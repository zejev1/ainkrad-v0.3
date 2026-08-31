/**
 * Determinism acceptance helpers.
 *
 * These compare externally supplied serializable snapshots/histories. They do
 * not reconstruct the missing SeededRng algorithm.
 */
export interface DeterminismComparisonV15 {
  sameState:boolean;
  sameHistory:boolean;
  ok:boolean;
}

function stableComparable(value:unknown):string{
  if(value===null || typeof value!=='object'){
    return JSON.stringify(value);
  }
  if(Array.isArray(value)){
    return `[${value.map(stableComparable).join(',')}]`;
  }
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map(
    key=>`${JSON.stringify(key)}:${stableComparable(record[key])}`
  ).join(',')}}`;
}

export function compareDeterministicRunsV15(
  leftState:unknown,
  leftHistory:unknown,
  rightState:unknown,
  rightHistory:unknown,
):DeterminismComparisonV15{
  const sameState=stableComparable(leftState)===stableComparable(rightState);
  const sameHistory=stableComparable(leftHistory)===stableComparable(rightHistory);
  return {sameState,sameHistory,ok:sameState&&sameHistory};
}

export interface RngRollbackAuditInput{
  beforeRngState:unknown;
  afterFailureRngState:unknown;
}

export function auditRngRollbackV15(
  input:RngRollbackAuditInput,
):boolean{
  return stableComparable(input.beforeRngState)===
    stableComparable(input.afterFailureRngState);
}
