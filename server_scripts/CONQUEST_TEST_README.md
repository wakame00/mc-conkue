# Conquest superflat test

1. Create a new superflat world in Creative mode.
2. Each tester joins with `/conq join red` or `/conq join blue`.
3. An operator starts the round with `/conq start` once both factions have at least one player.
4. Five white-wool markers are prototype flags. Stand within 16 blocks to capture one.
5. Tickets start at 300. A death costs one ticket; controlling more flags drains the other faction every five seconds.

Commands:

- `/conq join red|blue` — join or switch faction.
- `/conq start` — operator only; starts a waiting round.
- `/conq reset` — operator only; resets flags and tickets without starting.
- `/conq stop` — operator only; stops the active round.
- `/conq status` — displays the current state and tickets.

The complete test-map layout is in `conquest_prototype.js`. For MAIKURA CITY, replace the five flag coordinates and two base coordinates only.
