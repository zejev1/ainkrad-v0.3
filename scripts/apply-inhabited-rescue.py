from pathlib import Path


def replace(path: str, before: str, after: str):
    file = Path(path)
    text = file.read_text()
    if before not in text:
        if after in text:
            return
        raise RuntimeError(f'Missing exact integration anchor: {path}: {before[:100]}')
    if text.count(before) != 1:
        raise RuntimeError(f'Ambiguous integration anchor: {path}')
    file.write_text(text.replace(before, after, 1))


replace('src/world/geography/MainlandHomelands.ts',
    "  const unit = (suffix: string) => hash(`${signature}:${suffix}`) / 0x1_0000_0000;",
    """  const unit = (suffix: string) => {
    let n = hash(`${signature}:${suffix}`);
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 0x1_0000_0000;
  };""")
replace('src/world/geography/WorldTerrain.ts',
    "import {hash} from './TerrainMath';",
    "import {hash} from './TerrainMath';\nimport {plannedMainlandHomeland} from './MainlandHomelands';")
replace('src/world/geography/WorldTerrain.ts',
    "  if (race === 'human') return { x: human.mapX, y: human.mapY };\n  const key =",
    "  if (race === 'human') return { x: human.mapX, y: human.mapY };\n  if (!world.terrain) return plannedMainlandHomeland(world, race);\n  const key =")
replace('src/world/CompactSettlementLayout.ts',
    "import {hash} from './geography/TerrainMath';",
    "import {hash} from './geography/TerrainMath';\nimport {ensureInhabitedLandRescue} from './geography/InhabitedLandRescue';")
replace('src/world/CompactSettlementLayout.ts',
    "export function repairCompactSettlementLayout(world:WorldState):boolean {\n  bindWorldTerrain(world);",
    "export function repairCompactSettlementLayout(world:WorldState):boolean {\n  bindWorldTerrain(world);\n  const habitatRescueChanged=ensureInhabitedLandRescue(world).changed;")
replace('src/world/CompactSettlementLayout.ts',
    "  if(!terrainChanged&&!naturalChanged&&!civicCenterChanged&&!foundingSpreadChanged&&!freshLibraryChanged&&!moved.size&&!geographyChanged)return false;",
    "  if(!habitatRescueChanged&&!terrainChanged&&!naturalChanged&&!civicCenterChanged&&!foundingSpreadChanged&&!freshLibraryChanged&&!moved.size&&!geographyChanged)return false;")
replace('src/world/WorldEngine.ts',
    "import { repairCompactSettlementLayout } from './CompactSettlementLayout';",
    "import { repairCompactSettlementLayout } from './CompactSettlementLayout';\nimport {ensureInhabitedLandRescue} from './geography/InhabitedLandRescue';")
# A freshly reset founder already knows their own home and local public square.
# Commit that initial condition now, rather than adding it only on a reload.
replace('src/world/WorldEngine.ts',
    "            homeId, locationId: homeId, position: { x: places[homeId].mapX, y: places[homeId].mapY, layerId: 'surface' as const },",
    "            knownPlaceIds: [homeId, `${settlementSpec.prefix}commons`],\n            homeId, locationId: homeId, position: { x: places[homeId].mapX, y: places[homeId].mapY, layerId: 'surface' as const },")
engine = Path('src/world/WorldEngine.ts')
text = engine.read_text()
# Keep legacy coordinate rewriting out of every automatic loading path.
text = text.replace('  repairSapientHomelandGeography,\n', '')
text = text.replace('repairSapientHomelandGeography(next)', '0 /* saved homeland coordinates are authoritative */')
text = text.replace('migration:v22-family-lifecycle-cartography-perf-2026-09-15', 'migration:v22-inhabited-land-rescue-2026-09-18')
start = text.index('async function repairCompatibleV19World(')
end = text.index('\nfunction goalFromInitialState(', start)
part = text[start:end]
part = part.replace("schemaRevision: '2026-09-15-family-lifecycle-cartography-perf'", "schemaRevision: '2026-09-18-inhabited-land-rescue'")
part = part.replace('v22-family-lifecycle-cartography-perf-2026-09-15:revision:', 'v22-inhabited-land-rescue-2026-09-18:revision:')
anchor = '    const before = stableJsonStringify(next);\n'
if 'const habitatRescue = ensureInhabitedLandRescue(next);' not in part:
    if part.count(anchor) != 1:
        raise RuntimeError('Missing migration rescue anchor')
    part = part.replace(anchor, anchor + '    const habitatRescue = ensureInhabitedLandRescue(next);\n')
anchor = '        preservedRngState: next.determinism.rngState,\n'
if 'userAuthorizedGeographyRescue:' not in part:
    if part.count(anchor) != 1:
        raise RuntimeError('Missing migration evidence anchor')
    part = part.replace(anchor, anchor + '''        userAuthorizedGeographyRescue: habitatRescue.changed,
        rescuedSettlementIds: habitatRescue.settlementIds,
        addedRescueIslandIds: habitatRescue.addedIslandIds,
        addedRescueResourcePlaceIds: habitatRescue.addedPlaceIds,
        blockedRescueSettlementIds: habitatRescue.blockedSettlementIds,
        residentCoordinatesRewritten: false,
        cardinalIntervention: false,
''')
text = text[:start] + part + text[end:]
engine.write_text(text)
print('Integrated mainland reservations, additive rescue and canonical reset knowledge. No main/ref writes.')
