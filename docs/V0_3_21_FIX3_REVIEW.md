# Ainkrad 0.3.21 hotfix 3 — missing founding sea

Base: 68fdaabfc0ea4ae6cae1c6232141d2088dcc3684 in zejev1/ainkrad-v0.3, committed by the owner from the verified FIX2 ZIP.

## Report and cause

The Android screenshot reports: `World place shore references missing connection ocean_ainkrad.`
Its storage identity is ainkrad_live_world, epoch 2, revision 7418, with approximately 810597 world minutes. The user save itself has not been supplied.

Initial creation includes the physical sea. The separate resetEpoch constructor omitted it.
Natural exploration then creates the founding shore with an ocean_ainkrad connection. Strict validation rejects that expansion. A faster clock reaches the broken boundary sooner; changing speed is not itself the graph corruption.

The CI regression runs the published base in a detached checkout, starts epoch 2 through LiveWorldRuntime.resetWorld and advances the actual year-per-minute clock. It must catch the exact reported error and verify that the failed mutation did not replace the saved world. The generated FIX3 audit contains the observed reproduction position.

## Change and release audit

- One small FoundingOcean module owns the same sea definition used by initial creation and explicit epoch resets. Its coordinates, water polygon and bounds are unchanged from FIX2.
- Compatible-save repair adds only this known omitted sea and connects an already discovered shore reciprocally. It never creates a shore early or substitutes arbitrary missing places.
- Migration retains the current ID, epoch, calendar, population, deaths, lineage, memories, RNG, relationships, personality, learning and cultural evidence. A pre-migration snapshot is required by the existing persistence path before the repaired revision can commit. Backup failure leaves the original record intact.
- Existing ocean geometry and explicit boat routes are retained. No implicit walking connection to water is created. Route traversal counters remain intact.
- A second open is idempotent: no repeated repair, clock advance or accumulating backups. The existing limit of three recovery snapshots remains unchanged.
- The older unsurveyed-homeland cleanup used to drop every missing target, masking unrelated corruption during open. It now keeps unknown dangling edges for strict validation while still removing actual unsurveyed inter-homeland shortcuts. The repair does not hide errors or create a replacement world.
- The live x1/x10 clock and bounded offline catch-up continue across shoreline discovery, reload and further acceleration. IndexedDB regression retains nonzero Cardinal experience and append-only journal records. It compares experience against the durable journal: a pre-reload display can lag behind completed catch-up evaluations.
- Cardinal, Gateway, persistence algorithms, resident learning, library admissions, settlement geometry, settlement selection, viewport culling and canvas limits are unchanged. The full existing architecture and regression suite remains required.
- WorldEngine contains only the necessary integration; its total size decreases. Browser and worker changes only identify this software version. The worker frame protocol is not a save key and is not blamed for this failure.

## Validation and limits

The ZIP is generated only after the exact baseline error is reproduced, typecheck, the complete test suite and production build all pass. The generated FIX3_AUDIT.json records the actual tested commit and test counts; FIX3_FILES.json records packaged source hashes.

No real phone/Xbox execution, thermal test or inspection of the original browser database is claimed. The supplied screenshot now identifies a reproducible defect, but any additional device-specific error still needs its own evidence.

Browser worlds at separate origins remain separate. Backups inside the same database cannot recover data erased with all site data.

## Delivery

Only the previously authorised temporary branch and draft PR are updated. Main is not written or merged, and no deployment is invoked. The existing branch deployment guard is retained.

The SPCK ZIP has a normal main checkout at 68fdaabfc0ea4ae6cae1c6232141d2088dcc3684, the correct origin, and uncommitted FIX3 changes. Its deployment config and main CI file are restored from that base.
Git email for the owner's Commit/Push: zejev1@users.noreply.github.com.
