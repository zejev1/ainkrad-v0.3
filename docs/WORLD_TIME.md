# World Time and External Acceleration

Ainkrad has one persisted world-time domain. Calendar time, biological age, birth cooldowns and age-dependent physiology all consume the same `elapsedWorldMinutes` value. A resident therefore cannot age seven years while the displayed calendar advances only ten days.

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

Each preset can run at `x1` or `x10`. The default remains one world year per real minute. The choice is kept as browser UI preference and sent to the current exclusive world writer; it is not stored as a Cardinal-owned world rule.

Future Alicization-scale acceleration must extend this gateway and advance the engine through bounded deterministic substeps. It must not skip births, deaths, ecology, decisions, events or Cardinal evidence merely to make the displayed date jump faster.

## Human-like age effects

Age is continuous rather than a UI label. The engine derives strength, endurance, mobility and recovery from biological age and health:

- childhood develops toward adult capacity;
- young adults approach their physical peak;
- capacity declines gradually in later adulthood;
- old age can bring frailty, slower walking, weaker work/hunting and slower recovery.

These values affect autonomous choices and their consequences. They do not predetermine personality, relationships or individual fate.
