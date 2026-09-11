/** Scheduling lives outside the simulated clock. Yielding advances no time. */
export interface WorldTimeExecution {
  afterQuantum(): Promise<void>;
  shouldStop(): boolean;
}
export function cooperativeWorldTimeExecution(shouldStop:()=>boolean): WorldTimeExecution {
  let yieldedAt=performance.now();
  return {
    shouldStop,
    async afterQuantum() {
      if(performance.now()-yieldedAt<12 && !shouldStop())return;
      await new Promise<void>(resolve=>setTimeout(resolve,0));
      yieldedAt=performance.now();
    },
  };
}
