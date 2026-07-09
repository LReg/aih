# Game: AI Horde

## Overview

Turn-less real-time strategy on a discrete tile grid. Each player controls soldiers. Goal: eliminate all enemy soldiers or be the last standing when timer expires.

---

## Map

- 500×500 tile grid (configurable per gamemode)
- Default terrain: `grass`
- Each tile holds at most **one entity** (soldier or building)
- Entities block movement and placement

---

## Spawn

- Each player starts with **one soldier**
- Soldier spawns at a **random empty tile** on the map
- Positions are guaranteed to be at least 3 tiles away from any other spawn

---

## Entity: Soldier

| Property | Description |
|----------|-------------|
| HP | 1 (dies from any attack) |
| Move range | 3 tiles per action |
| Attack range | 1 tile (adjacent) |
| Actions | `walk`, `attack`, `build_barracks` |

Soldier can receive **one command at a time**. After command is issued, soldier executes it. Soldier is idle when no command is active.

### Command: `walk`

**Request:**
```json
{ "type": "walk", "payload": { "entityId": "uuid", "x": 5, "y": 8 } }
```

**Checks (all must pass, else `{ accepted: false }`):**
1. Game state is `running`
2. Entity exists, owned by this player, status is `idle` or `ready`
3. Target tile `(x, y)` is within map bounds
4. Target tile is empty (no entity on it)
5. Manhattan distance from entity to target ≤ `soldierMoveRange` (3)
6. There exists a path of empty tiles from entity to target

**Result on accept:**
- Entity state = `moving`
- After 1 tick: entity position updates to target, state back to `idle`

### Command: `attack`

**Request:**
```json
{ "type": "attack", "payload": { "entityId": "uuid", "x": 5, "y": 8 } }
```

**Checks:**
1. Game state is `running`
2. Entity exists, owned by this player, status is `idle` or `ready`
3. Target tile `(x, y)` is within map bounds
4. Manhattan distance from entity to target = 1 (adjacent)
5. Target tile contains an enemy entity (not own, not null)

**Result on accept:**
- Target entity destroyed (removed from map)
- Attacking entity stays in place, state = `idle`

### Command: `build_barracks`

**Request:**
```json
{ "type": "build_barracks", "payload": { "entityId": "uuid" } }
```

**Checks:**
1. Game state is `running`
2. Entity exists, owned by this player, status is `idle` or `ready`
3. Entity type is `soldier`
4. At least one adjacent tile (N/S/E/W) is empty and within map bounds

**Result on accept:**
- Entity state = `building-barracks`
- Entity **cannot receive any further commands** — all check #2 fails while in this state
- After `barracksBuildTime` seconds: barracks entity placed on nearest empty adjacent tile
  - If multiple equidistant: picks N > E > S > W
- Soldier state back to `idle`
- Soldier does **not** die

---

## Entity: Barracks

| Property | Description |
|----------|-------------|
| HP | 3 |
| Status while building | `building` |
| Status after build | `ready` |
| Production | 1 soldier per `soldierProductionTime` seconds |
| Blocks tile | yes, blocks movement and building placement |

### Construction Phase

- When `build_barracks` command completes, barracks entity is created on target tile
- Barracks starts with status `building`
- During `building`: barracks cannot be targeted for attack (it's under construction)
- After `barracksBuildTime` seconds → status changes to `ready`

### Production

- Every `soldierProductionTime` seconds, barracks produces **one soldier**
- Soldier spawns at the nearest empty tile adjacent to barracks
- If no adjacent tile is empty, production is queued (max queue: 5)
- When a tile opens up, the next soldier spawns immediately

---

## Win Condition

- When one player has eliminated all other players' entities
- If time runs out: player with most entities wins
- Draw if equal

---

## Gamemode Config Defaults

```ts
Casual: {
  maxPlayers: 4,
  startMinPlayers: 2,
  startTimerSeconds: 15,
  tickRateMs: 200,
  mapWidth: 100,
  mapHeight: 100,
  barracksBuildTime: 60,       // seconds
  soldierProductionTime: 60,   // seconds
  soldierMoveRange: 3,
  soldierAttackRange: 1,
}
```
