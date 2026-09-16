# F2 local performance evidence

Environment: Node 22 / Linux container; absolute values are not Android measurements.

- Matched 5-year sample, same `perf-f2-seed`:
  - earlier F2 checkpoint: ~8.80 s wall, 4 births, 34 living humans, 3 settlements;
  - current candidate: ~7.79 s wall, ~12.58 s CPU, ~280.6 MiB process RSS, 4 births, 34 living humans, 3 settlements.
  - This is one host/JIT sample, not a statistical guarantee; it shows no obvious regression while preserving the same macro life outcome.
- Current 20-year `yearly-f2-seed` run: ~81.6 s cumulative wall; 131 living residents, 42 births, 1 death, 199 places, 8 settlements, 170 routes. Year 20 took ~7.5 s; slowest canonical quantum observed in that run ~331 ms.
- No population-dependent suppression of decisions/actions was reintroduced. Gift/passive progression hooks reuse existing lived-event/aging passes and add no new full-population scheduler.
