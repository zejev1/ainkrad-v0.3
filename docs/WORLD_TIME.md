# World Time and External Acceleration — v0.3.15

Ainkrad has one persisted world-time domain. Calendar time, biological age, birth cooldowns and age-dependent physiology all consume the same `elapsedWorldMinutes` value. Cardinal's autonomy, research, gateway and outcome timing use that same canonical domain.

## Canonical contract

| Quantity | Canonical value |
|---|---:|
| One Ainkrad year | 525,600 world minutes |
| One semantic quantum | 8,760 world minutes |
| Legacy four-logical-tick prediction duration | 35,040 world minutes |
| Cardinal autonomy window | 129,600 world minutes (90 days) |

The semantic quantum is a decision boundary, not a browser-worker tick. Technical ticks remain available only for total ordering, retry identity and idempotency.

## External clock boundary

The browser controls acceleration through `IndependentWorldClockGateway`. The gateway has no Cardinal import or Cardinal capability. Cardinal can observe consequences in the world, but it cannot change, pause or accelerate time.

The current controls are:

| Preset | World time per real minute |
|---|---:|
| Real time | 1 minute |
| Hour | 1 hour |
| Day | 1 day |
| Month | 30 days |
| Year | 365 days |

Each preset can run at `×1`, `×10` or `×100`. The default remains one world year per real minute at `×1`. The choice is kept as browser UI preference and sent to the current exclusive world writer; it is not stored as a Cardinal-owned world rule.

`LiveWorldRuntime` accumulates external world minutes and divides every large advance at exact 8,760-minute boundaries. A run that reaches the same persisted Ainkrad time at `×1`, `×10` or `×100` therefore executes the same world quanta and offers Cardinal the same semantic opportunities. Acceleration may not skip births, deaths, ecology, decisions, events or Cardinal evidence.

## Cardinal timing

- CardinalCore and CardinalAuditor derive density, overlap and washout from canonical world minutes.
- InterventionGateway persists cooldown and authorized effect duration in world minutes.
- Outcome scheduling uses each prediction's `horizonWorldMinutes`.
- Current CardinalResearch timed evidence must match the current world epoch, policy, sensor and research versions and carry canonical world minutes.
- Tick-only legacy rows remain in all-time history/experience, but do not enter current persistence, autonomy or outcome math.

Modern events carry canonical occurrence/expiry coordinates. A compatibility tick may still be present on a record, but it is never converted implicitly into elapsed Ainkrad time.

## Presentation

Production UI presents Ainkrad year/day/time and human-readable durations. Technical tick numbers are not shown as elapsed time. Death diagnostics and world-health sections use committed world time and committed telemetry.

## Human-like age effects

Age is continuous rather than a UI label. The engine derives strength, endurance, mobility and recovery from biological age and health:

- childhood develops toward adult capacity;
- young adults approach their physical peak;
- capacity declines gradually in later adulthood;
- old age can bring frailty, slower walking, weaker work/hunting and slower recovery.

These values affect autonomous choices and their consequences. They do not predetermine personality, relationships or individual fate.
