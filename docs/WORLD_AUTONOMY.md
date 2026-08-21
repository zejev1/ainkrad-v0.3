# Autonomous World Contract

Ainkrad is not a Cardinal demonstration with decorative NPCs. The world must be capable of producing its own successes, failures, adaptations and social structures without Cardinal.

This document defines the v0.3.9 world layer that Cardinal is allowed to observe.

## Causal ownership

NPC state belongs to the NPC/world simulation, not to Cardinal.

Each agent persists:

- identity and name;
- energy, stress and personal resources;
- social drive;
- personality traits;
- belonging and purpose needs;
- gathering, hunting, craft, social and exploration skills;
- a current derived goal;
- home and current location;
- last autonomous action and meaningful-activity time.

Cardinal receives no capability that writes these fields directly. An authorized Cardinal intervention can alter a bounded environmental condition, but it cannot choose a person's goal, friendship, memory, skill or action.

## Resident-driven world growth

The initial settlement contains homes plus shared places for social contact, gathering, work, quiet reflection and exploration. It does not begin with the whole natural world already revealed.

Resident exploration accumulates persistent frontier progress. Crossing each threshold opens exactly one next region: meadow, forest, then sea shore. The discovery commits the new place, its wildlife and append-only evidence atomically. Cardinal does not trigger discovery and cannot select the explorer.

The first ecology is intentionally small: rabbits in the meadow, deer in the forest and fish at the shore. Populations have a carrying capacity, reproduction rate and alertness. They recover through an endogenous habitat cycle, including recovery from zero, so Cardinal is not the world's only path back from depletion.

A place is part of persistent world state. NPC actions move them through that state. Appearance, animation and richer geometry can be layered on later without changing the causal rule that the world owns its inhabitants.

## Choice, not a fixed routine

A tick does not execute a hard-coded `home -> work -> socialize` schedule.

Agents compare several locally available actions:

- rest;
- relax in nature;
- walk;
- gather;
- hunt;
- work;
- socialize;
- help;
- explore;
- reflect.

Utility comes from current needs, personality, skills, goal, relationships and environmental conditions. Ordinary action selection does not mechanically execute the highest score. The agent forms a bounded set of reasonable alternatives, converts their relative utilities into seeded weights and chooses within that set. Curiosity and risk tolerance widen the choice window; persisted seeded randomness keeps the result reproducible.

The latest decision persists the chosen action, the strongest-scoring action, the number of considered alternatives and normalized openness of the choice distribution. Action events carry the same concise evidence. This does not claim human consciousness; it makes the simulation's degree of behavioral constraint inspectable instead of hiding it behind animation.

Very low energy or resources can impose survival constraints, but these constraints do not permanently replace autonomous choice. Repetition remains possible: diligence can reinforce productive habits while curiosity makes an unchanged routine less attractive.

The processing order of agents is shuffled by the persisted seeded RNG each tick. Array position must not grant `agent_1` a permanent first-mover privilege.

Walking, relaxation and hunting are ordinary alternatives, not scheduled chores. Hunting can succeed or fail. It consumes energy, changes animal alertness, develops hunting skill and only removes an animal on success. Residents may continue gathering or working instead; no central process orders them to hunt.

## Endogenous economy and recovery

The control world is not intentionally starved so Cardinal can rescue it.

Agents can recover resources through more than one path:

- raw-resource gathering;
- productive work;
- exploration that can discover additional raw resources;
- voluntary help from other agents.

Work represents production of usable value, not a Cardinal subsidy. Resource shocks can damage both shared availability and household reserves, but the same autonomous production/recovery capabilities remain available in OFF, OBSERVER and INTERVENE worlds.

Long-run viability is tested across multiple seeds. A viable run is not proof that the world is healthy; it only guards against a rigged architecture in which ordinary living mechanically guarantees collapse.

## Social autonomy

Relationships are projections of interaction history, not instructions.

Interaction can improve or worsen trust, affinity, respect and conflict. Recent memories influence future social-target selection, while exploration remains possible so early social structure cannot permanently freeze the society.

Helping is an explicit action. An offer can be accepted or rejected. The simulation does not automatically transfer resources after every positive conversation.

Social barriers alter opportunity to meet; they do not rewrite relationships or order agents not to speak. A failed attempt can itself become an autonomous world event.

## Learning without a hidden mind

Skills change through experience. Goals are derived from inspectable state: recovery pressure, resource security, belonging, contribution, curiosity and reflection. The goal is persisted so later analysis can reconstruct what the NPC was prioritizing.

This is still a deliberately small cognitive model. It is not presented as human psychology. Its purpose is to create enough persistent, causal individuality for relationships and consequences to emerge before more sophisticated cognition is added.

## Memory

Interaction and reflection can create append-only long-term memories outside the hot world snapshot. Pair memories influence future target choice.

Bounded decision reads are a performance rule only. They do not authorize deletion of older experimental memory evidence.

## Disturbances

Disturbances change world conditions, not agent scripts.

- `resource_shock` reduces shared raw availability and household reserves;
- `social_barrier` temporarily reduces social opportunity;
- `safety_shock` temporarily reduces environmental safety support.

NPCs remain free to respond through their ordinary action model. This is essential for testing whether the society can adapt without Cardinal.

## Ecology and Cardinal

Read-only sensors derive explored-world ratio, wildlife pressure and ecological diversity from committed world state. They do not spawn animals or write habitat state.

Cardinal experience is reconstructed from append-only evaluations and outcomes. Repeated observations unlock analysis capabilities; they never unlock assignment of resident goals, actions, relationships, memories or skills. The only ecology intervention in v0.3.9 is a bounded temporary `habitat_support` proposal. It requires learned capability, independent Auditor approval and execution by the independent simulation gateway.

That proposal changes environmental recovery conditions only. Residents remain free to hunt, abstain, explore, work or rest. Natural population recovery remains available in OFF and OBSERVER modes.

## Sensors must measure current society

A persistent relationship row is not evidence that two agents are currently socially connected. The v0.3.7 social-isolation sensor therefore uses recent autonomous relationship-contact evidence within a logical-time window.

Sensor reads remain bounded. If event density is high enough that the bounded read may not cover the full contact window, the sensor records a limitation instead of silently claiming perfect coverage.

Changing this metric meaning changes the sensor version.

## Reproducibility and restart

World RNG state, event sequence, agent state, places and relationships are persisted in the world projection. Reopening the same committed world must preserve the exact deterministic future.

The explicit world-rules migration from v0.3.8 to v0.3.9 preserves logical time, RNG, residents, goals, locations and relationships. It adds ecology state and derives an initial hunting skill deterministically from each resident's already-persisted gathering, exploration and risk tolerance. It does not create replacement residents.

Same seed + same world rules + same disturbances must reproduce the same autonomous state and history. Different seeds are allowed to generate different societies.

The live browser adapter stores the world projection, events, memories and operation records in one IndexedDB database. Cardinal research evidence and the simulation gateway ledger use separate append-only streams in that database. Reopening the same origin resumes both the society and its governance evidence rather than rebuilding either from zero.

Browser persistence is local to that browser profile and origin. Clearing site data is an explicit reset. The worker advances the world while at least one page is running; browser-local persistence alone is not an always-on server.

## Persisted-state validation

TypeScript is not a storage validation boundary. A same-version persisted world is runtime-validated before use, including nested agent personality/needs/skills/goals, locations, places, relationships and determinism state.

A malformed same-version snapshot fails loudly. A snapshot from another world-rules version requires an explicit migration.

## Experimental requirement

The richer world does not exist to prove Cardinal useful.

A valid result may show that:

- the society recovers on its own;
- Cardinal helps;
- Cardinal changes nothing;
- Cardinal makes the outcome worse.

The world must be strong enough for all four results to remain possible.
