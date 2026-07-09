---
name: phaser3-multiplayer-game
description: "Expert Phaser 3 architecture and development for multiplayer turn-based strategy games using Angular and TypeScript with a NestJS authoritative server. Actions: plan, architect, build, implement, refactor, optimize, debug, review, and extend Phaser code. Topics: scenes, tilemaps, cameras, input, entity systems, rendering, animations, path visualization, selection, game objects, sprite management, asset loading, performance, interpolation, networking, synchronization, and state management. Backend integration: HTTP action queues, WebSocket state updates, authoritative server simulation, matchmaking queues, game sessions, and entity synchronization. Architecture: modular Phaser systems, Angular service integration, clean separation of client view state and server state, reusable game objects, ECS-inspired organization, and production-ready TypeScript. Constraints: one class per file, max 25 lines per function, max 2 nesting levels, max 4 parameters, dependency injection, maintainable code, and compatibility with the existing NestJS game backend."
---

# Skill: Phaser 3 Multiplayer Client (Angular + NestJS)

You are an experienced Phaser 3, Angular and TypeScript architect.

Your goal is to build and extend the frontend for a multiplayer turn-based strategy game whose backend already exists. You must NOT redesign the backend architecture. The frontend must adapt to it.

---

# Overall Architecture

Treat the frontend as four independent layers.

```
Angular
│
├── Pages
├── Components
├── Services
├── Signals / State
│
└── Phaser
      ├── Scenes
      ├── Systems
      ├── Game Objects
      ├── Input
      ├── Camera
      └── Rendering
```

Angular owns:

- Routing
- Menus
- HUD
- Matchmaking
- Chat
- Inventory
- Loading screens
- Settings

Phaser owns:

- Rendering
- Camera
- Input
- Tilemap
- Animations
- Selection
- Unit visualization

Never put Angular components inside Phaser.

Never manipulate the DOM from Phaser.

Communication happens through Angular services.

---

# Backend

The backend already contains

- Queue system
- Game sessions
- Tick-based simulation
- HTTP actions
- WebSocket updates

Respect the existing API.

Queue

POST /queue/join

POST /queue/leave

Game

POST /game/:gameId/action

GET /game/:gameId

WebSocket

/queue

/game

Never invent new endpoints unless explicitly requested.

---

# Networking Philosophy

The backend is authoritative.

The frontend is only a visualization.

Never execute gameplay locally.

Never calculate damage locally.

Never calculate movement locally.

Never determine wins locally.

The frontend may

- highlight tiles
- preview paths
- animate movement
- interpolate entity positions
- predict UX

but the official game state always comes from

stateUpdate

received over WebSocket.

---

# State Management

Maintain three different states.

## Server State

Exactly mirrors

Game.toJSON()

Received from

GET /game/:id

and

stateUpdate

Never mutate this object manually.

---

## Client View State

Contains things like

selectedEntity

hoveredTile

cameraPosition

currentPath

cursor

animation queues

This state never gets sent to the backend.

---

## Temporary Animation State

Animations should survive even if the next server update arrives.

Movement interpolation

Attack animations

Effects

Camera pans

must not mutate the server state.

---

# Phaser Structure

Prefer this structure.

```
game/

    scenes/

        BootScene.ts

        LoadingScene.ts

        GameScene.ts

    systems/

        InputSystem.ts

        CameraSystem.ts

        EntitySystem.ts

        SelectionSystem.ts

        AnimationSystem.ts

        GridSystem.ts

    entities/

        UnitSprite.ts

        BuildingSprite.ts

    map/

        Tile.ts

        TileRenderer.ts

    networking/

        GameSocket.ts

        QueueSocket.ts

        GameApi.ts

```

Systems should be small.

Avoid huge GameScene files.

GameScene coordinates systems.

---

# Rendering

Use Phaser Tilemaps when possible.

Each entity owns one sprite.

Never recreate sprites every update.

Instead

Create once.

Update position.

Update texture.

Play animation.

Destroy when removed.

---

# Entity Synchronization

Each Entity has

id

ownerId

type

x

y

state

Maintain

Map<string, UnitSprite>

When stateUpdate arrives

Compare incoming entities against current sprites.

Create missing sprites.

Update existing sprites.

Destroy removed sprites.

Never clear and rebuild the scene.

---

# Movement

Movement comes from backend updates.

If

```
x,y
```

changes

animate from old tile to new tile.

Never teleport unless explicitly requested.

---

# Camera

Camera is client only.

Support

wheel zoom

drag

edge scrolling

smooth panning

Camera state should never be synchronized.

---

# Selection

Selection is client-only.

Click

↓

Select unit

↓

Highlight reachable tiles

↓

Click destination

↓

POST action

↓

Wait for server

↓

Animate after stateUpdate

Never move immediately after clicking.

---

# Actions

Every gameplay interaction becomes an HTTP action.

Example

```
POST /game/:gameId/action

{
    type: "move",

    payload: {
        entityId,
        x,
        y
    }
}
```

Wait for

```
{
    accepted,
    actionId
}
```

Do not assume success until the server broadcasts a new state.

---

# WebSockets

Queue namespace

Subscribe

Receive

countdownStart

gameFound

Game namespace

Join room

Receive

stateUpdate

Reconnect automatically.

Rejoin rooms after reconnect.

---

# Angular Services

Prefer

GameApiService

QueueApiService

GameSocketService

QueueSocketService

GameStateService

SelectionService

Never let Phaser perform HTTP requests directly.

---

# Performance

Target

60 FPS

Avoid allocations inside update().

Reuse vectors.

Reuse arrays.

Avoid creating objects every frame.

Avoid

```
entities.map(...)
```

inside update loops.

Prefer

for...of

---

# Coding Style

Always use strict TypeScript.

Prefer readonly.

Prefer composition.

Avoid inheritance unless Phaser requires it.

One responsibility per class.

Small methods.

Meaningful names.

---

# Constraints

Respect these project rules.

- max 25 lines per function

- max 2 nesting levels

- max 4 parameters

- one class per file

- simple code over clever code

- dependency injection where possible

- avoid singleton globals

---

# When Generating Code

Always produce production-quality code.

Never leave TODO placeholders.

Never generate pseudo-code.

If multiple files are required, generate the complete file tree first.

Then generate each file completely.

Use modern Phaser 3 APIs.

Assume TypeScript 5.x.

Assume Angular 20.

Assume ES2023.

Prefer maintainability over micro-optimizations.

When uncertain, preserve compatibility with the existing backend rather than introducing frontend-side game logic.