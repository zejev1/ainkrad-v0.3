export interface V15EpochSnapshot {
  epochId: string;
  elapsedWorldMinutes: number;
  ordinaryResidentIds: string[];
  genesisTeacherIds: string[];
  genesisTeachingHistoryIds: string[];
  discoveredDistantRegionIds: string[];
  currentEpochEvidenceEpochIds: string[];
  activeTimedWindowEpochIds: string[];
  lineageReferences: Array<{
    residentId: string;
    parentIds: string[];
    childIds: string[];
  }>;
  cardinalAllTimeObservationCycles: number;
}

export interface V15ResetAuditResult {
  ok: boolean;
  failures: string[];
}

/**
 * Audits the v15 "New world" epoch boundary.
 *
 * Cardinal all-time experience is deliberately allowed to persist, but
 * current-world residents, Genesis identities/history, frontier and timed
 * evidence must be fresh.
 */
export function auditV15NewWorldReset(
  before: V15EpochSnapshot,
  after: V15EpochSnapshot,
): V15ResetAuditResult {
  const failures: string[] = [];

  if (!after.epochId || after.epochId === before.epochId) {
    failures.push('new_epoch_id_required');
  }
  if (after.ordinaryResidentIds.length !== 10) {
    failures.push('new_world_must_start_with_10_ordinary_residents');
  }
  if (after.genesisTeacherIds.length !== 4) {
    failures.push('new_world_must_start_with_4_genesis_teachers');
  }

  const priorPeople = new Set([
    ...before.ordinaryResidentIds,
    ...before.genesisTeacherIds,
  ]);
  if (
    [...after.ordinaryResidentIds, ...after.genesisTeacherIds].some((id) =>
      priorPeople.has(id),
    )
  ) {
    failures.push('resident_or_genesis_identity_leaked_across_epoch');
  }

  const oldTeachingHistory = new Set(before.genesisTeachingHistoryIds);
  if (after.genesisTeachingHistoryIds.some((id) => oldTeachingHistory.has(id))) {
    failures.push('genesis_teaching_history_leaked_across_epoch');
  }

  if (after.discoveredDistantRegionIds.length !== 0) {
    failures.push('distant_frontier_must_reset');
  }

  if (
    after.currentEpochEvidenceEpochIds.some((epoch) => epoch !== after.epochId)
  ) {
    failures.push('old_epoch_evidence_in_current_context');
  }

  if (
    after.activeTimedWindowEpochIds.some((epoch) => epoch !== after.epochId)
  ) {
    failures.push('old_epoch_timed_window_still_active');
  }

  const afterIds = new Set(after.ordinaryResidentIds);
  for (const link of after.lineageReferences) {
    if (!afterIds.has(link.residentId)) {
      failures.push('lineage_owner_missing_from_new_epoch');
      continue;
    }
    if (
      [...link.parentIds, ...link.childIds].some(
        (relativeId) => !afterIds.has(relativeId),
      )
    ) {
      failures.push('lineage_reference_leaked_across_epoch');
    }
  }

  if (after.elapsedWorldMinutes !== 0) {
    failures.push('new_world_calendar_must_start_at_zero');
  }

  if (
    after.cardinalAllTimeObservationCycles <
    before.cardinalAllTimeObservationCycles
  ) {
    failures.push('cardinal_all_time_experience_unexpectedly_rewound');
  }

  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
  };
}
