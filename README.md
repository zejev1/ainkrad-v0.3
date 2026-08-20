# Ainkrad v0.3

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

### Intervention Gateway

An architecturally separate component decides whether a proposed intervention is allowed **and performs the authorized simulation mutation itself**.

The Core can propose. It cannot directly execute, modify or bypass the gateway.

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

A future persistent storage adapter must atomically commit the current-state change and the historical evidence for one logical world operation, or provide an equivalent recoverable commit protocol. In-memory behavior is a reference implementation, not permission to accept split-brain state/history in persistent storage.

The v0.3 domain now exposes this boundary explicitly as `WorldStore`. `WorldEngine` stages the next state, world events and memories, then adopts the mutation only after the store commits them together with a stable operation record.

`WorldState.revision` protects one world from stale concurrent writers. It is deliberately **not** a global sequence counter shared by unrelated inputs or worlds.

Exact retries use the same logical operation ID and fingerprint. Same ID + same content is a no-op; same ID + different content is an error. See `docs/PERSISTENCE_CONTRACT.md`.

---

## Reproducible Research Versions

A persisted experiment must say which rules produced it.

Ainkrad records explicit versions for:

- autonomous world rules;
- sensor definitions;
- Cardinal policy logic.

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
- detected problem;
- proposed action;
- reason;
- expected outcome;
- requested magnitude;
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
│   └── World Runtime
│
├── World
│   ├── Autonomous Agents
│   ├── Needs
│   ├── Memory
│   ├── Relationships
│   ├── Resources
│   └── Append-only Events
│
├── Sensors
│   └── Read-only telemetry
│
├── Cardinal
│   ├── Observer
│   ├── Core
│   ├── Journal
│   ├── Intervention Proposal
│   └── Auditor
│
├── Intervention Gateway
│   └── Independent authorization
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
15. Database adapters and scaling.
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
