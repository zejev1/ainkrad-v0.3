import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { localSurveySite, localTerrainBiome } from '../src/world/geography/LocalExploration';
import { residentExplorationTarget } from '../src/world/ResidentExploration';
import { HISTORICAL_SOURCES } from '../src/v18/HistoricalSourceCorpus';
import { HISTORICAL_READING_MATERIALS, consumeReadingWords } from '../src/v18/HistoricalReading';
import { secretLibraryStudyMaterialV18 } from '../src/v18/SecretLibraryV18';
import { readingBudgetV20 } from '../src/v20/LibraryLearningV20';
import { fetchRealHumanTextV18 } from '../src/v18/SecretLibraryGatewayV18';
import { BOAT_KNOWLEDGE_ID, boatWorkSite, workOnBoat } from '../src/v21/MaritimePractice';
import {availableBoat} from '../src/v21/BoatNavigation';
import { ensureSettlementEconomyV16 } from '../src/v16/SocietyFoundationV16';

const fresh = async (seed: string) => (await WorldEngine.create({worldId:seed, seed, store:new InMemoryWorldStore(), startTime:0})).snapshot();

describe('local exploration and real historical reading', () => {
  it('surveys nearby existing dry ground in varied directions without changing terrain or knowledge', async () => {
    for (const seed of ['local-coast', 'local-forest', 'local-fields']) {
      const world=await fresh(seed), agent=world.agents.agent_1;
      agent.locationId='outskirts'; agent.movement=undefined;
      agent.position={x:world.places.outskirts.mapX,y:world.places.outskirts.mapY,layerId:'surface'};
      const before=structuredClone(world);
      const sites=Array.from({length:12},(_,i)=>localSurveySite(world,agent,i+1,(i+.5)/12));
      expect(sites.filter(Boolean).length).toBeGreaterThan(8);
      expect(new Set(sites.filter(Boolean).map(p=>Math.floor(Math.atan2(p!.y-agent.position.y,p!.x-agent.position.x)*4/Math.PI))).size).toBeGreaterThan(3);
      for(const site of sites) if(site) {
        const step=Math.hypot(site.x-agent.position.x,site.y-agent.position.y);
        expect(step).toBeGreaterThanOrEqual(5.9999);
        expect(step).toBeLessThanOrEqual(36.0001);
        expect(site.biome).toBe(localTerrainBiome(world,site));
        expect(site.connections).toEqual(['outskirts']);
      }
      expect(world).toEqual(before);
    }
  });

  it('does not reward a distant scripted forest over an equivalent nearby one', async () => {
    const world=await fresh('distance-choice'), a=world.agents.agent_1, p=world.places.outskirts;
    a.position={x:p.mapX,y:p.mapY,layerId:'surface'};a.locationId=p.id;a.plan=undefined;
    for(const [id,dx] of [['near',2],['far',500]] as const) world.places[id]={...p,id,kind:'forest',biome:'forest',settlementId:undefined,mapX:p.mapX+dx,mapY:p.mapY,connectedPlaceIds:[p.id]};
    a.knownPlaceIds=['near','far',p.id];
    for(let i=0;i<50;i++) expect(residentExplorationTarget(world,a,()=>true,[],.56+i*.008)).not.toBe('far');
  });

  it('exposes original Russian texts with verified pre-1901 editions and rejects later/unverified books',async()=>{
    expect(HISTORICAL_SOURCES).toHaveLength(4);
    for(const source of HISTORICAL_SOURCES) {
      expect(source.year).toBeLessThanOrEqual(1900);
      const book=await fetchRealHumanTextV18(source.page,'ru');
      expect(book.text).toBe(source.paragraphs.join('\n\n'));
      expect(book.text.length).toBeGreaterThan(10000);
      expect(book.text).not.toContain('## Дополнение');
    }
    await expect(fetchRealHumanTextV18('Современная генетика 2020','ru')).rejects.toThrow('1901');
  });

  it('retains partial reading through reload and completes the actual corpus in months of study, not decades',async()=>{
    const world=await fresh('reading-duration'),a=world.agents.agent_1;
    let progress:{pendingKnowledgeId?:string;pendingReadWords?:number}={};
    const page=HISTORICAL_READING_MATERIALS[0];
    const words=page.knowledge.join(' ').split(/\s+/u).length;
    expect(consumeReadingWords(progress,page.id,words,40).completed).toBe(false);
    progress=JSON.parse(JSON.stringify(progress));
    expect(consumeReadingWords(progress,page.id,words,words-40).completed).toBe(true);
    let minutes=0;
    for(const material of HISTORICAL_READING_MATERIALS) {
      const budget=readingBudgetV20(a,.5,24*60,material.difficulty);
      minutes+=material.knowledge.join(' ').split(/\s+/u).length/budget.wordsPerMinute;
    }
    expect(minutes/(6*60)).toBeLessThan(30);
    const pages:Record<string,number>={},known:string[]=[];
    for(let step=0;step<130;step++) {
      const material=secretLibraryStudyMaterialV18(a.id,1,step,known,pages).knowledge;
      expect(material.knownByYear).toBeLessThanOrEqual(1900);
      known.push(material.id);
      if(material.sourceBookId) {
        const n=Number(material.id.split(':page:')[1]??1);
        // A book's pages are visited in order until complete.
        if(n>(pages[material.sourceBookId]??0)) expect(n).toBe((pages[material.sourceBookId]??0)+1);
        pages[material.sourceBookId]=Math.max(pages[material.sourceBookId]??0,n);
      }
    }
    for(const source of HISTORICAL_SOURCES) expect(pages[`historical:${source.id}`]).toBe(HISTORICAL_READING_MATERIALS.filter(p=>p.sourceBookId===`historical:${source.id}`).length);
  });

  it('requires acquired knowledge, real materials, repeated physical work and a local boat for the fishing effect',async()=>{
    const world=await fresh('boat-practice'),a=world.agents.agent_1,p=world.places.outskirts;
    a.life.ageYears=24;a.skills.craft=.8;a.movement=undefined;
    world.places.test_bank={...p,id:'test_bank',kind:'river',biome:'river',surface:'shore',connectedPlaceIds:[p.id]};
    a.locationId='test_bank';a.position={x:p.mapX,y:p.mapY,layerId:'surface'};a.knownPlaceIds.push('test_bank');
    expect(boatWorkSite(world,a)).toBeUndefined();
    world.v18!.secretLibrary.knowledgeByAgentId[a.id]=[{id:'learned-boat',knowledgeId:BOAT_KNOWLEDGE_ID,title:'Корабль',category:'engineering',historicalSource:'ЭСБЕ 1895',sourceTitle:'Корабль',sourceUrl:HISTORICAL_SOURCES[0].sourceUrl,acquiredWorldMinute:0,understanding:.7,summary:'Киль, шпангоуты, обшивка',concepts:['судостроение'],practiceCount:1,sharedCount:0}];
    const economy=ensureSettlementEconomyV16(world,world.places[a.homeId].settlementId!);
    economy.stocks.wood=2;economy.stocks.stone=1;economy.activeHumanHomeProject=undefined;
    const wood=economy.stocks.wood;
    expect(workOnBoat(world,a)).toBe(true);
    expect(economy.stocks.wood).toBeCloseTo(wood-.8);
    expect(availableBoat(world,a)).toBeUndefined();
    expect(workOnBoat(world,a)).toBe(false);
    for(let i=0;i<40;i++){world.calendar.elapsedWorldMinutes+=480;workOnBoat(world,a);}
    expect(availableBoat(world,a)?.boat.completed).toBe(true);
    a.locationId=p.id;expect(availableBoat(world,a)).toBeUndefined();
    expect(economy.stocks.wood).toBeCloseTo(wood-.8);
  });
});
