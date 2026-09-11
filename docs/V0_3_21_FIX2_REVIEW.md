# Ainkrad 0.3.21 hotfix 2

Base: cfbf8f7938efd373fd5b67db6645847f315420e3 in zejev1/ainkrad-v0.3.

## Release audit

The final archive is produced only after typecheck, the complete test suite and a production build succeed. Its generated FIX2_AUDIT.json records the tested commit and actual test counts. This review describes implementation boundaries; it is not a substitute for those results.

- Library admission is checked in perception, testimony, intended destination, route construction, exact arrival and reading. Travelling and studying share five slots per library. Annual selection receipts survive the expiry of visits. Human and elf libraries have separate receipts and race checks. The 100-entry visit history is independent of knowledge and append-only biographical memory.
- Overfilled old saves retain the oldest eligible admissions. Extra occupants walk to the public entrance; an incoming unauthorised traveller reverses the travelled portion without teleportation or false completed-road credit. Former readers retain their knowledge.
- Layout version 2 uses metre-scale plots and shared curved lane waypoints. Existing place IDs, ownership and social membership remain intact. Fields and outskirts track the built perimeter. Construction updates geometry; map rendering does not. Migration reprojects local movement and retains road traversal counters. Distant homeland centres are not relocated.
- The settlement list counts living residents by home, includes all existing peoples and moves only the observer camera. It sends no command to the worker, world, NPC or Cardinal.
- IndexedDB retains its database name and world ID. Database schema version 2 adds identity markers and three rotating pre-migration snapshots with append-only control-stream head references. World/events/memories/operation/identity writes remain one transaction. Read errors, malformed records and missing known worlds stop startup. Failed checkpoint or migration cannot overwrite the current world. Cardinal streams, family records, death evidence and RNG are not reset.
- Reload no longer fabricates a new settlement-appraisal timestamp or reorders valid admissions. Visible storage diagnostics show origin, world ID, epoch, revision and calendar; loading time and current saved time are distinguished.
- Cardinal, external boundary gateways, personality and learning algorithms are unchanged. Existing OFF/OBSERVER, gateway causality, autonomy, families, mortality, learning, journal and viewport tests remain required.
- Existing map culling, resident-over-building layers and viewport pixel limits are retained. New cold-path geometry modules do not allocate textures or canvas surfaces at world-map scale.

## Practical limits

The two supplied Vercel hostnames are different origins if neither redirects. They therefore use separate browser storage. This patch does not copy worlds across origins, and the deployments were not probed again. A database erased together with all site data cannot be recovered without an independent surviving copy.

Migration backups are bounded snapshots in the same browser database, not protection against deletion of that entire database. Control journals remain append-only; backup manifests refer to their retained heads. Automatic rollback is deliberately not performed over newer evidence.

The reported acceleration error has no supplied stack trace or failing save. Clock, catch-up, library and IndexedDB paths are tested; the original device failure must not be described as reproduced or certainly fixed.

No Android/Xbox thermal or hardware test and no new millennial soak is claimed. Existing browser smoke tests may inspect source rather than drive an actual browser.

## Delivery

GitHub writes were explicitly authorised for work/ainkrad-v021-fix2 and a draft PR only. Main is not modified and the PR is not merged. Vercel deployment is disabled for that temporary branch. Packaging restores the base deployment configuration and CI file for the user's SPCK checkout, whose main HEAD remains the base commit with reviewable changes.

Before a user Commit/Push in SPCK, use Git email zejev1@users.noreply.github.com.
