export interface CardinalMetrics {
  populationActivity: number;
  averageStress: number;
  socialIsolation: number;
  conflictPressure: number;
  resourcePressure: number;
  relationshipDiversity: number;
  recoveryCapacity: number;
  activeSignalCount: number;
}

export interface SensorSnapshot {
  worldId: string;
  observedAt: number;
  metrics: CardinalMetrics;
  evidenceEventIds: string[];
  limitations: string[];
}
