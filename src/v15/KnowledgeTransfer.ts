import type { GenesisDomain, GenesisTeacher } from './GenesisBootstrap';
import { isGenesisTeacherActive } from './GenesisBootstrap';

export interface KnowledgeProfile {
  agriculture: number;
  construction: number;
  household: number;
  survival: number;
}

export interface LearningPerson {
  id: string;
  generation: number;
  ageYears: number;
  aptitude: Record<GenesisDomain, number>;
  knowledge: KnowledgeProfile;
}

export interface OrdinaryInstructor extends LearningPerson {
  ordinaryResident: true;
}

export interface LessonSession {
  lessonId: string;
  domain: GenesisDomain;
  instructorId: string;
  learnerId: string;
  worldMinutes: number;
  durationWorldMinutes: number;
  activityVerified: true;
}

export interface LearningCalibration {
  minimumLearningAgeYears: number;
  referenceLessonWorldMinutes: number;
  lessonGainAtEqualAptitude: number;
  practiceGainPerReferenceSession: number;
  maxLessonGainPerSession: number;
  maxPracticeGainPerSession: number;
}

export const DEFAULT_LEARNING_CALIBRATION: LearningCalibration = {
  minimumLearningAgeYears: 7,
  referenceLessonWorldMinutes: 240,
  lessonGainAtEqualAptitude: 0.012,
  practiceGainPerReferenceSession: 0.0045,
  maxLessonGainPerSession: 0.025,
  maxPracticeGainPerSession: 0.012,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function domainValue(
  profile: KnowledgeProfile,
  domain: GenesisDomain,
): number {
  return profile[domain];
}

function setDomainValue(
  profile: KnowledgeProfile,
  domain: GenesisDomain,
  value: number,
): void {
  profile[domain] = clamp01(value);
}

export interface LessonResult {
  before: number;
  after: number;
  gained: number;
}

/**
 * Real lesson path. There is no API here that accepts "target level" or writes
 * arbitrary knowledge into the learner.
 */
export function applyOrdinaryLesson(
  instructor: OrdinaryInstructor,
  learner: LearningPerson,
  session: LessonSession,
  calibration: LearningCalibration = DEFAULT_LEARNING_CALIBRATION,
): LessonResult {
  if (session.instructorId !== instructor.id || session.learnerId !== learner.id) {
    throw new Error('Lesson participants do not match the session.');
  }
  if (session.activityVerified !== true) {
    throw new Error('Knowledge transfer requires a verified real activity.');
  }
  if (learner.ageYears < calibration.minimumLearningAgeYears) {
    throw new Error('Learner has not reached the learning age.');
  }
  if (
    !Number.isFinite(session.durationWorldMinutes) ||
    session.durationWorldMinutes <= 0
  ) {
    throw new Error('Lesson duration must be positive world minutes.');
  }

  const before = domainValue(learner.knowledge, session.domain);
  const teacherLevel = domainValue(instructor.knowledge, session.domain);
  const gap = Math.max(0, teacherLevel - before);
  const aptitude = clamp01(learner.aptitude[session.domain]);
  const durationScale = Math.min(
    2,
    session.durationWorldMinutes / calibration.referenceLessonWorldMinutes,
  );

  // No instant specialist production: one session is tightly bounded.
  const potential =
    calibration.lessonGainAtEqualAptitude *
    (0.4 + aptitude * 0.6) *
    durationScale;

  // A teacher can efficiently transmit only what they know.
  const gained = Math.min(
    calibration.maxLessonGainPerSession,
    gap,
    potential,
  );

  setDomainValue(learner.knowledge, session.domain, before + gained);
  return {
    before,
    after: domainValue(learner.knowledge, session.domain),
    gained,
  };
}

export function applyGenesisLesson(
  teacher: GenesisTeacher,
  learner: LearningPerson,
  teacherKnowledge: number,
  session: LessonSession,
  calibration: LearningCalibration = DEFAULT_LEARNING_CALIBRATION,
): LessonResult {
  if (!isGenesisTeacherActive(teacher, session.worldMinutes)) {
    throw new Error('Genesis Teacher is inactive.');
  }
  if (session.instructorId !== teacher.id) {
    throw new Error('Genesis lesson instructor mismatch.');
  }
  if (session.domain !== teacher.domain) {
    throw new Error('Genesis Teacher may teach only its bootstrap domain.');
  }

  // Use the same real-lesson mechanics as an ordinary teacher by projecting
  // the Genesis domain knowledge into a temporary instructor view.
  const ordinaryProjection: OrdinaryInstructor = {
    id: teacher.id,
    generation: -1,
    ageYears: 1_000,
    ordinaryResident: true,
    aptitude: {
      agriculture: 1,
      construction: 1,
      household: 1,
      survival: 1,
    },
    knowledge: {
      agriculture: 0,
      construction: 0,
      household: 0,
      survival: 0,
      [teacher.domain]: Math.max(0, teacherKnowledge),
    },
  };
  return applyOrdinaryLesson(
    ordinaryProjection,
    learner,
    session,
    calibration,
  );
}

export interface PracticeSession {
  practiceId: string;
  personId: string;
  domain: GenesisDomain;
  worldMinutes: number;
  durationWorldMinutes: number;
  activityVerified: true;
  challenge: number;
}

/**
 * Practice is independent from teachers and intentionally has no Genesis cap.
 * A resident can therefore exceed the original bootstrap teacher level over
 * enough lived experience.
 */
export function applyIndependentPractice(
  person: LearningPerson,
  session: PracticeSession,
  calibration: LearningCalibration = DEFAULT_LEARNING_CALIBRATION,
): LessonResult {
  if (session.personId !== person.id) {
    throw new Error('Practice person mismatch.');
  }
  if (session.activityVerified !== true) {
    throw new Error('Practice requires a verified real activity.');
  }
  if (
    !Number.isFinite(session.durationWorldMinutes) ||
    session.durationWorldMinutes <= 0
  ) {
    throw new Error('Practice duration must be positive world minutes.');
  }

  const before = domainValue(person.knowledge, session.domain);
  const aptitude = clamp01(person.aptitude[session.domain]);
  const challenge = clamp01(session.challenge);
  const durationScale = Math.min(
    3,
    session.durationWorldMinutes / calibration.referenceLessonWorldMinutes,
  );
  const gained = Math.min(
    calibration.maxPracticeGainPerSession,
    calibration.practiceGainPerReferenceSession *
      (0.35 + aptitude * 0.65) *
      (0.45 + challenge * 0.55) *
      durationScale,
  );

  setDomainValue(person.knowledge, session.domain, before + gained);
  return {
    before,
    after: domainValue(person.knowledge, session.domain),
    gained,
  };
}
