export interface CardinalMetrics {
  populationActivity: number;
  averageStress: number;
  socialIsolation: number;
  conflictPressure: number;
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
