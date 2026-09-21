# Cardinal Detachable-Conductor Constitution

Status: **permanent Ainkrad architecture rule**.

This document makes explicit an original Ainkrad research premise already present in the project invariants: the world must remain autonomous without Cardinal, and a fair experiment must be able to conclude that Cardinal is useful, useless, or harmful.

## Core model

Cardinal is the **conductor**, not the orchestra and not the power supply.

The simulation host owns and runs:

- `WorldEngine` and canonical world persistence;
- autonomous system-agent runtimes for weather, resources, ecology, dungeons/monsters, economy/settlements and future domains;
- resident life and resident autonomy;
- world-owned state, history and audit evidence needed for continuity.

Cardinal is a separable orchestration/research layer. It may live on removable media or another machine.

## Required operating states

### CARDINAL ON

Cardinal is connected and may:

- observe world/system-agent state through read-only sensors;
- coordinate or reprioritize system agents through explicit contracts;
- propose bounded changes;
- evaluate failures and outcomes;
- request replacement/upgrade of a faulty system-agent implementation within that same domain;
- learn from evidence permitted by the research architecture.

Its presence must not grant direct resident-mind control or bypass the independent gateway/boundary rules.

Since f14, the owner permits orchestration and otherwise authorized proposals from the first launch; there is no 200-year delay. Cardinal may not subsidize resources through direct relief, habitat support, resource-recovery laws or catastrophe-recovery bonuses. Technical restore preserves finite physical stores. Past records stay intact; unexecuted legacy subsidy intents are denied.

### CARDINAL OFF

Turning Cardinal OFF means **remove orchestration**, not stop the world.

While OFF:

- world time continues;
- residents continue living;
- every system agent continues its domain independently;
- weather continues;
- resources/ecology/dungeons/economy continue;
- saves/history continue;
- no local agent waits for Cardinal before progressing.

### CARDINAL OFFLINE / physically removed

Unexpected loss of the Cardinal device, process, cable, USB drive or remote connection is a supported condition.

The Cardinal control channel fails closed. The world does **not** fail with it.

The world host must continue from its last committed local state. No world-domain scheduler may depend on Cardinal's disk or RAM.

## Reconnection rule

When Cardinal returns, it joins the world **as it exists now**.

It reads:

1. current committed world state;
2. current autonomous system-agent states;
3. bounded recent operational state needed for decisions;
4. durable history/audit evidence covering Cardinal's absence.

It then reconstructs what happened and resumes orchestration.

Cardinal must never overwrite newer autonomous history with an older snapshot simply because that was the last state it personally observed.

## System-agent rule

Every system domain has an autonomous implementation resident with the world.

A system agent must have:

- a domain contract;
- world-owned local state;
- deterministic/defined scheduler semantics;
- autonomous fallback/default policy;
- bounded command inbox from Cardinal;
- timeout/absence behavior that is simply continued autonomous operation;
- versioned replacement/migration rules;
- tests proving operation without Cardinal.

Cardinal may conduct these agents, not become their hidden inner loop.

## Scientific purpose

Ainkrad does **not** assume Cardinal is beneficial.

The research question is empirical:

> Does a detachable orchestration system improve the long-term quality, resilience and recoverability of an already autonomous living world enough to justify its existence?

Acceptable findings include:

- Cardinal is beneficial;
- Cardinal has no meaningful effect;
- Cardinal is useful only under some conditions;
- Cardinal harms the world;
- specific Cardinal capabilities are useful while others should be removed.

The autonomous control world must not be intentionally crippled to make Cardinal win.

## Mandatory proof tests

Every future integration of a real system agent must prove:

1. **Absent-from-boot:** world starts and progresses with no Cardinal runtime present.
2. **ON → OFF:** disabling Cardinal while running does not pause or semantically reduce the world.
3. **OFF interval:** world progresses for substantial world time with all required system domains operating autonomously.
4. **OFF → ON:** Cardinal reconnects, catches up from current state/evidence and resumes without rollback.
5. **Hard removal:** abrupt disappearance of the Cardinal process/device is survivable and becomes `OFFLINE` rather than a world failure.
6. **Persistence:** save/reload during a Cardinal-absent interval preserves all world-owned semantic state.
7. **Fair A/B:** the same autonomous substrate can be evaluated with and without Cardinal; no special weakness is introduced into the OFF/control branch.

## UI rule

The product should expose two explicit controls, not an ambiguous toggle:

- **ВКЛЮЧИТЬ CARDINAL**
- **ВЫКЛЮЧИТЬ CARDINAL**

The status is separately visible as at least:

- `ONLINE`
- `OFF`
- `OFFLINE / DISCONNECTED`

The OFF action must clearly mean "stop Cardinal orchestration" rather than "stop simulation".

## Failure condition

An implementation is architecturally invalid if any of the following is true:

- removing Cardinal freezes or pauses the world;
- a system agent stops solely because Cardinal is absent;
- Cardinal storage is required to open or continue the world;
- reconnecting Cardinal rolls the world backward;
- OFF mode secretly runs a weaker substrate than ON mode;
- residents lose autonomous opportunities because Cardinal is disconnected;
- Cardinal directly becomes the mandatory implementation of a system domain instead of conducting an autonomous domain agent.

This constitution is intentionally stronger than a feature description. Future code, agents and optimizations must conform to it.
