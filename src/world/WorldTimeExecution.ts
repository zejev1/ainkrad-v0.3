/** Scheduling lives outside the simulated clock. Yielding advances no time. */
export interface WorldTimeExecution {
  afterQuantum(): Promise<void>;
  shouldStop(): boolean;
}

type YieldInterval = number | (() => number);

// MessageChannel schedules a real host task without the timer clamping that
// makes setTimeout(0) particularly costly in console/mobile browsers.
const yieldToHost = (() => {
  if (typeof MessageChannel === 'undefined') {
    return () => new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return () => new Promise<void>(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(0);
  });
})();

export function cooperativeWorldTimeExecution(
  shouldStop:()=>boolean,
  yieldInterval: YieldInterval = 12,
): WorldTimeExecution {
  let yieldedAt=performance.now();
  return {
    shouldStop,
    async afterQuantum() {
      const requested = typeof yieldInterval === 'function' ? yieldInterval() : yieldInterval;
      const interval = Number.isFinite(requested) ? Math.max(4, requested) : 12;
      if(performance.now()-yieldedAt<interval && !shouldStop())return;
      await yieldToHost();
      yieldedAt=performance.now();
    },
  };
}
