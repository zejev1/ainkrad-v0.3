import type { SensorSnapshot } from '../../sensors/types';
import type {
  CardinalEvaluation,
  InterventionRecord,
} from '../types';

/**
 * A host-world adapter maps its own immutable snapshot into Cardinal's stable
 * semantic sensor contract. Cardinal never receives the host engine itself.
 */
export interface CardinalObservationPort<THostSnapshot> {
  readonly adapterId: string;
  observe(
    snapshot: Readonly<THostSnapshot>,
    technicalOrder: number,
  ): Promise<SensorSnapshot>;
}

/**
 * The mutation capability remains outside PortableCardinalRuntime. A host may
 * choose to provide this independent boundary, or run Cardinal as observer.
 */
export interface CardinalActionGatewayPort<THostSnapshot> {
  readonly gatewayPolicyVersion: string;
  authorizeAndExecute(
    evaluation: Readonly<CardinalEvaluation>,
    expectedSnapshot: Readonly<THostSnapshot>,
    technicalOrder: number,
  ): Promise<InterventionRecord | undefined>;
}

