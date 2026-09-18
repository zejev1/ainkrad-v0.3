import { describe, expect, it } from 'vitest';
import { physicalPlaceDrawing, isPersistentMapLandmark } from '../src/presentation/MapPlacePresentation';
import type { WorldPlace } from '../src/world/types';

function place(id:string, kind:WorldPlace['kind']='shore'):WorldPlace {
  return {
    id,
    name:id,
    kind,
    capacity:10,
    biome:'coast',
    mapX:0,
    mapY:0,
    connectedPlaceIds:[],
    fertility:.2,
    danger:.05,
    surface:'shore',
  };
}

describe('Rulid harbor map presentation',()=>{
  it('treats only the Rulid shore as a persistent civic landmark',()=>{
    expect(isPersistentMapLandmark(place('rulid_shore'))).toBe(true);
    expect(isPersistentMapLandmark(place('other_shore'))).toBe(false);
  });

  it('draws a dedicated harbor with pier and boat instead of the generic shore symbol',()=>{
    const drawing=physicalPlaceDrawing(place('rulid_shore'),true);
    expect(drawing).toContain('rulid-harbor-art');
    expect(drawing).toContain('M7 29H39V34H7Z');
    expect(drawing).toContain('M41 18L55 18L52 26H44Z');

    const generic=physicalPlaceDrawing(place('other_shore'),true);
    expect(generic).not.toContain('rulid-harbor-art');
  });
});
