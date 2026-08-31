import type { WorldState } from '../../world/types';
import { CardinalObserver } from '../CardinalObserver';
import { IndependentInterventionGateway } from '../InterventionGateway';
import type {
  CardinalEvaluation,
  InterventionRecord,
} from '../types';
import type {
  CardinalActionGatewayPort,
  CardinalObservationPort,
} from './types';

export const AINKRAD_CARDINAL_OBSERVATION_ADAPTER_ID =
  'ainkrad-world-sensors-adapter-0.3.16';

export class AinkradCardinalObservationAdapter
  implements CardinalObservationPort<WorldState>
{
  readonly adapterId = AINKRAD_CARDINAL_OBSERVATION_ADAPTER_ID;

  constructor(private readonly observer: CardinalObserver) {}

  async observe(snapshot: Readonly<WorldState>, technicalOrder: number) {
    return await this.observer.observe(snapshot, technicalOrder);
  }
}

/** Independent host-owned adapter; never passed into PortableCardinalRuntime. */
export class AinkradCardinalActionGatewayAdapter
  implements CardinalActionGatewayPort<WorldState>
{
  readonly gatewayPolicyVersion: string;

  constructor(private readonly gateway: IndependentInterventionGateway) {
    this.gatewayPolicyVersion = gateway.policyVersion;
  }

  async authorizeAndExecute(
    evaluation: Readonly<CardinalEvaluation>,
    expectedSnapshot: Readonly<WorldState>,
    technicalOrder: number,
  ): Promise<InterventionRecord | undefined> {
    if (!evaluation.proposal) return undefined;
    return await this.gateway.execute(
      evaluation.evaluationId,
      evaluation.proposal,
      expectedSnapshot,
      technicalOrder,
      {
        worldEpoch: evaluation.worldEpoch,
        policyVersion: evaluation.policyVersion,
        sensorVersion: evaluation.sensorVersion,
        researchVersion: evaluation.researchVersion,
        evaluatedWorldMinutes: evaluation.evaluatedWorldMinutes,
      },
    );
  }
}

