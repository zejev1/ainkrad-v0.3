import type { WorldPlace } from './types';
function points(value:unknown,label:string,minimum:number):void {
  if(!Array.isArray(value)||value.length<minimum||value.some(point=>!point||typeof point!=='object'||
    !Number.isFinite(point.x)||!Number.isFinite(point.y)))throw new Error(label+' is invalid.');
}
/** Area outlines describe surveyed land as well as water. A bank's water
 * polygon is separate, so an accessible place never acquires water walking. */
export function assertPlaceGeography(value:unknown,id:string):void {
  const place=value as Partial<WorldPlace>,label='World place '+id;
  if(place.rotation!==undefined&&!Number.isFinite(place.rotation))throw new Error(label+'.rotation is invalid.');
  if(place.geographyVersion!==undefined&&place.geographyVersion!==1)throw new Error(label+'.geographyVersion is unsupported.');
  if(place.boundaryPolygon!==undefined) {
    points(place.boundaryPolygon,label+'.boundaryPolygon',3);
    const surveyed=place.geographyVersion===1||place.urbanLayoutVersion===3;
    const landKind=['resource_field','forest','mountains','swamp','meadow','quiet_space','shore','ruins','cemetery'].includes(place.kind??'');
    if(place.surface!=='water'&&!(surveyed&&landKind))throw new Error(label+' has an unsurveyed land boundary.');
  }
  if(place.waterPolygon!==undefined) {
    points(place.waterPolygon,label+'.waterPolygon',3);
    if(place.surface!=='water'&&!['river','lake'].includes(place.kind??''))throw new Error(label+' has water without a water feature.');
  }
  if(place.terrainPath!==undefined)points(place.terrainPath,label+'.terrainPath',2);
}
