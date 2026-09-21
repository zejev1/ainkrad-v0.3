import { VEGETATION_AGENT_MANIFEST } from '../world/systems/VegetationSystemAgent';
import { WEATHER_AGENT_MANIFEST } from '../world/systems/WeatherSystemAgent';
import { HYDROLOGY_AGENT_MANIFEST } from '../world/systems/HydrologySystemAgent';
import type { SystemAgentManifest } from './SystemAgentContracts';

/**
 * Weather, vegetation and hydrology are connected to WorldEngine. Remaining entries are architectural
 * placeholders only. Each manifest defines a natural subsystem boundary that can
 * be implemented gradually without granting cross-domain authority.
 */
export const SYSTEM_AGENT_CATALOG: readonly SystemAgentManifest[] = [
  WEATHER_AGENT_MANIFEST,
  VEGETATION_AGENT_MANIFEST,
  HYDROLOGY_AGENT_MANIFEST,
  {
    id: 'resource-system',
    version: 'draft-1',
    domain: 'resources',
    description: 'Resource deposits, depletion, regeneration and physical availability.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'resources.state.write',
      domain: 'resources',
      readScopes: ['resources.deposits', 'resources.environment'],
      writeScopes: ['resources.deposits'],
    }],
  },
  {
    id: 'ecology-system',
    version: 'draft-1',
    domain: 'ecology',
    description: 'Environmental population pressure and ecological recovery.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'ecology.state.write',
      domain: 'ecology',
      readScopes: ['ecology.current', 'resources.deposits', 'wildlife.populations'],
      writeScopes: ['ecology.current'],
    }],
  },
  {
    id: 'wildlife-system',
    version: 'draft-1',
    domain: 'wildlife',
    description: 'Non-sapient animal populations and their physical world state.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'wildlife.population.write',
      domain: 'wildlife',
      readScopes: ['wildlife.populations', 'ecology.current'],
      writeScopes: ['wildlife.populations'],
    }],
  },
  {
    id: 'monster-system',
    version: 'draft-1',
    domain: 'monsters',
    description: 'Monster populations, movement and environmental behavior.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'monsters.population.write',
      domain: 'monsters',
      readScopes: ['monsters.populations', 'geography.surface'],
      writeScopes: ['monsters.populations'],
    }],
  },
  {
    id: 'geography-system',
    version: 'draft-1',
    domain: 'geography',
    description: 'Terrain and physical geography model, not Spark navigation choices.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'geography.state.write',
      domain: 'geography',
      readScopes: ['geography.foundation'],
      writeScopes: ['geography.terrain'],
    }],
  },
  {
    id: 'ocean-system',
    version: 'draft-1',
    domain: 'ocean',
    description: 'Ocean physical state and maritime environment.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'ocean.state.write',
      domain: 'ocean',
      readScopes: ['ocean.current', 'weather.current'],
      writeScopes: ['ocean.current'],
    }],
  },
  {
    id: 'dungeon-system',
    version: 'draft-1',
    domain: 'dungeons',
    description: 'Dungeon physical lifecycle, contents and environmental state; never assigns quests.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'dungeons.state.write',
      domain: 'dungeons',
      readScopes: ['dungeons.current', 'geography.terrain'],
      writeScopes: ['dungeons.current'],
    }],
  },
  {
    id: 'emotion-observer',
    version: 'draft-1',
    domain: 'observation',
    description: 'Read-only observer for persistent social or emotional anomalies; never edits Spark feelings.',
    infrastructureOnly: true,
    capabilities: [{
      id: 'observation.spark-state.read',
      domain: 'observation',
      readScopes: ['sparks.aggregate_emotional_state'],
      writeScopes: [],
    }],
  },
] as const;
