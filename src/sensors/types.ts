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
  /** v18 observer-only social/economic evidence; never an agent command. */
  averageSatiety?: number;
  outsideHomeSettlementShare?: number;
  professionDiversity?: number;
  undecidedLivelihoodShare?: number;
  productiveActionShare?: number;
  communicationActionShare?: number;
  workActionShare?: number;
  prayerActionShare?: number;
}

export interface SensorSnapshot {
  sensorVersion: string;
  worldId: string;
  worldEpoch: number;
  worldRevision: number;
  /** Technical ordering/idempotency coordinate only. */
  observedAt: number;
  /** Canonical Ainkrad time used by every semantic window. */
  observedWorldMinutes: number;
  metrics: CardinalMetrics;
  evidenceEventIds: string[];
  limitations: string[];
}
