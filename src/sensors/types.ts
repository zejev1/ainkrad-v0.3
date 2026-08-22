export interface CardinalMetrics {
  livingPopulation: number;
  sapientPopulation: number;
  raceDiversity: number;
  reproductiveAdultMales: number;
  reproductiveAdultFemales: number;
  reproductivePairPotential: number;
  reproductiveContinuity: number;
  civilizationPressure: number;
  civilizationCriticality: number;
  recentDeathPressure: number;
  wildlifeAttackDeathShare: number;
  monsterDeathShare: number;
  wildlifeDangerPressure: number;
  monsterPressure: number;
  populationActivity: number;
  averageStress: number;
  socialIsolation: number;
  conflictPressure: number;
  safetyPressure: number;
  resourcePressure: number;
  relationshipDiversity: number;
  recoveryCapacity: number;
  exploredWorldRatio: number;
  wildlifePressure: number;
  ecologicalDiversity: number;
  activeSignalCount: number;
}

export interface SensorSnapshot {
  sensorVersion: string;
  worldId: string;
  worldRevision: number;
  observedAt: number;
  metrics: CardinalMetrics;
  evidenceEventIds: string[];
  limitations: string[];
}
