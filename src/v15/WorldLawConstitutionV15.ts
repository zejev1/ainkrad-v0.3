export type WorldLawDomainV15 =
  | 'geography'
  | 'ecology'
  | 'climate'
  | 'resources'
  | 'demography'
  | 'cosmology';

export type WorldLawMechanismV15 =
  | 'frontier_expansion'
  | 'wildlife_recovery'
  | 'fertility_support'
  | 'resource_regeneration'
  | 'mystic_resonance'
  | 'weather_volatility'
  | 'catastrophe_recovery';

export const LAW_MECHANISM_DOMAINS_V15: Readonly<
  Record<WorldLawMechanismV15, WorldLawDomainV15>
> = {
  frontier_expansion: 'geography',
  wildlife_recovery: 'ecology',
  fertility_support: 'demography',
  resource_regeneration: 'resources',
  mystic_resonance: 'cosmology',
  weather_volatility: 'climate',
  catastrophe_recovery: 'ecology',
};

export const PROTECTED_PERSONHOOD_DOMAINS_V15 = [
  'identity',
  'memory',
  'agency',
  'values',
  'relationships',
] as const;

export interface WorldLawV15 {
  id: string;
  domain: WorldLawDomainV15;
  mechanism: WorldLawMechanismV15;
  value: number;
  minimum: number;
  maximum: number;
  revision: number;

  /** Technical ordering kept for compatibility. */
  createdAtTick: number;
  updatedAtTick: number;

  /** Canonical Ainkrad timestamps for human meaning/durations. */
  createdWorldMinutes: number;
  updatedWorldMinutes: number;

  /** Source of the proposal, not a statement that Cardinal executed it directly. */
  createdBy: 'system' | 'cardinal';
  rationale: string;
}

export interface GatewayLawAuthorizationV15 {
  authorizationId: string;
  issuer: 'independent_gateway';
  authorized: true;
  worldId: string;
  expectedWorldRevision: number;
  authorizedAtWorldMinutes: number;
  proposalSource: 'cardinal' | 'system';
}

export interface AuthorizedWorldLawMutationV15 {
  authorization: GatewayLawAuthorizationV15;
  law: WorldLawV15;
}

export const DEFAULT_WORLD_LAWS_V15: readonly Omit<
  WorldLawV15,
  'revision' | 'createdAtTick' | 'updatedAtTick' |
  'createdWorldMinutes' | 'updatedWorldMinutes' | 'createdBy'
>[] = [
  {
    id: 'frontier_expansion_rate',
    domain: 'geography',
    mechanism: 'frontier_expansion',
    value: 1,
    minimum: 0.25,
    maximum: 2.5,
    rationale: 'Residents may discover a continuously generated frontier.',
  },
  {
    id: 'wildlife_recovery_rate',
    domain: 'ecology',
    mechanism: 'wildlife_recovery',
    value: 1,
    minimum: 0.35,
    maximum: 2,
    rationale: 'Wildlife recovers through habitat conditions rather than spawning on command.',
  },
  {
    id: 'fertility_support',
    domain: 'demography',
    mechanism: 'fertility_support',
    value: 0.55,
    minimum: 0.1,
    maximum: 1,
    rationale: 'Families remain voluntary while the world can support new life.',
  },
  {
    id: 'resource_regeneration',
    domain: 'resources',
    mechanism: 'resource_regeneration',
    value: 1,
    minimum: 0.35,
    maximum: 2,
    rationale: 'Shared resources recover according to ecological capacity.',
  },
  {
    id: 'mystic_resonance',
    domain: 'cosmology',
    mechanism: 'mystic_resonance',
    value: 0.35,
    minimum: 0,
    maximum: 1,
    rationale: 'Unexplained events may become belief, ritual and myth through lived experience.',
  },
  {
    id: 'weather_volatility',
    domain: 'climate',
    mechanism: 'weather_volatility',
    value: 0.2,
    minimum: 0,
    maximum: 0.8,
    rationale: 'Weather may vary without directly commanding residents.',
  },
  {
    id: 'catastrophe_recovery',
    domain: 'ecology',
    mechanism: 'catastrophe_recovery',
    value: 0.75,
    minimum: 0.25,
    maximum: 1.5,
    rationale: 'A damaged world retains a path to recovery after a systemic event.',
  },
] as const;

function finite(value:number,label:string):void{
  if(!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

export function instantiateDefaultWorldLawsV15(
  technicalTick:number,
  worldMinutes:number,
):Record<string,WorldLawV15>{
  finite(technicalTick,'technicalTick');
  finite(worldMinutes,'worldMinutes');
  if(worldMinutes<0) throw new Error('worldMinutes must be non-negative.');

  return Object.fromEntries(DEFAULT_WORLD_LAWS_V15.map((item)=>[
    item.id,
    {
      ...item,
      revision:0,
      createdAtTick:technicalTick,
      updatedAtTick:technicalTick,
      createdWorldMinutes:worldMinutes,
      updatedWorldMinutes:worldMinutes,
      createdBy:'system' as const,
    },
  ]));
}

function validateLawShape(
  domain:WorldLawDomainV15,
  mechanism:WorldLawMechanismV15,
  value:number,
  minimum:number,
  maximum:number,
):void{
  if(LAW_MECHANISM_DOMAINS_V15[mechanism]!==domain){
    throw new Error('World-law mechanism does not belong to its domain.');
  }
  finite(value,'value');finite(minimum,'minimum');finite(maximum,'maximum');
  if(minimum>maximum || value<minimum || value>maximum){
    throw new Error('World-law value is outside the proposed range.');
  }
}

/**
 * Applies the proven constitutional range rule, but only when an independent
 * Gateway authorization object is present.
 *
 * Cardinal itself has no direct mutation function in this module.
 */
export function prepareAuthorizedWorldLawMutationV15(
  params:{
    worldId:string;
    currentWorldRevision:number;
    current?:WorldLawV15;
    lawId:string;
    domain:WorldLawDomainV15;
    mechanism:WorldLawMechanismV15;
    value:number;
    minimum:number;
    maximum:number;
    rationale:string;
    technicalTick:number;
    worldMinutes:number;
    proposalSource:'cardinal'|'system';
  },
  authorization:GatewayLawAuthorizationV15,
):AuthorizedWorldLawMutationV15{
  if(!params.worldId.trim() || !params.lawId.trim() || !params.rationale.trim()){
    throw new Error('World-law mutation requires IDs and rationale.');
  }
  if(
    authorization.issuer!=='independent_gateway' ||
    authorization.authorized!==true
  ){
    throw new Error('Independent Gateway authorization is required.');
  }
  if(authorization.worldId!==params.worldId){
    throw new Error('Gateway authorization belongs to a different world.');
  }
  if(authorization.expectedWorldRevision!==params.currentWorldRevision){
    throw new Error('Gateway authorization is stale for this world revision.');
  }
  if(authorization.proposalSource!==params.proposalSource){
    throw new Error('Gateway authorization proposal source mismatch.');
  }
  finite(params.technicalTick,'technicalTick');
  finite(params.worldMinutes,'worldMinutes');
  if(params.worldMinutes<0) throw new Error('worldMinutes must be non-negative.');

  validateLawShape(
    params.domain,params.mechanism,params.value,params.minimum,params.maximum
  );

  let law:WorldLawV15;
  if(!params.current){
    law={
      id:params.lawId,
      domain:params.domain,
      mechanism:params.mechanism,
      value:params.value,
      minimum:params.minimum,
      maximum:params.maximum,
      revision:0,
      createdAtTick:params.technicalTick,
      updatedAtTick:params.technicalTick,
      createdWorldMinutes:params.worldMinutes,
      updatedWorldMinutes:params.worldMinutes,
      createdBy:params.proposalSource,
      rationale:params.rationale,
    };
  }else{
    const current=params.current;
    if(
      current.id!==params.lawId ||
      current.domain!==params.domain ||
      current.mechanism!==params.mechanism ||
      params.minimum<current.minimum ||
      params.maximum>current.maximum ||
      params.value<current.minimum ||
      params.value>current.maximum
    ){
      throw new Error(`World law ${params.lawId} exceeds its constitutional range.`);
    }
    law={
      ...current,
      value:params.value,
      revision:current.revision+1,
      updatedAtTick:params.technicalTick,
      updatedWorldMinutes:params.worldMinutes,
      createdBy:params.proposalSource,
      rationale:params.rationale,
    };
  }

  return {authorization:{...authorization},law};
}

export function assertPersonhoodConstitutionV15(
  domains:readonly string[],
):void{
  if(
    domains.length!==PROTECTED_PERSONHOOD_DOMAINS_V15.length ||
    PROTECTED_PERSONHOOD_DOMAINS_V15.some((d,i)=>domains[i]!==d)
  ){
    throw new Error('World personhood constitution was altered.');
  }
}
