# Game Server — Implementation

## Overview

Multiplayer game server inside NestJS backend (`backend/src/`). Players queue for a gamemode, get placed into a game, send HTTP actions, receive state updates via WebSocket.

---

## Module Structure

```
backend/src/
  game/                     # Game session logic
    game.ts                 # Game class (id, state, players, map, toJSON)
    game-map.ts             # GameMap (tile grid), Tile, Entity
    gamemode.config.ts      # Gamemode enum, GamemodeConfig, hardcoded "casual"
    game.service.ts         # launchGame, queueAction, tick loop, getGame
    game.controller.ts      # POST /game/:gameId/action, GET /game/:gameId
    game.gateway.ts         # Socket.io /game namespace, joinGame/leaveGame rooms
    game.module.ts
  queue/                    # Queue + matchmaking
    queue-dao.ts            # RAM queue storage per Gamemode
    queue.service.ts        # join/leave queue, countdown timer, launch trigger
    queue.controller.ts     # POST /queue/join, POST /queue/leave
    queue.gateway.ts        # Socket.io /queue namespace, subscribe/unsubscribe
    queue.module.ts
  dao/
    game-dao.ts             # Game storage (RAM + MongoDB persist on writes)
    UserDao.ts              # Existing user DAO
```

---

## Components Implemented

### 1. Gamemode Config
- `Gamemode` enum (`Casual = 'casual'`)
- `GamemodeConfig` interface: `maxPlayers`, `startMinPlayers?`, `startTimerSeconds`, `mapWidth`, `mapHeight`, `winCondition`
- Hardcoded in `gamemode.config.ts` — `GAMEMODE_CONFIGS: Record<Gamemode, GamemodeConfig>`

### 2. Queue System
- `POST /queue/join { gamemode }` — add player to queue
- `POST /queue/leave { gamemode }` — remove player from queue
- When queue length reaches `startMinPlayers` → 15s countdown starts
- On timer expiry → game launches automatically
- Queue gateway pushes real-time events to subscribed clients

### 3. Queue Gateway (`/queue` namespace)
- `subscribe { gamemode }` — client joins gamemode room
- `unsubscribe { gamemode }` — client leaves gamemode room
- `countdownStart { gamemode, seconds }` — pushed when timer starts
- `gameFound { gamemode, gameId, players }` — pushed when game launches

### 4. Game Session
- `Game` class: id (UUID), state (`waiting` → `running` → `finished`), gamemode, players, map, createdAt
- `GameMap`: tile grid (`Map<string, Tile>`), entity registry (`Map<string, Entity>`)
- Stored in `GameDao` (RAM) + persisted to MongoDB on writes

### 5. Map
- Discrete tile grid: `width x height` tiles, keyed by `"${x},${y}"`
- Default terrain: `grass`
- `Tile`: `{ terrain, entityId? }`
- `Entity`: `{ id, ownerId, type, x, y, state }`
- Entities reference tiles via `entityId`

### 6. Action Queue + Game Tick
- `POST /game/:gameId/action { type, payload }` — validated immediately, queued
- Returns `{ accepted, actionId }` — reliable HTTP handshake
- Per-game tick loop (`setInterval`, configurable `tickRateMs`) drains action queue
- Tick processes actions, advances simulation, checks win condition
- After tick → broadcasts `stateUpdate` to game room
- On win → game state set to `finished`, tick stopped, persisted

### 7. Game Gateway (`/game` namespace)
- `joinGame { gameId }` — client joins game room (receives state updates)
- `leaveGame { gameId }` — client leaves game room
- `stateUpdate` — broadcast to game room after each action
- `gameFound { gameId, players, gamemode }` — broadcast to all players when game starts

### 8. Persistence
- `GameDao`: writes to RAM (`Map<string, Game>`) + MongoDB collection `games`
- Reads only from RAM
- Queue data is RAM-only

---

## API Reference

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/queue/join` | `{ gamemode }` | Join queue |
| POST | `/queue/leave` | `{ gamemode }` | Leave queue |
| POST | `/game/:gameId/action` | `{ type, payload }` | Queue action → `{ accepted, actionId }` |
| GET | `/game/:gameId` | — | Get game snapshot |

## WebSocket Namespaces

### `/queue`
| Event | Direction | Payload |
|-------|-----------|---------|
| `subscribe` | Client→Server | `gamemode` |
| `unsubscribe` | Client→Server | `gamemode` |
| `countdownStart` | Server→Client | `{ gamemode, seconds }` |
| `gameFound` | Server→Client | `{ gamemode, gameId, players }` |

### `/game`
| Event | Direction | Payload |
|-------|-----------|---------|
| `joinGame` | Client→Server | `gameId` |
| `leaveGame` | Client→Server | `gameId` |
| `stateUpdate` | Server→Client | `Game.toJSON()` |

---

---

## Frontend — Angular + Phaser 3

### Overview
- Angular 18 standalone app (`frontend/`) with two main views
- **Home view**: self-built HTML/CSS UI (lobby, queue, match history)
- **Game view**: Phaser 3 canvas rendering the game state
- Socket.io client connects to both `/queue` and `/game` namespaces

### Route Structure
```
/login              LoginComponent      — OIDC auth
/home               HomeComponent       — Lobby (queue, gamemode select, settings) [existing]
/game/:gameId       GameComponent       — Phaser 3 canvas, receives state updates
```

### Component Tree
```
AppComponent (RouterOutlet)
├── LoginComponent       — OIDC login redirect
├── HomeComponent        — Lobby UI (hand-built, no framework UI lib)
│   ├── GamemodeSelect   — Pick gamemode, show player count
│   ├── QueueStatus      — Queue joined, countdown timer, players in queue
│   └── MatchFoundModal  — "Game found!" overlay → navigate to /game/:id
└── GameComponent        — Phaser 3 boot wrapper
    └── PhaserGame       — Phaser.Game instance in a <div> container
```

### Phaser 3 Integration
- `GameComponent` creates `Phaser.Game` inside `ngAfterViewInit`
- Phaser scenes: `BootScene` → `GameScene`
- `GameScene` receives game state from Angular via a shared service or Input
- Each `stateUpdate` WS event → `GameScene.updateFromState(json)` → reconcilies entities
- Player actions sent via HTTP `POST /game/:id/action` (Angular `HttpClient`)

### Socket.io Client Service
- Separate service per namespace or one service with namespace switching
- `/queue` namespace:
  - `subscribe(gamemode)` on entering lobby
  - Listen `countdownStart`, `gameFound`
  - `unsubscribe(gamemode)` on leaving lobby
- `/game` namespace:
  - `joinGame(gameId)` on entering game view
  - Listen `stateUpdate` → forward to Phaser scene
  - `leaveGame(gameId)` on leaving game view

### Data Flow
```
Lobby:
  User clicks "Join Queue" → POST /queue/join → WS subscribe /queue
  Server emits countdownStart → UI shows timer
  Server emits gameFound → navigate to /game/:gameId

In-Game:
  User clicks/taps on map → build Action object
  POST /game/:gameId/action { type, payload }
  Server queues action → processes on next tick
  Server broadcasts stateUpdate via WS /game
  Phaser scene updates entities from state
```

### Folder Structure (planned additions to `frontend/src/app/`)
```
components/
  game/
    game.component.ts         — Phaser host, WS lifecycle
    game.component.html       — <div #phaserContainer>
    game-scene.ts             — Phaser.GameObjects, render tiles/entities
  queue/
    queue-status.component.ts — Timer, player count, leave button
service/
  socket.service.ts           — Socket.io client (queue + game namespaces)
  game-api.service.ts         — HTTP calls: queue/join, queue/leave, game/action
```

### Dependencies to Add
- `socket.io-client` — WebSocket client
- `phaser` — Game framework (v3.x)
- Max 25 lines per function body
- Max 2 nesting levels
- Max 4 parameters
- One class per file
- Class token injection over string tokens
- Simpler solution preferred
