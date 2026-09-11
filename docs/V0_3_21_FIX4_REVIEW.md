# Ainkrad FIX4: responsive external clock

Base: d2a3463540e5b931847f2b09980ea6df6b16b884 (the owner's published FIX3).
Working branch only; main and deployments remain under the owner's control.

## Diagnosis
A diagnostic run on the unchanged base reproduced 100 queued years still present after switching to real time.
A naturally evolved 27-year world had 260 living residents and 129 places.
One subsequent world year in single-quantum batches took 15.43 seconds in Node/GitHub Actions; the CPU profile was dominated by full-state structured cloning.
These are synthetic CI observations, not measurements on the owner's phone or Xbox.

The worker's 80 ms batch-size target included large fixed snapshot costs. Slow snapshots therefore forced one-quantum batches, repeating those same costs.
An outcome-journal lookup cloned the entire world just to read its ID, epoch and time.
Browser anchors conflated committed time and requested future time. During restoration, stale full frames could overwrite progress; reloads added time spent calculating to the unfinished target.
Changing the selected speed did not withdraw either live or offline pending work.

## Changes
- Browser live acceleration has an eight-quantum queue ceiling. Excess requested acceleration becomes a lower measured rate; the world calendar never jumps over unprocessed events.
- Explicit deterministic replay APIs retain their exact-target behavior. The browser explicitly enables the capacity limit.
- External clock commands apply between atomic commits. Lower speed and the stop button cancel only uncomputed requests. World state and Cardinal records are not reset.
- Clock revisions reject stale cross-tab targets and frames. Stop intent is persisted before sending the worker command, including before the first frame.
- Version-2 timing anchors separate committed progress and a fixed catch-up target. Time spent restoring does not enlarge that target. Version-1 anchors remain readable.
- Closed-tab time defaults to ordinary time, visibly selectable as accelerated background time. Existing pending historical requests remain available until the user stops them.
- Four-to-eight quantum batches amortize snapshot overhead. Transaction failure recovery can still reduce to one quantum and keeps that smaller ceiling.
- Outcome metadata reads use the immutable internal state view; public snapshot isolation remains intact.
- Fractional catch-up reaches exact Cardinal calendar boundaries. The most recent evaluated experience is reflected in the next UI frame.
- New clock mechanisms and UI live in separate modules; browser.ts is smaller. WorldEngine, resident learning, movement, layouts, secret libraries and persistence transactions are unchanged.

## Release audit
Gates are recorded in the generated FIX4_AUDIT.json after CI passes.
Targeted tests cover 50/100-year settings, sustained saturation, lower-speed cancellation, an in-flight commit, stale commands, restart before acknowledgement, legacy backlog, progress persistence, background modes, epoch isolation, exact Cardinal boundaries and IndexedDB world/journal continuity.
The benchmark compares identical naturally evolved worlds on the base and the patch, then compares one mature year with old and new batch scheduling, asserting identical resident/world state and RNG except the transaction revision.

Resident autonomy and the independent Gateway remain protected. Clock control does not grant Cardinal a resident, thought, identity or decision writer. Convex is not used.
World ID, IndexedDB name and schema, backups, genealogy, deaths, knowledge and RNG are retained.
New metadata uses one replacement localStorage entry, and queues are bounded. No new world-history collection or background service is added.
Existing event and memory histories remain append-only; this release does not claim they have a new global byte ceiling.
No deployment or actual-device verification is part of this audit.

## Limits
100 world years per real minute is a requested ceiling. A device cannot guarantee it for an arbitrarily complex autonomous world.
The browser cannot run a persistent server while closed. Accelerated offline progression is an explicit option that necessarily requires computation on return.
A stop takes effect after the current atomic batch. A slow browser snapshot or transaction cannot be preempted midway without risking continuity.
The original browser save was not supplied; synthetic compatible saves and the published code are tested.
Different origins retain separate browser worlds. Data deleted from all browser storage cannot be reconstructed without a surviving backup.
