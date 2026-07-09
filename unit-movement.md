# Unit Movement and Attack Logic

## Goal

This document describes the basic behavior of soldiers when the player gives movement or attack commands.

The system should support controlling multiple soldiers at the same time.

The server is authoritative. The client only displays movement and attack animations.

---

# Multiple Unit Movement

The player can select multiple soldiers and give them one movement command.

Example:


Select 10 soldiers
↓
Click destination tile
↓
All soldiers move to that area


Each soldier needs its own target position.

Multiple soldiers must never move to the exact same tile.

---

# Movement Assignment

When multiple soldiers receive a movement command:

1. Calculate a path for each soldier.
2. Find available target tiles around the clicked destination.
3. Assign one target tile to each soldier.
4. Make sure every soldier has a unique destination.

Example:


Destination clicked:

 X

Assigned positions:

S S S
S X S
S S S


The soldiers should spread around the target location.

---

# Pathfinding

Soldiers use a grid-based pathfinding algorithm.

The path should:

- avoid blocked tiles
- avoid enemy occupied tiles
- avoid other friendly soldiers
- prefer the shortest available path

The path can change if:

- another soldier blocks the way
- terrain changes
- the destination becomes impossible

---

# Movement Update

Movement happens step by step.

Each game tick:

1. Check the next tile.
2. Verify that the tile is still available.
3. Move the soldier.
4. Continue until the destination is reached.

If the path is blocked:

- calculate a new path
- wait if another friendly soldier temporarily blocks the way
- stop if no path exists

---

# Attack Command

The player can select multiple soldiers and give an attack command.

Example:


Select 20 soldiers
↓
Click attack position
↓
Every soldier attacks independently


The clicked position is only the attack target area.

---

# Attack Target Selection

Every soldier chooses its own target.

For each selected soldier:

1. Search for the nearest enemy object around the attack position.
2. Move into attack range if necessary.
3. Attack that object.

Example:


Attack position

    Enemy A

Soldier 1 ---> Enemy A

    Enemy B

Soldier 2 ---> Enemy B


Different soldiers can attack different enemies.

---

# Attack Behavior

A soldier should:

1. Find the nearest valid enemy.
2. Move toward the enemy if outside attack range.
3. Stop when in range.
4. Perform attacks automatically.
5. Continue attacking until:
   - the target is destroyed
   - a new command is received
   - the soldier dies

---

# No Shared Movement Position

When many soldiers move together:

- they should spread out
- they should not overlap
- they should not occupy the same tile
- they should avoid blocking each other

The movement system must always assign unique positions.

---

# Deterministic Rules

The same situation should always create the same result.

If multiple soldiers want the same tile:

Priority is decided by:

1. Original selection order
2. Soldier ID as fallback

The result must always be reproducible on the server.

---

# Client Visualization

The client may show:

- planned paths
- attack ranges
- movement animations
- attack animations

The real position and state always come from the server.