import {it,expect,vi} from 'vitest';
import {WorldSensors} from '../src/sensors/WorldSensors';
import {WorldEngine} from '../src/world/WorldEngine';
import {InMemoryWorldStore} from '../src/world/InMemoryWorldStore';

it('reuses only atomically committed evidence, preserving independent audits and invalidating on revision, time and failures',async()=>{
  const store=new InMemoryWorldStore(),world=await WorldEngine.create({worldId:'sensor-cache',seed:'sensor-cache',store});
  const sensors=new WorldSensors(store,true),auditor=new WorldSensors(store,true),recent=vi.spyOn(store,'recent'),signals=vi.spyOn(store,'activeSignals');
  const snapshot=world.snapshot(),first=await sensors.observe(snapshot,snapshot.now);
  const baseline=structuredClone(first);first.metrics.averageStress=999;first.evidenceEventIds.push('forged');
  for(let n=0;n<100;n++)expect(await sensors.observe(structuredClone(snapshot),snapshot.now)).toEqual(baseline);
  expect(recent).toHaveBeenCalledTimes(1);expect(signals).toHaveBeenCalledTimes(1);
  expect(await auditor.observe(snapshot,snapshot.now)).toEqual(baseline);
  expect(recent).toHaveBeenCalledTimes(2); // Independent sensor never borrows Cardinal's evidence.
  await world.controlHydrologySystem({kind:'stop'},'revision-without-time',snapshot.revision);
  const changed=world.snapshot();expect(changed.now).toBe(snapshot.now);
  await sensors.observe(changed,changed.now);expect(recent).toHaveBeenCalledTimes(3);
  recent.mockRejectedValueOnce(new Error('temporary read failure'));
  const another={...changed,revision:changed.revision+1};
  await expect(sensors.observe(another,another.now)).rejects.toThrow('temporary read failure');
  await sensors.observe(another,another.now);expect(recent).toHaveBeenCalledTimes(5);
  await expect(sensors.observe(another,another.now+1)).rejects.toThrow('observation time');
  const general=new WorldSensors(store);await general.observe(changed,changed.now);await general.observe(changed,changed.now);
  expect(recent).toHaveBeenCalledTimes(7);
});
