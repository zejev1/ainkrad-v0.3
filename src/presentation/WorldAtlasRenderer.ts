import {bindWorldTerrain} from '../world/geography/WorldTerrain';
import {TerrainRaster} from './TerrainRaster';
import {paintRegionalFeatures} from './TerrainFeatures';
import { clipMapPolygon,clipMapSegment,type WorldMapCamera } from './WorldMapCamera';
import { WorldAtlasIndex,atlasLevel } from './WorldAtlasIndex';
import type { WorldState } from '../world/types';

const SVG='http://www.w3.org/2000/svg';
const palette:Record<string,string>={water:'#5b96a2',forest:'#678465',quiet_space:'#809b70',mountains:'#aaa58e',
  swamp:'#829481',meadow:'#a4b589',resource_field:'#c1b074',settlement:'#bdb596',cemetery:'#a1aa90',shore:'#c9be94',ruins:'#b0ab92'};
const order:Record<string,number>={meadow:0,forest:1,mountains:2,swamp:3,shore:4,ruins:5,settlement:6,quiet_space:7,resource_field:8,cemetery:9,water:10};
export class WorldAtlasRenderer {
  readonly index=new WorldAtlasIndex();
  readonly raster=new TerrainRaster();
  private terrainKey='';private roadKey='';
  private svg:SVGSVGElement;private shapes:SVGGElement;
  constructor(private ground:HTMLElement,private roads:SVGSVGElement,private towns:HTMLElement) {
    this.svg=document.createElementNS(SVG,'svg');this.svg.setAttribute('viewBox','0 0 100 100');this.svg.setAttribute('preserveAspectRatio','none');this.svg.classList.add('atlas-terrain');
    this.svg.innerHTML='<defs><pattern id="atlas-field-rows" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(22)"><path d="M2 0V9M6 0V9" stroke="#8c874e" stroke-width="1.3"/></pattern><pattern id="atlas-forest" patternUnits="userSpaceOnUse" width="16" height="16"><circle cx="5" cy="5" r="3" fill="#436b50"/><circle cx="12" cy="12" r="3" fill="#527658"/></pattern><pattern id="atlas-relief" patternUnits="userSpaceOnUse" width="24" height="24"><path d="M-2 15Q5 2 13 12T27 12M-2 20Q5 7 13 17T27 17" fill="none" stroke="#827f6c" stroke-width=".8"/></pattern></defs>';
    this.shapes=document.createElementNS(SVG,'g');this.svg.append(this.shapes);ground.replaceChildren(this.raster.canvas,this.svg);towns.replaceChildren();
  }
  render(world:Readonly<WorldState>,camera:Readonly<WorldMapCamera>):void {
    this.index.update(world);
    const cameraKey=[this.index.revision,camera.x,camera.y,camera.pixelsPerUnit,camera.width,camera.height].join(':');
    if(cameraKey!==this.terrainKey) {this.paintTerrain(camera,world);this.terrainKey=cameraKey;}
    const routes=this.index.visibleRoads(world,camera),roadKey=cameraKey+':'+routes.map(r=>r.id).join('|');
    if(roadKey!==this.roadKey) {
      const seen=new Set<string>(),parts:string[]=[];
      roadSegments: for(const route of routes)for(let i=1;i<route.waypoints.length;i++) {
        const segment=clipMapSegment(camera.point(route.waypoints[i-1].x,route.waypoints[i-1].y),camera.point(route.waypoints[i].x,route.waypoints[i].y));
        if(!segment)continue;
        const ends=segment.map(p=>p.x.toFixed(4)+' '+p.y.toFixed(4)),key=[...ends].sort().join('|');
        if(!seen.has(key)){seen.add(key);parts.push('M'+ends[0]+'L'+ends[1]);}
        if(parts.length>=1600)break roadSegments;
      }
      this.roads.replaceChildren();
      if(parts.length) {
        // SVG uses viewport percentages; non-scaling stroke is in screen pixels.
        for(const [kind,width,color]of [['edge',4,'#92846d'],['road',3,'#ddcbae']]as const) {
          const path=document.createElementNS(SVG,'path');path.setAttribute('d',parts.join(' '));path.setAttribute('fill','none');
          path.setAttribute('vector-effect','non-scaling-stroke');
          path.style.stroke=color;path.style.strokeWidth=Math.max(.65,width*camera.pixelsPerUnit/100)+'px';
          path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.classList.add('atlas-road-'+kind);this.roads.append(path);
        }
      }
      this.roadKey=roadKey;
    }
  }
  private paintTerrain(camera:Readonly<WorldMapCamera>,world:Readonly<WorldState>):void {
    const model=bindWorldTerrain(world);if(model)this.raster.render(model,camera);
    if(model){
      let clip=this.svg.querySelector<SVGClipPathElement>('#atlas-land');
      if(!clip){clip=document.createElementNS(SVG,'clipPath');clip.id='atlas-land';this.svg.querySelector('defs')!.append(clip);}
      const boundary=clipMapPolygon(model.outline.map(p=>camera.point(p.x,p.y))),path=document.createElementNS(SVG,'path');
      path.setAttribute('d',boundary.length?'M'+boundary.map(p=>p.x+' '+p.y).join('L')+'Z':'M0 0');clip.replaceChildren(path);
      this.shapes.setAttribute('clip-path','url(#atlas-land)');
    }
    const level=atlasLevel(camera.pixelsPerUnit),fragment=document.createDocumentFragment();
    const areas=this.index.visibleAreas(camera).sort((a,b)=>(order[a.kind]??0)-(order[b.kind]??0)||a.id.localeCompare(b.id));
    for(const area of areas) {
      if(model&&area.id==='ocean_ainkrad:land')continue;
      // Continuous terrain supplies these biomes. Old survey extents remain
      // in the save, but must not paint a flat mountain oval over a forest town.
      if(model&&['forest','mountains','swamp','meadow'].includes(area.kind))continue;
      const polygon=clipMapPolygon(area.polygon.map(p=>camera.point(p.x,p.y)));
      if(polygon.length<3)continue;
      const d='M'+polygon.map(p=>p.x.toFixed(4)+' '+p.y.toFixed(4)).join('L')+'Z';
      const path=document.createElementNS(SVG,'path');path.setAttribute('d',d);path.setAttribute('fill',palette[area.kind]??'#a6b28b');
      path.setAttribute('fill-rule','evenodd');path.dataset.area=area.id;fragment.append(path);
      if(area.kind==='water') {
        path.setAttribute('stroke','#d5cbaa');path.setAttribute('stroke-width',String(Math.min(.7,Math.max(.12,.04*camera.pixelsPerUnit/camera.width*100))));
        path.setAttribute('stroke-linejoin','round');
      }
      const pattern=area.kind==='resource_field'?'atlas-field-rows':area.kind==='forest'?'atlas-forest':area.kind==='mountains'?'atlas-relief':undefined;
      if(pattern&&level!=='world'&&level!=='region') {
        const texture=document.createElementNS(SVG,'path');texture.setAttribute('d',d);texture.setAttribute('fill','url(#'+pattern+')');texture.setAttribute('opacity','.7');fragment.append(texture);
      }
    }
    this.shapes.replaceChildren(fragment);
    if(model)paintRegionalFeatures(model,camera,this.shapes);
    // Pattern size follows world coordinates and never rescales the SVG surface.
    const px=Number(camera.pixelsPerUnit);
    for(const [id,metres]of [['atlas-field-rows',4],['atlas-forest',6],['atlas-relief',16]]as const) {
      const pattern=this.svg.querySelector<SVGPatternElement>('#'+id)!;
      const base=id==='atlas-relief'?24:id==='atlas-forest'?16:9;
      const width=metres*px/camera.width,height=metres*px/camera.height,origin=camera.point(0,0);
      const x=((origin.x%width)+width)%width,y=((origin.y%height)+height)%height;
      pattern.setAttribute('patternTransform','translate('+x+' '+y+') scale('+width/base+' '+height/base+')');
    }
  }
}
