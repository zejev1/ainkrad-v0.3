# PR5: causal settlement maps and bounded navigation work

Rework of `2ca2d99a9477e1b42a63d6f67b4c71ea9ffcdfc5` on main base
`b3bfd24aaff1a80c54abd3bfdc370395dc85631e`. Review as a draft. **No automatic merge**.

## Persistent knowledge, not repeated personal cartography

A physically completed survey creates a signed-by-resident observation (attribution,
not a cryptographic identity) in their carried notes. On returning to their own
settlement, they deposit observations, traversed routes and copies learned through
actual meetings. Another local traveller can consult that archive. Shared information
never increments the reader's personal exploration skill or cartographer achievements.

Each copy names an acquired revision. A known point upgraded to a surveyed point later
has its own first-survey revision: a traveller already away does not receive that upgrade.
A real conversation may transmit only the speaker's carried revisions and unpublished
notes, not the current state of a remote settlement. Survey attribution survives death,
ordinary teaching, migration and save/load. A lost explorer's unreported notes are not
magically inherited. Shared archives never include secret-library locations.

Home consultation is a simulation of local access/reporting, not a new physical paper,
ink, map-shop, translation or UI subsystem. Maps identify places and traversed connections;
they do not pretend to implement every aspect of realistic cartography or stale weather
reports. Existing individual observations may still provide known place names without a
completed survey. Old `mappedPlaceIds` are not trusted as survey evidence: older main
versions filled them at destination selection before actual arrival.

Private notes are consolidated into archive revision references after deposit to avoid
copying every surveyed-point payload onto every resident. The original personal practice
receipts remain personal. New repeated exploration at a mapped site is reported separately
as frontier searching, not another first cartographic discovery.

## Physical routes and computation

- Prepared polygon predicates preserve existing even/odd containment, edge intersection,
  ocean holes, and exact physical water/building rejection. BVH and y-band acceleration
  prune work, not physical rules. Polygon coordinates are copied into immutable scopes.
- Static feature indexes compute feature bounds once. A geometry-edit scope recreates local
  indexes; moved houses and same-length in-place water edits invalidate affected paths.
- A safe existing route is reused only against a runtime certificate of the actual route,
  endpoints, physical terrain recipe and relevant nearby obstacles. Save flags are not proof.
- A failed deterministic route search records the water/building query footprint plus all
  non-indexed endpoint, urban-centre and nearby rough-terrain inputs it read. The bounded
  runtime negative cache retries when any of those inputs changes. Distant discoveries
  alone do not repeat impossible construction. Reverse heuristic attempts remain separate.
- The exploratory candidate and actual movement use the same resident-known graph, not a
  global shortest path through unknown intermediate places. A longer known detour remains
  available. Physical geometry edits and boat discoveries invalidate in-place route caches.
- Normal embodied actions initialize/check the actor, not every body/item in the world.
  Full repair still runs at load and embodied-state boundaries. Newborn/death cleanup stays.
- A wallet lookup does not synchronize every dungeon. Independent dungeon synchronization
  remains in the world quantum, with explicit local checks on actual adventure attempts.
- Relationship adjacency and population summaries are reused without skipping residents'
  action/learning quanta. Individual prayers do not scan unrelated families or select an
  unused distant sacred location. Repeated camp/travel-unavailable messages use routine
  event sampling rather than unbounded exceptional-event logging.

People already on the road are excluded from their old origin's physical encounters.
Help, ordinary conversation, bonding and map exchange require real local presence. This
repair does not redesign gestation, force partners/births, change race life profiles, or
claim that the whole demographic model is solved. Cardinal/Gateway authority is unchanged.

## Verification and limitations

Run `npm run typecheck`, `npm test`, and `npm run build`.
Targeted tests include geometry edits and removed blockers, cold/save-cloned certificates,
local/remote map copies, author death and descendants, unread future revisions, library
isolation, real route completion, known detours, and no per-action global body scan.

Two old assertions were updated for changed interfaces, without suppressing failures:
1. The routing-failure test disconnects the real route graph instead of mocking the now
   unused global path helper. It still requires no movement/effort/false mapping credit.
2. Prayer-location assertions now match the existing production rule allowing prayer at
   home or outdoors. A focused test requires an actual prayer receipt at the unchanged
   physical position, no invented trip. Production/workplace assertions remain unchanged.

The portable benchmark evidence is provided separately. Compare both engines on the same
saved world as well as same-seed new worlds; count CPU and active action/learning work, not
just a green build. Timing/RSS of Node with an in-memory journal is not Android/IndexedDB
performance. Browser queue/time-contract tests do not prove 10/20/50/100 years per minute
on the user's device. No personal saved world was loaded or reset, and no permission to
merge into main is implied by the checks.
