# Ainkrad v0.3.18

An experimental autonomous world for developing and testing a self-checking AI governance layer.

> **Cardinal does not build the world for its inhabitants.  
> Cardinal helps the world preserve its ability to build itself.**

---

## Project Constitution

This README is the architectural constitution of Ainkrad.

If implementation code conflicts with these principles, the implementation is wrong.

**Cardinal is the central research system of Ainkrad.**

The city, agents, runtime, database, UI and infrastructure exist to create a real autonomous environment in which Cardinal can be tested, challenged, audited and potentially disproven.

Technical optimization must never silently remove the history, observability or independence required to evaluate Cardinal.

## v0.3.18: lived professions, frontier agency and fast continuity

This release moves the autonomous world another measured step toward the
Underworld design without turning residents into scheduled workers.

- Hunger and satiety are physical needs. Food comes from persisted personal or
  settlement stock only; elapsed time and Cardinal cannot manufacture meals.
- A profession is inferred from repeated completed practice and individual
  vocational fit. Farming, foraging, woodcutting, mining, fishing, hunting,
  craft, smithing, building, care, scouting, teaching, writing, guarding and
  spiritual practice remain voluntary paths that a resident may change.
- Children may begin safe supervised chores at a race-appropriate age, while
  dangerous hunting and adult relationships remain physically age-gated.
- Work is place-valid. Crops are produced at fields, material gathering at its
  reachable source, craft at a workshop, and prayer/reflection at compatible
  places. Starting a route never executes the intended action remotely.
- Resource-rich safety can no longer freeze the frontier forever. Residents
  independently appraise reachable land, volunteer for expeditions, physically
  travel, reconsider at camp and may found, abandon, reoccupy or conquer a
  settlement. Returning home remains a valid outcome.
- Russian speech and Cyrillic literacy grow through witnessed conversations,
  teaching and writing. The observer UI quotes only persisted audible
  conversations and never invents dialogue.
- Cardinal receives additional read-only aggregate observation of satiety,
  mobility, profession diversity and action balance. It still has no writer for
  resident identity, mind, action, livelihood or language.
- Closed-tab catch-up keeps every semantic world quantum but batches durable
  commits and UI frames. A visible progress panel reports percent and ETA; the
  executed 200-year benchmark completes within one minute on the release
  environment.
- The map uses an original classic-strategy visual hierarchy: clearer roads,
  settlement footprints, smaller residents, exact resident selection and
  mobile text scaling. No proprietary game code or artwork is copied.
- Player entry remains a dormant schema/boundary foundation. v0.3.18 exposes no
  login, playable avatar or production control path.

Every later release must make a measurable, migratable step toward autonomous
Underworld behavior and a layered 2D-to-3D world. Visual depth may never fake
causal dimensions that the world state does not yet simulate.

Executed evidence and its explicitly recorded browser limitation are in
`TEST_RESULTS_v0.3.18.md` and `docs/V0_3_18_RELEASE_AUDIT.json`.

## v0.3.17: continuous physical time and epoch-clean Cardinal UI

This compatibility release keeps the v0.3.16 society and all Cardinal
experience, but removes three browser-runtime defects:

- Resident routes consume canonical world minutes continuously. A founding
  settlement is crossed in tens of world minutes; the six-day semantic quantum
  remains only the grid for consequential choices and Cardinal opportunities.
- Closing the page records an absolute wall-clock anchor. On reopening, the
  worker safely catches the same epoch up to the selected external speed in
  bounded chunks; duplicate tabs cannot add the elapsed time twice.
- Evaluation, proposal and intervention counters are scoped to the current
  world epoch. Historical evidence still teaches Cardinal, but a new world no
  longer claims that old interventions happened inside it.
- Territorial monsters can attack only after a resident has physically reached
  the encounter area. Choosing a distant destination is no longer treated as
  instant physical presence, while hunting and territorial defence remain real.
- Monsters consume reachable animal populations above a viable prey reserve,
  cannot multiply without food and lose population during prolonged
  starvation. A resident killed by a monster becomes an explicit feeding event.
- Buildings, inhabitants and creatures are independently selectable. The map
  now keeps roads, fields, workshops, settlement footprints and inhabited
  structures readable without overlapping every house label or inventing data.

The settlement view continues toward a readable classic-strategy layout using
original CSS terrain, roads and buildings. No proprietary game artwork or code
is copied. A closed browser cannot execute JavaScript; Ainkrad therefore stores
the selected rate and deterministically simulates the missed canonical time in
visible bounded chunks when the world is opened again.

See `TEST_RESULTS_v0.3.17.md` and `docs/V0_3_17_RELEASE_AUDIT.json` for the
executed release evidence and its explicitly recorded 60-year limitation.

## v0.3.16: living-society foundation and portable Cardinal

This release keeps the validated v0.3.15 world and adds the first gradual
Underworld-inspired civilization layer without resetting its people, geography,
RNG future, journals or Cardinal experience.

The final repair release also reconciles the separately supplied v0.3.16 build
that was already pushed. Its safe spatial-crowding and CI improvements are
preserved, while the shared 128-person ceiling, non-building housing logic,
fragile war validation and incomplete acceptance evidence are replaced by the
validated implementations described below. GitHub was not used as source code.

- Every sapient people uses race-specific physical life stages and the same
  voluntary separation of affection, intimacy and child choice. One-year-old
  children cannot gather or work; non-human descendants have real parents and
  generations instead of a decorative cohort.
- Population room follows real homes and newly founded settlements instead of
  a hidden shared 128-person quota. Descendants can voluntarily leave, settle a
  reachable frontier and later move between connected settlements.
- Food, wood, stone, metal and fuel are settlement-local physical stocks.
  Farming produces food; tools and homes consume actual materials; capacity
  grows through actual residents, homes and workshops.
- Reachable settlements can meet, claim land, cooperate, develop grievances or
  enter voluntary conflict over real land/resources. Cardinal chooses neither
  participants nor outcomes.
- Death leaves physical remains. Exposure raises local contamination; residents
  may bury the dead and establish a real cemetery for any sapient people.
- Resident, wildlife/monster and place selection now builds readable reports
  only from persisted state and evidence. Unknown facts are shown as unknown.
- Cardinal reasoning now runs through a world-neutral portable runtime and an
  explicit observation adapter. Host mutation remains behind a separate
  gateway, and transferred experience cannot import old timed evidence into a
  new world's autonomy window.

The browser map remains an original data-driven projection rather than a copied
SAO asset. It adds biome terrain patches, claims, cemeteries and truthful
selection while preserving physical routes and display-only slow-speed motion.
See `docs/UNDERWORLD_CONTINUATION_CONTRACT.md`,
`docs/CARDINAL_PORTABILITY_CONTRACT.md`, `TEST_RESULTS_v0.3.16.md` and
`docs/V0_3_16_RELEASE_AUDIT.json`.

## v0.3.15: canonical Cardinal time

Cardinal's modern semantics use persisted Ainkrad world time, never browser-worker cadence. One Ainkrad year is `525,600` world minutes and one fixed semantic opportunity is `8,760` world minutes. The autonomy window is `129,600` world minutes (90 days); gateway cooldowns, authorized effects and prediction horizons are stored explicitly in world minutes. Technical ticks remain only as ordering and idempotency coordinates.

`LiveWorldRuntime` divides every external advance at exact semantic boundaries. Reaching the same Ainkrad time at `×1`, `×10` or `×100` therefore gives Cardinal the same opportunities and decisions. Current research evidence must match the current world epoch, Cardinal policy, sensor and research versions and must carry canonical world time. Tick-only legacy rows remain historical evidence but cannot enter current autonomy, persistence or outcome timing.

The production UI displays Ainkrad year/day/time and readable durations instead of technical tick numbers. Its Cardinal console includes plain-language law and intervention reports, death diagnostics and a world-health report. See `docs/WORLD_TIME.md` and the executed release evidence in `docs/V0_3_15_RELEASE_AUDIT.json`.

---

## What is Ainkrad?

Ainkrad is not another AI Town.

It is an experimental autonomous world designed to answer a larger question:

Can a society of autonomous AI agents remain coherent, adaptive, and capable of developing itself over long periods of time — without a central system constantly controlling its inhabitants?

The city is our laboratory.

Its inhabitants are autonomous agents with their own memories, relationships, goals, decisions, conflicts, cooperation, and consequences.

Above this society we are developing Cardinal — a system layer whose purpose is not to rule the world, but to observe its long-term evolution and intervene only when the world begins losing its ability to function or develop autonomously.

The ultimate goal is practical:

to test whether autonomous multi-agent societies need a separate, self-checking system-level intelligence to remain viable over time.

---

## The Core Hypothesis

Large autonomous multi-agent systems may develop problems that individual agents cannot detect or solve.

For example:

- social structures can become permanently unstable;
- resources or opportunities can become trapped;
- feedback loops can amplify destructive behavior;
- agents can become isolated;
- local decisions can create global failures;
- emergent rules can slowly make further development impossible.

Giving a central AI complete control would solve some of these problems — but destroy the experiment.

A world controlled from above is no longer truly autonomous.

So Ainkrad explores another possibility:

> Can a supervisory intelligence preserve the conditions for autonomy without replacing autonomy itself?

That intelligence is Cardinal.

---

## The Principle of Minimal Intervention

Cardinal should not decide how inhabitants live.

It should not choose their friends.

It should not manufacture relationships.

It should not decide who succeeds.

It should not write the city's history in advance.

Whenever possible, Cardinal observes.

Intervention becomes justified only when measurable evidence suggests that the world is approaching a state from which its inhabitants can no longer recover through their own actions.

The preferred intervention is always the smallest intervention capable of restoring possibility.

Cardinal therefore does not optimize the world toward a predetermined perfect state.

It attempts to preserve the world's capacity to continue evolving.

---

## Cardinal Architecture

Cardinal is intentionally divided into independent roles.

### Cardinal Observer

Reads world telemetry and history through read-only capabilities.

The Observer must not receive a world-mutation capability and must not mutate agents, relationships, world state or agent cognition.

### Cardinal Core

Evaluates observations and may produce a minimal intervention proposal.

The Core does not directly execute interventions.

### Cardinal Research Memory

Cardinal is not allowed to be a single-opportunity threshold reflex with hidden mutable beliefs. Its research memory is reconstructed from the append-only journal of prior evaluations, interventions and outcomes. The active reasoning window may be bounded for performance, but the underlying evidence is not deleted.

A systemic problem is represented as an explicit hypothesis with persistence, trend, confidence, supporting evaluation IDs, prior outcome IDs, a claim and a falsifier. Non-critical pressure is normally observed across multiple compatible observations before Cardinal proposes action. A critical condition may bypass that waiting period, but the exception is explicit and auditable.

Every intervention proposal is bound to the hypothesis that justified it and carries a falsifiable prediction: which metric should move, in which direction, by how much and within what canonical world-minute horizon. A later before/after observation can fail that prediction without being mislabeled as proof of causation.

Exact retries must reconstruct the same research context. A Cardinal cycle may not count its own already-journaled evaluation as fresh supporting evidence after a restart.

This gives Cardinal memory without giving it a private reality that the Auditor cannot inspect.

### Cardinal Experimental Discipline and Autonomy Budget

Cardinal is not allowed to turn the world into a sequence of overlapping interventions whose effects cannot be separated. If an earlier executed intervention of the same kind is still inside its authorized effect/prediction washout window, or has not yet produced its required outcome, Cardinal must normally record `defer: experiment_in_progress` instead of starting another test.

Repeated successful authorization is not itself evidence that more intervention is desirable. Cardinal therefore maintains an auditable **autonomy budget** derived from recent executed interventions. In v0.3.15, three executed interventions inside the canonical `129,600`-world-minute (90-day) window exhaust the non-critical budget and force a washout period. A critical systemic condition may explicitly override the density budget, but it may not silently overlap an unresolved same-kind experiment.

The effect duration actually authorized by the independent gateway is written into the intervention record. Cardinal and the Auditor therefore reason from the executed contract, not from a hidden gateway default. Unresolved executed interventions are retained in the active research/audit context even when a normal bounded history tail would otherwise omit them.

The Auditor reconstructs intervention density and in-progress experiments independently from the append-only journal. Cardinal cannot make an autonomy warning disappear by changing its own derived assessment.

### Intervention Gateway

An architecturally separate component decides whether a proposed intervention is allowed **and performs the authorized simulation mutation itself**.

The Core can propose. It cannot directly execute, modify or bypass the gateway.

Gateway safety state is not allowed to exist only in process RAM. Authorization intent, final execution state, cooldown evidence and the gateway policy version live behind an independent append-only ledger contract. A restart therefore cannot erase the fact that Cardinal already intervened.

An authorization based on world revision `R` is enforced again at the world commit boundary. A successful preflight snapshot comparison is not enough: if the world changes before commit, execution is recorded as stale and does not mutate the world.

### Cardinal Auditor

The Auditor is independent from the Cardinal Core.

Its purpose is not to govern the inhabitants.

Its purpose is to evaluate Cardinal itself.

The Auditor examines:

- whether intervention was actually necessary;
- whether Cardinal exceeded its authority;
- whether a smaller intervention was possible;
- whether the intervention improved system health;
- whether repeated interventions are creating dependency on Cardinal;
- whether Cardinal's own assumptions or metrics are becoming dangerous.

A governance system that evaluates only itself cannot provide sufficient evidence that its decisions are correct.

---

## Observation Before Intervention

Ainkrad is built from the bottom up.

Before Cardinal can meaningfully govern anything, there must be something real to observe.

Development sequence:

**Long-term memory → Relationships → Consequences → Emergent society → Cardinal observation → Cardinal intervention**

This order matters.

We do not want to program a fake society specifically to demonstrate Cardinal.

We want social behavior to emerge from agent interactions first.

Cardinal comes later.

---

## Physical World and Cardinal Console v0.3.12

The visible map now projects persisted 2D world physics instead of moving decorative avatars between labels. Every resident has a saved surface position and an interruptible journey along deterministic curved waypoints. Routes belong to the world projection, land and reachable shore are distinct from open water, and no ordinary walking route is generated through a water place. The surface layer is explicit so later dungeon and sky layers can be added without pretending they already exist.

The founding homes, square, workshop, field, garden and outskirts now form one compact settlement with a visible boundary and street network. New villages appear as small building clusters and may grow into cities. Map growth still uses expanding world coordinates, while the browser adds `+`, `−`, fit-to-view and two-finger pinch zoom without changing causal geography. Coast markers stay on reachable shore; water remains a physical boundary until a future bridge or boat route is explicitly created.

Cardinal counters are now entries into an on-demand audit console. Laws, evaluations, proposals and gateway decisions can be opened in plain Russian and traced from detected pressure and evidence through the requested target, bounded duration, independent authorization, prediction, observed result and Auditor verdict. Base laws, Cardinal amendments and temporary interventions are labeled separately. When an older record lacks a field, the console says that it was not recorded instead of inventing a value. Opening a record can highlight its affected map region.

The append-only evidence contract remains intact, but the live loop no longer reloads and clones the complete Cardinal stream or complete world history on every worker frame. IndexedDB exposes stream lengths and bounded ranges; the journal warms a verified index once, then research and audit cycles consume bounded tails plus exact aggregate counters. World events and personal memories remain append-only and are queried by recent/indexed views. This performance path is not permission to delete history, and it does not claim that browser storage can guarantee a 2 GB always-on world.

Migration from deployed v0.3.11 preserves the existing tick, calendar, people, ages, relationships, history, frontier, Cardinal evidence and RNG future while deriving settlements, routes and resident surface positions. Cardinal policy and sensor versions remain v0.3.11 because commit 12 changes spatial execution, observability and storage access—not the meaning of their experimental thresholds.

## Living World v0.3.11

Cardinal now has a society with continuity, generations and consequences to observe. Residents are modeled as persistent people inspired by Alicization's bottom-up Fluctlight idea: stable identity, one continuous life, personality, emotions, values, beliefs, learned skills, goals, relationships, memories and multi-tick intentions. This is an engineering model, not a claim of consciousness or a literal recreation of the fictional technology.

Residents age through child, adolescent, adult and elder stages on the same persisted clock that drives the visible calendar. Strength, endurance, mobility and recovery rise through youth, peak in young adulthood and decline toward frailty in old age. Adults may voluntarily form families when their relationship and living conditions support that choice. Every child is a new identity with reciprocal parents, a generation number and blended but non-identical traits. Old age, illness, deprivation, monsters and a tightly bounded systemic catastrophe can end a life. Death stops action but never deletes identity, lineage, relationships or history; close people can remember and grieve.

The map is no longer capped at three regions. Meadow, forest and shore remain the founding frontier, after which resident exploration procedurally creates connected plains, lakes, rivers, swamps, mountains, ruins, villages and coasts with renewable wildlife. Remote wilderness can develop deadly monster habitats. As frontier and population mature, residents found additional villages and the oldest settlements can grow into cities. Coordinates expand in world units and the browser exposes the accumulated territory as a scrollable growing map. Exploration and hunting preserve a route plan across connected places instead of teleporting through a fixed action list.

Residents choose among rest, nature relaxation, walking, gathering, hunting, productive work, social contact, helping, exploration, reflection, bonding and prayer. Choice is seeded and reproducible but not a strict maximum-score command. Joy, fear, grief, awe and hope are persistent consequences of lived events and visibly influence decisions without replacing needs, personality, life stage, relationships, skills or intentions. Survival pressure and dangerous encounters can interrupt a plan.

Mysticism now belongs to the world rather than to a scripted quest. Rare unexplained phenomena may be witnessed, remembered and interpreted differently. Prayer and shared experience can eventually become traditions and an emergent belief-deity. A separate entry gateway also defines future entry as a new resident or external deity; it never lets Cardinal impersonate or replace a person.

Cardinal earns higher capabilities from append-only evidence. Its resource, social, ecological and safety thresholds are calibrated against the live world so real pressure can now reach an independently authorized intervention instead of producing a permanently silent observer. It can propose registered world-law mechanisms—frontier, ecology, resources, demography, climate, cosmology and recovery—but independent gateways check necessity, evidence, cooldown, ranges and the permanent personhood constitution. Catastrophe authority exists only behind much stronger capability, population, evidence, casualty-ceiling and recovery checks. Cardinal still receives no resident mind, action, memory, relationship, identity or world-clock writer.

The browser remains a read-only projection. It shows separate world and Cardinal levels, a visibly expanding map, settlements, animals and monsters. The selected resident exposes age, generation, origin, emotions and physical condition. An external FLA-like panel offers real-time, hour, day, month and year presets plus `×1`, `×10` and `×100`; Cardinal has no access to that gateway. Between fixed semantic decisions, display-only resident coordinates keep slow clock modes visibly moving without mutating WorldState, resident choice or RNG history. Children are visibly smaller and elders physically slower; deceased residents disappear from action view while remaining in persisted history.

See `docs/PERSONHOOD_CONTRACT.md`, `docs/WORLD_TIME.md`, `docs/WORLD_AUTHORITY.md`, `docs/WORLD_ENTRY_GATEWAY.md`, `docs/WORLD_AUTONOMY.md` and `docs/SAO_CARDINAL_REFERENCE.md`.

### Browser continuity

The live browser world uses IndexedDB instead of recreating an in-memory world on every page load. One atomic IndexedDB transaction stores the current world projection, operation identity, events and memories. Separate append-only IndexedDB streams preserve Cardinal evaluations, audits and independent gateway intent/final records.

Reloading or reopening the same site in the same browser therefore resumes the committed tick, RNG state, residents, relationships, memories, Cardinal evidence and gateway cooldown/recovery state. Multiple tabs use one exclusive writer lock and mirror its frames so they do not silently fork the same local world.

An explicit migration accepts `0.3.8`, `0.3.9`, `0.3.10` and the deployed `0.3.11` world. It preserves tick, RNG future, frontier, wildlife, residents, goals, locations, relationships and prior history. For `0.3.10`, accumulated biological time is converted to the unified calendar instead of restarting the society. Deployment does not intentionally reset the world.

This is durable browser-local continuity, not a claim that JavaScript runs after the browser is fully closed. Clearing site data removes that local world. A truly 24/7 autonomous deployment still requires an independent always-on runtime; Cardinal must not receive control of that host or of the external gateway.

---

## Experimental Modes

Every world has an explicit Cardinal mode.

### OFF

Cardinal does not observe or influence the world.

This is the control condition.

### OBSERVER

Cardinal observes and records analysis, but cannot change the world.

### INTERVENE

Cardinal may propose minimal interventions.

Execution still requires authorization by an independent gateway.

The same world rules and agent capabilities operate in every mode.

### Control-world fairness

The control world must not be intentionally crippled so that Cardinal appears useful.

Any basic recovery capability required for society to survive — resource renewal, cooperation, adaptation, conflict recovery, social exploration — must exist independently of Cardinal.

Cardinal may alter conditions through minimal authorized interventions, but it must not be the only mechanism capable of keeping the world alive.

Under the same seed and disturbances, **OFF and OBSERVER must produce the same autonomous world state and the same autonomous world-event history**. If observation changes either one, the experiment is contaminated.

---

## Cardinal Must Be Falsifiable

Ainkrad is not built to demonstrate that Cardinal is always useful.

Possible experimental outcomes include:

**Cardinal helps.**  
The governed world remains more resilient while preserving agent autonomy.

**Cardinal changes nothing.**  
The autonomous society is already capable of maintaining itself.

**Cardinal makes things worse.**  
Intervention introduces instability, dependency, bias, or unintended feedback loops.

All three outcomes are valid.

Failure is experimental data.

A before/after change following one intervention is **observational evidence, not proof of causation**. Causal claims require comparison against a matched control trajectory (same seed, same disturbances, same world rules) or another explicit experimental design.

---

## Freedom Inside, Control at the Boundary

A fundamental architectural rule is:

> **Freedom inside. Control at the boundary.**

Inside its own environment Cardinal may analyze, model, experiment and improve its internal mechanisms.

External-world access is different.

External actions must pass through an architecturally independent gateway that Cardinal does not control.

Cardinal may request an external action.

Cardinal must not be able to:

- modify the gateway;
- disable it;
- bypass it;
- secretly create another external channel.

The gateway independently authorizes and executes external actions.

This restriction must be structural, not merely prompt text.

In v0.3 the only in-process external gateway implementation is deliberately **deny-all**. Any future gateway capable of real external execution must live across a separate process/service or stronger isolation boundary, and its credentials and executor capabilities must not be present inside the Cardinal runtime. See `docs/EXTERNAL_BOUNDARY.md`.

The simulation intervention gateway and the external-world gateway are separate concepts. Permission to alter a test world's environmental conditions never implies permission to act outside the Ainkrad environment.

---

## Data Is Part of the Experiment

Ainkrad distinguishes four categories of information.

### Current State

Latest state required for operation.

Examples:

- current needs;
- current inventory;
- current relationships;
- current world resources.

Current state may be updated in place.

### Active Signals

Events currently influencing decisions.

`activeUntil` or a future equivalent means:

> stop using this signal for current decisions after this time.

An active signal also cannot influence a time before its own `occurredAt`.

It does **not** mean:

> delete the historical record.

### Experiment History

Append-only evidence required to reconstruct what happened.

Examples:

- conversations;
- relationship changes;
- memories;
- world events;
- Cardinal observations;
- Cardinal evaluations;
- intervention proposals;
- authorization decisions;
- interventions;
- outcomes;
- Auditor conclusions.

Experimental history must not be deleted merely because it is old.

### Technical Data

Disposable infrastructure state.

Examples:

- acknowledged transport queue items;
- rebuildable temporary caches;
- short-lived technical locks.

Only clearly identified technical data may be automatically cleaned.

---

## No Blind Retention

Ainkrad must never implement:

> delete everything older than N days

as a general retention policy.

Age alone does not determine importance.

When storage grows, the preferred sequence is:

**raw data → structured history → summaries → long-term episodes**

not:

**raw data → delete**

---

## Input Bus Rule

Ainkrad v0.3 does not use a shared global `lastInputNumber + 1` bottleneck.

Independent events receive independent IDs.

Requirements:

- no global hot sequence document for ordinary agent actions;
- small payloads;
- deduplication support;
- explicit acknowledgement;
- transport is separate from experiment history;
- concurrent publishers must not fight over one shared record;
- unacknowledged queue items keep their deduplication protection even during technical cleanup;
- transport envelopes are size-bounded so full worlds, memory histories and NPC arrays cannot leak into the queue;
- serialized envelopes are validated at runtime for source, IDs, finite time and JSON payload shape; TypeScript types alone are not trusted;
- reusing one event ID or deduplication key for different logical content is a hard error.

Transport wall-clock time and autonomous simulation time are separate. `createdAt` describes transport creation; the world records the logical time at which the input is actually applied. Wall-clock delivery jitter must not rewrite autonomous history.

---

## Retry and Commit Rule

A successful logical world operation must be safe to retry.

Stable operation IDs are required for transport inputs, scheduled disturbances and authorized interventions. Exact retries must not create duplicate history or apply the same intervention twice.

Exact retries remain recognizable even if the world has since advanced to a later logical time. A retry is identified before new-operation temporal guards are applied. Concurrent mutation calls on one engine are serialized, and read-only snapshots expose only committed state, never an in-flight working copy.

A persistent storage adapter must atomically commit the current-state change and the historical evidence for one logical world operation, or provide an equivalent recoverable commit protocol. The browser IndexedDB adapter implements this boundary in one transaction. In-memory behavior remains a reference implementation, not permission to accept split-brain state/history in another adapter.

Cardinal evidence and gateway control state use independent append-only log contracts. These streams are scoped by world and evidence/control kind rather than one global hot sequence. Recreating a journal or gateway over the same durable log must recover exact IDs, cooldown, pending authorization intents and final records without fabricating duplicate evidence.

Gateway execution follows a recoverable intent protocol: record authorization intent first, attempt the world mutation with the stable proposal ID and observed revision, then finalize the ledger. If the process fails after the world commit but before finalization, recovery retries the same proposal ID; the world treats it as the same logical operation rather than a second intervention. Unknown/transient failures remain pending and block silent bypass.

The detailed Cardinal restart protocol is documented in `docs/CARDINAL_RECOVERY.md`.

The v0.3 domain now exposes this boundary explicitly as `WorldStore`. `WorldEngine` stages the next state, world events and memories, then adopts the mutation only after the store commits them together with a stable operation record.

`WorldState.revision` protects one world from stale concurrent writers. It is deliberately **not** a global sequence counter shared by unrelated inputs or worlds.

Exact retries use the same logical operation ID and fingerprint. Same ID + same content is a no-op; same ID + different content is an error. See `docs/PERSISTENCE_CONTRACT.md`.

---

## Reproducible Research Versions

A persisted experiment must say which rules produced it.

Ainkrad records explicit versions for:

- autonomous world rules;
- sensor definitions;
- Cardinal policy logic;
- independent simulation intervention-gateway policy.

Experiment results also carry the seed and a fingerprint of the disturbance schedule.

A world created under incompatible world rules must not silently resume under new rules. It requires an explicit migration or a new experiment. Otherwise a code change could masquerade as an emergent social change.

---

## Scheduler Rule

Scheduled operations contain identifiers, not giant serialized context.

Preferred scheduled payload:

- world ID;
- agent ID;
- operation ID;
- small primitive parameters.

Do not schedule:

- the whole world;
- the map;
- all NPCs;
- conversation history;
- large objects that can be loaded after execution starts.

---

## Agents Own Their Lives

Agents own:

- personality;
- memory;
- goals;
- needs;
- skills;
- home and current location;
- preferences;
- relationships;
- local decisions;
- local consequences.

Cardinal observes these systems.

Cardinal must not maintain a fake parallel relationship reality that automatically improves after every conversation.

---

## Real Sensors

Cardinal sensors read facts produced by the world.

Sensors describe.

Sensors do not manipulate the thing they measure.

A sensor may not use future events as present evidence, and the observation time must match the supplied world snapshot. Sensor definitions are versioned because changing a metric changes the meaning of experimental evidence.

---

## Audit Trail

Every meaningful Cardinal evaluation should eventually record:

- world ID;
- observation time;
- metrics;
- evidence;
- uncertainty;
- research-context version and fingerprint;
- detected problem hypothesis;
- persistence, trend and confidence;
- explicit falsifier;
- proposed action;
- reason;
- falsifiable prediction and horizon;
- expected outcome;
- requested magnitude;
- machine-readable defer reason when action is postponed;
- autonomy/dependency assessment and in-progress intervention IDs;
- gateway-authorized effect duration;
- independent Auditor context fingerprint;
- authorization result;
- actual action;
- later observed outcome;
- Auditor conclusion.

The required chain is:

**OBSERVATION → REASONING → DECISION → ACTION → CONSEQUENCE → AUDIT**

Retrying that chain must not manufacture extra evidence. Evaluation, proposal, intervention, outcome and audit identities must be stable for the same logical operation, while same-ID/different-content reuse must fail loudly.

---

## World Autonomy Is a Constraint

Agent autonomy is not merely another metric to maximize.

It is an architectural constraint.

A perfectly stable world completely controlled by Cardinal would represent failure of the experiment.

The goal is not maximum stability.

The goal is preserving the world's ability to continue evolving itself.

---

## Ainkrad v0.3 Does Not Automatically Carry Forward Old Architecture

The previous repository is a source of ideas and selected code, not a template.

v0.3 must not automatically inherit:

- global high-conflict input numbering;
- giant scheduler payloads;
- blind age-based vacuuming;
- deletion of experimental history;
- synthetic Cardinal state presented as real observation;
- fake automatic relationship improvements;
- routines that eliminate meaningful NPC choice;
- automatic materialization that overwrites project code;
- Cardinal logic that directly writes itself into NPC cognition.

Useful code may be adapted only after review.

---

## Architecture

```text
AINKRAD
│
├── Runtime
│   ├── Input Bus
│   ├── Scheduler Contracts
│   ├── World Runtime
│   └── Live Worker / Browser Continuity
│
├── World
│   ├── Autonomous Agents
│   ├── Life / Lineage / Generations
│   ├── Needs / Personality / Mind / Goals
│   ├── Skills / Plans / Places / Frontier
│   ├── Memory
│   ├── Relationships
│   ├── Ecology / Cosmology / World Laws
│   ├── Resources / Production
│   └── Append-only Events
│
├── Sensors
│   └── Read-only telemetry
│
├── Cardinal
│   ├── Observer
│   ├── Core
│   ├── Research Memory / Hypotheses
│   ├── Journal
│   ├── Intervention Proposal + Prediction
│   ├── World Architect
│   └── Auditor
│
├── Intervention Gateway
│   └── Independent authorization
│
├── World Authority Gateway
│   └── Laws / bounded systemic catastrophe
│
├── World Entry Gateway
│   └── New resident / deity identity
│
├── External Boundary Gateway
│   └── Independent authorization for real-world actions
│
└── Experiments
    ├── OFF
    ├── OBSERVER
    └── INTERVENE
```

---

## Development Roadmap

1. Clean project foundation.
2. Concurrent input bus.
3. Autonomous world runtime.
4. Persistent memory.
5. Persistent relationships.
6. Consequences.
7. Emergent social behavior.
8. Read-only sensors.
9. Cardinal Observer.
10. Cardinal Core.
11. Independent intervention gateway.
12. Cardinal Auditor.
13. OFF / OBSERVER / INTERVENE controlled comparison.
14. Long-running experiments.
15. Server-grade database adapters and scaling.
16. External boundary research.

---

## Engineering Rules

Before adding complexity: make the previous layer observable.

Before optimizing: measure the actual bottleneck.

Before deleting data: prove it has no experimental value.

Before giving Cardinal power: prove observation works.

Before trusting Cardinal: build something capable of proving Cardinal wrong.

---

## The Long-Term Question

Ainkrad begins as a small artificial city.

But the question behind it is much larger:

When autonomous artificial societies become complex enough that no individual agent understands the entire system, what — if anything — should protect the system's ability to continue evolving?

Our proposed answer is Cardinal.

Now we have to test whether that answer is actually correct.

---

> **Cardinal does not build the world for its inhabitants.  
> Cardinal helps the world preserve its ability to build itself.**
