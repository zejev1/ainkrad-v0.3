# Underworld-inspired continuation contract for Ainkrad

This document preserves the design understanding for the next development
session. The goal is not a visual reskin and not a literal copy of Sword Art
Online. The goal is an original, inspectable autonomous world that captures the
strongest simulation ideas of Alicization/Underworld while preserving Ainkrad's
resident agency and the strict separation between Cardinal and world authority.

## What “Underworld-like autonomy” means here

1. **Persons are formed by lived history.** Family, place, work, teaching,
   friendship, conflict, loss and chosen goals leave durable evidence. UI
   descriptions are derived from that evidence; they are never improvised text.
2. **Civilization grows bottom-up.** Households, workshops, settlements,
   customs, institutions and political relations emerge because residents
   repeatedly coordinate, remember and teach—not because a global controller
   assigns a civilization template.
3. **Bodies and geography matter.** Travel time, habitat, food, water, tools,
   danger, local storage and routes constrain choices. Resources cannot
   teleport and a resident cannot act everywhere at once.
4. **Skill comes from doing and teaching.** Practice, mentorship, failure and
   retained artefacts produce competence. Knowledge can be lost when no one
   knows or preserves it, and can compound across generations when it is taught.
5. **History changes the future.** Repeated cooperation can create trust and
   trade; injury, theft and violence can create fear or grievance; aid can
   create gratitude or debt. These states decay or strengthen through later
   evidence instead of being fixed faction labels.
6. **Races are peoples, not alignments.** Physiology and habitat can differ,
   but morality, profession, friendship, settlement membership and political
   choices remain individual and historical.
7. **Technology is open-ended.** The world can move beyond its starting tier
   when materials, experiments, craftspeople, teachers and social demand make
   it possible. No artificial permanent medieval ceiling.

Useful wider SAO design lessons to adapt without copying:

- Aincrad: diverse ordinary lives, crafts, guilds and social roles matter as
  much as combat.
- Progressive: persistent NPC memory and prior choices make later encounters
  branch meaningfully.
- Alfheim: biome/habitat differences, territories, neutral meeting places and
  alliances can coexist without biological moral alignment.
- Gun Gale Online: specialization, equipment economy and squads create
  interdependence.
- The Seed: compatible foundations can support continuity without one central
  ruler owning every world.
- Unital Ring: local materials, survival needs, travel and settlement building
  make geography consequential.

## What Ainkrad must explicitly reject

- A compulsory Sacred Task or predestined profession.
- A Taboo Index that replaces conscience and free choice.
- Rule by strength, administrator worship or a Quinella-like merger of
  Cardinal with sovereign world control.
- Forced marriage, sex, pregnancy, children or demographic quotas.
- “Good race” and “evil race” constants.
- Manufactured suffering or starvation merely to provoke development.
- Fake biographies, relationships, skills, occupations, culture or terrain
  descriptions that are not backed by stored simulation facts.

## v0.3.16 foundation now implemented

The first gap is repaired additively. Humans, goblins, orcs and ogres use one
race-neutral family-opportunity pipeline with race-specific physical maturity
and lifespan only. Attachment, intimacy and child intent remain independent,
and every born resident receives real parents, lineage and an ordinary learning
path. A shared technical 128-person ceiling no longer suppresses every race:
demographic room grows with actual homes and settlements, with only a high
emergency runtime guard outside normal simulation scale.

Settlement membership, voluntary resettlement and frontier founding now apply
to every sapient people. Local food/material stocks, buildings, burial sites,
claims and settlement relations are physical records. Residents can build
homes and tools, farm, bury their dead, meet neighbors, dispute land/resources,
volunteer for conflict or refuse. Cardinal has no resident action writer.

Truthful resident, wildlife/monster and terrain inspectors are connected to the
production UI. They derive their text from state and bounded evidence instead
of inventing biography. The map has original biome patches, settlement
footprints, routes, claims and cemetery markers while retaining the existing
physical movement projection.

The next gap is deeper culture: durable occupations, workshops/guilds,
apprenticeship lineages, trade logistics, political institutions, diplomacy,
domestication and art should emerge from repeated evidence. These remain future
increments and must not be represented as if they already exist.

## Additive society model

### Resident evidence

For every sapient resident, persist or derive from immutable events:

- biological parents, adoptive/guardian relations, children and household;
- birthplace, residence history, travel and settlement membership;
- practiced skills with evidence, teachers, apprentices and last-used time;
- real work episodes, tools used, items built, food/resources obtained and
  contributions accepted by a local settlement;
- likes/dislikes inferred only from repeated voluntary choices and outcomes;
- social circle from actual contact, help, teaching, trade, care, conflict and
  shared work;
- chosen goals, abandoned goals and reasons available to that resident;
- injuries, deaths witnessed and other durable memories only when the resident
  could actually observe or learn of them.

Do not add a prose biography field that can drift from state. Build readable
views from these facts.

### Voluntary family loop for every sapient race

Each race can have different lifespan, maturity, gestation, fertility needs,
habitat comfort and physiology. The decision sequence remains universal:

1. independent affection/attachment;
2. independent sexual willingness where applicable;
3. independent desire and readiness for a child;
4. mutual consent and feasible local conditions;
5. pregnancy/birth or race-appropriate reproduction;
6. caregiving, kin recognition and later teaching.

None of these steps implies the next. Population pressure may influence desire
or perceived feasibility, but it never overrides agency.

### Settlement growth

A settlement is a local social/geographic structure, not a human-only tag. It
can be founded, joined, left, divided or merged through real resident actions.
Track:

- actual residents and visitors;
- local buildings/places and their physical capacity;
- local renewable sources and stored stock;
- households, work groups, teachers/apprentices and governance practices;
- safe/unsafe routes and known neighboring places;
- repeated customs derived from action frequencies and transmitted teaching.

A city is an evolved settlement with sustained population, specialization,
infrastructure and coordination—not a visual label awarded at a threshold.

### Culture and institutions

Culture begins as an evidence summary. It can become an institution only after
residents repeatedly enact it, teach it and recognize it. Examples include a
market day, apprenticeship norm, funeral practice, mediation council, hunting
rule or hospitality custom. Store provenance: who did it, where, when, who
learned it, and whether later residents still follow it.

Institutions can change, split or disappear. They cannot directly write a
resident's mind or force an action.

### Inter-settlement relations

Represent relations as independent evidence-backed dimensions rather than one
single faction score:

- familiarity;
- trust;
- fear;
- grievance;
- obligation/debt;
- trade dependence;
- kinship links;
- alliance/coordination;
- active conflict and remembered causes.

Update them from visits, exchange, aid, promises, harm, deaths, raids,
mediation and shared threats. A treaty or war needs actual participants and
causes, not a random flavor event.

## Truthful selection and inspection

Every visible/selectable thing must resolve to a real entity or terrain record.

- **Sapient resident:** identity, species/race, age, kin tree, residence,
  current action/goal, evidenced skills, real work and creations, preferences,
  teachers/apprentices, friends/contacts/conflicts and relevant life history.
- **Animal:** species, age/life stage if known, sex where modeled, health,
  hunger, habitat, herd/pack, current behavior, known encounters and whether it
  is wild, domesticated or bonded.
- **Monster:** species/type, ecology/origin actually modeled, health, behavior,
  habitat, threat evidence, encounters/kills and loot/resources only if real.
- **Terrain/place:** biome, elevation/water/vegetation as modeled, renewable
  sources, stored local resources, hazards, ownership/use, discovered-by state,
  paths, buildings and recent events that truly occurred there.

Unknown data must be labeled unknown, not invented. The interface may summarize
but must offer a trace back to source events/state.

## Map direction

The supplied fantasy-world and city images are mood references only. Do not
copy their assets or geography. Build an original layered map:

1. biome and water/terrain readability;
2. settlement footprints, buildings and local resource sites;
3. roads/routes, exploration frontier and territorial use;
4. moving residents/animals/monsters with selection and focus;
5. zoom from world/region to settlement without changing semantic state;
6. later original art, sprites and biome detail after logic is stable.

Animation is presentation-only. It can interpolate a known route but never
manufacture travel or choices.

## Migration and Cardinal guardrail

The first implementation must be additive and versioned. Existing humans,
Genesis, goblins, orcs, ogres, animals and monsters are migrated in place with
stable IDs. No respawn, reset, race replacement or fabricated backstory.

Before/after migration, assert exact continuity of:

- world ID/epoch and canonical time;
- RNG seed/state and future deterministic continuation;
- resident/entity IDs, life/death state, positions and active routes;
- parent/child/partner/household and social relations;
- settlement-local stocks, renewable bases and created artefacts;
- Cardinal journal, experience, evaluations, interventions, policies, sensor
  epochs and outcome evidence.

New social reports begin outside Cardinal's decision inputs. Cardinal may see a
read-only health summary after its semantics are stable, but it gains no new
writer and no extra decision opportunity.

## Acceptance criteria retained for every continuation

- Existing v0.3.15 saves migrate without reset and continue deterministically.
- At equal Ainkrad time, worker speed x1/x10/x100 produces equal semantic world
  and Cardinal opportunities.
- Multiple non-human sapient populations demonstrate voluntary courtship/family
  opportunities and at least one normal generational path across sufficiently
  long deterministic seeds; no forced-birth mechanism exists.
- Human family agency and the known 30-year population/generation envelope do
  not regress without an explained, reviewed simulation change.
- Settlement membership and local storage work for all sapient races.
- Skills/jobs/culture/relations shown in UI can be traced to real state/events.
- Animal, monster, sapient and terrain selection all show type-correct facts.
- Genesis remains off after year 3; renewable/stored resources stay separate;
  deaths and monsters remain bounded and diagnosable.
- Mobile 2D motion and selection remain usable.
- Full regressions, migration tests, 8/10/12-year seeds and several 30-year
  seeds actually run before final packaging.

## Scope discipline

Implement this gradually. The first patch should establish the shared sapient
life/society foundations and truthful inspectors while preserving the current
map behavior. A major artistic world/city map overhaul is a later risky block
with its own checkpoint and regression gate.

## Design references reviewed

These references establish the fictional vocabulary and broad civilization
themes only; Ainkrad does not copy characters, story, map assets or proprietary
rules.

- Official Alicization introduction: https://sao-alicization.com/intro/
- Official character material: https://sao-alicization.com/character/?chara=dil
- Official episode material: https://sao-alicization.com/1st/story/04.html
- Yen Press Project Alicization description:
  https://yenpress.com/titles/9781975318178-sword-art-online-project-alicization-vol-1-manga
- Underworld overview used only as secondary orientation:
  https://otakumode.com/otapedia/anime/sword_art_online/underworld_1_sao
