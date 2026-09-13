import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import {
  knownMeetingPlace,
  socialOpportunityAvailable,
} from '../src/world/ResidentNavigationKnowledge';
import { WorldEngine } from '../src/world/WorldEngine';

describe('resident social navigation knowledge', () => {
  it('does not treat a resident alone at home as unable to seek company', async () => {
    const engine = await WorldEngine.create({
      worldId: 'social-navigation-regression',
      seed: 'social-navigation-regression',
      store: new InMemoryWorldStore(),
      agentNames: ['Наблюдатель'],
      startTime: 0,
    });
    const world = engine.snapshot();
    const resident = Object.values(world.agents)[0];

    expect(knownMeetingPlace(world, resident)).toBeDefined();
    expect(socialOpportunityAvailable(world, resident, [resident])).toBe(true);
  });
});
