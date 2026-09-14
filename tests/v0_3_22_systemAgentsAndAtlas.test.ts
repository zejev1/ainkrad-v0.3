import { describe, expect, it } from 'vitest';
import { shouldPaintAtlasAreaOverlay } from '../src/presentation/WorldAtlasOverlayPolicy';
import {
  assertSystemAgentWriteAllowed,
  SystemAgentBoundaryViolation,
  type SystemAgentManifest,
} from '../src/cardinal/SystemAgentContracts';

const weatherManifest: SystemAgentManifest = {
  id: 'weather-system',
  version: 'test',
  domain: 'weather',
  description: 'test weather system',
  infrastructureOnly: true,
  capabilities: [{
    id: 'weather.state.write',
    domain: 'weather',
    readScopes: ['weather.current'],
    writeScopes: ['weather.current'],
  }],
};

describe('atlas natural-surface ownership', () => {
  it('leaves legacy water overlays available without continuous terrain', () => {
    expect(shouldPaintAtlasAreaOverlay('water', false)).toBe(true);
  });

  it('prevents water polygons from repainting continuous terrain at any zoom', () => {
    expect(shouldPaintAtlasAreaOverlay('water', true)).toBe(false);
    expect(shouldPaintAtlasAreaOverlay('forest', true)).toBe(false);
    expect(shouldPaintAtlasAreaOverlay('settlement', true)).toBe(true);
    expect(shouldPaintAtlasAreaOverlay('resource_field', true)).toBe(true);
  });
});

describe('Cardinal system-agent boundary', () => {
  it('allows only declared writes in the agent own domain', () => {
    expect(() => assertSystemAgentWriteAllowed(
      weatherManifest,
      'weather.state.write',
      'weather',
      'weather.current',
    )).not.toThrow();
  });

  it('fails closed on cross-domain or undeclared writes', () => {
    expect(() => assertSystemAgentWriteAllowed(
      weatherManifest,
      'weather.state.write',
      'resources',
      'resources.deposits',
    )).toThrow(SystemAgentBoundaryViolation);

    expect(() => assertSystemAgentWriteAllowed(
      weatherManifest,
      'weather.state.write',
      'weather',
      'weather.spark_emotions',
    )).toThrow(SystemAgentBoundaryViolation);
  });
});
