import type {WorldState} from '../world/types';
import type {OceanDecision} from '../world/geography/OceanExploration';
import {oceanDecisionAllowed} from '../world/geography/OceanGeographyPolicy';
export {oceanDecisionAllowed,applyOceanDecision} from '../world/geography/OceanGeographyPolicy';

interface OceanTarget {runtimeStateView():Readonly<WorldState>;applyAuthorizedOceanDecision(decision:OceanDecision,revision:number):Promise<unknown>}
export class IndependentOceanFrontierGateway {
  constructor(private readonly target:OceanTarget){}
  async execute(decision:OceanDecision,revision:number):Promise<boolean>{
    const world=this.target.runtimeStateView();
    if(world.revision!==revision||!oceanDecisionAllowed(world,decision))return false;
    await this.target.applyAuthorizedOceanDecision(decision,revision);return true;
  }
}
