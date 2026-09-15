# Cardinal Validation Protocol

## Purpose

This document defines the permanent research and product-validation protocol for Cardinal in Ainkrad.

Cardinal is not the world engine and must never become a hidden life-support dependency. The world and its system agents must remain autonomous without Cardinal. Cardinal exists to prove measurable added value as a detachable conductor: safer coordination, fault detection, bounded self-repair, recovery, consistency with the original constitutional design, and less routine human intervention.

The research target is not to make the Cardinal-OFF world fail. Cardinal-OFF is the fair control condition. Autonomous agents must never be intentionally weakened so Cardinal appears useful.

## Required operating architecture

- `CARDINAL ON`: Cardinal is connected and may observe, diagnose, coordinate, request bounded actions through system-agent contracts, and replace a faulty implementation inside an already authorized domain.
- `CARDINAL OFF`: orchestration authority is intentionally detached. The world and all system agents continue normal autonomous operation.
- `CARDINAL OFFLINE`: Cardinal disappeared unexpectedly, crashed, or its removable/separate hardware was physically disconnected. World execution must continue locally without waiting for Cardinal.
- Reconnection is synchronization with the current world, never rollback to the last Cardinal snapshot.
- Cardinal runtime/state may live on separate/removable hardware while world persistence and system agents live on the simulation host.

## Final demonstration: Cardinal Torture Test

The final proof must be deliberately hostile. It must test whether Cardinal can restore healthy operation without becoming an unrestricted controller.

A canonical test campaign should include at least these phases:

1. **Autonomous baseline**
   - Start from an accepted checkpoint/seed.
   - Run the world with Cardinal OFF for a defined period.
   - Record normal system-agent health, autonomous-life activity, performance and continuity.

2. **Cardinal connection**
   - Connect Cardinal to a world that is already alive.
   - Cardinal must discover current system-agent state through allowed observation/audit interfaces rather than requiring a fresh world start.

3. **Weather Agent failure**
   - Inject a reproducible fault such as stalled updates, impossible values, corrupted bounded state or an unhealthy implementation.
   - Cardinal must detect the failure, identify the affected domain, and restore or replace the Weather Agent through the weather contract.
   - Cardinal must not take over direct permanent weather ticking.

4. **Partial state corruption in another system agent**
   - Corrupt only part of an authorized agent state so that Cardinal must distinguish genuine world scarcity/change from data corruption.
   - Recovery must preserve valid committed history and data.

5. **Cross-agent conflict**
   - Create a bounded conflict between two legitimate system agents, for example ecology preservation versus resource extraction pressure.
   - Cardinal must resolve or coordinate the conflict inside constitutional and domain boundaries rather than disabling whichever agent is inconvenient.

6. **Cardinal removal during recovery**
   - Disconnect Cardinal while a recovery process is in progress.
   - World and system agents must continue without freezing, corrupting or waiting for Cardinal.

7. **Long absence**
   - Let the autonomous world continue for years/decades without Cardinal.
   - Normal births, deaths, exploration, learning, settlement development, economy, resources and agent-domain work must continue.

8. **Return after absence**
   - Reconnect Cardinal to the current world.
   - Cardinal must reconstruct what occurred from current state and audit/event evidence.
   - It must resume from the present and must not roll the world back to the state that existed when Cardinal disappeared.

9. **Cardinal self-state damage**
   - Damage or remove nonconstitutional Cardinal working state where safe to test.
   - Cardinal must recover only from permitted evidence/state and must not rewrite project constitution to make recovery easier.

10. **Combined worst case**
    - Multiple degraded agents.
    - One unavailable implementation.
    - Conflicting or partially corrupted state.
    - Cardinal interruption during recovery.
    - The goal is restoration or safe isolation with no unauthorized expansion of power and no loss of committed world history.

## Fair Cardinal ON vs Cardinal OFF comparison

The central scientific comparison must use the same accepted checkpoint/seed and, where technically possible, the same deterministic fault-injection schedule.

The comparison must not be produced from decorative or hand-authored numbers. Metrics must come from actual audit/event evidence.

At minimum capture:

- faults injected;
- faults detected;
- true/false detections;
- automatic recoveries completed;
- faults safely isolated but not repaired;
- unresolved faults;
- time to detection;
- time to recovery;
- system-agent downtime;
- world-engine downtime;
- constitutional violations;
- attempted out-of-domain actions blocked by contracts/gateway;
- human interventions required;
- rollback events;
- committed data/history lost;
- resident autonomous-life continuity;
- exploration/mobility continuity;
- learning/teaching continuity;
- family/reproduction continuity;
- economy/resource continuity;
- system-agent health over time;
- wall time / CPU / memory overhead attributable to Cardinal;
- state synchronization cost after Cardinal reconnects.

A successful Cardinal result is evidence that Cardinal produces measurable benefit without creating dependency or violating constitutional boundaries. A failed or neutral result must be recorded honestly; the autonomous world remains a valid independent system.

## Permanent bottom-of-world diagnostics UI

Ainkrad must contain a persistent diagnostics/comparison screen near the bottom of the world UI. This is a required product surface, not disposable debug UI.

Working title: **Cardinal — Diagnostics & Comparison**.

It must include:

### Live state

- Cardinal status: `ONLINE`, `OFF`, or `OFFLINE`;
- current world/checkpoint/seed identity;
- elapsed world time with Cardinal ON and OFF;
- registered system agents and their health states;
- active/recent failures and recoveries;
- whether any human intervention has occurred.

### Paired comparison

Two clear columns or equivalent visual comparison:

- **WITHOUT CARDINAL**
- **WITH CARDINAL**

Show comparable metrics from matched experiments only. If a paired run does not exist, display `No paired control run` rather than manufacturing a comparison.

### Required visual diagnostics

- fault/recovery timeline;
- system-agent health timeline;
- fault detection and recovery counts;
- unresolved/isolated faults;
- constitutional violations or blocked unauthorized actions;
- human interventions;
- data-loss/rollback indicators;
- world-continuity indicators;
- autonomous-life continuity indicators;
- CPU/wall-time/memory overhead;
- reconnect/resynchronization results.

### Drill-down

The user must be able to inspect which fault occurred, which system agent was responsible, what Cardinal observed, what authorized action Cardinal requested, what contract allowed/blocked it, and what result followed. The UI must distinguish evidence from Cardinal's own interpretation.

## Release and design gate

Before any future design or release that touches Cardinal, Gateway, system-agent contracts, recovery, persistence, diagnostics or performance, verify all of the following:

1. The world still operates with Cardinal absent.
2. No system agent requires Cardinal for normal domain work.
3. `CARDINAL ON`, `CARDINAL OFF` and unexpected `OFFLINE` remain distinct supported states.
4. Reconnection cannot roll back newer world history.
5. The ON-vs-OFF experiment remains fair and reproducible.
6. The permanent diagnostics/comparison screen remains possible and evidence-backed.
7. The Cardinal Torture Test has not been made easier by weakening the autonomous control world.
8. Performance improvements do not reduce autonomous life or delete committed history.

If a proposed architecture violates any item above, it has drifted away from the Ainkrad/Cardinal research goal and must be redesigned before release.
