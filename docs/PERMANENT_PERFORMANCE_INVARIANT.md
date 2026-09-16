# Permanent Ainkrad performance invariant

This rule is mandatory for every future Ainkrad version, ZIP and commit package and for every assistant/Work session operating on the project.

> No optimization may improve performance by reducing the life of the world: NPC/Spark decisions, movement, exploration, learning, social behavior, families, consent, pregnancy/birth processing, professions, adventures, trade, settlement development, or previously accumulated world data.

## What this forbids

- Reducing semantic decision/action opportunities per world year as population grows.
- Skipping exploration, learning, family or social processing merely to hit a target speed.
- Making later generations less active than founders because the scheduler is sampling them less often.
- Deleting, truncating, resetting or silently ignoring committed maps, knowledge, memories, relationships, pregnancies, routes, resources or history to save CPU/RAM.
- Calling a behavior change a "performance optimization" when residents can now do less in the same amount of world time.

## What is allowed

- Indexing and better data structures.
- Correctly invalidated caches.
- Incremental/local recomputation instead of full-world recomputation.
- Batching equivalent persistence/rendering work while still executing every semantic world quantum.
- Removing duplicate calculations.
- Bounded UI/hot-history projections when the authoritative committed evidence remains intact.
- Worker/off-thread execution or other implementation changes that do not alter autonomous semantics.

## Mandatory acceptance gate

Before a future package is called ready, compare it with the latest accepted checkpoint using equal world time on a fixed seed and, where possible, an identical saved-world snapshot.

Check both performance and semantics:

1. wall time, CPU and memory;
2. ordinary action opportunities per world year;
3. movement/exploration and frontier progress;
4. learning/teaching and intergenerational skill continuity;
5. family meetings, independent consent decisions, pregnancies and births;
6. population, ages, births and deaths;
7. maps, knowledge, relationships, resources and other save data before/after reload/migration;
8. trade/adventures/settlement development where relevant.

If performance improves by materially reducing autonomous life, or if accumulated data is lost, the optimization fails and must not ship.

This invariant may be strengthened later, but it may not be weakened or removed without the user's explicit instruction.
