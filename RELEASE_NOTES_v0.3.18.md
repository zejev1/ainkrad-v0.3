# Ainkrad v0.3.18

v0.3.18 is an additive Underworld-foundation release. It keeps the validated
v15/v16/v17 world and Cardinal experience while repairing mature-world
stagnation, work/place causality, closed-browser restoration and mobile
observability.

## Autonomous life and work

- Satiety and missed meals are persisted per resident. Meals consume personal
  or settlement food; elapsed time and Cardinal cannot invent stored food.
- Fifteen livelihood paths are inferred from repeated completed practice and
  personal fit. They are not assigned by quotas and may change with later life.
- Safe childhood chores can begin before adulthood. Hunting, combat and adult
  relationships retain race-specific physical age gates.
- Farming, gathering, hunting, crafting, building, prayer and reflection now
  finish only after physical arrival at a compatible place. A workshop cannot
  produce a remote crop and a route cannot teleport its result home.
- Repetition penalties and a social-skill ceiling stop conversation or prayer
  from becoming a permanent self-reinforcing first choice.

## Settlements and the frontier

- Residents appraise discovered reachable sites and independently decide
  whether to join an expedition. At camp every member independently confirms
  or rejects permanent settlement.
- Generation-zero founders may guide a group but remain rooted in Ainkrad.
  Only descendants can permanently found a frontier home.
- Settlement lifecycle evidence covers inhabited, declining, abandoned,
  ruined and occupied states. Reoccupation and resource transfer remain
  physical events; return and failure are valid expedition outcomes.
- Ordinary wolves and boars can defend territory but are materially less
  lethal than true monsters. Monsters still require physical co-location,
  attack, feed from reachable prey and leave recoverable remains after kills.

## Language, observer and UI

- Russian spoken comprehension, expression, vocabulary and Cyrillic literacy
  grow from conversations, teaching and writing.
- Recent observer-audible conversations retain structured evidence and bounded
  Russian utterances; the UI never fabricates dialogue.
- Cardinal receives read-only aggregates for satiety, mobility, profession
  diversity and action balance. Its independent gateway and prohibition on
  resident mind/action/identity writers are unchanged.
- The original 2D strategy presentation adds clearer roads, buildings, work
  zones, smaller residents, exact resident selection and three mobile text
  scales. No proprietary Age of Empires assets or code are copied.

## Closed-browser continuity

- The browser stores an epoch-scoped absolute catch-up target derived from the
  selected external speed. Reopening cannot double-add time across tabs.
- Every canonical resident quantum is still executed, while persistence and UI
  updates are batched. Critical low-population worlds use annual rather than
  sixty-day snapshot boundaries.
- The progress panel exposes percent, elapsed time and ETA. Final benchmarks
  completed 100 years in 15.573 s, 138 years in 24.516 s and 200 years in
  43.128 s in the release environment.

## Future foundation

- Player entry has schema and authority boundaries only. Production login,
  avatar control and playable entry remain disabled.
- Architecture invariants now require every later release to make a measurable
  step toward autonomous Underworld behavior and a truthful layered 2D-to-3D
  world, without replacing simulation with decorative data.

The final project is prepared as uncommitted changes on the read-only verified
GitHub parent `dad1dc0f72bd0883f801b93e3da4cae1587b6270` in
`zejev1/ainkrad-v0.3`. No commit, push, Vercel write or Convex connection was
performed by the assistant.

## 2026-09-07 mobile catch-up hotfix

- Closed-browser restoration now commits at most 24 semantic quanta per
  IndexedDB transaction. The reported day-300 plus 2.1-year restoration is
  split into six durable batches instead of one mobile-hostile transaction.
- A rejected durable batch is rolled back to the last committed state and
  retried at progressively smaller sizes: 24, 12, 6, 3 and 1 quantum.
- If even one quantum cannot be written, only offline catch-up is abandoned;
  the saved world continues from its last confirmed point instead of killing
  the live worker.
- A fatal worker from one stale tab is no longer broadcast as a false world
  failure to every other Ainkrad tab.
- Catch-up failures now expose their real message in the visible restoration
  panel instead of leaving an unexplained 0% indicator.
- The hotfix is prepared as uncommitted changes on GitHub parent
  `2a96ac62764db4df848543f16ed3d1d999dc650a`. The assistant performed no
  commit, push or Vercel write.

## 2026-09-07 cultural agency completion

- New children receive a parent- and culture-derived name with no visible
  sequence number. Existing saves repair only the exact old aliases such as
  `Ari 11`; user-authored names and stable person IDs are preserved.
- Conversation wording now combines the speaker's current work, place,
  family, resources, danger, relationship, personality and learned material.
  The bounded recent window rejects repeated rendered lines when another
  truthful wording is available.
- Secret Library records now influence matching voluntary action scores,
  strengthen only through matching lived practice and can move between two
  co-located residents through an actual conversation. Oral transfer grants
  partial understanding, never instant mastery.
- A 100-year OFF-mode audit reached 461 living residents across all four
  races. Its 496 native children had 496 distinct names and zero technical
  numbered names. The final 96-conversation window contained 95 distinct
  utterances; 28 cited learned knowledge and 18 transferred it.
- The knowledge store remains bounded to 64 compact records per resident. No
  simulation tick downloads a book, calls a language model, or gives Cardinal
  a resident mind/action writer.
