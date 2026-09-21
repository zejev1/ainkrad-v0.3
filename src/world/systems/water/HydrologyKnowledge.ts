/** Reviewed primary references, distinct from the fictional world's calibration.
 * No network access is needed by the simulation. */
export const HYDROLOGY_DATA_VERSION = 'hydrology-2026-09-21-v1';
export const HYDROLOGY_SOURCES = [
  { name: 'USGS — Water cycle', url: 'https://www.usgs.gov/water-science-school/water-cycle',
    reviewed: '2026-09-21', facts: 'Water is stored in snow, soil, aquifers and surface waters; precipitation, evaporation and discharge cross their boundaries.' },
  { name: 'USGS — Snowmelt runoff', url: 'https://www.usgs.gov/water-science-school/science/snowmelt-runoff-and-water-cycle',
    reviewed: '2026-09-21', facts: 'Snow retains winter precipitation and releases it during thaw; melt and rain can raise downstream flow.' },
  { name: 'FAO 56 — Chapter 8, soil water balance', url: 'https://www.fao.org/4/x0490e/x0490e0e.htm',
    reviewed: '2026-09-21', facts: 'Root-zone storage changes through infiltration, capillary rise, drainage and evapotranspiration. Water stress limits plant uptake before the wilting point.' },
] as const;

/** Calibration, NOT measured Ainkrad data or a Penman–Monteith estimate.
 * The weather model supplies an index, so rainfall conversion is explicit. */
export const WATER_CALIBRATION = Object.freeze({ precipitationMmPerIndexDay: 18,
  soilCapacityMm: 240, fieldCapacityFraction: 0.65, wiltingFraction: 0.08,
  meltMmPerDegreeDay: 3, groundwaterInitialMm: 90, groundwaterCapacityMm: 600,
  snowIndexMm: 200, catchmentCells: 192, plotAreaM2: 10_000 });
