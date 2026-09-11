# Ainkrad 0.3.21-hotfix.5

Base: 339970d2b2ca0545415b11460bb58b7c164915f4 (the owner's main with FIX4).
Work remains in the explicitly authorized temporary branch and draft PR. No main update, PR merge, deployment or deployment inspection is part of this work.

## Time and persistence
The first native Chromium profile of the old code found repeated full-world decoding and duplicate structured clones around IndexedDB transactions. Reads now use the small identity/revision head atomically written with the world; key existence is verified, and legacy heads still require full-record validation. IndexedDB already copies stored values, so redundant copies were removed. Public snapshots and rollback isolation remain separate copies.

Calculation yields to worker commands between completed canonical quanta. Stop commits the completed portion and withdraws only unprocessed requests. A partial transaction has its own absolute-time receipt; it cannot consume the idempotency identity of a still-unreached target. Runtime accounting debits actual committed time and stops after an in-flight cancellation. Offline batches normally contain 8–16 quanta; failed transactions can still retry one quantum. Each existing resident quantum executes; no simulated years or biographies are fabricated to meet the selected speed.

Time receipts now have bounded retention (2048 recent revisions, swept every 300 revisions, at most 4096 removals per sweep). Other operation receipts, world evidence, memories and Cardinal/Gateway journals are excluded. Existing historical backlog is removed gradually. This does not impose a byte ceiling on accumulated lived history.

The database name, world ID and schema stay unchanged. Pre-migration checkpoints retain at most three snapshots. Read errors and migration failures propagate instead of creating a replacement. Browser deletion of all site data still requires an independent surviving backup for recovery.

## Physical geography
Settlement layout version 3 is surveyed on migration or construction. Irregular curved lanes, branches, rotated parcels, dry field polygons outside built boundaries and actual outskirts share world coordinates with the routes. Opposing home parcels allow approximately 4.5–5 metres for their lane; all building footprints retain at least 3 metres of clearance. Rendered local roads use a 3-metre carriageway. The central plaza is an open public place, not a road-width measurement.

The survey applies to settlement records for all sapient races. IDs, ownership, families, roles, knowledge, memories and homeland centres remain. The migration changes internal geometry; it does not shorten the approximately thousand-kilometre distances between peoples. Route traversal counts remain attached to route IDs. Residents on affected local journeys are reprojected with their progress; long-distance travellers use the nearest point on the rebuilt path. Unavailable routes end safely instead of inventing water traversal. Library relocation also preserves its recorded anchor and admission rules.

Forests, meadows, mountains, wetlands and farms have bounded surveyed polygons. Lakes and rivers have separate water polygons beside their accessible bank. Dry routes detour around these polygons and building footprints; boats and bridges still require explicit world routes. Existing founding-sea geometry is preserved.

This is a coherent vector atlas of the modelled world. It does not claim satellite imagery, a global elevation model, hydrological erosion, or unseen continents that the simulation has never generated. Future movement may differ because the physical layout has changed; already lived history is retained.

## Observer interface
The header contains only version and world level. Technical persistence information, status details and Cardinal level are in closed diagnostics. The visible term is world time, not game time.

The atlas has world, region, settlement, street and building detail levels. Stable roof details appear nearby; labels are decluttered. Touch pinch, drag, wheel, double-click and keyboard gestures affect the camera only. Town selection retains the resident selection and does not grant NPC discoveries. The browser audit pauses through the existing external pause channel when comparing the entire state before/after observer selection, so normal live motion cannot be mistaken for a selector mutation.

Rendering is clipped to a viewport capped at 1280 × 800 pixels. The spatial index is rebuilt on geometry revision, with a 64-entry tile cache, 180 place nodes, 120 resident nodes, 300 visible area candidates and at most 1600 visible road segments. Zoom never creates a planet-sized canvas. Residents remain above roofs.

## Release audit
The generated FIX5_AUDIT.json records the exact tested commit, typecheck, full test count, production build, native-browser checks and performance samples. It is created only after all gates pass. FIX5_FILES.json hashes the delivered tested sources.

Checks cover old-save migration and checkpoint failure, IndexedDB atomic rollback, Cardinal evidence continuity, deterministic time partitions, in-flight cancellation and resume, reload after stop, library year boundaries and former-visitor exclusion, physical street/water clearance, different-race settlements, once-only layout, preserved road counts and observer immutability.

Existing coordinate-specific library tests now check the persisted local anchor and its stability instead of requiring the former straight-grid coordinate. The overlapping-live/offline-time regression accounts for the actual size of the completed adaptive batch and still checks that total time is charged once. No autonomy or learning assertions were removed.

Protected Cardinal, Gateway/boundary and resident-learning implementations are unchanged. Outside timing still passes through the independent Gateway; no resident thought, identity or decision writer is exposed to Cardinal. Convex is not used.

The Alicization comparison from FIX4 remains in V0_3_21_FIX4_ALICIZATION.md. Its engineering principle is preserved: internal years have lived consequences while an external clock selects the requested rate. It is not a hardware-performance promise derived from fiction.

## Limits of verification
Measurements use Chromium, real IndexedDB, an isolated 390 × 844 mobile viewport and a separate 4× CPU-throttled harness. Three fresh-profile samples compare a quarter-year of continuation from the same naturally evolved 27-year main-version save. Geometry migration occurs before the timer. This is not a physical Android or Xbox test and not the owner's unavailable save.

A browser storage commit cannot be interrupted halfway safely; stop is acknowledged after the completed portion is saved. A mature century can still require substantial computation. Selected acceleration remains a ceiling, with bounded pending work and visible achieved throughput.

The ZIP is a main checkout at the stated base with the tested changes uncommitted, correct GitHub origin and email zejev1@users.noreply.github.com. Branch-only CI and deployment guard settings are restored to the main versions in that checkout. The user makes the final commit and push through SPCK.
