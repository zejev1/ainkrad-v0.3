export interface FamilyRelationshipSeedV15 {
  agentA: string;
  agentB: string;
  trust: number;
  affinity: number;
  respect: number;
  conflict: number;
  updatedAtTick: number;
  updatedWorldMinutes: number;
}

export interface FamilyEmotionStateV15 {
  joy: number;
  hope: number;
  grief: number;
}

export interface FamilyBeliefStateV15 {
  afterlife: number;
}

export interface FamilyContinuityPersonV15 {
  id: string;
  name: string;
  alive: boolean;
  parentIds: string[];
  childIds: string[];
  emotions: FamilyEmotionStateV15;
  beliefs: FamilyBeliefStateV15;
}

export interface FamilyMemoryV15 {
  memoryId: string;
  agentId: string;
  technicalTick: number;
  worldMinutes: number;
  kind: 'birth' | 'death';
  summary: string;
  importance: number;
  valence: number;
  relatedAgentIds: string[];
}

export interface BirthContinuityResultV15 {
  parentChildRelationships: [FamilyRelationshipSeedV15, FamilyRelationshipSeedV15];
  parentEmotionUpdates: Array<{
    parentId: string;
    before: FamilyEmotionStateV15;
    after: FamilyEmotionStateV15;
  }>;
  memories: [FamilyMemoryV15, FamilyMemoryV15];
  event: {
    kind: 'agent.born';
    technicalTick: number;
    worldMinutes: number;
    payload: {
      agentId: string;
      name: string;
      parentIds: [string, string];
      generation: number;
    };
  };
}

export interface RelationshipForBereavementV15 {
  agentA: string;
  agentB: string;
  trust: number;
  affinity: number;
  respect: number;
  conflict: number;
}

export interface DeathContinuityResultV15 {
  affectedPersonIds: string[];
  emotionUpdates: Array<{
    personId: string;
    before: FamilyEmotionStateV15;
    after: FamilyEmotionStateV15;
    beforeAfterlife: number;
    afterAfterlife: number;
  }>;
  memories: FamilyMemoryV15[];
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

function relationshipKey(left: string, right: string): [string, string] {
  return left < right ? [left, right] : [right, left];
}

/**
 * Exact recovered parent-child relationship seed from v0.3.13.
 */
export function parentChildRelationshipSeedV15(
  parentId: string,
  childId: string,
  technicalTick: number,
  worldMinutes: number,
): FamilyRelationshipSeedV15 {
  const [agentA, agentB] = relationshipKey(parentId, childId);
  return {
    agentA,
    agentB,
    trust: 0.82,
    affinity: 0.88,
    respect: 0.58,
    conflict: 0.02,
    updatedAtTick: technicalTick,
    updatedWorldMinutes: worldMinutes,
  };
}

/**
 * Exact recovered birth-continuity effects, with v15 canonical world-time
 * fields added alongside technical tick ordering.
 *
 * This function does NOT decide whether a child should exist. It runs only
 * after the independent v15 family decision and world eligibility checks have
 * already produced an actual birth.
 */
export function buildBirthContinuityEffectsV15(
  params: {
    childId: string;
    childName: string;
    generation: number;
    parentA: FamilyContinuityPersonV15;
    parentB: FamilyContinuityPersonV15;
    technicalTick: number;
    worldMinutes: number;
    nextMemoryId: () => string;
  },
): BirthContinuityResultV15 {
  const parents = [params.parentA, params.parentB] as const;

  const parentEmotionUpdates = parents.map((parent) => {
    const before = {...parent.emotions};
    const after = {
      ...before,
      joy: clamp01(before.joy + 0.28),
      hope: clamp01(before.hope + 0.22),
    };
    return {
      parentId: parent.id,
      before,
      after,
    };
  });

  const memories = parents.map((parent) => ({
    memoryId: params.nextMemoryId(),
    agentId: parent.id,
    technicalTick: params.technicalTick,
    worldMinutes: params.worldMinutes,
    kind: 'birth' as const,
    summary:
      `${params.childName} was born to ${params.parentA.name} and ${params.parentB.name}.`,
    importance: 0.98,
    valence: 0.92,
    relatedAgentIds: [
      params.childId,
      parent.id === params.parentA.id
        ? params.parentB.id
        : params.parentA.id,
    ],
  })) as [FamilyMemoryV15, FamilyMemoryV15];

  return {
    parentChildRelationships: [
      parentChildRelationshipSeedV15(
        params.parentA.id,
        params.childId,
        params.technicalTick,
        params.worldMinutes,
      ),
      parentChildRelationshipSeedV15(
        params.parentB.id,
        params.childId,
        params.technicalTick,
        params.worldMinutes,
      ),
    ],
    parentEmotionUpdates,
    memories,
    event: {
      kind: 'agent.born',
      technicalTick: params.technicalTick,
      worldMinutes: params.worldMinutes,
      payload: {
        agentId: params.childId,
        name: params.childName,
        parentIds: [params.parentA.id, params.parentB.id],
        generation: params.generation,
      },
    },
  };
}

/**
 * Reconstructs the exact recovered bereavement-selection rule:
 * - parents and children are always included;
 * - any other relationship whose
 *   trust + affinity + respect - conflict >= 1.45 is also included.
 */
export function bereavementAffectedPeopleV15(
  deceased: FamilyContinuityPersonV15,
  people: Readonly<Record<string, FamilyContinuityPersonV15>>,
  relationships: readonly RelationshipForBereavementV15[],
): string[] {
  const affected = new Set<string>([
    ...deceased.parentIds,
    ...deceased.childIds,
  ]);

  for (const relationship of relationships) {
    const otherId =
      relationship.agentA === deceased.id
        ? relationship.agentB
        : relationship.agentB === deceased.id
          ? relationship.agentA
          : undefined;
    if (!otherId) continue;

    const bondStrength =
      relationship.trust +
      relationship.affinity +
      relationship.respect -
      relationship.conflict;

    if (bondStrength >= 1.45) {
      affected.add(otherId);
    }
  }

  return [...affected]
    .filter((id) => people[id]?.alive)
    .sort();
}

/**
 * Exact recovered emotional/memory deltas for death continuity:
 * grief +.46, joy -.24, afterlife +.035,
 * memory importance .96, valence -.92.
 *
 * This mutates no resident. It returns a proposed state transition so the
 * real WorldEngine can commit it transactionally and auditably.
 */
export function buildDeathContinuityEffectsV15(
  params: {
    deceased: FamilyContinuityPersonV15;
    people: Readonly<Record<string, FamilyContinuityPersonV15>>;
    relationships: readonly RelationshipForBereavementV15[];
    technicalTick: number;
    worldMinutes: number;
    nextMemoryId: () => string;
  },
): DeathContinuityResultV15 {
  const affectedPersonIds = bereavementAffectedPeopleV15(
    params.deceased,
    params.people,
    params.relationships,
  );

  const emotionUpdates: DeathContinuityResultV15['emotionUpdates'] = [];
  const memories: FamilyMemoryV15[] = [];

  for (const personId of affectedPersonIds) {
    const person = params.people[personId];
    if (!person?.alive) continue;

    const before = {...person.emotions};
    const beforeAfterlife = person.beliefs.afterlife;
    const after = {
      ...before,
      grief: clamp01(before.grief + 0.46),
      joy: clamp01(before.joy - 0.24),
    };
    const afterAfterlife = clamp01(beforeAfterlife + 0.035);

    emotionUpdates.push({
      personId,
      before,
      after,
      beforeAfterlife,
      afterAfterlife,
    });

    memories.push({
      memoryId: params.nextMemoryId(),
      agentId: person.id,
      technicalTick: params.technicalTick,
      worldMinutes: params.worldMinutes,
      kind: 'death',
      summary: `${person.name} lost ${params.deceased.name}.`,
      importance: 0.96,
      valence: -0.92,
      relatedAgentIds: [params.deceased.id],
    });
  }

  return {
    affectedPersonIds,
    emotionUpdates,
    memories,
  };
}
