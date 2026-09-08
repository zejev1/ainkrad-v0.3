# Ainkrad v0.3.19 — executed release verification

Date: 2026-09-08 UTC  
Source: complete v0.3.19 working tree on verified main parent 66538c03ff8dfcea0bccb2e493c6af1666facfad.

Repository: `https://github.com/zejev1/ainkrad-v0.3.git`, branch `main`.
No unexecuted check is labelled PASS. The assistant performed no commit, push,
Vercel write or Convex connection.

## Build and regression

- TypeScript: PASS — `tsc -p tsconfig.json`.
- Full sequential regression: PASS — Vitest 3.1.1, 43/43 files and 185/185
  tests in 101.51 seconds.
- Targeted society, gifts, prayers, adventure economy and sapient-peoples
  regression: PASS — 4/4 files and 28/28 tests.
- Cardinal equal-time causality: PASS — x1, x10 and x100 produce identical
  opportunities and decisions at equal Ainkrad time.
- OFF/OBSERVER autonomy: PASS — read-only observation does not change the
  autonomous world.
- Production build: PASS — Vite 7.0.4 emitted the index, 45,747-byte CSS,
  154,638-byte application JavaScript and a dedicated 567,096-byte worker.
- Production HTTP smoke: PASS — the built index and worker both returned 200;
  the emitted bundles contain the v0.3.19 prayer, divine-audience and adventure
  protocols.
- `git diff --check`: PASS before packaging.

## Migration, authority and bounded storage

- Existing v0.3.18 worlds migrate additively to v0.3.19 while preserving
  people, relationships, world time, professions, RNG future and Cardinal
  experience. Canonical non-human homelands created by the faulty 11-23 km
  rule are moved once with their homes, resident positions and rebuilt routes;
  a second repair is revision-neutral.
- A legacy private calling becomes historical gift/contact evidence; its old
  role label no longer controls the resident's profession or decisions.
- Gifts and direct messages cross the independent player-entry gateway.
  Cardinal receives no resident mind, action, identity, profession, prayer or
  private-contact writer.
- Prayer detail is bounded to the latest 256 records and 12 significant entries
  per resident. Dungeon runs and market transactions retain the latest 256
  details; cumulative counters preserve older evidence. Dungeons, artifacts,
  abilities and physical inventories also have explicit limits.

## v0.3.19 feature acceptance

- Gift independence: PASS — an ordinary farmer keeps identity, family,
  profession and freedom after every gift, including the level-100 hero preset.
- Contextual prayer: PASS — text and structured reason are derived from the
  resident's current evidence, differing life states produce differing prayers,
  and no prayer automatically gives a reward.
- Divine response uncertainty: PASS — direct contact, ambiguous signs, gifts
  and no response remain separate; the resident's own interpretation is stored.
- Physical dungeon entry: PASS — a run is rejected until the resident reaches
  its surface entrance; no selection teleports them.
- Voluntary progression: PASS — a prepared adult can choose an expedition,
  gain lived experience and rank, find an artifact or skill book and learn a
  specific ability. A child or unprepared resident is never assigned by quota.
- Real economy: PASS — food purchases reduce the actual v16 settlement stock,
  currency moves between resident and market, and foreign trade is recorded
  only when a resident physically carries it between settlements.
- UI contract: PASS — prayer inbox and filters, open-NPC action, prayer reply,
  gift/contact separation, resident adventure details, dungeon map markers and
  world economy summary are present.
- Sapient geography: PASS — all 15 pairs among humans, elves, dwarves,
  goblins, orcs and ogres are between 100 and 200 physical kilometres apart.
- Sapient depth: PASS — six peoples have distinct life windows, physiology,
  founder skills, terrain traditions, cultural naming and visible appearance.
  Human/elf and human/dwarf first-contact priors are friendly; human/goblin
  and human/orc priors are hostile, while later evidence remains free to
  change diplomacy and individual choices.

## Autonomous 100-year browser-seed audit

Command: `node --import tsx src/v18/runOfflineCatchUpBenchmarkV18.ts 100 off ainkrad-browser-world`.
The runtime executed its normal residents, deaths, births, resources, routes,
professions and RNG with Cardinal interventions disabled. No residents,
couples, professions, prayers, dungeon outcomes or transactions were injected
by the audit.

- Result: PASS in 114.169 seconds; 6,000 semantic quanta in 23 durable batches.
- Population: 738 living, 751 births, 83 deaths, generations 0 through 5 and
  ten inhabited settlements. There were no deprivation deaths.
- Living peoples: 65 humans, 122 elves, 161 dwarves, 66 goblins, 156 orcs and
  168 ogres. Humans grew from ten founders to 65 without Cardinal assistance
  or an artificial population ceiling.
- Physical agency: 133 residents were travelling at the final frame, 39 were
  currently outside their home settlement and 31,673 outside-settlement
  actions had accumulated.
- Naming and speech: all 751 native children had distinct names, with zero
  technical-number names. The bounded 96-conversation window contained 95
  distinct utterances, 21 grounded in learned knowledge and 18 transferring
  knowledge.
- Learning: 7,210 Secret Library knowledge records existed; 6,961 had matching
  practice and 1,637 had been shared. The library remained physically fixed
  beside Ainkrad.
- Professions: 55 living adventurers, 81 teachers, 122 artisans and residents
  with accumulated practice in farming, mining, scouting, cartography,
  guarding, warrior work, care, writing and spiritual keeping. The large
  `undecided` count includes children and residents still gathering experience.
- Prayer: 340 contextual prayers existed; recent detail was correctly bounded
  to 256.
- Dungeons/economy: 16 active dungeons, 308 voluntary runs, 152 successes, 30
  artifacts, 435.87 recovered coins, 2,365.33 trade volume and six physically
  carried inter-settlement trade relations. Run and transaction detail were
  each bounded to 256.

## Release conclusion

PASS. The final tree satisfies migration/continuity, protected resident
autonomy, Cardinal/Gateway separation, bounded v0.3.19 histories, complete
typecheck/regression/build and the 100-year autonomous browser-seed audit.
No commit, push, deployment write or Convex connection was performed.

## Limits of verification

The production index and worker were served locally and returned HTTP 200.
This does not verify browser rendering or IndexedDB on the user's phone.
An earlier cloud-browser preview was blocked with ERR_BLOCKED_BY_CLIENT;
the final mobile Chrome/Vercel smoke remains to be performed after the user's
push. The 100-year audit does not establish a 300-year population target or
guarantee survival on every seed.
