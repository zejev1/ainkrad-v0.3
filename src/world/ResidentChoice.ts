import type {AgentActionKind} from './types';

export interface ScoredAction {action:AgentActionKind;score:number}
/** A preference threshold must not remove the last physically available
 * action. In particular, a young child's only action can have a negative
 * score after ordinary repetition and personal experience. */
export function residentChoiceCandidates(scores:readonly ScoredAction[],allowed:ReadonlySet<AgentActionKind>,window:number):ScoredAction[] {
  const viable=scores.filter(s=>allowed.has(s.action)&&Number.isFinite(s.score)).sort((a,b)=>b.score-a.score);
  if(!viable.length)throw new Error('Resident has no finite, physically available action score.');
  const preferred=viable.filter(s=>s.score>=viable[0].score-window&&s.score>-.25);
  return preferred.length?preferred:viable.filter(s=>s.score>=viable[0].score-window);
}
