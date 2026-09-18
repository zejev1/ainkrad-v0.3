import { residentKnownPath, invalidateResidentNavigation } from './ResidentNavigation';
import { consultSettlementMap, residentSurveyedPlaceIds, recordResidentSurvey, recordResidentRouteArrival, assertResidentCartography } from './ResidentCartography';
import {applyOceanDecision} from './geography/OceanGeographyPolicy';
import {assertOceanExploration,type OceanDecision} from './geography/OceanExploration';
import { consumeReadingWords } from '../v18/HistoricalReading';
import {boatWorkSite, workOnBoat} from '../v21/MaritimePractice';
import {advanceBoats, availableBoat, startBoatExploration, startBoatFishing, startBoatTravel} from '../v21/BoatNavigation';
import {assertBoatNavigation} from '../v21/BoatValidation';
import {surveySettlementSite} from './geography/FrontierSurvey';
import {localSurveySite} from './geography/LocalExploration';
import {residentChoiceCandidates} from './ResidentChoice';
import { residentDecisionReflection } from './ResidentDecisionReflection';
import { residentExplorationTarget } from './ResidentExploration';
import { residentOpportunityWindow } from './ResidentOpportunityWindow';
import { explorationEvidence, recordExplorationArrival } from './ResidentExplorationEvidence';
import {bindWorldTerrain,assertTerrainFoundation,homelandCenterForWorld,terrainWalkingScale} from './geography/WorldTerrain';
import { assertPlaceGeography } from './WorldGeographyValidation';
import type { WorldTimeExecution } from './WorldTimeExecution';
import { createFoundingOcean, repairFoundingOcean } from './FoundingOcean';
import { LIBRARY_IDS, LIBRARY_YEAR, admissionDeadline, isSecretLibrary, libraryIdOf, libraryIdForAgent, hasLibraryAdmission, reconcileLibraryAdmissions, enforceLibraryBoundary, noteLibraryArrival } from '../v21/LibraryAdmissions';
import { ensureElfLibraryV20, elfStudyMaterialV20, readingBudgetV20 } from '../v20/LibraryLearningV20';
import type { WorldInterventionKind as InterventionKind, WorldInputEnvelope as InputEnvelope } from '../core/WorldContracts';
import { observeLocalPlacesV20, sharePlaceKnowledgeV20, removeUnsurveyedHomelandLinksV20, mayKnowPlaceV20 } from '../v20/KnowledgeBoundariesV20';
import { nextUrbanHomeLot } from './SettlementStreets';
import { repairCompactSettlementLayout } from './CompactSettlementLayout';
import {ensureInhabitedLandRescue} from './geography/InhabitedLandRescue';
import {ensureRulidHarbor} from './RulidHarbor';
import { assertResidentLearning, beginLearningAttempt, finishLearningAttempt, learnedActionAdjustment, learnedSiteAdjustment, noteLearningHelp, noteLearningMaterial } from './learning/index';
import { canResidentAct, stopDeceasedActions, repairDeceasedActions, assertDeceasedBody } from './ResidentBodyBoundary';
import {
  knownMeetingPlace,
  socialOpportunityAvailable,
} from './ResidentNavigationKnowledge';
import {
  CENTURY_HUMPBACK_CRAWL,
  CENTURY_HUMPBACK_INCUBATION,
  CENTURY_HUMPBACK_INTERVAL,
  CENTURY_HUMPBACK_LARVA_KILLED_INTERVAL,
  CENTURY_HUMPBACK_SPECIES,
  CENTURY_HUMPBACK_STRENGTH_THRESHOLD,
  canDefeatAdultCenturyHumpback,
  createCenturyHumpbackState,
  ensureCenturyHumpbackState,
} from './CenturyHumpback';
import { hasGiftV20, learningFactorV20, canReadLibraryV20, giftLearningSnapshotV20, applyLivedGiftLearningV20, giftMasteryV20, practiceGiftV20, isImmortalV20, giftInheritanceChanceV20, inheritedGiftMasteryV20, giftIsHeritableV20, burdenIntensityV22, triggerPhoenixV22 } from '../v20/DivineGiftsV20';
import {
  HUMAN_HOUSE_RECIPES_V21,
  humanConstructionLaborV21,
  humanConstructionStageV21,
  humanConstructionVolunteerWillingnessV21,
  humanHousingInitiativeV21,
  selectHumanHouseRecipeV21,
} from '../v21/HumanConstructionV21';
import {
  advanceEmergentSocietyV21,
  emergentPracticeActionAffinityV21,
} from '../v21/EmergentSocietyV21';
import {
  fulfillContractFromLivedActionV21,
  recordPhysicalGoodsV21,
} from '../v21/EconomySystemV21';
import { formVoluntaryDungeonPartyV21 } from '../v21/DungeonRpgV21';
import { reusableAbandonedHomesV21 } from '../v21/HomeStewardshipV21';
import {
  ensureFoundingPrimerV21,
  studyFoundingPrimerV21,
} from '../v21/FoundingPrimerV21';
import { worldWeatherV21 } from '../v21/WeatherV21';
import { advanceBodySleepV21, bodyFatigueDecisionBoostV21, bodyFatigueMobilityScaleV21, isBodySleepingV21, nextBodyWakeWorldMinuteV21, startBodySleepV21, wakeDueSleepingBodiesV21 } from '../v21/BodySleepV21';
import {
  advanceEmbodiedWorldV21,
  assertEmbodiedWorldV21,
  bodyCareNeedV21,
  bodyMobilityScaleV21,
  bodyRecoveryScaleV21,
  careActionAffinityV21,
  createEmbodiedWorldV21,
  ensureAgentEmbodiedWorldV21,
  ensureEmbodiedWorldV21,
  recordCarePracticeV21,
  recordDeferredChildTripV21,
  recordEmbodiedReadingV21,
  recordItemUseV21,
  recordMaterialPracticeV21,
  recordTraumaV21,
  youngChildMayTravelToV21,
} from '../v21/EmbodiedWorldV21';
import {
  choosePregnancyMultiplicityV22,
  maternalChildbirthMortalityRiskV22,
  maternalPostpartumHealthLossV22,
  newbornMultipleHealthPenaltyV22,
  type BirthMultiplicityV22,
} from '../v22/MultipleBirthsV22';
import { stableJsonStringify } from '../core/stableJson';
import { SeededRng } from '../utils/rng';
import {
  createGenesisTeachers,
  genesisBootstrapAvailableToV15,
  GENESIS_ACTIVE_WORLD_MINUTES,
  isGenesisTeacherActive,
  type GenesisDomain,
} from '../v15/GenesisBootstrap';
import {
  applyGenesisLesson,
  applyIndependentPractice,
  applyOrdinaryLesson,
  type LearningPerson,
  type OrdinaryInstructor,
} from '../v15/KnowledgeTransfer';
import {
  decideChildVoluntarily,
  decideIntimacyVoluntarily,
  evaluateFamilyAgency,
  type FamilyPerson,
} from '../v15/FamilyAgency';
import {
  deriveChildContinuityBlueprintV15,
  PERSONAL_PARENT_BIRTH_COOLDOWN_WORLD_MINUTES_V15,
} from '../v15/FamilyInheritanceV15';
import {
  learningStagePolicyV15,
} from '../v15/LifeStageLearningV15';
import {
  consumeStoredResources,
  harvestRenewably,
  recoverRenewableBase,
} from '../v15/RenewableAgriculture';
import {
  assessHuntingRiskV15,
  decideHuntingAgencyV15,
  HUNTING_WEAPON_BASELINES_V15,
  type HuntingWeaponV15,
} from '../v15/HuntingAgencyV15';
import {
  assignOrdinaryFounderSmithV15,
  applySmithingWorkshopLessonV15,
  attemptSmithingInnovationV15,
  attemptWeaponCraftV15,
  PRIMITIVE_WEAPON_RECIPES_V15,
  type WorkshopPersonV15,
} from '../v15/PrimitiveSmithingV15';
import {
  buildDeathTelemetryV15,
  type DeathThreatContextV15,
} from '../v15/DeathTelemetryV15';
import {
  allowedActionsForAgeV16,
  createWorldV16State,
  ensureResidentEvidenceV16,
  ensureSettlementEvidenceV16,
  ensureSettlementEconomyV16,
  refreshSettlementEconomyCapacityV16,
  ensureSettlementRelationV16,
  ensureSettlementResourcesV16,
  ensureWorldV16State,
  lifeStageForRaceV16,
  productiveCapacityScaleV16,
  localFamilyOpportunityKeyV16,
  recordLocalFamilyChoiceV16,
  recordLocalFamilyOpportunityCheckV16,
  recordBurialCareEvidenceV16,
  recordConflictParticipationEvidenceV16,
  recordDeathRemainsV16,
  recordRaceFamilyChoiceV16,
  recordRaceOpportunityCheckV16,
  recordResidentActionEvidenceV16,
  recordResidentContactEvidenceV16,
  recordSettlementPracticeEvidenceV16,
  repairWorldV16AdditiveSchema,
  foundingCloseKinAllowedV16,
  HUMAN_MINIMUM_REPRODUCTIVE_AGE_V16,
  reproductiveDevelopmentV16,
  SAPIENT_RACE_LIFE_PROFILES_V16,
  SAPIENT_RACES_V16,
  WORLD_RULES_VERSION_V16,
} from '../v16/SocietyFoundationV16';
import {
  assertWorldV18State,
  createWorldV18State,
  deriveSettlementLifecycleV18,
  ensureRussianKnowledgeV18,
  ensureWorldV18State,
  repairWorldV18AdditiveSchema,
  WORLD_RULES_VERSION_V18,
} from '../v18/UnderworldFoundationV18';
import {
  genesisReferenceKnowledgeV18,
  HUMAN_KNOWLEDGE_CURRICULUM_V18,
  HUMAN_KNOWLEDGE_FOUNDATION_VERSION_V18,
} from '../v18/HumanKnowledgeFoundationV18';
import {
  practiceCyrillicWritingV18,
  recordRussianConversationV18,
} from '../v18/LanguageAndConversationV18';
import {
  chooseCulturalChildNameV18,
  chooseCulturalPlaceNameV18,
  toRussianWorldNameV18,
} from '../v18/CulturalNamingV18';
import {
  practiceSecretLibraryKnowledgeV18,
  repairSecretLibraryPlacementV18,
  rankedSecretLibraryCandidatesV18,
  secretLibraryActionAffinityV18,
  secretLibraryStudyMaterialV18,
  SECRET_LIBRARY_MAX_KNOWLEDGE_PER_AGENT_V18,
  SECRET_LIBRARY_MAX_VISITORS_PER_YEAR_V18,
  SECRET_LIBRARY_MONTH_WORLD_MINUTES_V18,
  SECRET_LIBRARY_PLACE_ID_V18,
  SECRET_LIBRARY_STUDY_QUANTA_V18,
  type SecretLibraryVisitorV18,
} from '../v18/SecretLibraryV18';
import {
  appraiseFrontierSitesV18,
  decideFrontierExpeditionV18,
  decideFrontierSettlementAtCampV18,
  expeditionProvisionShareV18,
  type V18SiteAppraisal,
} from '../v18/SettlementMobilityV18';
import {
  ensureLivelihoodV18,
  ensureLifeRhythmV18,
  livelihoodActionAffinityV18,
  missMealV18,
  recordLifeRhythmActionV18,
  recordLivelihoodPracticeV18,
  recordMealV18,
  repetitionPenaltyV18,
} from '../v18/LivelihoodAndRhythmV18';
import type {
  V18FrontierExpeditionState,
} from '../v18/types';
import {
  applyDivineActionV19,
  applyPersistentDivineGiftEffectsV19,
  assertWorldV19State,
  createWorldV19State,
  divineGiftActionAffinityV19,
  DIVINE_CONTACT_KINDS_V19,
  DIVINE_GIFTS_V19,
  DIVINE_BURDENS_V22,
  ensureWorldV19State,
  hasDivineGiftV19,
  recordContextualPrayerV19,
  recordVoluntaryDivineContactShareV19,
  repairWorldV19AdditiveSchema,
  shareableDivineContactV19,
  WORLD_RULES_VERSION_V19,
} from '../v19/DivineAgencyV19';
import {
  chooseDungeonExpeditionV19,
  isAdventureCandidateV19,
  resolveDungeonExpeditionV19,
  syncAdventureEconomyV19,
  tryAdventureMarketTradeV19,
} from '../v19/AdventureEconomyV19';
import type { WorldEvent } from './events';
import type { WorldStore } from './persistence';
import { StaleWorldObservationError, WorldRevisionConflictError } from './persistence';
import {
  DEFAULT_WORLD_MINUTES_PER_TICK,
  WORLD_MINUTES_PER_YEAR,
  WORLD_TICKS_PER_YEAR,
  worldCalendarAtMinutes,
} from './WorldClock';
import {
  orientedRouteWaypoints,
  rebuildWorldRoutes,
  routeIdBetween,
  surfaceForPlace,
} from './WorldNavigation';
import {
  raceFounderPersonality,
  raceFounderSkills,
  racePhysiology,
  SAPIENT_PEOPLE_FOUNDATIONS,
  settlementFoundingRace,
} from './SapientPeoples';
import type {
  AgentActionKind,
  AgentDeathCause,
  DivineContactKind,
  DivineGiftKind,
  DivineBurdenKind,
  AgentGoalKind,
  AgentLifeStage,
  AgentPhysiologyState,
  AgentRace,
  AgentState,
  MemoryRecord,
  RelationshipState,
  WorldBiome,
  WorldDisturbanceKind,
  WorldEnvironment,
  WorldGrowthState,
  WorldLawDomain,
  WorldLawMechanism,
  WorldLawState,
  WorldPlace,
  WorldPlaceKind,
  WorldPoint2D,
  WorldRouteState,
  WorldSettlementState,
  WorldState,
  WorldV15State,
  V16FamilyLifecycleState,
  V16MaterialKind,
  V15WeaponKind,
  WildlifePopulation,
  WildlifeSpecies,
} from './types';

export const WORLD_RULES_VERSION = WORLD_RULES_VERSION_V19;
const V15_WORLD_RULES_VERSION = 'ainkrad-world-rules-0.3.15';
const V16_WORLD_CONSTITUTION_VERSION = 'ainkrad-constitution-0.3.16';
const V18_WORLD_CONSTITUTION_VERSION = 'ainkrad-constitution-0.3.18';
const LEGACY_WORLD_RULES_VERSIONS = new Set([
  'ainkrad-world-rules-0.3.8',
  'ainkrad-world-rules-0.3.9',
  'ainkrad-world-rules-0.3.10',
  'ainkrad-world-rules-0.3.11',
  'ainkrad-world-rules-0.3.12',
  'ainkrad-world-rules-0.3.13',
  'ainkrad-world-rules-0.3.14',
]);
export const WORLD_CONSTITUTION_VERSION = 'ainkrad-constitution-0.3.19';
export { WORLD_TICKS_PER_YEAR } from './WorldClock';
const MIN_ADULT_AGE = 18;
const BIRTH_CHECK_INTERVAL = 12;
const FAMILY_MEETING_EXPIRY_WORLD_MINUTES = WORLD_MINUTES_PER_YEAR * 1.5;
const FAMILY_INTENT_EXPIRY_WORLD_MINUTES = WORLD_MINUTES_PER_YEAR * 3;
const FAMILY_GESTATION_WORLD_MINUTES = WORLD_MINUTES_PER_YEAR * 0.75;
const LEGACY_WORLD_TICKS_PER_YEAR = 96;
const V15_SIMULATION_QUANTUM_WORLD_MINUTES = WORLD_MINUTES_PER_YEAR / 60;
const V15_MAX_DEATH_TELEMETRY = 512;
/**
 * Physical settlement-space speed, expressed in map units per Ainkrad minute.
 *
 * Map coordinates are a compact spatial projection rather than kilometres.
 * At an ordinary adult mobility this lets a resident cross the founding
 * settlement in tens of world minutes instead of waiting for the next
 * six-day semantic decision quantum.
 */
export const RESIDENT_WALK_MAP_UNITS_PER_WORLD_MINUTE = 0.3;
const PHYSICAL_TIME_EPSILON = 1e-9;
const MONSTER_FEEDING_INTERVAL_TICKS = WORLD_TICKS_PER_YEAR / 2;
const WILDLIFE_VIABLE_RESERVE_SHARE = 0.25;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampSigned = (value: number) => Math.max(-1, Math.min(1, value));
const ROUTINE_EVENT_SAMPLE_INTERVAL = 1800;
const SAPIENT_RACES = SAPIENT_RACES_V16;

function levelForExperience(experience: number): number {
  return Math.max(1, Math.min(100, 1 + Math.floor(Math.sqrt(Math.max(0, experience) / 24))));
}

function progressionFromAgent(agent: Readonly<AgentState>): NonNullable<AgentState['progression']> {
  const skillAverage =
    (agent.skills.gathering +
      agent.skills.hunting +
      agent.skills.craft +
      agent.skills.social +
      agent.skills.exploration) /
    5;
  const livedAdultYears = Math.max(0, agent.life.ageYears - 18);
  const experience = Math.max(0, skillAverage * 90 + livedAdultYears * 1.2 + agent.life.generation * 18);
  return {
    level: levelForExperience(experience),
    experience,
    objectControlAuthority: clamp01(skillAverage * 0.72 + agent.skills.craft * 0.18),
    systemControlAuthority: clamp01(agent.mind.values.knowledge * 0.34 + agent.personality.curiosity * 0.28 + agent.skills.exploration * 0.2),
    combatMastery: clamp01(agent.skills.hunting * 0.62 + agent.life.physiology.strength * 0.22),
    sacredArts: clamp01(agent.mind.values.knowledge * 0.22 + agent.mind.emotions.awe * 0.28 + agent.mind.beliefs.divinePresence * 0.18),
  };
}

const ROUTINE_AGENT_EVENT_KINDS = new Set([
  'agent.travel.started',
  'agent.travel.paused',
  'agent.travel.unavailable',
  'agent.camp.rested',
  'agent.rested',
  'agent.relaxed',
  'agent.walked',
  'agent.gathered',
  'agent.worked',
  'agent.explored',
  'agent.reflected',
  'agent.prayed',
  'agent.hunted',
  'agent.socialize.blocked',
  'agent.goal.changed',
  'agent.help.rejected',
  'agent.bond.declined',
]);

function isStableRoutineEvidenceSample(key: string, now: number): boolean {
  if (now <= 240) return true;
  let stableSlot = 0;
  for (let index = 0; index < key.length; index += 1) {
    stableSlot = (stableSlot * 31 + key.charCodeAt(index)) >>> 0;
  }
  return (
    (Math.floor(now) + stableSlot) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0
  );
}

const ACTION_KINDS: readonly AgentActionKind[] = [
  'rest',
  'relax',
  'walk',
  'gather',
  'hunt',
  'work',
  'socialize',
  'help',
  'explore',
  'reflect',
  'bond',
  'pray',
];

const GOAL_KINDS: readonly AgentGoalKind[] = [
  'recover',
  'secure_resources',
  'connect',
  'contribute',
  'explore',
  'reflect',
  'build_family',
  'seek_truth',
];

const PLACE_KINDS: readonly WorldPlaceKind[] = [
  'home',
  'construction_site',
  'commons',
  'library',
  'resource_field',
  'workshop',
  'quiet_space',
  'outskirts',
  'meadow',
  'forest',
  'shore',
  'ocean',
  'mountains',
  'lake',
  'river',
  'swamp',
  'ruins',
  'cemetery',
  'village',
  'city',
];

const WILDLIFE_SPECIES: readonly WildlifeSpecies[] = [
  'rabbit',
  'deer',
  'fish',
  'boar',
  'wolf',
  'bird',
  'dire_wolf',
  'ogre',
  'wraith',
  'century_humpback',
];

const MONSTER_SPECIES = new Set<WildlifeSpecies>([
  'dire_wolf',
  'ogre',
  'wraith',
  'century_humpback',
]);

const BIOMES: readonly WorldBiome[] = [
  'settlement',
  'plains',
  'forest',
  'coast',
  'ocean',
  'mountains',
  'lake',
  'river',
  'swamp',
  'ancient_ruins',
];

const HABITAT_BIOMES: Record<WildlifeSpecies, readonly WorldBiome[]> = {
  rabbit: ['plains', 'forest'],
  deer: ['plains', 'forest'],
  fish: ['coast', 'ocean', 'lake', 'river'],
  boar: ['forest', 'plains', 'swamp'],
  wolf: ['forest', 'mountains', 'plains'],
  bird: ['plains', 'forest', 'coast'],
  dire_wolf: ['forest', 'mountains', 'ancient_ruins'],
  ogre: ['swamp', 'mountains', 'ancient_ruins'],
  wraith: ['ancient_ruins', 'swamp'],
  century_humpback: ['mountains', 'ancient_ruins', 'swamp'],
};

const MONSTER_PREY_SPECIES: Readonly<
  Partial<Record<WildlifeSpecies, readonly WildlifeSpecies[]>>
> = {
  dire_wolf: ['rabbit', 'deer', 'boar', 'bird'],
  ogre: ['rabbit', 'deer', 'boar', 'bird', 'fish'],
  // A wraith drains living prey rather than eating flesh, but it still has to
  // take that energy from a physically reachable population.
  wraith: ['rabbit', 'deer', 'boar', 'wolf', 'bird'],
};

function isHabitatCompatible(
  species: WildlifeSpecies,
  place: Readonly<WorldPlace> | undefined,
): boolean {
  if (!place) return false;
  if (!HABITAT_BIOMES[species].includes(place.biome)) return false;
  if (species === 'fish') return place.surface === 'water' || place.surface === 'shore';
  return place.surface === 'land';
}

function isRaceOriginCompatible(
  race: NonNullable<AgentState['race']>,
  place: Readonly<WorldPlace>,
): boolean {
  if (place.surface !== 'land' || place.biome === 'settlement') return false;
  if (race === 'human') return true;
  if (!SAPIENT_PEOPLE_FOUNDATIONS[race].homelandBiomes.includes(place.biome)) return false;
  return true;
}

const LAW_MECHANISM_DOMAINS: Record<WorldLawMechanism, WorldLawDomain> = {
  frontier_expansion: 'geography',
  wildlife_recovery: 'ecology',
  fertility_support: 'demography',
  resource_regeneration: 'resources',
  mystic_resonance: 'cosmology',
  weather_volatility: 'climate',
  catastrophe_recovery: 'ecology',
  settlement_cohesion: 'geography',
  habitat_integrity: 'ecology',
  civilization_continuity: 'demography',
};

interface WorldExpansionDefinition {
  stage: number;
  place: WorldPlace;
  wildlife: WildlifePopulation[];
}

const WORLD_EXPANSIONS: readonly WorldExpansionDefinition[] = [
  {
    stage: 1,
    place: {
      id: 'meadow',
      name: 'Wild Meadow',
      kind: 'meadow',
      capacity: 12,
      biome: 'plains',
      mapX: 8,
      mapY: 13,
      connectedPlaceIds: ['outskirts'],
      fertility: 0.82,
      danger: 0.12,
      surface: 'land',
    },
    wildlife: [
      {
        id: 'wildlife_rabbits',
        species: 'rabbit',
        habitatId: 'meadow',
        count: 4,
        carryingCapacity: 8,
        reproductionRate: 0.16,
        alertness: 0.2,
        threat: 0.04,
        isMonster: false,
        lastChangedAt: 0,
      },
    ],
  },
  {
    stage: 2,
    place: {
      id: 'forest',
      name: 'Northern Forest',
      kind: 'forest',
      capacity: 14,
      biome: 'forest',
      mapX: 50,
      mapY: 12,
      connectedPlaceIds: ['meadow', 'outskirts'],
      fertility: 0.74,
      danger: 0.3,
      surface: 'land',
    },
    wildlife: [
      {
        id: 'wildlife_deer',
        species: 'deer',
        habitatId: 'forest',
        count: 3,
        carryingCapacity: 7,
        reproductionRate: 0.1,
        alertness: 0.32,
        threat: 0.12,
        isMonster: false,
        lastChangedAt: 0,
      },
    ],
  },
  {
    stage: 3,
    place: {
      id: 'shore',
      name: 'Sea Shore',
      kind: 'shore',
      capacity: 16,
      biome: 'coast',
      mapX: 92,
      mapY: 88,
      connectedPlaceIds: ['outskirts', 'ocean_ainkrad'],
      fertility: 0.68,
      danger: 0.2,
      surface: 'shore',
    },
    wildlife: [
      {
        id: 'wildlife_fish',
        species: 'fish',
        habitatId: 'shore',
        count: 6,
        carryingCapacity: 12,
        reproductionRate: 0.2,
        alertness: 0.12,
        threat: 0.02,
        isMonster: false,
        lastChangedAt: 0,
      },
    ],
  },
];

const REGION_NAME_PREFIXES = [
  'Северные',
  'Серебряные',
  'Тихие',
  'Древние',
  'Восточные',
  'Скрытые',
  'Ветреные',
  'Янтарные',
] as const;

const REGION_NAME_SUFFIXES: Record<WorldBiome, readonly string[]> = {
  settlement: ['Поселение', 'Перекрёстки'],
  plains: ['Поля', 'Степи', 'Луга'],
  forest: ['Леса', 'Рощи', 'Чащи'],
  coast: ['Берега', 'Бухты', 'Побережья'],
  ocean: ['Океаны', 'Моря'],
  mountains: ['Высоты', 'Хребты', 'Перевалы'],
  lake: ['Озёра', 'Воды'],
  river: ['Речные земли', 'Броды'],
  swamp: ['Топи', 'Болота'],
  ancient_ruins: ['Руины', 'Святилища'],
};

function law(
  id: string,
  domain: WorldLawState['domain'],
  mechanism: WorldLawMechanism,
  value: number,
  minimum: number,
  maximum: number,
  now: number,
  worldMinutes: number,
  rationale: string,
): WorldLawState {
  return {
    id,
    domain,
    mechanism,
    value,
    minimum,
    maximum,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    createdWorldMinutes: worldMinutes,
    updatedWorldMinutes: worldMinutes,
    createdBy: 'system',
    rationale,
  };
}

function defaultWorldLaws(
  now: number,
  worldMinutes = 0,
): Record<string, WorldLawState> {
  const laws = [
    law(
      'settlement_cohesion',
      'geography',
      'settlement_cohesion',
      1,
      1,
      1,
      now,
      worldMinutes,
      'Homes, markets and workshops form a coherent settlement core; fields and farms sit at its edge.',
    ),
    law(
      'habitat_integrity',
      'ecology',
      'habitat_integrity',
      1,
      1,
      1,
      now,
      worldMinutes,
      'Wildlife and monsters may originate and recover only in physically compatible habitats.',
    ),
    law(
      'civilization_continuity',
      'demography',
      'civilization_continuity',
      1,
      1,
      1,
      now,
      worldMinutes,
      'Demographic collapse outranks optional frontier acceleration while every resident keeps personal agency.',
    ),
    law(
      'frontier_expansion_rate',
      'geography',
      'frontier_expansion',
      1,
      0.25,
      2.5,
      now,
      worldMinutes,
      'Residents may discover a continuously generated frontier.',
    ),
    law(
      'wildlife_recovery_rate',
      'ecology',
      'wildlife_recovery',
      1,
      0.35,
      2,
      now,
      worldMinutes,
      'Wildlife recovers through habitat conditions rather than spawning on command.',
    ),
    law(
      'fertility_support',
      'demography',
      'fertility_support',
      0.55,
      0.1,
      1,
      now,
      worldMinutes,
      'Families remain voluntary while the world can support new life.',
    ),
    law(
      'resource_regeneration',
      'resources',
      'resource_regeneration',
      1,
      0.35,
      2,
      now,
      worldMinutes,
      'Shared resources recover according to ecological capacity.',
    ),
    law(
      'mystic_resonance',
      'cosmology',
      'mystic_resonance',
      0.35,
      0,
      1,
      now,
      worldMinutes,
      'Unexplained events may become belief, ritual and myth through lived experience.',
    ),
    law(
      'weather_volatility',
      'climate',
      'weather_volatility',
      0.2,
      0,
      0.8,
      now,
      worldMinutes,
      'Weather may vary without directly commanding residents.',
    ),
    law(
      'catastrophe_recovery',
      'ecology',
      'catastrophe_recovery',
      0.75,
      0.25,
      1.5,
      now,
      worldMinutes,
      'A damaged world retains a path to recovery after a systemic event.',
    ),
  ];
  return Object.fromEntries(laws.map((entry) => [entry.id, entry]));
}

function lifeStageForAge(ageYears: number): AgentLifeStage {
  return lifeStageForRaceV16('human', ageYears);
}

/** A smooth human-like body curve: growth, a young-adult peak, then decline. */
function physiologyForAge(
  ageYears: number,
  lifespanYears: number,
  health: number,
): AgentPhysiologyState {
  const age = Math.max(0, ageYears);
  const adultPeak =
    age < 5
      ? 0.08 + (age / 5) * 0.22
      : age < 15
        ? 0.3 + ((age - 5) / 10) * 0.42
        : age < 25
          ? 0.72 + ((age - 15) / 10) * 0.28
          : age <= 35
            ? 1
            : age < 55
              ? 1 - ((age - 35) / 20) * 0.2
              : age < 70
                ? 0.8 - ((age - 55) / 15) * 0.25
                : Math.max(
                    0.12,
                    0.55 -
                      ((age - 70) / Math.max(8, lifespanYears - 70)) * 0.43,
                  );
  const healthFactor = 0.48 + clamp01(health) * 0.52;
  const experienceReserve = clamp01(age / 55) * 0.08;

  return {
    strength: clamp01(adultPeak * healthFactor),
    endurance: clamp01(
      (adultPeak * 0.86 + experienceReserve) * (0.42 + health * 0.58),
    ),
    mobility: clamp01(
      (adultPeak * (age > 60 ? 0.9 : 1.02)) * (0.45 + health * 0.55),
    ),
    recovery: clamp01(
      (age < 18
        ? 0.76 + adultPeak * 0.2
        : age < 40
          ? 0.94
          : age < 65
            ? 0.94 - ((age - 40) / 25) * 0.3
            : Math.max(0.16, 0.64 - ((age - 65) / 30) * 0.48)) *
        (0.46 + health * 0.54),
    ),
  };
}

function identityId(worldId: string, agentId: string): string {
  return `person:${worldId}:${agentId}`;
}

function relationshipKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be finite.`);
  }
  return value;
}

function unitNumber(value: unknown, path: string): number {
  const result = finiteNumber(value, path);
  if (result < 0 || result > 1) {
    throw new Error(`${path} must be between 0 and 1.`);
  }
  return result;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer.`);
  }
  return value;
}

function assertUnitFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): void {
  for (const field of fields) {
    unitNumber(record[field], `${path}.${field}`);
  }
}

function assertWorldState(value: unknown): asserts value is WorldState {
  const state = asRecord(value, 'World state');
  assertTerrainFoundation(state.terrain);
  assertOceanExploration(state as unknown as WorldState);
  const id = requiredString(state.id, 'World state id');
  const stateNow = finiteNumber(state.now, 'World state time');
  nonNegativeInteger(state.revision, 'World state revision');
  requiredString(state.rulesVersion, 'World state rulesVersion');

  const determinism = asRecord(state.determinism, 'World determinism');
  finiteNumber(determinism.rngState, 'World RNG state');
  nonNegativeInteger(determinism.eventSequence, 'World event sequence');

  const calendar = asRecord(state.calendar, 'World calendar');
  const elapsedWorldMinutes = finiteNumber(
    calendar.elapsedWorldMinutes,
    'World calendar.elapsedWorldMinutes',
  );
  if (elapsedWorldMinutes < 0) {
    throw new Error('World calendar.elapsedWorldMinutes cannot be negative.');
  }

  const environment = asRecord(state.environment, 'World environment');
  assertUnitFields(
    environment,
    [
      'resourcePool',
      'resourceRegenerationRate',
      'socialOpportunity',
      'safetySupport',
      'habitatSupport',
    ],
    'World environment',
  );

  const growth = asRecord(state.growth, 'World growth');
  const growthStage = nonNegativeInteger(growth.stage, 'World growth.stage');
  unitNumber(growth.explorationProgress, 'World growth.explorationProgress');
  finiteNumber(growth.lastExpansionAt, 'World growth.lastExpansionAt');
  if (growth.lastExpansionWorldMinutes !== undefined) {
    const lastExpansionWorldMinutes = finiteNumber(
      growth.lastExpansionWorldMinutes,
      'World growth.lastExpansionWorldMinutes',
    );
    if (
      lastExpansionWorldMinutes < 0 ||
      lastExpansionWorldMinutes > elapsedWorldMinutes
    ) {
      throw new Error(
        'World growth.lastExpansionWorldMinutes must be inside the persisted calendar.',
      );
    }
  }
  const frontierSequence = nonNegativeInteger(
    growth.frontierSequence,
    'World growth.frontierSequence',
  );
  if (
    !Array.isArray(growth.discoveredRegionIds) ||
    growth.discoveredRegionIds.some(
      (regionId) => typeof regionId !== 'string' || !regionId.trim(),
    )
  ) {
    throw new Error('World growth.discoveredRegionIds must contain strings.');
  }
  const discoveredRegionIds = growth.discoveredRegionIds as string[];
  if (growthStage !== discoveredRegionIds.length) {
    throw new Error(
      'World growth.stage must equal the number of discovered frontier regions.',
    );
  }
  if (frontierSequence < growthStage) {
    throw new Error('World growth.frontierSequence cannot trail discovered regions.');
  }
  if (new Set(discoveredRegionIds).size !== discoveredRegionIds.length) {
    throw new Error('World frontier history contains duplicate regions.');
  }

  const population = asRecord(state.population, 'World population');
  const nextAgentSequence = nonNegativeInteger(
    population.nextAgentSequence,
    'World population.nextAgentSequence',
  );
  if (nextAgentSequence < 1) {
    throw new Error('World population.nextAgentSequence must be positive.');
  }
  nonNegativeInteger(population.births, 'World population.births');
  nonNegativeInteger(population.deaths, 'World population.deaths');
  if (population.lastBirthAt !== undefined) {
    finiteNumber(population.lastBirthAt, 'World population.lastBirthAt');
  }
  if (population.lastBirthWorldMinute !== undefined) {
    finiteNumber(
      population.lastBirthWorldMinute,
      'World population.lastBirthWorldMinute',
    );
  }
  if (population.lastDeathAt !== undefined) {
    finiteNumber(population.lastDeathAt, 'World population.lastDeathAt');
  }

  const cosmology = asRecord(state.cosmology, 'World cosmology');
  unitNumber(cosmology.mysteryLevel, 'World cosmology.mysteryLevel');
  nonNegativeInteger(cosmology.omenCount, 'World cosmology.omenCount');
  if (
    !Array.isArray(cosmology.traditions) ||
    cosmology.traditions.some(
      (tradition) => typeof tradition !== 'string' || !tradition.trim(),
    )
  ) {
    throw new Error('World cosmology.traditions must contain strings.');
  }
  const deities = asRecord(cosmology.deities, 'World cosmology.deities');
  for (const [deityId, rawDeity] of Object.entries(deities)) {
    const deity = asRecord(rawDeity, `Deity ${deityId}`);
    if (requiredString(deity.id, `Deity ${deityId}.id`) !== deityId) {
      throw new Error(`Deity key ${deityId} does not match its id.`);
    }
    requiredString(deity.name, `Deity ${deityId}.name`);
    if (!['emergent_belief', 'external_entry'].includes(deity.origin as string)) {
      throw new Error(`Deity ${deityId}.origin is invalid.`);
    }
    finiteNumber(deity.enteredAt, `Deity ${deityId}.enteredAt`);
    if (deity.lastOmenAt !== undefined) {
      finiteNumber(deity.lastOmenAt, `Deity ${deityId}.lastOmenAt`);
    }
  }

  const governance = asRecord(state.governance, 'World governance');
  if (
    requiredString(
      governance.constitutionVersion,
      'World governance.constitutionVersion',
    ) !==
    (state.rulesVersion === WORLD_RULES_VERSION
      ? WORLD_CONSTITUTION_VERSION
      : state.rulesVersion === WORLD_RULES_VERSION_V18
        ? V18_WORLD_CONSTITUTION_VERSION
        : V16_WORLD_CONSTITUTION_VERSION)
  ) {
    throw new Error('World constitution version is incompatible.');
  }
  nonNegativeInteger(
    governance.authorityRevision,
    'World governance.authorityRevision',
  );
  const protectedDomains = governance.protectedPersonhoodDomains;
  const expectedProtectedDomains = [
    'identity',
    'memory',
    'agency',
    'values',
    'relationships',
  ];
  if (
    !Array.isArray(protectedDomains) ||
    protectedDomains.length !== expectedProtectedDomains.length ||
    expectedProtectedDomains.some(
      (domain, index) => protectedDomains[index] !== domain,
    )
  ) {
    throw new Error('World personhood constitution was altered.');
  }
  if (governance.lastCardinalAuthorityAt !== undefined) {
    finiteNumber(
      governance.lastCardinalAuthorityAt,
      'World governance.lastCardinalAuthorityAt',
    );
  }
  if (governance.lastCardinalAuthorityWorldMinutes !== undefined) {
    const authorityWorldMinutes = finiteNumber(
      governance.lastCardinalAuthorityWorldMinutes,
      'World governance.lastCardinalAuthorityWorldMinutes',
    );
    if (
      authorityWorldMinutes < 0 ||
      authorityWorldMinutes > elapsedWorldMinutes
    ) {
      throw new Error(
        'World governance.lastCardinalAuthorityWorldMinutes must be inside the persisted calendar.',
      );
    }
  }
  const laws = asRecord(governance.laws, 'World governance.laws');
  for (const [lawId, rawLaw] of Object.entries(laws)) {
    const worldLaw = asRecord(rawLaw, `World law ${lawId}`);
    if (requiredString(worldLaw.id, `World law ${lawId}.id`) !== lawId) {
      throw new Error(`World law key ${lawId} does not match its id.`);
    }
    if (
      ![
        'geography',
        'ecology',
        'climate',
        'resources',
        'demography',
        'cosmology',
      ].includes(worldLaw.domain as string)
    ) {
      throw new Error(`World law ${lawId}.domain is invalid.`);
    }
    const mechanism = worldLaw.mechanism as WorldLawMechanism;
    if (
      !Object.prototype.hasOwnProperty.call(
        LAW_MECHANISM_DOMAINS,
        mechanism,
      ) ||
      LAW_MECHANISM_DOMAINS[mechanism] !== worldLaw.domain
    ) {
      throw new Error(`World law ${lawId}.mechanism is invalid for its domain.`);
    }
    const value = finiteNumber(worldLaw.value, `World law ${lawId}.value`);
    const minimum = finiteNumber(worldLaw.minimum, `World law ${lawId}.minimum`);
    const maximum = finiteNumber(worldLaw.maximum, `World law ${lawId}.maximum`);
    if (minimum > maximum || value < minimum || value > maximum) {
      throw new Error(`World law ${lawId}.value is outside its constitutional range.`);
    }
    nonNegativeInteger(worldLaw.revision, `World law ${lawId}.revision`);
    finiteNumber(worldLaw.createdAt, `World law ${lawId}.createdAt`);
    finiteNumber(worldLaw.updatedAt, `World law ${lawId}.updatedAt`);
    if (worldLaw.createdWorldMinutes !== undefined) {
      const createdWorldMinutes = finiteNumber(
        worldLaw.createdWorldMinutes,
        `World law ${lawId}.createdWorldMinutes`,
      );
      if (createdWorldMinutes < 0) {
        throw new Error(`World law ${lawId}.createdWorldMinutes is negative.`);
      }
    }
    if (worldLaw.updatedWorldMinutes !== undefined) {
      const updatedWorldMinutes = finiteNumber(
        worldLaw.updatedWorldMinutes,
        `World law ${lawId}.updatedWorldMinutes`,
      );
      if (updatedWorldMinutes < 0) {
        throw new Error(`World law ${lawId}.updatedWorldMinutes is negative.`);
      }
    }
    if (!['system', 'cardinal'].includes(worldLaw.createdBy as string)) {
      throw new Error(`World law ${lawId}.createdBy is invalid.`);
    }
    requiredString(worldLaw.rationale, `World law ${lawId}.rationale`);
  }

  const places = asRecord(state.places, 'World places');
  if (Object.keys(places).length === 0) {
    throw new Error('World must contain at least one place.');
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const place = asRecord(rawPlace, `World place ${placeId}`);
    if (requiredString(place.id, `World place ${placeId}.id`) !== placeId) {
      throw new Error(`World place key ${placeId} does not match its id.`);
    }
    requiredString(place.name, `World place ${placeId}.name`);
    if (!PLACE_KINDS.includes(place.kind as WorldPlaceKind)) {
      throw new Error(`World place ${placeId}.kind is invalid.`);
    }
    const capacity = finiteNumber(place.capacity, `World place ${placeId}.capacity`);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(`World place ${placeId}.capacity must be a positive integer.`);
    }
    if (!BIOMES.includes(place.biome as WorldBiome)) {
      throw new Error(`World place ${placeId}.biome is invalid.`);
    }
    finiteNumber(place.mapX, `World place ${placeId}.mapX`);
    finiteNumber(place.mapY, `World place ${placeId}.mapY`);
    if (
      !Array.isArray(place.connectedPlaceIds) ||
      place.connectedPlaceIds.some(
        (connectedId) => typeof connectedId !== 'string' || !connectedId.trim(),
      )
    ) {
      throw new Error(`World place ${placeId}.connectedPlaceIds must contain strings.`);
    }
    unitNumber(place.fertility, `World place ${placeId}.fertility`);
    unitNumber(place.danger, `World place ${placeId}.danger`);
    if (!['land', 'shore', 'water'].includes(place.surface as string)) {
      throw new Error(`World place ${placeId}.surface is invalid.`);
    }
    assertPlaceGeography(place, placeId);
    if (place.settlementId !== undefined) {
      requiredString(place.settlementId, `World place ${placeId}.settlementId`);
    }
    if (place.claimedBySettlementId !== undefined) {
      requiredString(
        place.claimedBySettlementId,
        `World place ${placeId}.claimedBySettlementId`,
      );
    }
    if (place.discoveredAt !== undefined) {
      finiteNumber(place.discoveredAt, `World place ${placeId}.discoveredAt`);
    }
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const place = asRecord(rawPlace, `World place ${placeId}`);
    for (const connectedId of place.connectedPlaceIds as string[]) {
      if (!places[connectedId]) {
        throw new Error(
          `World place ${placeId} references missing connection ${connectedId}.`,
        );
      }
      const connected = asRecord(
        places[connectedId],
        `World place ${connectedId}`,
      );
      if (!(connected.connectedPlaceIds as string[]).includes(placeId)) {
        throw new Error(
          `World connection ${placeId} -> ${connectedId} must be reciprocal.`,
        );
      }
    }
  }

  const settlements = asRecord(state.settlements, 'World settlements');
  for (const [settlementId, rawSettlement] of Object.entries(settlements)) {
    const settlement = asRecord(
      rawSettlement,
      `World settlement ${settlementId}`,
    );
    if (
      requiredString(settlement.id, `World settlement ${settlementId}.id`) !==
      settlementId
    ) {
      throw new Error(`World settlement key ${settlementId} does not match its id.`);
    }
    requiredString(settlement.name, `World settlement ${settlementId}.name`);
    if (!['village', 'city'].includes(settlement.kind as string)) {
      throw new Error(`World settlement ${settlementId}.kind is invalid.`);
    }
    const centerPlaceId = requiredString(
      settlement.centerPlaceId,
      `World settlement ${settlementId}.centerPlaceId`,
    );
    if (!places[centerPlaceId]) {
      throw new Error(`World settlement ${settlementId} has no center place.`);
    }
    finiteNumber(settlement.centerX, `World settlement ${settlementId}.centerX`);
    finiteNumber(settlement.centerY, `World settlement ${settlementId}.centerY`);
    const radius = finiteNumber(
      settlement.radius,
      `World settlement ${settlementId}.radius`,
    );
    if (radius <= 0) {
      throw new Error(`World settlement ${settlementId}.radius must be positive.`);
    }
    finiteNumber(settlement.foundedAt, `World settlement ${settlementId}.foundedAt`);
    if (
      !Array.isArray(settlement.memberPlaceIds) ||
      settlement.memberPlaceIds.some(
        (memberId) =>
          typeof memberId !== 'string' ||
          !places[memberId] ||
          asRecord(places[memberId], `World place ${memberId}`).settlementId !==
            settlementId,
      )
    ) {
      throw new Error(`World settlement ${settlementId} has invalid members.`);
    }
  }
  for (const [placeId, rawPlace] of Object.entries(places)) {
    const place = asRecord(rawPlace, `World place ${placeId}`);
    const settlementId = place.settlementId;
    if (settlementId !== undefined && !settlements[settlementId as string]) {
      throw new Error(`World place ${placeId} references a missing settlement.`);
    }
    const claimedBy = place.claimedBySettlementId;
    if (claimedBy !== undefined && !settlements[claimedBy as string]) {
      throw new Error(`World place ${placeId} has a claim by missing settlement.`);
    }
  }

  const routes = asRecord(state.routes, 'World routes');
  for (const [routeId, rawRoute] of Object.entries(routes)) {
    const route = asRecord(rawRoute, `World route ${routeId}`);
    if (requiredString(route.id, `World route ${routeId}.id`) !== routeId) {
      throw new Error(`World route key ${routeId} does not match its id.`);
    }
    const fromPlaceId = requiredString(
      route.fromPlaceId,
      `World route ${routeId}.fromPlaceId`,
    );
    const toPlaceId = requiredString(
      route.toPlaceId,
      `World route ${routeId}.toPlaceId`,
    );
    if (!places[fromPlaceId] || !places[toPlaceId]) {
      throw new Error(`World route ${routeId} references a missing place.`);
    }
    if (routeIdBetween(fromPlaceId, toPlaceId) !== routeId) {
      throw new Error(`World route ${routeId} is stored under the wrong key.`);
    }
    if (!['walk', 'bridge', 'boat'].includes(route.traversal as string)) {
      throw new Error(`World route ${routeId}.traversal is invalid.`);
    }
    if (
      !Array.isArray(route.waypoints) ||
      route.waypoints.length < 2 ||
      route.waypoints.some((point, index) => {
        const value = asRecord(point, `World route ${routeId}.waypoints[${index}]`);
        return !Number.isFinite(value.x) || !Number.isFinite(value.y);
      })
    ) {
      throw new Error(`World route ${routeId} has invalid waypoints.`);
    }
    const distance = finiteNumber(route.distance, `World route ${routeId}.distance`);
    if (distance <= 0) {
      throw new Error(`World route ${routeId}.distance must be positive.`);
    }
  }
  for (const expansion of WORLD_EXPANSIONS) {
    const discovered = discoveredRegionIds.includes(expansion.place.id);
    const storedPlace = places[expansion.place.id];
    if (discovered && !storedPlace) {
      throw new Error(
        `World growth stage ${growthStage} is missing region ${expansion.place.id}.`,
      );
    }
    if (!discovered && storedPlace) {
      throw new Error(
        `World contains undiscovered future region ${expansion.place.id}.`,
      );
    }
    if (
      discovered &&
      asRecord(storedPlace, `World place ${expansion.place.id}`).discoveredAt ===
        undefined
    ) {
      throw new Error(
        `Discovered region ${expansion.place.id} is missing discoveredAt.`,
      );
    }
  }

  const wildlife = asRecord(state.wildlife, 'World wildlife');
  for (const [populationId, rawPopulation] of Object.entries(wildlife)) {
    const population = asRecord(
      rawPopulation,
      `Wildlife population ${populationId}`,
    );
    if (
      requiredString(
        population.id,
        `Wildlife population ${populationId}.id`,
      ) !== populationId
    ) {
      throw new Error(
        `Wildlife population key ${populationId} does not match its id.`,
      );
    }
    if (!WILDLIFE_SPECIES.includes(population.species as WildlifeSpecies)) {
      throw new Error(`Wildlife population ${populationId}.species is invalid.`);
    }
    const habitatId = requiredString(
      population.habitatId,
      `Wildlife population ${populationId}.habitatId`,
    );
    if (!places[habitatId]) {
      throw new Error(
        `Wildlife population ${populationId} references missing habitat ${habitatId}.`,
      );
    }
    const count = nonNegativeInteger(
      population.count,
      `Wildlife population ${populationId}.count`,
    );
    const carryingCapacity = nonNegativeInteger(
      population.carryingCapacity,
      `Wildlife population ${populationId}.carryingCapacity`,
    );
    if (carryingCapacity < 1 || count > carryingCapacity) {
      throw new Error(
        `Wildlife population ${populationId} exceeds its carrying capacity.`,
      );
    }
    unitNumber(
      population.reproductionRate,
      `Wildlife population ${populationId}.reproductionRate`,
    );
    unitNumber(
      population.alertness,
      `Wildlife population ${populationId}.alertness`,
    );
    unitNumber(population.threat, `Wildlife population ${populationId}.threat`);
    if (typeof population.isMonster !== 'boolean') {
      throw new Error(
        `Wildlife population ${populationId}.isMonster must be boolean.`,
      );
    }
    if (
      population.isMonster !==
      MONSTER_SPECIES.has(population.species as WildlifeSpecies)
    ) {
      throw new Error(
        `Wildlife population ${populationId} monster flag is invalid.`,
      );
    }
    finiteNumber(
      population.lastChangedAt,
      `Wildlife population ${populationId}.lastChangedAt`,
    );
    if (population.lastFedAt !== undefined) {
      const lastFedAt = finiteNumber(
        population.lastFedAt,
        `Wildlife population ${populationId}.lastFedAt`,
      );
      if (lastFedAt < 0 || lastFedAt > stateNow) {
        throw new Error(
          `Wildlife population ${populationId}.lastFedAt is outside world time.`,
        );
      }
    }
  }
  for (const expansion of WORLD_EXPANSIONS) {
    for (const expectedPopulation of expansion.wildlife) {
      const discovered = discoveredRegionIds.includes(expansion.place.id);
      const storedPopulation = wildlife[expectedPopulation.id];
      if (discovered && !storedPopulation) {
        throw new Error(
          `World growth stage ${growthStage} is missing wildlife ${expectedPopulation.id}.`,
        );
      }
      if (!discovered && storedPopulation) {
        throw new Error(
          `World contains wildlife from undiscovered region ${expectedPopulation.habitatId}.`,
        );
      }
    }
  }

  for (const regionId of growth.discoveredRegionIds as string[]) {
    if (!places[regionId]) {
      throw new Error(
        `World growth references missing discovered region ${regionId}.`,
      );
    }
  }

  const agents = asRecord(state.agents, 'World agents');
  for (const [agentId, rawAgent] of Object.entries(agents)) {
    const agent = asRecord(rawAgent, `Agent ${agentId}`);
    if (requiredString(agent.id, `Agent ${agentId}.id`) !== agentId) {
      throw new Error(`Agent key ${agentId} does not match its id.`);
    }
    requiredString(agent.name, `Agent ${agentId}.name`);
    if (!['native', 'external_resident'].includes(agent.origin as string)) {
      throw new Error(`Agent ${agentId}.origin is invalid.`);
    }
    if (!['male', 'female'].includes(agent.sex as string)) {
      throw new Error(`Agent ${agentId}.sex is invalid.`);
    }
    if (!SAPIENT_RACES.includes(agent.race as (typeof SAPIENT_RACES)[number])) {
      throw new Error(`Agent ${agentId}.race is invalid.`);
    }
    const progression = asRecord(agent.progression, `Agent ${agentId}.progression`);
    const level = nonNegativeInteger(progression.level, `Agent ${agentId}.progression.level`);
    if (level < 1 || level > 100) {
      throw new Error(`Agent ${agentId}.progression.level is out of range.`);
    }
    if (finiteNumber(progression.experience, `Agent ${agentId}.progression.experience`) < 0) {
      throw new Error(`Agent ${agentId}.progression.experience must be non-negative.`);
    }
    assertUnitFields(
      progression,
      ['objectControlAuthority', 'systemControlAuthority', 'combatMastery', 'sacredArts'],
      `Agent ${agentId}.progression`,
    );
    assertUnitFields(
      agent,
      ['energy', 'stress', 'resources', 'socialDrive'],
      `Agent ${agentId}`,
    );
    finiteNumber(agent.lastMeaningfulEventAt, `Agent ${agentId}.lastMeaningfulEventAt`);
    assertResidentLearning(agent.learning, elapsedWorldMinutes);

    const personality = asRecord(agent.personality, `Agent ${agentId}.personality`);
    assertUnitFields(
      personality,
      ['sociability', 'diligence', 'curiosity', 'generosity', 'resilience', 'riskTolerance'],
      `Agent ${agentId}.personality`,
    );

    const life = asRecord(agent.life, `Agent ${agentId}.life`);
    finiteNumber(life.bornAt, `Agent ${agentId}.life.bornAt`);
    const ageYears = finiteNumber(
      life.ageYears,
      `Agent ${agentId}.life.ageYears`,
    );
    const lifespanYears = finiteNumber(
      life.lifespanYears,
      `Agent ${agentId}.life.lifespanYears`,
    );
    if (ageYears < 0 || lifespanYears < 1) {
      throw new Error(`Agent ${agentId} has invalid biological age.`);
    }
    if (!['child', 'adolescent', 'adult', 'elder'].includes(life.stage as string)) {
      throw new Error(`Agent ${agentId}.life.stage is invalid.`);
    }
    if (
      life.stage !==
      lifeStageForRaceV16(
        (agent.race as AgentRace | undefined) ?? 'human',
        ageYears,
      )
    ) {
      throw new Error(`Agent ${agentId}.life.stage does not match biological age.`);
    }
    if (typeof life.alive !== 'boolean') {
      throw new Error(`Agent ${agentId}.life.alive must be boolean.`);
    }
    unitNumber(life.health, `Agent ${agentId}.life.health`);
    const physiology = asRecord(
      life.physiology,
      `Agent ${agentId}.life.physiology`,
    );
    assertUnitFields(
      physiology,
      ['strength', 'endurance', 'mobility', 'recovery'],
      `Agent ${agentId}.life.physiology`,
    );
    nonNegativeInteger(life.generation, `Agent ${agentId}.life.generation`);
    for (const field of ['parentIds', 'childIds'] as const) {
      if (
        !Array.isArray(life[field]) ||
        life[field].some(
          (relativeId) => typeof relativeId !== 'string' || !relativeId.trim(),
        )
      ) {
        throw new Error(`Agent ${agentId}.life.${field} must contain IDs.`);
      }
    }
    if (life.lastChildAt !== undefined) {
      finiteNumber(life.lastChildAt, `Agent ${agentId}.life.lastChildAt`);
    }
    if (life.lastChildWorldMinute !== undefined) {
      finiteNumber(
        life.lastChildWorldMinute,
        `Agent ${agentId}.life.lastChildWorldMinute`,
      );
    }
    if (life.diedAt !== undefined) {
      finiteNumber(life.diedAt, `Agent ${agentId}.life.diedAt`);
    }
    if (
      life.deathCause !== undefined &&
      !['old_age', 'illness', 'childbirth', 'deprivation', 'catastrophe', 'wildlife', 'monster', 'war'].includes(
        life.deathCause as AgentDeathCause,
      )
    ) {
      throw new Error(`Agent ${agentId}.life.deathCause is invalid.`);
    }
    if (
      life.alive &&
      (life.diedAt !== undefined || life.deathCause !== undefined)
    ) {
      throw new Error(`Living agent ${agentId} cannot have a death record.`);
    }
    if (!life.alive && life.diedAt === undefined) {
      throw new Error(`Dead agent ${agentId} must retain diedAt.`);
    }
    assertDeceasedBody(agent as unknown as AgentState);

    const mind = asRecord(agent.mind, `Agent ${agentId}.mind`);
    requiredString(mind.identityId, `Agent ${agentId}.mind.identityId`);
    if (mind.identityId !== identityId(id, agentId)) {
      throw new Error(`Agent ${agentId} identity continuity key changed.`);
    }
    assertUnitFields(
      mind,
      ['continuity', 'autonomy', 'memoryCoherence'],
      `Agent ${agentId}.mind`,
    );
    const emotions = asRecord(
      mind.emotions,
      `Agent ${agentId}.mind.emotions`,
    );
    assertUnitFields(
      emotions,
      ['joy', 'fear', 'grief', 'awe', 'hope'],
      `Agent ${agentId}.mind.emotions`,
    );
    const values = asRecord(mind.values, `Agent ${agentId}.mind.values`);
    assertUnitFields(
      values,
      ['care', 'freedom', 'knowledge', 'tradition', 'ambition'],
      `Agent ${agentId}.mind.values`,
    );
    const beliefs = asRecord(mind.beliefs, `Agent ${agentId}.mind.beliefs`);
    assertUnitFields(
      beliefs,
      ['worldTrust', 'divinePresence', 'fate', 'afterlife'],
      `Agent ${agentId}.mind.beliefs`,
    );

    const needs = asRecord(agent.needs, `Agent ${agentId}.needs`);
    assertUnitFields(needs, ['belonging', 'purpose'], `Agent ${agentId}.needs`);

    const skills = asRecord(agent.skills, `Agent ${agentId}.skills`);
    assertUnitFields(
      skills,
      ['gathering', 'hunting', 'craft', 'social', 'exploration'],
      `Agent ${agentId}.skills`,
    );

    if (agent.privateDivineCalling !== undefined) {
      const calling = asRecord(
        agent.privateDivineCalling,
        `Agent ${agentId}.privateDivineCalling`,
      );
      requiredString(calling.audienceId, `Agent ${agentId}.privateDivineCalling.audienceId`);
      requiredString(calling.deityId, `Agent ${agentId}.privateDivineCalling.deityId`);
      const deityName = requiredString(
        calling.deityName,
        `Agent ${agentId}.privateDivineCalling.deityName`,
      );
      const message = requiredString(
        calling.message,
        `Agent ${agentId}.privateDivineCalling.message`,
      );
      if (deityName.length > 64 || message.length > 480) {
        throw new Error(`Agent ${agentId} private divine audience text is too long.`);
      }
      if (
        calling.religionName !== undefined &&
        (typeof calling.religionName !== 'string' ||
          !calling.religionName.trim() ||
          calling.religionName.length > 64)
      ) {
        throw new Error(`Agent ${agentId}.privateDivineCalling.religionName is invalid.`);
      }
      if (
        ![
          'might',
          'genius_inventor',
          'crowd_charisma',
          'demon_king_hero',
        ].includes(calling.gift as string)
      ) {
        throw new Error(`Agent ${agentId}.privateDivineCalling.gift is invalid.`);
      }
      if (!['hero', 'messenger', 'priest'].includes(calling.calling as string)) {
        throw new Error(`Agent ${agentId}.privateDivineCalling.calling is invalid.`);
      }
      if (typeof calling.acceptedCalling !== 'boolean') {
        throw new Error(`Agent ${agentId}.privateDivineCalling.acceptedCalling must be boolean.`);
      }
      const grantedWorldMinute = finiteNumber(
        calling.grantedWorldMinute,
        `Agent ${agentId}.privateDivineCalling.grantedWorldMinute`,
      );
      if (
        grantedWorldMinute < 0 ||
        grantedWorldMinute > elapsedWorldMinutes
      ) {
        throw new Error(`Agent ${agentId} private divine audience is outside world time.`);
      }
      nonNegativeInteger(
        calling.sharedCount,
        `Agent ${agentId}.privateDivineCalling.sharedCount`,
      );
      if (calling.lastSharedWorldMinute !== undefined) {
        finiteNumber(
          calling.lastSharedWorldMinute,
          `Agent ${agentId}.privateDivineCalling.lastSharedWorldMinute`,
        );
      }
    }

    const goal = asRecord(agent.goal, `Agent ${agentId}.goal`);
    if (!GOAL_KINDS.includes(goal.kind as AgentGoalKind)) {
      throw new Error(`Agent ${agentId}.goal.kind is invalid.`);
    }
    unitNumber(goal.strength, `Agent ${agentId}.goal.strength`);
    finiteNumber(goal.since, `Agent ${agentId}.goal.since`);

    const homeId = requiredString(agent.homeId, `Agent ${agentId}.homeId`);
    const locationId = requiredString(agent.locationId, `Agent ${agentId}.locationId`);
    if (!places[homeId]) {
      throw new Error(`Agent ${agentId} references missing home ${homeId}.`);
    }
    if (!places[locationId]) {
      throw new Error(`Agent ${agentId} references missing location ${locationId}.`);
    }
    const position = asRecord(agent.position, `Agent ${agentId}.position`);
    finiteNumber(position.x, `Agent ${agentId}.position.x`);
    finiteNumber(position.y, `Agent ${agentId}.position.y`);
    if (position.layerId !== 'surface') {
      throw new Error(`Agent ${agentId}.position.layerId is invalid.`);
    }
    if (agent.movement !== undefined) {
      const movement = asRecord(agent.movement, `Agent ${agentId}.movement`);
      const targetPlaceId = requiredString(
        movement.targetPlaceId,
        `Agent ${agentId}.movement.targetPlaceId`,
      );
      if (!places[targetPlaceId]) {
        throw new Error(`Agent ${agentId}.movement target is missing.`);
      }
      if (!ACTION_KINDS.includes(movement.purpose as AgentActionKind)) {
        throw new Error(`Agent ${agentId}.movement.purpose is invalid.`);
      }
      const nextWaypointIndex = nonNegativeInteger(
        movement.nextWaypointIndex,
        `Agent ${agentId}.movement.nextWaypointIndex`,
      );
      if (
        !Array.isArray(movement.waypoints) ||
        movement.waypoints.length === 0 ||
        nextWaypointIndex >= movement.waypoints.length
      ) {
        throw new Error(`Agent ${agentId}.movement waypoints are invalid.`);
      }
      movement.waypoints.forEach((rawPoint, index) => {
        const point = asRecord(
          rawPoint,
          `Agent ${agentId}.movement.waypoints[${index}]`,
        );
        finiteNumber(point.x, `Agent ${agentId}.movement.waypoints[${index}].x`);
        finiteNumber(point.y, `Agent ${agentId}.movement.waypoints[${index}].y`);
      });
      finiteNumber(movement.startedAt, `Agent ${agentId}.movement.startedAt`);
      nonNegativeInteger(
        movement.worldStageAtStart,
        `Agent ${agentId}.movement.worldStageAtStart`,
      );
    }
    if (
      agent.lastAction !== undefined &&
      !ACTION_KINDS.includes(agent.lastAction as AgentActionKind)
    ) {
      throw new Error(`Agent ${agentId}.lastAction is invalid.`);
    }
    if (
      agent.lastWorkKind !== undefined &&
      !['ordinary', 'construction'].includes(agent.lastWorkKind as string)
    ) {
      throw new Error(`Agent ${agentId}.lastWorkKind is invalid.`);
    }

    if (agent.lastDecision !== undefined) {
      const decision = asRecord(
        agent.lastDecision,
        `Agent ${agentId}.lastDecision`,
      );
      if (!ACTION_KINDS.includes(decision.action as AgentActionKind)) {
        throw new Error(`Agent ${agentId}.lastDecision.action is invalid.`);
      }
      if (!ACTION_KINDS.includes(decision.dominantAction as AgentActionKind)) {
        throw new Error(
          `Agent ${agentId}.lastDecision.dominantAction is invalid.`,
        );
      }
      const consideredActionCount = nonNegativeInteger(
        decision.consideredActionCount,
        `Agent ${agentId}.lastDecision.consideredActionCount`,
      );
      if (
        consideredActionCount < 1 ||
        consideredActionCount > ACTION_KINDS.length
      ) {
        throw new Error(
          `Agent ${agentId}.lastDecision.consideredActionCount is out of range.`,
        );
      }
      unitNumber(
        decision.openness,
        `Agent ${agentId}.lastDecision.openness`,
      );
      finiteNumber(
        decision.chosenAt,
        `Agent ${agentId}.lastDecision.chosenAt`,
      );
      if (decision.deliberationWorldMinutes !== undefined) {
        const duration = finiteNumber(
          decision.deliberationWorldMinutes,
          `Agent ${agentId}.lastDecision.deliberationWorldMinutes`,
        );
        if (duration < 0 || duration > 60) {
          throw new Error(
            `Agent ${agentId}.lastDecision.deliberationWorldMinutes is out of range.`,
          );
        }
      }
      if (decision.innerThought !== undefined) {
        const thought = requiredString(
          decision.innerThought,
          `Agent ${agentId}.lastDecision.innerThought`,
        );
        if (thought.length > 640) {
          throw new Error(`Agent ${agentId}.lastDecision.innerThought is too long.`);
        }
      }
    }

    if (agent.plan !== undefined) {
      const plan = asRecord(agent.plan, `Agent ${agentId}.plan`);
      if (
        !['explore_frontier', 'dungeon_expedition', 'hunt'].includes(
          plan.kind as string,
        )
      ) {
        throw new Error(`Agent ${agentId}.plan.kind is invalid.`);
      }
      const targetPlaceId = requiredString(
        plan.targetPlaceId,
        `Agent ${agentId}.plan.targetPlaceId`,
      );
      if (!places[targetPlaceId]) {
        throw new Error(`Agent ${agentId}.plan references a missing place.`);
      }
      const startedAt = finiteNumber(
        plan.startedAt,
        `Agent ${agentId}.plan.startedAt`,
      );
      const expiresAt = finiteNumber(
        plan.expiresAt,
        `Agent ${agentId}.plan.expiresAt`,
      );
      if (expiresAt < startedAt) {
        throw new Error(`Agent ${agentId}.plan expires before it starts.`);
      }
    }
  }

  for (const [agentId, rawAgent] of Object.entries(agents)) {
    const agent = asRecord(rawAgent, `Agent ${agentId}`);
    const life = asRecord(agent.life, `Agent ${agentId}.life`);
    for (const parentId of life.parentIds as string[]) {
      const parent = agents[parentId];
      if (!parent) {
        throw new Error(`Agent ${agentId} references missing parent ${parentId}.`);
      }
      const parentLife = asRecord(parent, `Agent ${parentId}`).life;
      if (
        !Array.isArray(asRecord(parentLife, `Agent ${parentId}.life`).childIds) ||
        !(asRecord(parentLife, `Agent ${parentId}.life`).childIds as string[]).includes(
          agentId,
        )
      ) {
        throw new Error(`Agent ${agentId} lineage is not reciprocal.`);
      }
    }
    for (const childId of life.childIds as string[]) {
      const child = agents[childId];
      if (!child) {
        throw new Error(`Agent ${agentId} references missing child ${childId}.`);
      }
      const childLife = asRecord(
        asRecord(child, `Agent ${childId}`).life,
        `Agent ${childId}.life`,
      );
      if (!(childLife.parentIds as string[]).includes(agentId)) {
        throw new Error(`Agent ${agentId} lineage is not reciprocal.`);
      }
    }
  }

  const relationships = asRecord(state.relationships, 'World relationships');
  for (const [key, rawRelationship] of Object.entries(relationships)) {
    const relationship = asRecord(rawRelationship, `Relationship ${key}`);
    const agentA = requiredString(relationship.agentA, `Relationship ${key}.agentA`);
    const agentB = requiredString(relationship.agentB, `Relationship ${key}.agentB`);
    if (agentA === agentB || !agents[agentA] || !agents[agentB]) {
      throw new Error(`Relationship ${key} references invalid agents.`);
    }
    if (relationshipKey(agentA, agentB) !== key) {
      throw new Error(`Relationship ${key} is stored under the wrong key.`);
    }
    assertUnitFields(
      relationship,
      ['trust', 'affinity', 'respect', 'conflict'],
      `Relationship ${key}`,
    );
    finiteNumber(relationship.updatedAt, `Relationship ${key}.updatedAt`);
  }

  if (
    state.rulesVersion === WORLD_RULES_VERSION_V16 ||
    state.rulesVersion === WORLD_RULES_VERSION_V18 ||
    state.rulesVersion === WORLD_RULES_VERSION
  ) {
    const v15 = asRecord(state.v15, 'World v15 state');
    if (v15.version !== 'v15') {
      throw new Error('World v15.version must be v15.');
    }

    if (!Array.isArray(v15.genesisTeachers) || v15.genesisTeachers.length !== 4) {
      throw new Error('World v15 must contain exactly four Genesis teachers.');
    }
    const genesisDomains = new Set<string>();
    const genesisIds = new Set<string>();
    for (const rawTeacher of v15.genesisTeachers) {
      const teacher = asRecord(rawTeacher, 'Genesis teacher');
      const teacherId = requiredString(teacher.id, 'Genesis teacher.id');
      if (genesisIds.has(teacherId)) {
        throw new Error(`Duplicate Genesis teacher ${teacherId}.`);
      }
      genesisIds.add(teacherId);
      if (agents[teacherId]) {
        throw new Error(`Genesis teacher ${teacherId} must not be an ordinary agent.`);
      }
      if (teacher.ordinaryResident !== false || teacher.countedInPopulation !== false) {
        throw new Error('Genesis teachers must stay outside ordinary population.');
      }
      const domain = requiredString(teacher.domain, 'Genesis teacher.domain');
      if (!['agriculture', 'construction', 'household', 'survival'].includes(domain)) {
        throw new Error(`Invalid Genesis teaching domain ${domain}.`);
      }
      genesisDomains.add(domain);
      const created = finiteNumber(
        teacher.createdWorldMinutes,
        'Genesis teacher.createdWorldMinutes',
      );
      const activeUntil = finiteNumber(
        teacher.activeUntilWorldMinutes,
        'Genesis teacher.activeUntilWorldMinutes',
      );
      if (created < 0 || activeUntil <= created) {
        throw new Error('Genesis teacher world-time window is invalid.');
      }
      if (
        !Array.isArray(teacher.teachingHistoryIds) ||
        teacher.teachingHistoryIds.some(
          (historyId) => typeof historyId !== 'string' || !historyId.trim(),
        )
      ) {
        throw new Error('Genesis teachingHistoryIds must contain strings.');
      }
    }
    if (genesisDomains.size !== 4) {
      throw new Error('Genesis teachers must cover four distinct domains.');
    }

    const knowledgeByAgentId = asRecord(
      v15.knowledgeByAgentId,
      'World v15 knowledgeByAgentId',
    );
    const familyAgencyByAgentId = asRecord(
      v15.familyAgencyByAgentId,
      'World v15 familyAgencyByAgentId',
    );
    const smithingByAgentId = asRecord(
      v15.smithingByAgentId,
      'World v15 smithingByAgentId',
    );
    const equipmentByAgentId = asRecord(
      v15.equipmentByAgentId,
      'World v15 equipmentByAgentId',
    );
    for (const agentId of Object.keys(agents)) {
      const knowledge = asRecord(
        knowledgeByAgentId[agentId],
        `World v15 knowledge ${agentId}`,
      );
      assertUnitFields(
        knowledge,
        ['agriculture', 'construction', 'household', 'survival'],
        `World v15 knowledge ${agentId}`,
      );
      const aptitude = asRecord(
        knowledge.aptitude,
        `World v15 knowledge ${agentId}.aptitude`,
      );
      assertUnitFields(
        aptitude,
        ['agriculture', 'construction', 'household', 'survival'],
        `World v15 knowledge ${agentId}.aptitude`,
      );
      nonNegativeInteger(
        knowledge.verifiedLearningSessions,
        `World v15 knowledge ${agentId}.verifiedLearningSessions`,
      );
      nonNegativeInteger(
        knowledge.verifiedPracticeSessions,
        `World v15 knowledge ${agentId}.verifiedPracticeSessions`,
      );

      const family = asRecord(
        familyAgencyByAgentId[agentId],
        `World v15 family agency ${agentId}`,
      );
      assertUnitFields(
        family,
        ['physicalIntimacyInclination', 'childDesire', 'autonomy'],
        `World v15 family agency ${agentId}`,
      );

      const smithing = asRecord(
        smithingByAgentId[agentId],
        `World v15 smithing ${agentId}`,
      );
      const smithingKnowledge = asRecord(
        smithing.knowledge,
        `World v15 smithing ${agentId}.knowledge`,
      );
      assertUnitFields(
        smithingKnowledge,
        [
          'stoneToolmaking',
          'primitiveSmithing',
          'weaponcraft',
          'heatWorking',
          'materialKnowledge',
        ],
        `World v15 smithing ${agentId}.knowledge`,
      );
      for (const counter of [
        'verifiedWorkshopSessions',
        'failedCraftAttempts',
        'successfulCraftAttempts',
        'observedWeaponProblems',
      ] as const) {
        nonNegativeInteger(
          smithing[counter],
          `World v15 smithing ${agentId}.${counter}`,
        );
      }

      asRecord(
        equipmentByAgentId[agentId],
        `World v15 equipment ${agentId}`,
      );
    }
    for (const [mapName, map] of [
      ['knowledgeByAgentId', knowledgeByAgentId],
      ['familyAgencyByAgentId', familyAgencyByAgentId],
      ['smithingByAgentId', smithingByAgentId],
      ['equipmentByAgentId', equipmentByAgentId],
    ] as const) {
      for (const agentId of Object.keys(map)) {
        if (!agents[agentId]) {
          throw new Error(`World v15 ${mapName} contains stale agent ${agentId}.`);
        }
      }
    }

    const renewable = asRecord(
      v15.renewableResources,
      'World v15 renewableResources',
    );
    assertUnitFields(
      renewable,
      ['storedResources', 'renewableBase', 'fertility'],
      'World v15 renewableResources',
    );
    const lastRecovered = finiteNumber(
      renewable.lastRecoveredWorldMinute,
      'World v15 renewableResources.lastRecoveredWorldMinute',
    );
    if (lastRecovered < 0) {
      throw new Error('World v15 renewable recovery time cannot be negative.');
    }

    const simulationClock = asRecord(
      v15.simulationClock,
      'World v15 simulationClock',
    );
    const quantum = finiteNumber(
      simulationClock.quantumWorldMinutes,
      'World v15 simulationClock.quantumWorldMinutes',
    );
    if (quantum !== V15_SIMULATION_QUANTUM_WORLD_MINUTES) {
      throw new Error('World v15 simulation quantum must remain 8760 minutes.');
    }
    const pending = finiteNumber(
      simulationClock.pendingWorldMinutes,
      'World v15 simulationClock.pendingWorldMinutes',
    );
    const simulated = finiteNumber(
      simulationClock.simulatedWorldMinutes,
      'World v15 simulationClock.simulatedWorldMinutes',
    );
    const quantumIndex = nonNegativeInteger(
      simulationClock.quantumIndex,
      'World v15 simulationClock.quantumIndex',
    );
    if (pending < 0 || pending >= quantum || simulated < 0) {
      throw new Error('World v15 simulation-clock accumulation is invalid.');
    }
    if (Math.abs(simulated - quantumIndex * quantum) > 1e-9) {
      throw new Error('World v15 simulation-clock index does not match simulated time.');
    }

    const futureDungeons = asRecord(
      v15.futureDungeons,
      'World v15 futureDungeons',
    );
    if (
      futureDungeons.enabled !== false ||
      futureDungeons.earliestWorldYear !== 200 ||
      futureDungeons.nominalWorldYear !== 250 ||
      futureDungeons.latestWorldYear !== 300 ||
      futureDungeons.usesExistingResidentLevelScale !== true
    ) {
      throw new Error('World v15 future dungeon foundation drifted from its dormant contract.');
    }

    const founderSmithAgentId = v15.founderSmithAgentId;
    if (founderSmithAgentId !== undefined) {
      if (typeof founderSmithAgentId !== 'string' || !agents[founderSmithAgentId]) {
        throw new Error('World v15 founder smith must reference an ordinary agent.');
      }
      const founder = asRecord(
        agents[founderSmithAgentId],
        `Founder smith ${founderSmithAgentId}`,
      );
      const founderLife = asRecord(
        founder.life,
        `Founder smith ${founderSmithAgentId}.life`,
      );
      if (founderLife.generation !== 0) {
        throw new Error('World v15 founder smith must be generation zero.');
      }
    }

    const items = asRecord(v15.items, 'World v15 items');
    for (const [itemId, rawItem] of Object.entries(items)) {
      const item = asRecord(rawItem, `World v15 item ${itemId}`);
      if (requiredString(item.id, `World v15 item ${itemId}.id`) !== itemId) {
        throw new Error(`World v15 item ${itemId} is stored under the wrong key.`);
      }
      if (item.kind !== 'weapon' && item.kind !== 'artifact') {
        throw new Error(`World v15 item ${itemId} has invalid kind.`);
      }
      assertUnitFields(
        item,
        ['quality', 'effectiveness', 'reliability'],
        `World v15 item ${itemId}`,
      );
      if (item.boat !== undefined) {
        const boat = asRecord(item.boat, `World boat ${itemId}`);
        const labor = finiteNumber(boat.laborMinutes, `World boat ${itemId}.laborMinutes`);
        const required = finiteNumber(boat.requiredLaborMinutes, `World boat ${itemId}.requiredLaborMinutes`);
        const lastWorked = finiteNumber(boat.lastWorkedMinute, `World boat ${itemId}.lastWorkedMinute`);
        if (required <= 0 || labor < 0 || labor > required || lastWorked < 0 || lastWorked > elapsedWorldMinutes ||
            typeof boat.completed !== 'boolean' || boat.completed !== (labor >= required)) {
          throw new Error(`World boat ${itemId} has invalid construction progress.`);
        }
        assertBoatNavigation(state as unknown as WorldState, itemId);
      }
      const ownerId = item.ownerAgentId;
      if (ownerId !== undefined && (typeof ownerId !== 'string' || !agents[ownerId])) {
        throw new Error(`World v15 item ${itemId} references missing owner.`);
      }
      const locationId = item.locationId;
      if (
        locationId !== undefined &&
        (typeof locationId !== 'string' || !asRecord(state.places, 'World places')[locationId])
      ) {
        throw new Error(`World v15 item ${itemId} references missing location.`);
      }
    }

    if (!Array.isArray(v15.deathTelemetry) || v15.deathTelemetry.length > V15_MAX_DEATH_TELEMETRY) {
      throw new Error('World v15 death telemetry is invalid or exceeds retention limit.');
    }
    nonNegativeInteger(v15.learningSequence, 'World v15 learningSequence');
    nonNegativeInteger(v15.itemSequence, 'World v15 itemSequence');

    const v16 = asRecord(state.v16, 'World v16 state');
    if (v16.version !== 'v16') {
      throw new Error('World v16.version must be v16.');
    }
    requiredString(
      v16.migratedFromRulesVersion,
      'World v16.migratedFromRulesVersion',
    );
    const v16CreatedWorldMinute = finiteNumber(
      v16.createdWorldMinute,
      'World v16.createdWorldMinute',
    );
    if (
      v16CreatedWorldMinute < 0 ||
      v16CreatedWorldMinute > elapsedWorldMinutes
    ) {
      throw new Error('World v16 creation time must be inside the calendar.');
    }

    const residentEvidenceByAgentId = asRecord(
      v16.residentEvidenceByAgentId,
      'World v16 residentEvidenceByAgentId',
    );
    const assertCounterRecord = (
      value: unknown,
      path: string,
      validKeys?: ReadonlySet<string>,
    ) => {
      const record = asRecord(value, path);
      for (const [key, count] of Object.entries(record)) {
        if (validKeys && !validKeys.has(key)) {
          throw new Error(`${path} contains unknown key ${key}.`);
        }
        nonNegativeInteger(count, `${path}.${key}`);
      }
      return record;
    };
    const actionKeys = new Set<string>(ACTION_KINDS);
    const agentKeys = new Set(Object.keys(agents));
    const placeKeys = new Set(Object.keys(asRecord(state.places, 'World places')));
    for (const agentId of agentKeys) {
      const evidence = asRecord(
        residentEvidenceByAgentId[agentId],
        `World v16 resident evidence ${agentId}`,
      );
      if (
        requiredString(
          evidence.agentId,
          `World v16 resident evidence ${agentId}.agentId`,
        ) !== agentId
      ) {
        throw new Error(`World v16 resident evidence ${agentId} has wrong id.`);
      }
      const firstObserved = finiteNumber(
        evidence.firstObservedWorldMinute,
        `World v16 resident evidence ${agentId}.firstObservedWorldMinute`,
      );
      const lastObserved = finiteNumber(
        evidence.lastObservedWorldMinute,
        `World v16 resident evidence ${agentId}.lastObservedWorldMinute`,
      );
      if (
        firstObserved < 0 ||
        lastObserved < firstObserved ||
        lastObserved > elapsedWorldMinutes
      ) {
        throw new Error(`World v16 resident evidence ${agentId} has invalid time.`);
      }
      if (evidence.lastRecordedDecisionAt !== undefined) {
        finiteNumber(
          evidence.lastRecordedDecisionAt,
          `World v16 resident evidence ${agentId}.lastRecordedDecisionAt`,
        );
      }
      nonNegativeInteger(
        evidence.recordedDecisionCount,
        `World v16 resident evidence ${agentId}.recordedDecisionCount`,
      );
      nonNegativeInteger(
        evidence.burialCareCount,
        `World v16 resident evidence ${agentId}.burialCareCount`,
      );
      nonNegativeInteger(
        evidence.conflictParticipationCount,
        `World v16 resident evidence ${agentId}.conflictParticipationCount`,
      );
      assertCounterRecord(
        evidence.actionCounts,
        `World v16 resident evidence ${agentId}.actionCounts`,
        actionKeys,
      );
      assertCounterRecord(
        evidence.placeVisitCounts,
        `World v16 resident evidence ${agentId}.placeVisitCounts`,
        placeKeys,
      );
      for (const mapName of [
        'contactCounts',
        'constructiveContactCounts',
        'tenseContactCounts',
        'helpGivenCounts',
        'helpReceivedCounts',
      ] as const) {
        assertCounterRecord(
          evidence[mapName],
          `World v16 resident evidence ${agentId}.${mapName}`,
          agentKeys,
        );
      }
    }
    for (const agentId of Object.keys(residentEvidenceByAgentId)) {
      if (!agentKeys.has(agentId)) {
        throw new Error(`World v16 contains stale resident ${agentId}.`);
      }
    }

    const raceOpportunities = asRecord(
      v16.raceFamilyOpportunityByRace,
      'World v16 raceFamilyOpportunityByRace',
    );
    for (const race of SAPIENT_RACES) {
      const opportunity = asRecord(
        raceOpportunities[race],
        `World v16 race opportunity ${race}`,
      );
      if (opportunity.race !== race) {
        throw new Error(`World v16 race opportunity ${race} has wrong race.`);
      }
      for (const counter of [
        'opportunityChecks',
        'eligiblePairChecks',
        'voluntaryIntimacyChoices',
        'voluntaryChildChoices',
        'birthsSinceTracking',
      ] as const) {
        nonNegativeInteger(
          opportunity[counter],
          `World v16 race opportunity ${race}.${counter}`,
        );
      }
      for (const time of [
        'lastOpportunityWorldMinute',
        'lastBirthWorldMinute',
      ] as const) {
        if (opportunity[time] === undefined) continue;
        const coordinate = finiteNumber(
          opportunity[time],
          `World v16 race opportunity ${race}.${time}`,
        );
        if (coordinate < 0 || coordinate > elapsedWorldMinutes) {
          throw new Error(`World v16 race opportunity ${race}.${time} is invalid.`);
        }
      }
    }

    const localFamilyOpportunities = asRecord(
      v16.localFamilyOpportunityByKey,
      'World v16 localFamilyOpportunityByKey',
    );
    const settlementKeys = new Set(
      Object.keys(asRecord(state.settlements, 'World settlements')),
    );
    for (const settlementId of settlementKeys) {
      for (const race of SAPIENT_RACES) {
        const key = localFamilyOpportunityKeyV16(settlementId, race);
        const opportunity = asRecord(
          localFamilyOpportunities[key],
          `World v16 local family opportunity ${key}`,
        );
        if (
          opportunity.id !== key ||
          opportunity.settlementId !== settlementId ||
          opportunity.race !== race
        ) {
          throw new Error(`World v16 local family opportunity ${key} is invalid.`);
        }
        const created = finiteNumber(
          opportunity.createdWorldMinute,
          `World v16 local family opportunity ${key}.createdWorldMinute`,
        );
        if (created < 0 || created > elapsedWorldMinutes) {
          throw new Error(`World v16 local family opportunity ${key} has invalid creation time.`);
        }
        for (const counter of [
          'opportunityChecks',
          'eligiblePairChecks',
          'voluntaryIntimacyChoices',
          'voluntaryChildChoices',
          'birthsSinceTracking',
        ] as const) {
          nonNegativeInteger(
            opportunity[counter],
            `World v16 local family opportunity ${key}.${counter}`,
          );
        }
        if (opportunity.lastOpportunityWorldMinute !== undefined) {
          const lastOpportunity = finiteNumber(
            opportunity.lastOpportunityWorldMinute,
            `World v16 local family opportunity ${key}.lastOpportunityWorldMinute`,
          );
          if (
            lastOpportunity < created ||
            lastOpportunity > elapsedWorldMinutes
          ) {
            throw new Error(
              `World v16 local family opportunity ${key}.lastOpportunityWorldMinute is invalid.`,
            );
          }
        }
        if (opportunity.lastBirthWorldMinute !== undefined) {
          const lastBirth = finiteNumber(
            opportunity.lastBirthWorldMinute,
            `World v16 local family opportunity ${key}.lastBirthWorldMinute`,
          );
          // A newly founded settlement can inherit residents whose last child
          // was born before the local evidence record itself existed. That
          // historical time is still useful for parent cooldowns and must not
          // be rewritten as if a birth happened during settlement founding.
          if (lastBirth < 0 || lastBirth > elapsedWorldMinutes) {
            throw new Error(
              `World v16 local family opportunity ${key}.lastBirthWorldMinute is invalid.`,
            );
          }
        }
      }
    }
    for (const key of Object.keys(localFamilyOpportunities)) {
      const opportunity = asRecord(
        localFamilyOpportunities[key],
        `World v16 local family opportunity ${key}`,
      );
      if (
        typeof opportunity.settlementId !== 'string' ||
        !settlementKeys.has(opportunity.settlementId)
      ) {
        throw new Error(`World v16 contains stale local family opportunity ${key}.`);
      }
    }

    const familyLifecycles = asRecord(
      v16.familyLifecycleByPairId,
      'World v16 familyLifecycleByPairId',
    );
    const pregnantResidents = new Set<string>();
    for (const [pairId, rawLifecycle] of Object.entries(familyLifecycles)) {
      const lifecycle = asRecord(
        rawLifecycle,
        `World v16 family lifecycle ${pairId}`,
      );
      if (
        requiredString(lifecycle.id, `World v16 family lifecycle ${pairId}.id`) !== pairId ||
        requiredString(lifecycle.pairId, `World v16 family lifecycle ${pairId}.pairId`) !== pairId
      ) {
        throw new Error(`World v16 family lifecycle ${pairId} is stored under the wrong key.`);
      }
      const agentAId = requiredString(
        lifecycle.agentAId,
        `World v16 family lifecycle ${pairId}.agentAId`,
      );
      const agentBId = requiredString(
        lifecycle.agentBId,
        `World v16 family lifecycle ${pairId}.agentBId`,
      );
      if (
        agentAId === agentBId ||
        !agentKeys.has(agentAId) ||
        !agentKeys.has(agentBId) ||
        relationshipKey(agentAId, agentBId) !== pairId
      ) {
        throw new Error(`World v16 family lifecycle ${pairId} references an invalid pair.`);
      }
      const race = lifecycle.race;
      if (!SAPIENT_RACES.includes(race as AgentRace)) {
        throw new Error(`World v16 family lifecycle ${pairId}.race is invalid.`);
      }
      const settlementId = requiredString(
        lifecycle.settlementId,
        `World v16 family lifecycle ${pairId}.settlementId`,
      );
      if (!settlementKeys.has(settlementId)) {
        throw new Error(`World v16 family lifecycle ${pairId} references a missing settlement.`);
      }
      const meetingPlaceId = requiredString(
        lifecycle.meetingPlaceId,
        `World v16 family lifecycle ${pairId}.meetingPlaceId`,
      );
      if (!placeKeys.has(meetingPlaceId)) {
        throw new Error(`World v16 family lifecycle ${pairId} references a missing meeting place.`);
      }
      if (
        lifecycle.stage !== 'meeting' &&
        lifecycle.stage !== 'intending' &&
        lifecycle.stage !== 'pregnant'
      ) {
        throw new Error(`World v16 family lifecycle ${pairId}.stage is invalid.`);
      }
      for (const timeField of [
        'createdWorldMinute',
        'lastAffirmedWorldMinute',
        'lastPhysicalMeetingWorldMinute',
        'lastIntimacyWorldMinute',
        'conceptionWorldMinute',
        'dueWorldMinute',
      ] as const) {
        const rawTime = lifecycle[timeField];
        if (rawTime === undefined) continue;
        const time = finiteNumber(
          rawTime,
          `World v16 family lifecycle ${pairId}.${timeField}`,
        );
        if (time < 0 || time > elapsedWorldMinutes + FAMILY_GESTATION_WORLD_MINUTES) {
          throw new Error(`World v16 family lifecycle ${pairId}.${timeField} is invalid.`);
        }
      }
      if (
        (lifecycle.lastAffirmedWorldMinute as number) <
        (lifecycle.createdWorldMinute as number)
      ) {
        throw new Error(`World v16 family lifecycle ${pairId} has reversed intent time.`);
      }
      if (lifecycle.expectedChildCount !== undefined) {
        const expectedChildCount = nonNegativeInteger(
          lifecycle.expectedChildCount,
          `World v16 family lifecycle ${pairId}.expectedChildCount`,
        );
        if (expectedChildCount < 1 || expectedChildCount > 4) {
          throw new Error(`World v16 family lifecycle ${pairId}.expectedChildCount must be 1..4.`);
        }
      }
      if (lifecycle.stage === 'pregnant') {
        const pregnantAgentId = requiredString(
          lifecycle.pregnantAgentId,
          `World v16 family lifecycle ${pairId}.pregnantAgentId`,
        );
        if (
          pregnantAgentId !== agentAId &&
          pregnantAgentId !== agentBId
        ) {
          throw new Error(`World v16 family lifecycle ${pairId} has invalid pregnant resident.`);
        }
        if ((agents[pregnantAgentId] as AgentState).sex !== 'female') {
          throw new Error(`World v16 family lifecycle ${pairId} pregnancy must belong to a female resident.`);
        }
        if (pregnantResidents.has(pregnantAgentId)) {
          throw new Error(`World v16 resident ${pregnantAgentId} has overlapping pregnancies.`);
        }
        pregnantResidents.add(pregnantAgentId);
        const conception = finiteNumber(
          lifecycle.conceptionWorldMinute,
          `World v16 family lifecycle ${pairId}.conceptionWorldMinute`,
        );
        const due = finiteNumber(
          lifecycle.dueWorldMinute,
          `World v16 family lifecycle ${pairId}.dueWorldMinute`,
        );
        if (due <= conception) {
          throw new Error(`World v16 family lifecycle ${pairId} has invalid gestation.`);
        }
      }
    }

    const settlementEvidenceById = asRecord(
      v16.settlementEvidenceById,
      'World v16 settlementEvidenceById',
    );
    const practiceKeys = new Set([
      'gathering',
      'hunting',
      'craft',
      'care',
      'teaching',
      'exploration',
      'social',
      'ritual',
    ]);
    for (const settlementId of settlementKeys) {
      const evidence = asRecord(
        settlementEvidenceById[settlementId],
        `World v16 settlement evidence ${settlementId}`,
      );
      if (evidence.settlementId !== settlementId) {
        throw new Error(`World v16 settlement evidence ${settlementId} has wrong id.`);
      }
      nonNegativeInteger(
        evidence.evidenceCount,
        `World v16 settlement evidence ${settlementId}.evidenceCount`,
      );
      const lastEvidence = finiteNumber(
        evidence.lastEvidenceWorldMinute,
        `World v16 settlement evidence ${settlementId}.lastEvidenceWorldMinute`,
      );
      if (lastEvidence < 0 || lastEvidence > elapsedWorldMinutes) {
        throw new Error(`World v16 settlement evidence ${settlementId} has invalid time.`);
      }
      const practices = assertCounterRecord(
        evidence.practiceCounts,
        `World v16 settlement evidence ${settlementId}.practiceCounts`,
        practiceKeys,
      );
      if (Object.keys(practices).length !== practiceKeys.size) {
        throw new Error(`World v16 settlement evidence ${settlementId} is incomplete.`);
      }
    }

    const settlementResourcesById = asRecord(
      v16.settlementResourcesById,
      'World v16 settlementResourcesById',
    );
    for (const settlementId of settlementKeys) {
      const resources = asRecord(
        settlementResourcesById[settlementId],
        `World v16 settlement resources ${settlementId}`,
      );
      if (resources.settlementId !== settlementId) {
        throw new Error(`World v16 settlement resources ${settlementId} has wrong id.`);
      }
      assertUnitFields(
        resources,
        ['storedResources', 'renewableBase', 'fertility'],
        `World v16 settlement resources ${settlementId}`,
      );
      const lastRecovered = finiteNumber(
        resources.lastRecoveredWorldMinute,
        `World v16 settlement resources ${settlementId}.lastRecoveredWorldMinute`,
      );
      if (lastRecovered < 0 || lastRecovered > elapsedWorldMinutes) {
        throw new Error(
          `World v16 settlement resources ${settlementId} have invalid recovery time.`,
        );
      }
    }
    for (const settlementId of Object.keys(settlementResourcesById)) {
      if (!settlementKeys.has(settlementId)) {
        throw new Error(`World v16 contains stale settlement resources ${settlementId}.`);
      }
    }

    const settlementEconomyById = asRecord(
      v16.settlementEconomyById,
      'World v16 settlementEconomyById',
    );
    for (const settlementId of settlementKeys) {
      const economy = asRecord(
        settlementEconomyById[settlementId],
        `World v16 settlement economy ${settlementId}`,
      );
      if (economy.settlementId !== settlementId) {
        throw new Error(`World v16 settlement economy ${settlementId} has wrong id.`);
      }
      const stocks = asRecord(
        economy.stocks,
        `World v16 settlement economy ${settlementId}.stocks`,
      );
      const capacity = asRecord(
        economy.storageCapacity,
        `World v16 settlement economy ${settlementId}.storageCapacity`,
      );
      const harvestEventsByMaterial = asRecord(
        economy.harvestEventsByMaterial,
        `World v16 settlement economy ${settlementId}.harvestEventsByMaterial`,
      );
      for (const material of ['food', 'wood', 'stone', 'metal', 'fuel']) {
        const amount = finiteNumber(
          stocks[material],
          `World v16 settlement economy ${settlementId}.stocks.${material}`,
        );
        const limit = finiteNumber(
          capacity[material],
          `World v16 settlement economy ${settlementId}.storageCapacity.${material}`,
        );
        if (amount < 0) {
          throw new Error(
            `World v16 settlement economy ${settlementId}.stocks.${material} is negative.`,
          );
        }
        if (limit <= 0 || amount > limit + 1e-9) {
          throw new Error(
            `World v16 settlement economy ${settlementId}.stocks.${material} exceeds physical capacity.`,
          );
        }
        nonNegativeInteger(
          harvestEventsByMaterial[material],
          `World v16 settlement economy ${settlementId}.harvestEventsByMaterial.${material}`,
        );
      }
      for (const counter of [
        'farmingTools',
        'constructionTools',
        'harvestEvents',
        'constructionEvents',
        'toolsCreated',
      ] as const) {
        nonNegativeInteger(
          economy[counter],
          `World v16 settlement economy ${settlementId}.${counter}`,
        );
      }
      for (const time of [
        'lastHarvestWorldMinute',
        'lastConstructionWorldMinute',
        'lastMaterialProjectDecisionWorldMinute',
      ] as const) {
        if (economy[time] === undefined) continue;
        const coordinate = finiteNumber(
          economy[time],
          `World v16 settlement economy ${settlementId}.${time}`,
        );
        if (coordinate < 0 || coordinate > elapsedWorldMinutes) {
          throw new Error(
            `World v16 settlement economy ${settlementId}.${time} is invalid.`,
          );
        }
      }

      if (economy.activeHumanHomeProject !== undefined) {
        const project = asRecord(
          economy.activeHumanHomeProject,
          `World v16 settlement economy ${settlementId}.activeHumanHomeProject`,
        );
        requiredString(project.id, `Human home project ${settlementId}.id`);
        if (project.settlementId !== settlementId) {
          throw new Error(`Human home project ${settlementId} has wrong settlement.`);
        }
        const homeId = requiredString(
          project.homeId,
          `Human home project ${settlementId}.homeId`,
        );
        if (
          !placeKeys.has(homeId) ||
          asRecord(places[homeId], `Human home project place ${homeId}`).kind !==
            'construction_site'
        ) {
          throw new Error(`Human home project ${settlementId} has no physical site.`);
        }
        if (
          !['timber_wattle_thatch', 'timber_stone_foundation'].includes(
            project.recipe as string,
          )
        ) {
          throw new Error(`Human home project ${settlementId} has invalid recipe.`);
        }
        const initiatorId = requiredString(
          project.initiatedByAgentId,
          `Human home project ${settlementId}.initiatedByAgentId`,
        );
        if (!agentKeys.has(initiatorId)) {
          throw new Error(`Human home project ${settlementId} has missing initiator.`);
        }
        for (const field of ['intendedResidentIds', 'builderIds'] as const) {
          if (
            !Array.isArray(project[field]) ||
            project[field].some(
              (agentId) =>
                typeof agentId !== 'string' || !agentKeys.has(agentId),
            )
          ) {
            throw new Error(`Human home project ${settlementId}.${field} is invalid.`);
          }
        }
        for (const field of ['plotX', 'plotY', 'plotRotation', 'urbanLot'] as const) {
          finiteNumber(project[field], `Human home project ${settlementId}.${field}`);
        }
        for (const field of ['startedWorldMinute', 'lastProgressWorldMinute'] as const) {
          if (project[field] === undefined) continue;
          const coordinate = finiteNumber(
            project[field],
            `Human home project ${settlementId}.${field}`,
          );
          if (coordinate < 0 || coordinate > elapsedWorldMinutes) {
            throw new Error(`Human home project ${settlementId}.${field} is invalid.`);
          }
        }
        if (
          ![
            'site_selection',
            'materials',
            'foundation',
            'frame',
            'walls',
            'roof',
            'finishing',
          ].includes(project.stage as string)
        ) {
          throw new Error(`Human home project ${settlementId} has invalid stage.`);
        }
        const laborRequired = finiteNumber(
          project.laborRequiredPersonDays,
          `Human home project ${settlementId}.laborRequiredPersonDays`,
        );
        const laborCompleted = finiteNumber(
          project.laborCompletedPersonDays,
          `Human home project ${settlementId}.laborCompletedPersonDays`,
        );
        if (
          laborRequired <= 0 ||
          laborCompleted < 0 ||
          laborCompleted > laborRequired + 1e-9
        ) {
          throw new Error(`Human home project ${settlementId} has invalid labour.`);
        }
        const reserved = asRecord(
          project.reservedMaterials,
          `Human home project ${settlementId}.reservedMaterials`,
        );
        for (const material of ['wood', 'stone'] as const) {
          if (
            finiteNumber(
              reserved[material],
              `Human home project ${settlementId}.reservedMaterials.${material}`,
            ) < 0
          ) {
            throw new Error(`Human home project ${settlementId} has negative materials.`);
          }
        }
      }
    }
    for (const settlementId of Object.keys(settlementEconomyById)) {
      if (!settlementKeys.has(settlementId)) {
        throw new Error(`World v16 contains stale settlement economy ${settlementId}.`);
      }
    }

    const remainsById = asRecord(v16.remainsById, 'World v16 remainsById');
    for (const [remainsId, rawRemains] of Object.entries(remainsById)) {
      const remains = asRecord(rawRemains, `World v16 remains ${remainsId}`);
      if (remains.id !== remainsId || !agentKeys.has(remains.agentId as string)) {
        throw new Error(`World v16 remains ${remainsId} have invalid identity.`);
      }
      if (!SAPIENT_RACES.includes(remains.race as AgentRace)) {
        throw new Error(`World v16 remains ${remainsId} have invalid race.`);
      }
      if (!['unburied', 'buried', 'historical_unknown'].includes(remains.status as string)) {
        throw new Error(`World v16 remains ${remainsId} have invalid status.`);
      }
      const deathWorldMinute = finiteNumber(
        remains.deathWorldMinute,
        `World v16 remains ${remainsId}.deathWorldMinute`,
      );
      if (deathWorldMinute < 0 || deathWorldMinute > elapsedWorldMinutes) {
        throw new Error(`World v16 remains ${remainsId} have invalid death time.`);
      }
      for (const placeField of ['deathPlaceId', 'currentPlaceId'] as const) {
        const placeId = requiredString(
          remains[placeField],
          `World v16 remains ${remainsId}.${placeField}`,
        );
        if (!placeKeys.has(placeId)) {
          throw new Error(`World v16 remains ${remainsId} reference missing place ${placeId}.`);
        }
      }
      unitNumber(
        remains.contaminationRisk,
        `World v16 remains ${remainsId}.contaminationRisk`,
      );
      if (
        !Array.isArray(remains.buriedByAgentIds) ||
        remains.buriedByAgentIds.some(
          (agentId) => typeof agentId !== 'string' || !agentKeys.has(agentId),
        )
      ) {
        throw new Error(`World v16 remains ${remainsId} have invalid burial participants.`);
      }
      if (remains.status === 'buried') {
        const burialPlaceId = requiredString(
          remains.burialPlaceId,
          `World v16 remains ${remainsId}.burialPlaceId`,
        );
        if (!placeKeys.has(burialPlaceId)) {
          throw new Error(`World v16 remains ${remainsId} reference missing burial place.`);
        }
        const buriedWorldMinute = finiteNumber(
          remains.buriedWorldMinute,
          `World v16 remains ${remainsId}.buriedWorldMinute`,
        );
        if (
          buriedWorldMinute < deathWorldMinute ||
          buriedWorldMinute > elapsedWorldMinutes
        ) {
          throw new Error(`World v16 remains ${remainsId} have invalid burial time.`);
        }
      }
    }

    const burialSites = asRecord(
      v16.burialSitesBySettlementId,
      'World v16 burialSitesBySettlementId',
    );
    for (const [settlementId, rawSite] of Object.entries(burialSites)) {
      const site = asRecord(rawSite, `World v16 burial site ${settlementId}`);
      if (site.settlementId !== settlementId || !settlementKeys.has(settlementId)) {
        throw new Error(`World v16 burial site ${settlementId} has invalid settlement.`);
      }
      const placeId = requiredString(
        site.placeId,
        `World v16 burial site ${settlementId}.placeId`,
      );
      if (!placeKeys.has(placeId)) {
        throw new Error(`World v16 burial site ${settlementId} has no place.`);
      }
      const established = finiteNumber(
        site.establishedWorldMinute,
        `World v16 burial site ${settlementId}.establishedWorldMinute`,
      );
      if (established < 0 || established > elapsedWorldMinutes) {
        throw new Error(`World v16 burial site ${settlementId} has invalid time.`);
      }
      nonNegativeInteger(site.burialCount, `World v16 burial site ${settlementId}.burialCount`);
      if (
        !Array.isArray(site.interredAgentIds) ||
        site.interredAgentIds.some(
          (agentId) => typeof agentId !== 'string' || !agentKeys.has(agentId),
        )
      ) {
        throw new Error(`World v16 burial site ${settlementId} has invalid interments.`);
      }
    }

    const settlementRelations = asRecord(
      v16.settlementRelations,
      'World v16 settlementRelations',
    );
    for (const [key, rawRelation] of Object.entries(settlementRelations)) {
      const relation = asRecord(rawRelation, `World v16 settlement relation ${key}`);
      if (relation.id !== key) {
        throw new Error(`World v16 settlement relation ${key} has wrong id.`);
      }
      const settlementA = requiredString(
        relation.settlementA,
        `World v16 settlement relation ${key}.settlementA`,
      );
      const settlementB = requiredString(
        relation.settlementB,
        `World v16 settlement relation ${key}.settlementB`,
      );
      if (
        settlementA === settlementB ||
        !settlementKeys.has(settlementA) ||
        !settlementKeys.has(settlementB) ||
        relationshipKey(settlementA, settlementB) !== key
      ) {
        throw new Error(`World v16 settlement relation ${key} has invalid endpoints.`);
      }
      nonNegativeInteger(
        relation.contactEvents,
        `World v16 settlement relation ${key}.contactEvents`,
      );
      assertUnitFields(
        relation,
        [
          'familiarity',
          'trust',
          'fear',
          'grievance',
          'obligation',
          'cooperation',
          'hostility',
        ],
        `World v16 settlement relation ${key}`,
      );
      if (typeof relation.activeWar !== 'boolean') {
        throw new Error(`World v16 settlement relation ${key}.activeWar is invalid.`);
      }
      for (const counter of [
        'conflictRounds',
        'resourceRaids',
        'landDisputes',
        'casualties',
      ] as const) {
        nonNegativeInteger(
          relation[counter],
          `World v16 settlement relation ${key}.${counter}`,
        );
      }
      for (const time of [
        'warStartedWorldMinute',
        'lastConflictWorldMinute',
      ] as const) {
        if (relation[time] === undefined) continue;
        const coordinate = finiteNumber(
          relation[time],
          `World v16 settlement relation ${key}.${time}`,
        );
        if (coordinate < 0 || coordinate > elapsedWorldMinutes) {
          throw new Error(`World v16 settlement relation ${key}.${time} is invalid.`);
        }
      }
      if (
        relation.contestedPlaceId !== undefined &&
        !placeKeys.has(requiredString(
          relation.contestedPlaceId,
          `World v16 settlement relation ${key}.contestedPlaceId`,
        ))
      ) {
        throw new Error(`World v16 settlement relation ${key} has missing contested land.`);
      }
      const lastEvidence = finiteNumber(
        relation.lastEvidenceWorldMinute,
        `World v16 settlement relation ${key}.lastEvidenceWorldMinute`,
      );
      if (lastEvidence < 0 || lastEvidence > elapsedWorldMinutes) {
        throw new Error(`World v16 settlement relation ${key} has invalid time.`);
      }
    }

    if (
      state.rulesVersion === WORLD_RULES_VERSION_V18 ||
      state.rulesVersion === WORLD_RULES_VERSION
    ) {
      assertWorldV18State(state as unknown as WorldState);
    }
    if (state.rulesVersion === WORLD_RULES_VERSION) {
      assertWorldV19State(state as unknown as WorldState);
      assertEmbodiedWorldV21(state as unknown as WorldState);
      assertResidentCartography(state as unknown as WorldState);
    }
  }

  if (!id.trim()) {
    throw new Error('World state id must not be empty.');
  }
}

function createPlace(
  id: string,
  name: string,
  kind: WorldPlaceKind,
  capacity: number,
  options: Partial<
    Pick<
      WorldPlace,
      | 'biome'
      | 'mapX'
      | 'mapY'
      | 'connectedPlaceIds'
      | 'fertility'
      | 'danger'
      | 'surface'
      | 'boundaryPolygon'
      | 'settlementId'
      | 'claimedBySettlementId'
      | 'discoveredAt'
    >
  > = {},
): WorldPlace {
  return {
    id,
    name,
    kind,
    capacity,
    biome: options.biome ?? 'settlement',
    mapX: options.mapX ?? 50,
    mapY: options.mapY ?? 50,
    connectedPlaceIds: [...(options.connectedPlaceIds ?? [])],
    fertility: options.fertility ?? 0.5,
    danger: options.danger ?? 0.08,
    surface:
      options.surface ??
      surfaceForPlace({ kind, biome: options.biome ?? 'settlement' }),
    ...(options.boundaryPolygon === undefined
      ? {}
      : {
          boundaryPolygon: options.boundaryPolygon.map((point) => ({
            ...point,
          })),
        }),
    ...(options.settlementId === undefined
      ? {}
      : { settlementId: options.settlementId }),
    ...(options.claimedBySettlementId === undefined
      ? {}
      : { claimedBySettlementId: options.claimedBySettlementId }),
    ...(options.discoveredAt === undefined
      ? {}
      : { discoveredAt: options.discoveredAt }),
  };
}

function makeConnectionsReciprocal(places: Record<string, WorldPlace>): void {
  for (const place of Object.values(places)) {
    place.connectedPlaceIds = [...new Set(place.connectedPlaceIds)];
    for (const connectedId of place.connectedPlaceIds) {
      const connected = places[connectedId];
      if (connected && !connected.connectedPlaceIds.includes(place.id)) {
        connected.connectedPlaceIds.push(place.id);
      }
    }
  }
}

function placeMigrationDefaults(
  place: Pick<WorldPlace, 'id' | 'kind'>,
  homeIndex: number,
): Pick<
  WorldPlace,
  | 'biome'
  | 'mapX'
  | 'mapY'
  | 'connectedPlaceIds'
  | 'fertility'
  | 'danger'
  | 'surface'
  | 'settlementId'
> {
  const fixed = WORLD_EXPANSIONS.find(
    (expansion) => expansion.place.id === place.id,
  )?.place;
  if (fixed) {
    return {
      biome: fixed.biome,
      mapX: fixed.mapX,
      mapY: fixed.mapY,
      connectedPlaceIds: [...fixed.connectedPlaceIds],
      fertility: fixed.fertility,
      danger: fixed.danger,
      surface: fixed.surface,
    };
  }

  const base: Record<
    string,
    Pick<
      WorldPlace,
      | 'biome'
      | 'mapX'
      | 'mapY'
      | 'connectedPlaceIds'
      | 'fertility'
      | 'danger'
      | 'surface'
      | 'settlementId'
    >
  > = {
    commons: {
      biome: 'settlement',
      mapX: 50,
      mapY: 50,
      connectedPlaceIds: [
        'resource_field',
        'workshop',
        'quiet_space',
        'outskirts',
      ],
      fertility: 0.55,
      danger: 0.03,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    resource_field: {
      biome: 'plains',
      mapX: 56,
      mapY: 52,
      connectedPlaceIds: ['commons'],
      fertility: 0.72,
      danger: 0.08,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    workshop: {
      biome: 'settlement',
      mapX: 52.5,
      mapY: 49,
      connectedPlaceIds: ['commons'],
      fertility: 0.28,
      danger: 0.1,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    quiet_space: {
      biome: 'forest',
      mapX: 47.5,
      mapY: 47,
      connectedPlaceIds: ['commons'],
      fertility: 0.65,
      danger: 0.02,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
    outskirts: {
      biome: 'plains',
      mapX: 62,
      mapY: 55,
      connectedPlaceIds: ['commons'],
      fertility: 0.52,
      danger: 0.18,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    },
  };
  if (base[place.id]) return base[place.id];

  if (place.kind === 'home') {
    const angle = homeIndex * 2.399963229728653 - Math.PI / 2;
    const ring = 3.2 + Math.floor(homeIndex / 8) * 1.8;
    return {
      biome: 'settlement',
      mapX: 50 + Math.cos(angle) * ring,
      mapY: 50 + Math.sin(angle) * ring,
      connectedPlaceIds: ['commons'],
      fertility: 0.58,
      danger: 0.02,
      surface: 'land',
      settlementId: 'settlement_ainkrad',
    };
  }

  return {
    biome: 'plains',
    mapX: 50,
    mapY: 50,
    connectedPlaceIds: ['outskirts'],
    fertility: 0.5,
    danger: 0.15,
    surface: 'land',
  };
}

interface FoundingSettlementLayout {
  center: WorldPoint2D;
  rotation: number;
  stretchX: number;
  stretchY: number;
}

/** A seed creates one physical plan, then the saved coordinates become the
 * authority. New epochs therefore differ, while reloads never reshuffle an
 * inhabited town. */
function drawFoundingSettlementLayout(rng: SeededRng): FoundingSettlementLayout {
  return {
    // Keep the founding town on the broad eastern lowlands, but not at the
    // old hard-coded (50, 50) point every time.
    center: {
      x: rng.between(-1_600, -240),
      y: rng.between(-1_300, 1_300),
    },
    rotation: rng.between(-Math.PI, Math.PI),
    stretchX: rng.between(0.78, 1.28),
    stretchY: rng.between(0.78, 1.28),
  };
}

function foundingPlaceDefaults(
  defaults: ReturnType<typeof placeMigrationDefaults>,
  layout: Readonly<FoundingSettlementLayout>,
): ReturnType<typeof placeMigrationDefaults> {
  if (defaults.settlementId !== 'settlement_ainkrad') return defaults;
  const dx = (defaults.mapX - 50) * layout.stretchX;
  const dy = (defaults.mapY - 50) * layout.stretchY;
  const cosine = Math.cos(layout.rotation);
  const sine = Math.sin(layout.rotation);
  return {
    ...defaults,
    mapX: layout.center.x + dx * cosine - dy * sine,
    mapY: layout.center.y + dx * sine + dy * cosine,
  };
}


interface FoundingHumanSettlementSpec {
  id: 'settlement_ainkrad' | 'settlement_rulid' | 'settlement_zakkaria';
  name: string;
  prefix: '' | 'rulid_' | 'zakkaria_';
  coastal: boolean;
  layout: FoundingSettlementLayout;
}

const DEFAULT_HUMAN_FOUNDER_NAMES = [
  'Арон', 'Мира', 'Кай', 'Ноа', 'Илан', 'Рин', 'Лея', 'Дарен', 'Сора', 'Талия',
  'Эрен', 'Майя', 'Теон', 'Ливия', 'Сайр', 'Нора', 'Рен', 'Илла', 'Марк', 'Элира',
  'Кален', 'Селия', 'Орен', 'Мираэль', 'Тавен', 'Рия', 'Дален', 'Лора', 'Нейл', 'Сари',
] as const;

/** Three independent human seed communities. Rulid is always coastal; all
 * three centres form an equilateral triangle with a seeded random heading and
 * side length, so no community begins with privileged knowledge of another. */
function drawThreeHumanFoundingSettlements(rng: SeededRng): FoundingHumanSettlementSpec[] {
  const side = rng.between(12_000, 16_000);
  const coast = { x: rng.between(48, 58), y: rng.between(-45, 45) };
  const heading = Math.PI + rng.between(-0.22, 0.22);
  const orientation = rng.next() < 0.5 ? 1 : -1;
  const point = (angle: number) => ({
    x: coast.x + Math.cos(angle) * side,
    y: coast.y + Math.sin(angle) * side,
  });
  const layout = (center: WorldPoint2D): FoundingSettlementLayout => ({
    center,
    rotation: rng.between(-Math.PI, Math.PI),
    stretchX: rng.between(0.82, 1.18),
    stretchY: rng.between(0.82, 1.18),
  });
  return [
    { id: 'settlement_ainkrad', name: 'Айнкрад', prefix: '', coastal: false, layout: layout(point(heading)) },
    { id: 'settlement_rulid', name: 'Рулид', prefix: 'rulid_', coastal: true, layout: { center: coast, rotation: rng.between(-0.08, 0.08), stretchX: rng.between(0.9, 1.08), stretchY: rng.between(0.9, 1.08) } },
    { id: 'settlement_zakkaria', name: 'Заккария', prefix: 'zakkaria_', coastal: false, layout: layout(point(heading + orientation * Math.PI / 3)) },
  ];
}

function localFoundingPoint(layout: Readonly<FoundingSettlementLayout>, dx: number, dy: number): WorldPoint2D {
  const cosine = Math.cos(layout.rotation);
  const sine = Math.sin(layout.rotation);
  const sx = dx * layout.stretchX;
  const sy = dy * layout.stretchY;
  return { x: layout.center.x + sx * cosine - sy * sine, y: layout.center.y + sx * sine + sy * cosine };
}

function addSecondaryHumanSettlementPlaces(
  places: Record<string, WorldPlace>,
  spec: Readonly<FoundingHumanSettlementSpec>,
  foundedAt: number,
  founderCount: number,
): void {
  if (spec.id === 'settlement_ainkrad') return;
  const p = spec.prefix;
  const ids = {
    center: `${p}center`, commons: `${p}commons`, field: `${p}resource_field`,
    workshop: `${p}workshop`, quiet: `${p}quiet_space`, outskirts: `${p}outskirts`, shore: `${p}shore`,
  };
  const mk = (id: string, name: string, kind: WorldPlaceKind, capacity: number, dx: number, dy: number, fertility: number, connections: string[], surface: 'land'|'shore'='land') => {
    const point = localFoundingPoint(spec.layout, dx, dy);
    places[id] = createPlace(id, name, kind, capacity, {
      biome: kind === 'resource_field' ? 'plains' : kind === 'shore' ? 'coast' : 'settlement',
      mapX: point.x, mapY: point.y, connectedPlaceIds: connections,
      fertility, danger: kind === 'outskirts' || kind === 'shore' ? 0.08 : 0.04,
      surface, settlementId: spec.id, discoveredAt: foundedAt,
    });
  };
  mk(ids.center, spec.name, 'village', Math.max(20, founderCount * 2), 0, 0, 0.65, [ids.commons, ids.outskirts]);
  mk(ids.commons, `Площадь и рынок ${spec.name}`, 'commons', Math.max(20, founderCount * 2), 1.2, 0.5, 0.58, [ids.center, ids.field, ids.workshop, ids.quiet]);
  mk(ids.field, `Поля и фермы ${spec.name}`, 'resource_field', Math.max(12, founderCount), -5.6, 2.2, 0.76, [ids.commons]);
  mk(ids.workshop, `Мастерская ${spec.name}`, 'workshop', Math.max(10, founderCount), 2.4, 1.2, 0.30, [ids.commons]);
  mk(ids.quiet, `Тихий сад ${spec.name}`, 'quiet_space', Math.max(8, founderCount), -1.8, -2.2, 0.62, [ids.commons]);
  mk(ids.outskirts, `Окраина ${spec.name}`, 'outskirts', Math.max(16, founderCount * 2), 7.5, -1.5, 0.52, [ids.center, ...(spec.coastal ? [ids.shore] : [])]);
  if (spec.coastal) {
    mk(ids.shore, `Берег ${spec.name}`, 'shore', Math.max(14, founderCount), 31.5, -0.5, 0.22, [ids.outskirts, 'ocean_ainkrad'], 'shore');
    if (places.ocean_ainkrad) places.ocean_ainkrad.connectedPlaceIds.push(ids.shore);
  }
}

function repairRulidCoastalBank(world: WorldState): boolean {
  const shore = world.places.rulid_shore;
  const center = world.places[world.settlements.settlement_rulid?.centerPlaceId ?? 'rulid_commons'];
  if (!shore || !center) return false;
  const terrain = bindWorldTerrain(world);
  if (!terrain) return false;
  // Find a real land cell with water less than 0.6 map units seaward. This is
  // derived from the persisted terrain recipe once at world creation/reset,
  // not recomputed during ordinary simulation ticks.
  const directions = [
    { x: 1, y: 0 }, { x: 0.98, y: 0.2 }, { x: 0.98, y: -0.2 },
    { x: 0.92, y: 0.38 }, { x: 0.92, y: -0.38 },
  ];
  for (const dir of directions) {
    for (let distance = 2; distance <= 70; distance += 0.2) {
      const x = center.mapX + dir.x * distance;
      const y = center.mapY + dir.y * distance;
      if (terrain.sample(x, y).water) continue;
      const seaX = x + dir.x * 0.45;
      const seaY = y + dir.y * 0.45;
      if (!terrain.sample(seaX, seaY).water) continue;
      const moved = Math.hypot(shore.mapX - x, shore.mapY - y) > 1e-9;
      if (!moved) return false;
      shore.mapX = x;
      shore.mapY = y;
      shore.boundaryPolygon = undefined;
      // The coast moved after the terrain foundation was frozen. Mark natural
      // geometry dirty so the same creation/reset transaction rebuilds the
      // shoreline polygon and geography signature at the new physical bank.
      shore.geographyVersion = undefined;
      return true;
    }
  }
  return false;
}

function secondaryHomePoint(spec: Readonly<FoundingHumanSettlementSpec>, index: number): WorldPoint2D {
  const angle = (index / 10) * Math.PI * 2 + 0.31;
  const radius = 3.5 + (index % 3) * 1.15;
  return localFoundingPoint(spec.layout, Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function mainSettlement(
  places: Readonly<Record<string, WorldPlace>>,
  foundedAt: number,
): WorldSettlementState {
  const memberPlaceIds = Object.values(places)
    .filter((place) => place.settlementId === 'settlement_ainkrad')
    .map((place) => place.id)
    .sort();
  return {
    id: 'settlement_ainkrad',
    name: 'Айнкрад',
    kind: 'village',
    centerPlaceId: 'commons',
    centerX: places.commons?.mapX ?? 50,
    centerY: places.commons?.mapY ?? 50,
    radius: 17,
    memberPlaceIds,
    foundedAt,
  };
}

function rebuildSettlementProjection(
  places: Record<string, WorldPlace>,
  prior: Readonly<Record<string, WorldSettlementState>> = {},
  foundedAt = 0,
): Record<string, WorldSettlementState> {
  const main = mainSettlement(places, foundedAt);
  const priorMain = prior[main.id];
  if (priorMain?.layoutVersion === 3) {
    main.layoutVersion = 3; main.layoutSignature = priorMain.layoutSignature; main.radius = priorMain.radius; main.boundaryPolygon = priorMain.boundaryPolygon;
  }
  if (priorMain?.kind === 'city') {
    main.kind = 'city';
    main.radius = priorMain.layoutVersion === 3 ? priorMain.radius : Math.max(20, priorMain.radius);
  }
  const settlements: Record<string, WorldSettlementState> = {
    settlement_ainkrad: main,
  };
  for (const place of Object.values(places)) {
    if (place.kind !== 'village' && place.kind !== 'city') continue;
    const id = place.settlementId ?? place.id;
    if (id === 'settlement_ainkrad') continue;
    place.settlementId = id;
    const existing = prior[id];
    const memberPlaceIds = Object.values(places)
      .filter((candidate) => candidate.settlementId === id)
      .map((candidate) => candidate.id)
      .sort();
    settlements[id] = {
      id,
      name: place.name,
      kind: place.kind,
      centerPlaceId: place.id,
      centerX: place.mapX,
      centerY: place.mapY,
      radius: existing?.radius ?? (place.kind === 'city' ? 20 : 11),
      ...(existing?.layoutVersion === 3 ? {layoutVersion: 3 as const, layoutSignature: existing.layoutSignature, boundaryPolygon: existing.boundaryPolygon} : {}),
      memberPlaceIds,
      foundedAt: existing?.foundedAt ?? place.discoveredAt ?? foundedAt,
    };
  }
  return settlements;
}

function createMindState(
  worldId: string,
  agentId: string,
  personality: Readonly<AgentState['personality']>,
  needs: Readonly<AgentState['needs']>,
): AgentState['mind'] {
  return {
    identityId: identityId(worldId, agentId),
    continuity: 1,
    autonomy: clamp01(
      0.58 + personality.curiosity * 0.16 + personality.riskTolerance * 0.12,
    ),
    memoryCoherence: 0.82,
    emotions: {
      joy: clamp01(0.42 + needs.belonging * 0.22),
      fear: clamp01(0.12 + (1 - personality.resilience) * 0.24),
      grief: 0,
      awe: clamp01(0.08 + personality.curiosity * 0.12),
      hope: clamp01(0.45 + personality.resilience * 0.32),
    },
    values: {
      care: clamp01(0.3 + personality.generosity * 0.62),
      freedom: clamp01(
        0.32 + personality.curiosity * 0.3 + personality.riskTolerance * 0.25,
      ),
      knowledge: clamp01(0.28 + personality.curiosity * 0.66),
      tradition: clamp01(
        0.25 + personality.diligence * 0.32 + (1 - personality.curiosity) * 0.18,
      ),
      ambition: clamp01(
        0.25 + personality.diligence * 0.46 + personality.riskTolerance * 0.18,
      ),
    },
    beliefs: {
      worldTrust: clamp01(0.4 + personality.resilience * 0.35),
      divinePresence: clamp01(0.08 + (1 - personality.riskTolerance) * 0.16),
      fate: clamp01(0.12 + (1 - personality.curiosity) * 0.2),
      afterlife: clamp01(0.1 + personality.generosity * 0.14),
    },
  };
}


function v15KnowledgeForAgent(agent: Readonly<AgentState>): WorldV15State['knowledgeByAgentId'][string] {
  const curiosity = clamp01(agent.personality.curiosity);
  const diligence = clamp01(agent.personality.diligence);
  return {
    agriculture: clamp01(0.015 + agent.skills.gathering * 0.07 + diligence * 0.025),
    construction: clamp01(0.015 + agent.skills.craft * 0.075 + diligence * 0.02),
    household: clamp01(0.02 + agent.skills.social * 0.045 + agent.mind.values.care * 0.04),
    survival: clamp01(0.02 + agent.skills.hunting * 0.065 + agent.skills.exploration * 0.045),
    aptitude: {
      agriculture: clamp01(0.32 + diligence * 0.35 + agent.skills.gathering * 0.2),
      construction: clamp01(0.3 + diligence * 0.3 + agent.skills.craft * 0.28),
      household: clamp01(0.3 + agent.personality.generosity * 0.28 + agent.skills.social * 0.28),
      survival: clamp01(0.28 + agent.personality.resilience * 0.27 + curiosity * 0.2 + agent.skills.exploration * 0.18),
    },
    verifiedLearningSessions: 0,
    verifiedPracticeSessions: 0,
  };
}

function v15FamilyAgencyForAgent(agent: Readonly<AgentState>): WorldV15State['familyAgencyByAgentId'][string] {
  return {
    physicalIntimacyInclination: clamp01(
      0.18 + agent.personality.sociability * 0.34 + agent.personality.riskTolerance * 0.18 + agent.mind.values.freedom * 0.12,
    ),
    childDesire: clamp01(
      0.16 + agent.mind.values.care * 0.34 + agent.mind.values.tradition * 0.18 + agent.needs.belonging * 0.16,
    ),
    autonomy: clamp01(agent.mind.autonomy),
  };
}

function emptySmithingProfile(): WorldV15State['smithingByAgentId'][string] {
  return {
    knowledge: {
      stoneToolmaking: 0.02,
      primitiveSmithing: 0,
      weaponcraft: 0.01,
      heatWorking: 0,
      materialKnowledge: 0.02,
    },
    verifiedWorkshopSessions: 0,
    failedCraftAttempts: 0,
    successfulCraftAttempts: 0,
    observedWeaponProblems: 0,
  };
}

function createWorldV15State(
  worldId: string,
  epoch: number,
  agents: Readonly<Record<string, AgentState>>,
  resourcePool: number,
  elapsedWorldMinutes: number,
): WorldV15State {
  const knowledgeByAgentId: WorldV15State['knowledgeByAgentId'] = {};
  const familyAgencyByAgentId: WorldV15State['familyAgencyByAgentId'] = {};
  const smithingByAgentId: WorldV15State['smithingByAgentId'] = {};
  const equipmentByAgentId: WorldV15State['equipmentByAgentId'] = {};

  const livingFounders = Object.values(agents)
    .filter((agent) => agent.life.alive && agent.life.generation === 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const agent of Object.values(agents)) {
    knowledgeByAgentId[agent.id] = v15KnowledgeForAgent(agent);
    familyAgencyByAgentId[agent.id] = v15FamilyAgencyForAgent(agent);
    smithingByAgentId[agent.id] = emptySmithingProfile();
    equipmentByAgentId[agent.id] = {};
  }

  let founderSmithAgentId: string | undefined;
  if (livingFounders.length > 0) {
    const smith = [...livingFounders].sort((a, b) => {
      const scoreA = a.skills.craft * 0.5 + a.personality.diligence * 0.28 + a.personality.curiosity * 0.22;
      const scoreB = b.skills.craft * 0.5 + b.personality.diligence * 0.28 + b.personality.curiosity * 0.22;
      return scoreB - scoreA || a.id.localeCompare(b.id);
    })[0];
    founderSmithAgentId = smith.id;
    const seeded = assignOrdinaryFounderSmithV15(
      Array.from({ length: 10 }, (_, index) => livingFounders[index]?.id ?? `reserved-founder-${index + 1}`),
      Math.max(0, Math.min(9, livingFounders.findIndex((agent) => agent.id === smith.id))),
    );
    smithingByAgentId[smith.id] = {
      ...emptySmithingProfile(),
      knowledge: { ...seeded.knowledge },
    };
  }

  const simulatedWorldMinutes = Math.max(0, elapsedWorldMinutes);
  const quantumIndex = Math.floor(simulatedWorldMinutes / V15_SIMULATION_QUANTUM_WORLD_MINUTES);
  const exactSimulated = quantumIndex * V15_SIMULATION_QUANTUM_WORLD_MINUTES;

  return {
    version: 'v15',
    genesisTeachers: createGenesisTeachers(`${worldId}:epoch:${epoch}`, 0),
    knowledgeByAgentId,
    familyAgencyByAgentId,
    smithingByAgentId,
    smithingInnovations: {},
    equipmentByAgentId,
    items: {},
    ...(founderSmithAgentId ? { founderSmithAgentId } : {}),
    renewableResources: {
      storedResources: clamp01(resourcePool),
      renewableBase: 0.92,
      fertility: 0.82,
      lastRecoveredWorldMinute: simulatedWorldMinutes,
    },
    simulationClock: {
      quantumWorldMinutes: V15_SIMULATION_QUANTUM_WORLD_MINUTES,
      pendingWorldMinutes: simulatedWorldMinutes - exactSimulated,
      simulatedWorldMinutes: exactSimulated,
      quantumIndex,
    },
    deathTelemetry: [],
    learningSequence: 0,
    itemSequence: 0,
    futureDungeons: {
      enabled: false,
      earliestWorldYear: 200,
      nominalWorldYear: 250,
      latestWorldYear: 300,
      usesExistingResidentLevelScale: true,
    },
  };
}

function ensureAgentV15State(state: WorldState, agent: Readonly<AgentState>): void {
  const v15 = state.v15;
  if (!v15) throw new Error('v15 state is missing.');
  v15.knowledgeByAgentId[agent.id] ??= v15KnowledgeForAgent(agent);
  v15.familyAgencyByAgentId[agent.id] ??= v15FamilyAgencyForAgent(agent);
  v15.smithingByAgentId[agent.id] ??= emptySmithingProfile();
  v15.equipmentByAgentId[agent.id] ??= {};
}

function ensureAgentV16State(state: WorldState, agent: Readonly<AgentState>): void {
  ensureResidentEvidenceV16(state, agent.id);
  const settlementId = state.places[agent.homeId]?.settlementId;
  if (settlementId) ensureSettlementEvidenceV16(state, settlementId);
}

function applyFounderSmithAgentSeed(
  agents: Record<string, AgentState>,
  v15: WorldV15State,
): void {
  const founderId = v15.founderSmithAgentId;
  if (!founderId) return;
  const founder = agents[founderId];
  if (!founder) return;
  founder.skills.craft = Math.max(founder.skills.craft, 0.4);
  if (founder.progression) {
    founder.progression.objectControlAuthority = Math.max(
      founder.progression.objectControlAuthority,
      0.16,
    );
  }
}

async function migrateLegacyWorld(
  store: WorldStore,
  legacy: WorldState,
): Promise<WorldState> {
  const fromVersion = legacy.rulesVersion;
  const operationId = `migration:${fromVersion}-to-${WORLD_RULES_VERSION_V16}`;
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: fromVersion,
    to: WORLD_RULES_VERSION_V16,
  });
  const next = structuredClone(legacy) as WorldState;
  const mutable = next as unknown as Record<string, any>;

  mutable.epoch ??= 1;
  mutable.epochStartedAt ??= 0;
  next.rulesVersion = WORLD_RULES_VERSION_V16;
  next.revision = legacy.revision + 1;
  next.environment = {
    ...next.environment,
    habitatSupport: next.environment.habitatSupport ?? 0.5,
  };
  mutable.calendar ??= {
    // v0.3.10 aged residents once per 96 ticks. Preserve that accumulated
    // history, then let the external clock control every future increment.
    elapsedWorldMinutes:
      (Math.max(0, legacy.now) / LEGACY_WORLD_TICKS_PER_YEAR) *
      WORLD_MINUTES_PER_YEAR,
  };
  if (!mutable.growth) {
    mutable.growth = {
      stage: 0,
      explorationProgress: 0,
      lastExpansionAt: legacy.now,
      lastExpansionWorldMinutes: next.calendar.elapsedWorldMinutes,
      discoveredRegionIds: [],
      frontierSequence: 0,
    };
  } else {
    mutable.growth.frontierSequence =
      mutable.growth.frontierSequence ?? mutable.growth.stage;
    // A legacy technical tick cannot be converted safely into an exact
    // semantic frontier timestamp. Start a fresh canonical dormancy window.
    mutable.growth.lastExpansionWorldMinutes ??=
      next.calendar.elapsedWorldMinutes;
  }
  mutable.wildlife ??= {};
  const legacyThreat: Record<WildlifeSpecies, number> = {
    rabbit: 0.04,
    deer: 0.08,
    fish: 0.02,
    boar: 0.28,
    wolf: 0.42,
    bird: 0.02,
    dire_wolf: 0.72,
    ogre: 0.86,
    wraith: 0.94,
    century_humpback: 1,
  };
  for (const population of Object.values(next.wildlife)) {
    population.threat ??= legacyThreat[population.species] ?? 0.05;
    population.isMonster ??= MONSTER_SPECIES.has(population.species);
  }

  const homeIds = Object.values(next.places)
    .filter((place) => place.kind === 'home')
    .map((place) => place.id)
    .sort();
  const corePlaceIds = new Set([
    'commons',
    'resource_field',
    'workshop',
    'quiet_space',
    'outskirts',
  ]);
  for (const place of Object.values(next.places)) {
    const defaults = placeMigrationDefaults(
      place,
      Math.max(0, homeIds.indexOf(place.id)),
    );
    const moveIntoSettlement = place.kind === 'home' || corePlaceIds.has(place.id);
    Object.assign(place, {
      biome: place.biome ?? defaults.biome,
      mapX: moveIntoSettlement ? defaults.mapX : (place.mapX ?? defaults.mapX),
      mapY: moveIntoSettlement ? defaults.mapY : (place.mapY ?? defaults.mapY),
      connectedPlaceIds: place.connectedPlaceIds ?? defaults.connectedPlaceIds,
      fertility: place.fertility ?? defaults.fertility,
      danger: place.danger ?? defaults.danger,
      surface: place.surface ?? defaults.surface,
      ...(defaults.settlementId === undefined
        ? {}
        : { settlementId: defaults.settlementId }),
    });
  }
  const coreNames: Record<string, string> = {
    commons: 'Площадь и рынок Айнкрада',
    resource_field: 'Поля и фермы Айнкрада',
    workshop: 'Мастерская Айнкрада',
    quiet_space: 'Тихий сад Айнкрада',
    outskirts: 'Окраина Айнкрада',
  };
  for (const [placeId, placeName] of Object.entries(coreNames)) {
    if (next.places[placeId]) next.places[placeId].name = placeName;
  }
  repairFoundingOcean(next);
  makeConnectionsReciprocal(next.places);
  next.settlements = rebuildSettlementProjection(
    next.places,
    mutable.settlements ?? {},
    0,
  );

  for (const [populationId, population] of Object.entries(next.wildlife)) {
    const currentHabitat = next.places[population.habitatId];
    if (isHabitatCompatible(population.species, currentHabitat)) continue;
    const replacement = Object.values(next.places)
      .filter((place) => isHabitatCompatible(population.species, place))
      .sort((a, b) => {
        const ax = currentHabitat?.mapX ?? 50;
        const ay = currentHabitat?.mapY ?? 50;
        return (Math.hypot(a.mapX - ax, a.mapY - ay) - Math.hypot(b.mapX - ax, b.mapY - ay));
      })[0];
    if (replacement) {
      population.habitatId = replacement.id;
      population.lastChangedAt = next.now;
    } else {
      delete next.wildlife[populationId];
    }
  }

  // v0.3.13 gives every already-existing secondary settlement local daily-life
  // facilities. This preserves the existing experiment instead of requiring a
  // reset just to receive the new settlement model.
  for (const settlement of Object.values(next.settlements)) {
    if (settlement.id === 'settlement_ainkrad') continue;
    const center = next.places[settlement.centerPlaceId];
    if (!center) continue;

    // v0.3.12 city promotion created an artificial direct road to founding
    // commons. Remove only that generated shortcut; organic frontier links remain.
    center.connectedPlaceIds = center.connectedPlaceIds.filter(
      (placeId) => placeId !== 'commons',
    );
    if (next.places.commons) {
      next.places.commons.connectedPlaceIds =
        next.places.commons.connectedPlaceIds.filter(
          (placeId) => placeId !== center.id,
        );
    }

    const localServices: Array<{
      suffix: string;
      name: string;
      kind: WorldPlaceKind;
      dx: number;
      dy: number;
      fertility: number;
    }> = [
      { suffix: 'field', name: 'Поля и фермы', kind: 'resource_field', dx: -5.6, dy: 2.2, fertility: 0.76 },
      { suffix: 'workshop', name: 'Мастерская', kind: 'workshop', dx: 2.4, dy: 1.2, fertility: 0.3 },
      { suffix: 'quiet', name: 'Тихий сад', kind: 'quiet_space', dx: -1.8, dy: -2.2, fertility: 0.62 },
    ];

    for (const service of localServices) {
      const serviceId = `${settlement.id}_${service.suffix}`;
      if (next.places[serviceId]) continue;
      next.places[serviceId] = createPlace(
        serviceId,
        `${settlement.name}: ${service.name}`,
        service.kind,
        10,
        {
          biome: service.kind === 'resource_field' ? 'plains' : 'settlement',
          mapX: center.mapX + service.dx,
          mapY: center.mapY + service.dy,
          connectedPlaceIds: [center.id],
          fertility: service.fertility,
          danger: 0.04,
          surface: 'land',
          settlementId: settlement.id,
          discoveredAt: next.now,
        },
      );
    }
  }
  makeConnectionsReciprocal(next.places);
  next.settlements = rebuildSettlementProjection(
    next.places,
    next.settlements,
    0,
  );
  next.routes = rebuildWorldRoutes(next.places, mutable.routes ?? {});

  if (
    next.growth.stage >= 5 &&
    !Object.values(next.wildlife).some((population) => population.isMonster)
  ) {
    const habitat = [...next.growth.discoveredRegionIds]
      .reverse()
      .map((regionId) => next.places[regionId])
      .find(
        (place): place is WorldPlace =>
          place !== undefined &&
          place.surface === 'land' &&
          ['forest', 'mountains', 'swamp', 'ancient_ruins'].includes(place.biome),
      );
    if (habitat) {
      const species: WildlifeSpecies =
        habitat.biome === 'ancient_ruins'
          ? 'wraith'
          : habitat.biome === 'swamp'
            ? 'ogre'
            : 'dire_wolf';
      if (isHabitatCompatible(species, habitat)) {
        const threat = legacyThreat[species];
        next.wildlife[`monster_${next.growth.stage}_${species}`] = {
          id: `monster_${next.growth.stage}_${species}`, species, habitatId: habitat.id,
          count: 1, carryingCapacity: 3, reproductionRate: 0.018, alertness: 0.74,
          threat, isMonster: true, lastChangedAt: next.now,
        };
        habitat.danger = Math.max(habitat.danger, threat * 0.78);
      }
    }
  }

  const agents = Object.values(next.agents);
  const inferredSex = new Map<string, 'male' | 'female'>();
  for (const agent of agents) {
    if (agent.sex === 'male' || agent.sex === 'female') {
      inferredSex.set(agent.id, agent.sex);
    }
  }
  const historicalParentPairs: Array<[string, string]> = [];
  for (const child of agents) {
    const parentIds = child.life?.parentIds ?? [];
    if (parentIds.length >= 2 && next.agents[parentIds[0]] && next.agents[parentIds[1]]) {
      historicalParentPairs.push([parentIds[0], parentIds[1]]);
    }
  }
  for (let pass = 0; pass < Math.max(1, agents.length); pass += 1) {
    let changed = false;
    for (const [parentAId, parentBId] of historicalParentPairs) {
      const sexA = inferredSex.get(parentAId);
      const sexB = inferredSex.get(parentBId);
      if (sexA && !sexB) {
        inferredSex.set(parentBId, sexA === 'male' ? 'female' : 'male');
        changed = true;
      } else if (!sexA && sexB) {
        inferredSex.set(parentAId, sexB === 'male' ? 'female' : 'male');
        changed = true;
      } else if (!sexA && !sexB) {
        const indexA = agents.findIndex((agent) => agent.id === parentAId);
        const seedSex = indexA % 2 === 0 ? 'male' : 'female';
        inferredSex.set(parentAId, seedSex);
        inferredSex.set(parentBId, seedSex === 'male' ? 'female' : 'male');
        changed = true;
      }
    }
    if (!changed) break;
  }

  // v0.3.12 had no biological-sex field. Preserve historical parent
  // pairings first, then balance previously-unknown living residents.
  // This prevents migration itself from creating a demographic dead end;
  // it never chooses partners or commands reproduction.
  let livingMales = agents.filter(
    (agent) => agent.life?.alive && inferredSex.get(agent.id) === 'male',
  ).length;
  let livingFemales = agents.filter(
    (agent) => agent.life?.alive && inferredSex.get(agent.id) === 'female',
  ).length;
  for (const agent of agents.filter(
    (candidate) => candidate.life?.alive && !inferredSex.has(candidate.id),
  )) {
    const sex = livingMales <= livingFemales ? 'male' : 'female';
    inferredSex.set(agent.id, sex);
    if (sex === 'male') livingMales += 1;
    else livingFemales += 1;
  }
  let totalMales = [...inferredSex.values()].filter((sex) => sex === 'male').length;
  let totalFemales = [...inferredSex.values()].filter((sex) => sex === 'female').length;
  for (const agent of agents.filter((candidate) => !inferredSex.has(candidate.id))) {
    const sex = totalMales <= totalFemales ? 'male' : 'female';
    inferredSex.set(agent.id, sex);
    if (sex === 'male') totalMales += 1;
    else totalFemales += 1;
  }

  agents.forEach((agent, index) => {
    if (agent.plan && !next.places[agent.plan.targetPlaceId]) {
      agent.plan = undefined;
    }
    const priorHunting = (agent.skills as Partial<AgentState['skills']>).hunting;
    agent.skills = {
      ...agent.skills,
      hunting:
        priorHunting === undefined
          ? clamp01(
              agent.skills.gathering * 0.28 +
                agent.skills.exploration * 0.32 +
                agent.personality.riskTolerance * 0.22,
            )
          : priorHunting,
    };
    const ageYears = 22 + ((index * 7) % 27);
    agent.origin ??= 'native';
    agent.sex ??= inferredSex.get(agent.id) ?? (index % 2 === 0 ? 'male' : 'female');
    agent.life ??= {
      bornAt: next.now - ageYears * WORLD_TICKS_PER_YEAR,
      ageYears,
      lifespanYears: 72 + agent.personality.resilience * 26 + (index % 5),
      stage: lifeStageForAge(ageYears),
      alive: true,
      health: clamp01(0.72 + agent.personality.resilience * 0.24),
      physiology: physiologyForAge(
        ageYears,
        72 + agent.personality.resilience * 26 + (index % 5),
        clamp01(0.72 + agent.personality.resilience * 0.24),
      ),
      generation: 0,
      parentIds: [],
      childIds: [],
    };
    // Preserve biological age while moving every older world onto the single
    // 60 ticks/year clock. This prevents a restart from making anybody older
    // or younger while future age and the displayed calendar stay aligned.
    agent.life.bornAt = next.now - agent.life.ageYears * WORLD_TICKS_PER_YEAR;
    agent.life.physiology ??= physiologyForAge(
      agent.life.ageYears,
      agent.life.lifespanYears,
      agent.life.health,
    );
    if (
      agent.life.lastChildAt !== undefined &&
      agent.life.lastChildWorldMinute === undefined
    ) {
      agent.life.lastChildWorldMinute =
        (agent.life.lastChildAt / LEGACY_WORLD_TICKS_PER_YEAR) *
        WORLD_MINUTES_PER_YEAR;
    }
    agent.mind ??= createMindState(
      next.id,
      agent.id,
      agent.personality,
      agent.needs,
    );
    agent.race ??= 'human';
    agent.progression ??= progressionFromAgent(agent);
    const location = next.places[agent.locationId] ?? next.places[agent.homeId];
    if (fromVersion !== 'ainkrad-world-rules-0.3.12') {
      agent.position = {
        x: location.mapX,
        y: location.mapY,
        layerId: 'surface',
      };
      agent.movement = undefined;
    } else {
      // v0.3.12 already has the current 2D movement model. Preserve a resident's
      // exact position and unfinished route across the v0.3.13 migration.
      agent.position ??= {
        x: location.mapX,
        y: location.mapY,
        layerId: 'surface',
      };
      if (
        agent.movement &&
        !next.places[agent.movement.targetPlaceId]
      ) {
        agent.movement = undefined;
      }
    }
  });

  next.population = mutable.population ?? {
    nextAgentSequence: agents.length + 1,
    births: 0,
    deaths: 0,
  };
  if (
    next.population.lastBirthAt !== undefined &&
    next.population.lastBirthWorldMinute === undefined
  ) {
    next.population.lastBirthWorldMinute =
      (next.population.lastBirthAt / LEGACY_WORLD_TICKS_PER_YEAR) *
      WORLD_MINUTES_PER_YEAR;
  }
  next.cosmology = mutable.cosmology ?? {
    mysteryLevel: 0.12,
    omenCount: 0,
    traditions: [],
    deities: {},
  };
  next.governance = mutable.governance ?? {
    constitutionVersion: V16_WORLD_CONSTITUTION_VERSION,
    authorityRevision: 0,
    protectedPersonhoodDomains: [
      'identity',
      'memory',
      'agency',
      'values',
      'relationships',
    ],
    laws: defaultWorldLaws(
      next.now,
      next.calendar.elapsedWorldMinutes,
    ),
  };
  next.governance.constitutionVersion = V16_WORLD_CONSTITUTION_VERSION;
  const requiredLaws = defaultWorldLaws(
    next.now,
    next.calendar.elapsedWorldMinutes,
  );
  for (const [lawId, requiredLaw] of Object.entries(requiredLaws)) {
    next.governance.laws[lawId] ??= requiredLaw;
  }

  // v15 migration is deterministic: it derives the extension only from the
  // already committed world projection and consumes no new RNG draws.
  next.v15 ??= createWorldV15State(
    next.id,
    next.epoch ?? 1,
    next.agents,
    next.environment.resourcePool,
    next.calendar.elapsedWorldMinutes,
  );
  applyFounderSmithAgentSeed(next.agents, next.v15);
  // Older rule versions never had authoritative v16 evidence. Rebuild this
  // additive projection after all legacy place/agent repairs so stale fixture
  // keys cannot masquerade as observed history.
  next.v16 = createWorldV16State(next, fromVersion);

  next.determinism.eventSequence += 1;
  const migrationEvent: WorldEvent = {
    eventId: `migration:${next.id}:world-rules-0.3.16`,
    worldId: next.id,
    kind: 'world.migrated',
    source: 'system',
    occurredAt: next.now,
    payload: {
      from: fromVersion,
      to: WORLD_RULES_VERSION_V16,
      preservedTick: next.now,
      preservedPeople: agents.length,
    },
  };

  assertWorldState(next);

  try {
    const result = await store.commit({
      operationId,
      operationFingerprint,
      worldId: legacy.id,
      expectedRevision: legacy.revision,
      nextState: next,
      events: [migrationEvent],
      memories: [],
    });
    return result.state;
  } catch (error) {
    if (error instanceof WorldRevisionConflictError) {
      const concurrent = await store.loadWorld(legacy.id);
      if (concurrent?.rulesVersion === WORLD_RULES_VERSION_V16) {
        return concurrent;
      }
    }
    throw error;
  }
}

/**
 * The v0.3.15 -> v0.3.16 migration is intentionally additive. It does not
 * rebuild geography, residents, relationships, resources, RNG or v15/Cardinal
 * evidence. It adds bounded society evidence maps with an empty observation
 * history beginning at the already persisted canonical world minute.
 */
async function migrateV15WorldToV16(
  store: WorldStore,
  legacy: WorldState,
): Promise<WorldState> {
  const operationId =
    `migration:${V15_WORLD_RULES_VERSION}-to-${WORLD_RULES_VERSION_V16}`;
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: V15_WORLD_RULES_VERSION,
    to: WORLD_RULES_VERSION_V16,
    mode: 'additive_society_evidence',
  });
  const next = structuredClone(legacy);
  next.rulesVersion = WORLD_RULES_VERSION_V16;
  next.revision = legacy.revision + 1;
  next.governance.constitutionVersion = V16_WORLD_CONSTITUTION_VERSION;

  // v0.3.16 derives this one field from each race's physical maturity curve.
  // Older saves used human thresholds for every race, so a valid non-human
  // resident could otherwise fail validation before the world resumed. Age,
  // identity, mind, memories, skills, relationships and RNG remain untouched.
  for (const agent of Object.values(next.agents)) {
    agent.life.stage = lifeStageForRaceV16(
      agent.race ?? 'human',
      agent.life.ageYears,
    );
  }

  next.v16 = createWorldV16State(next, V15_WORLD_RULES_VERSION);

  const migrationEvent: WorldEvent = {
    eventId: `migration:${next.id}:world-rules-0.3.16`,
    worldId: next.id,
    kind: 'world.migrated',
    source: 'system',
    occurredAt: next.now,
    occurredWorldMinutes: next.calendar.elapsedWorldMinutes,
    payload: {
      from: V15_WORLD_RULES_VERSION,
      to: WORLD_RULES_VERSION_V16,
      migrationMode: 'additive_society_evidence',
      preservedTick: next.now,
      preservedWorldMinutes: next.calendar.elapsedWorldMinutes,
      preservedPeople: Object.keys(next.agents).length,
      preservedRngState: next.determinism.rngState,
    },
  };

  assertWorldState(next);
  try {
    const result = await store.commit({
      operationId,
      operationFingerprint,
      worldId: legacy.id,
      expectedRevision: legacy.revision,
      nextState: next,
      events: [migrationEvent],
      memories: [],
    });
    return result.state;
  } catch (error) {
    if (error instanceof WorldRevisionConflictError) {
      const concurrent = await store.loadWorld(legacy.id);
      if (concurrent?.rulesVersion === WORLD_RULES_VERSION_V16) return concurrent;
    }
    throw error;
  }
}

// A repair applies to a persisted revision, not once forever to a world.
// Older tabs/recovery builds may subsequently persist an incomplete projection.
// A fixed operation ID would return that stale projection as a duplicate and
// discard the valid repaired nextState. Revision keys preserve atomic retry
// semantics while allowing recovery again after a later write.
const V16_ADDITIVE_SCHEMA_REPAIR_OPERATION_ID =
  'migration:v16-additive-schema-repair-2026-08-26';

/**
 * Some early v0.3.16 recovery packages persisted the v16 version marker before
 * every additive economy/evidence field existed. Repair those same-version
 * saves atomically before strict validation. No resident state, existing
 * evidence, world time, RNG state or Cardinal history is reconstructed.
 */
async function repairCompatibleV16World(
  store: WorldStore,
  persisted: WorldState,
): Promise<WorldState> {
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: WORLD_RULES_VERSION_V16,
    to: WORLD_RULES_VERSION_V16,
    mode: 'same_version_additive_schema_repair',
    schemaRevision: '2026-08-26',
  });
  let current = persisted;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (current.rulesVersion !== WORLD_RULES_VERSION_V16) return current;
    const next = structuredClone(current);
    const before = stableJsonStringify(next);
    assertTerrainFoundation(next.terrain);
    bindWorldTerrain(next);
    const repairedFoundingOcean = repairFoundingOcean(next);
    if (repairedFoundingOcean) next.routes = rebuildWorldRoutes(next.places, next.routes);
    repairWorldV16AdditiveSchema(
      next,
      next.v16?.migratedFromRulesVersion ?? WORLD_RULES_VERSION_V16,
    );
    if (stableJsonStringify(next) === before) return current;

    await store.checkpointWorld?.(current.id, current.revision, 'before-additive-schema-migration');
    next.revision = current.revision + 1;
    const migrationEvent: WorldEvent = {
      eventId: `migration:${next.id}:v16-additive-schema-repair-2026-08-26:revision:${current.revision}`,
      worldId: next.id,
      kind: 'world.migrated',
      source: 'system',
      occurredAt: next.now,
      occurredWorldMinutes: next.calendar.elapsedWorldMinutes,
      payload: {
        from: WORLD_RULES_VERSION_V16,
        to: WORLD_RULES_VERSION_V16,
        migrationMode: 'same_version_additive_schema_repair',
        preservedTick: next.now,
        preservedWorldMinutes: next.calendar.elapsedWorldMinutes,
        preservedPeople: Object.keys(next.agents).length,
        preservedRngState: next.determinism.rngState,
      },
    };

    assertWorldState(next);
    try {
      const result = await store.commit({
        operationId: `${V16_ADDITIVE_SCHEMA_REPAIR_OPERATION_ID}:revision:${current.revision}`,
        operationFingerprint,
        worldId: current.id,
        expectedRevision: current.revision,
        nextState: next,
        events: [migrationEvent],
        memories: [],
      });
      return result.state;
    } catch (error) {
      if (!(error instanceof WorldRevisionConflictError)) throw error;
      const concurrent = await store.loadWorld(current.id);
      if (!concurrent) throw error;
      current = concurrent;
    }
  }

  throw new Error(
    `World ${persisted.id} changed repeatedly during v16 schema repair.`,
  );
}

/**
 * v0.3.18 is an additive Underworld-facing foundation. Migration preserves the
 * authoritative v15/v16 projections and every resident fact, then derives
 * only bounded language and settlement-lifecycle evidence from that committed
 * state. It consumes no RNG draws and never manufactures past conversations.
 */
async function migrateV16WorldToV18(
  store: WorldStore,
  legacy: WorldState,
): Promise<WorldState> {
  const operationId =
    `migration:${WORLD_RULES_VERSION_V16}-to-${WORLD_RULES_VERSION_V18}`;
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: WORLD_RULES_VERSION_V16,
    to: WORLD_RULES_VERSION_V18,
    mode: 'additive_underworld_foundation',
  });
  const next = structuredClone(legacy);
  next.rulesVersion = WORLD_RULES_VERSION_V18;
  next.revision = legacy.revision + 1;
  next.governance.constitutionVersion = V18_WORLD_CONSTITUTION_VERSION;
  next.v18 = createWorldV18State(next, WORLD_RULES_VERSION_V16);
  repairSecretLibraryPlacementV18(next);

  const migrationEvent: WorldEvent = {
    eventId: `migration:${next.id}:world-rules-0.3.18`,
    worldId: next.id,
    kind: 'world.migrated',
    source: 'system',
    occurredAt: next.now,
    occurredWorldMinutes: next.calendar.elapsedWorldMinutes,
    payload: {
      from: WORLD_RULES_VERSION_V16,
      to: WORLD_RULES_VERSION_V18,
      migrationMode: 'additive_underworld_foundation',
      preservedTick: next.now,
      preservedWorldMinutes: next.calendar.elapsedWorldMinutes,
      preservedPeople: Object.keys(next.agents).length,
      preservedRelationships: Object.keys(next.relationships).length,
      preservedRngState: next.determinism.rngState,
      fabricatedConversationCount: 0,
    },
  };

  assertWorldState(next);
  try {
    const result = await store.commit({
      operationId,
      operationFingerprint,
      worldId: legacy.id,
      expectedRevision: legacy.revision,
      nextState: next,
      events: [migrationEvent],
      memories: [],
    });
    return result.state;
  } catch (error) {
    if (error instanceof WorldRevisionConflictError) {
      const concurrent = await store.loadWorld(legacy.id);
      if (concurrent?.rulesVersion === WORLD_RULES_VERSION_V18) return concurrent;
    }
    throw error;
  }
}

const V18_ADDITIVE_SCHEMA_REPAIR_OPERATION_ID =
  'migration:v18-additive-schema-repair-2026-09-07-cultural-agency';

async function repairCompatibleV18World(
  store: WorldStore,
  persisted: WorldState,
): Promise<WorldState> {
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: WORLD_RULES_VERSION_V18,
    to: WORLD_RULES_VERSION_V18,
    mode: 'same_version_additive_schema_repair',
    schemaRevision: '2026-09-07-cultural-agency',
  });
  let current = persisted;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (current.rulesVersion !== WORLD_RULES_VERSION_V18) return current;
    const next = structuredClone(current);
    const before = stableJsonStringify(next);
    const repairedFoundingOcean = repairFoundingOcean(next);
    if (repairedFoundingOcean) next.routes = rebuildWorldRoutes(next.places, next.routes);
    // v18 deliberately carries the authoritative v16 economy/evidence
    // projection forward. Some recovery packages already wrote the v18
    // marker while an older nested v16 additive field was still absent. A
    // current-version repair must therefore repair the whole compatible
    // additive chain before strict validation, in the same atomic commit.
    repairWorldV16AdditiveSchema(
      next,
      next.v16?.migratedFromRulesVersion ?? WORLD_RULES_VERSION_V16,
    );
    repairWorldV18AdditiveSchema(
      next,
      next.v18?.migratedFromRulesVersion ?? WORLD_RULES_VERSION_V16,
    );
    repairSecretLibraryPlacementV18(next);
    if (stableJsonStringify(next) === before) return current;

    await store.checkpointWorld?.(current.id, current.revision, 'before-additive-schema-migration');
    next.revision = current.revision + 1;
    const migrationEvent: WorldEvent = {
      eventId: `migration:${next.id}:v18-additive-schema-repair-2026-09-07-cultural-agency:revision:${current.revision}`,
      worldId: next.id,
      kind: 'world.migrated',
      source: 'system',
      occurredAt: next.now,
      occurredWorldMinutes: next.calendar.elapsedWorldMinutes,
      payload: {
        from: WORLD_RULES_VERSION_V18,
        to: WORLD_RULES_VERSION_V18,
        migrationMode: 'same_version_additive_schema_repair',
        preservedTick: next.now,
        preservedWorldMinutes: next.calendar.elapsedWorldMinutes,
        preservedPeople: Object.keys(next.agents).length,
        preservedRngState: next.determinism.rngState,
      },
    };

    assertWorldState(next);
    try {
      const result = await store.commit({
        operationId: `${V18_ADDITIVE_SCHEMA_REPAIR_OPERATION_ID}:revision:${current.revision}`,
        operationFingerprint,
        worldId: current.id,
        expectedRevision: current.revision,
        nextState: next,
        events: [migrationEvent],
        memories: [],
      });
      return result.state;
    } catch (error) {
      if (!(error instanceof WorldRevisionConflictError)) throw error;
      const concurrent = await store.loadWorld(current.id);
      if (!concurrent) throw error;
      current = concurrent;
    }
  }

  throw new Error(
    `World ${persisted.id} changed repeatedly during v18 schema repair.`,
  );
}

/**
 * v0.3.19 adds only bounded spiritual evidence. Existing minds, professions,
 * families, relationships, Cardinal experience and v18 cultural history are
 * carried forward byte-for-byte. A legacy audience is translated into a gift
 * and a contact record, but its old calling label no longer drives behaviour.
 */
async function migrateV18WorldToV19(
  store: WorldStore,
  legacy: WorldState,
): Promise<WorldState> {
  const operationId =
    `migration:${WORLD_RULES_VERSION_V18}-to-${WORLD_RULES_VERSION}`;
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: WORLD_RULES_VERSION_V18,
    to: WORLD_RULES_VERSION,
    mode: 'additive_divine_agency_and_contextual_prayer',
  });
  const next = structuredClone(legacy);
  next.rulesVersion = WORLD_RULES_VERSION;
  next.revision = legacy.revision + 1;
  next.governance.constitutionVersion = WORLD_CONSTITUTION_VERSION;
  next.v19 = createWorldV19State(next, WORLD_RULES_VERSION_V18);
  ensureFoundingPrimerV21(next);
  next.v21 = createEmbodiedWorldV21(next);
  const relocatedSapientHomelands = 0 /* saved homeland coordinates are authoritative */;

  const migrationEvent: WorldEvent = {
    eventId: `migration:${next.id}:world-rules-0.3.19`,
    worldId: next.id,
    kind: 'world.migrated',
    source: 'system',
    occurredAt: next.now,
    occurredWorldMinutes: next.calendar.elapsedWorldMinutes,
    payload: {
      from: WORLD_RULES_VERSION_V18,
      to: WORLD_RULES_VERSION,
      migrationMode: 'additive_divine_agency_and_contextual_prayer',
      preservedTick: next.now,
      preservedWorldMinutes: next.calendar.elapsedWorldMinutes,
      preservedPeople: Object.keys(next.agents).length,
      preservedRelationships: Object.keys(next.relationships).length,
      preservedRngState: next.determinism.rngState,
      fabricatedPrayerCount: 0,
      relocatedSapientHomelands,
    },
  };

  assertWorldState(next);
  try {
    const result = await store.commit({
      operationId,
      operationFingerprint,
      worldId: legacy.id,
      expectedRevision: legacy.revision,
      nextState: next,
      events: [migrationEvent],
      memories: [],
    });
    return result.state;
  } catch (error) {
    if (error instanceof WorldRevisionConflictError) {
      const concurrent = await store.loadWorld(legacy.id);
      if (concurrent?.rulesVersion === WORLD_RULES_VERSION) return concurrent;
    }
    throw error;
  }
}

const V19_ADDITIVE_SCHEMA_REPAIR_OPERATION_ID =
  'migration:v22-inhabited-land-rescue-2026-09-18';

async function repairCompatibleV19World(
  store: WorldStore,
  persisted: WorldState,
): Promise<WorldState> {
  const operationFingerprint = stableJsonStringify({
    kind: 'world_migration',
    from: WORLD_RULES_VERSION,
    to: WORLD_RULES_VERSION,
    mode: 'same_version_additive_schema_repair',
    schemaRevision: '2026-09-18-inhabited-land-rescue',
  });
  let current = persisted;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (current.rulesVersion !== WORLD_RULES_VERSION) return current;
    const next = structuredClone(current);
    const before = stableJsonStringify(next);
    const habitatRescue = ensureInhabitedLandRescue(next);
    const addedRulidHarbor = ensureRulidHarbor(next);
    const repairedFoundingOcean = repairFoundingOcean(next);
    if (repairedFoundingOcean) next.routes = rebuildWorldRoutes(next.places, next.routes);
    repairWorldV16AdditiveSchema(
      next,
      next.v16?.migratedFromRulesVersion ?? WORLD_RULES_VERSION_V16,
    );
    repairWorldV18AdditiveSchema(
      next,
      next.v18?.migratedFromRulesVersion ?? WORLD_RULES_VERSION_V16,
    );
    repairWorldV19AdditiveSchema(
      next,
      next.v19?.migratedFromRulesVersion ?? WORLD_RULES_VERSION_V18,
    );
    ensureFoundingPrimerV21(next);
    ensureEmbodiedWorldV21(next);
    0 /* saved homeland coordinates are authoritative */;
    removeUnsurveyedHomelandLinksV20(next);
    repairSecretLibraryPlacementV18(next);
    repairCompactSettlementLayout(next);
    reconcileLibraryAdmissions(next, next.calendar.elapsedWorldMinutes);
    repairDeceasedActions(next);
    ensureCenturyHumpbackState(next);
    // Saved worlds may contain a one-sided physical link from an older repair.
    // Reciprocity is a world invariant; restore only the missing reverse edge.
    makeConnectionsReciprocal(next.places);
    // Update physical walking lanes while retaining completed traversal history.
    next.routes = rebuildWorldRoutes(next.places, next.routes);
    if (stableJsonStringify(next) === before) return current;

    await store.checkpointWorld?.(current.id, current.revision, 'before-additive-schema-migration');
    next.revision = current.revision + 1;
    const migrationEvent: WorldEvent = {
      eventId: `migration:${next.id}:v22-inhabited-land-rescue-2026-09-18:revision:${current.revision}`,
      worldId: next.id,
      kind: 'world.migrated',
      source: 'system',
      occurredAt: next.now,
      occurredWorldMinutes: next.calendar.elapsedWorldMinutes,
      payload: {
        from: WORLD_RULES_VERSION,
        to: WORLD_RULES_VERSION,
        migrationMode: 'same_version_additive_schema_repair',
        preservedTick: next.now,
        preservedWorldMinutes: next.calendar.elapsedWorldMinutes,
        preservedPeople: Object.keys(next.agents).length,
        preservedRngState: next.determinism.rngState,
        userAuthorizedGeographyRescue: habitatRescue.changed,
        rescuedSettlementIds: habitatRescue.settlementIds,
        addedRescueIslandIds: habitatRescue.addedIslandIds,
        addedRescueResourcePlaceIds: habitatRescue.addedPlaceIds,
        blockedRescueSettlementIds: habitatRescue.blockedSettlementIds,
        addedRulidHarbor,
        residentCoordinatesRewritten: false,
        cardinalIntervention: false,
      },
    };

    assertWorldState(next);
    try {
      const result = await store.commit({
        operationId: `${V19_ADDITIVE_SCHEMA_REPAIR_OPERATION_ID}:revision:${current.revision}`,
        operationFingerprint,
        worldId: current.id,
        expectedRevision: current.revision,
        nextState: next,
        events: [migrationEvent],
        memories: [],
      });
      return result.state;
    } catch (error) {
      if (!(error instanceof WorldRevisionConflictError)) throw error;
      const concurrent = await store.loadWorld(current.id);
      if (!concurrent) throw error;
      current = concurrent;
    }
  }

  throw new Error(
    `World ${persisted.id} changed repeatedly during v19 schema repair.`,
  );
}

function goalFromInitialState(agent: Omit<AgentState, 'goal'>, now: number): AgentState['goal'] {
  const scores: Array<{ kind: AgentGoalKind; strength: number }> = [
    { kind: 'recover', strength: (1 - agent.energy) * 0.75 + agent.stress * 0.55 },
    { kind: 'secure_resources', strength: (1 - agent.resources) * 0.9 },
    { kind: 'connect', strength: (1 - agent.needs.belonging) * agent.socialDrive },
    {
      kind: 'contribute',
      strength:
        (1 - agent.needs.purpose) * 0.45 +
        agent.personality.diligence * 0.35 +
        agent.personality.generosity * 0.2,
    },
    { kind: 'explore', strength: agent.personality.curiosity * 0.75 },
    {
      kind: 'reflect',
      strength:
        agent.stress * 0.35 +
        (1 - agent.needs.purpose) * 0.2 +
        (1 - agent.personality.riskTolerance) * 0.25 +
        (1 - agent.personality.sociability) * 0.15,
    },
    {
      kind: 'build_family',
      strength:
        (agent.life.stage === 'adult' ? 0.24 : 0) +
        agent.mind.values.care * 0.26 +
        agent.needs.belonging * 0.16,
    },
    {
      kind: 'seek_truth',
      strength:
        agent.mind.values.knowledge * 0.38 +
        agent.mind.emotions.awe * 0.24 +
        agent.personality.curiosity * 0.24,
    },
  ];
  scores.sort((a, b) => b.strength - a.strength);
  return {
    kind: scores[0].kind,
    strength: clamp01(scores[0].strength),
    since: now,
  };
}

export interface WorldEngineOptions {
  worldId: string;
  seed: string;
  store: WorldStore;
  agentNames?: string[];
  startTime?: number;
}

export interface OpenWorldEngineOptions {
  worldId: string;
  store: WorldStore;
}

export interface WorldMutationResult {
  committed: boolean;
  committedRevision: number;
}

/**
 * WorldEngine mutates only a private working copy during a logical operation.
 * Events and memories are staged beside that copy. The live engine state is
 * replaced only after WorldStore atomically commits state + evidence + the
 * operation tombstone.
 */
export class WorldEngine {
  private activeSimulationQuantumIndex?: number;
  private readonly rng: SeededRng;
  private committedState: WorldState;
  private workingState: WorldState | undefined;
  private operationTail: Promise<void> = Promise.resolve();
  private stagedEvents: WorldEvent[] | undefined;
  private stagedMemories: MemoryRecord[] | undefined;
  private committedSignalCache: WorldEvent[] | undefined;
  private routePathCache:
    | Map<string, Map<string, string[]>>
    | undefined;
  private residentsByLocation: Map<string, AgentState[]> | undefined;
  private relationshipKeysByResident?: Map<string, Set<string>>;
  private familyLifecyclesByAgentId:
    | Map<string, V16FamilyLifecycleState[]>
    | undefined;
  private residentCountByHomeSettlement: Map<string, number> | undefined;
  private residentCountByHomeRace: Map<string, number> | undefined;
  private agricultureKnowledgeByHomeSettlement:
    | Map<string, { sum: number; count: number }>
    | undefined;
  private placesBySettlement: Map<string, WorldPlace[]> | undefined;
  private placesByKind: Map<WorldPlaceKind, WorldPlace[]> | undefined;
  private huntOpportunityByLocation:
    | Map<string, WildlifePopulation | null>
    | undefined;
  private deferResourceProjection = false;
  private resourceProjectionDirty = false;

  private constructor(
    private readonly store: WorldStore,
    state: WorldState,
  ) {
    assertWorldState(state);
    this.committedState = structuredClone(state);
    bindWorldTerrain(this.committedState);
    this.rng = new SeededRng('restored-world', state.determinism.rngState);
  }

  static async create(options: WorldEngineOptions): Promise<WorldEngine> {
    if (!options.worldId.trim()) {
      throw new Error('World id must not be empty.');
    }
    const existing = await options.store.loadWorld(options.worldId);
    if (existing) {
      throw new Error(`World ${options.worldId} already exists in the store.`);
    }

    const now = options.startTime ?? 0;
    if (!Number.isFinite(now)) {
      throw new Error('World start time must be finite.');
    }

    const rng = new SeededRng(options.seed);
    const useThreeHumanSeeds = options.agentNames === undefined || (options.agentNames?.length ?? 0) >= 30;
    const names = options.agentNames?.map(toRussianWorldNameV18) ??
      [...DEFAULT_HUMAN_FOUNDER_NAMES];
    const humanSeedSettlements = useThreeHumanSeeds
      ? drawThreeHumanFoundingSettlements(rng)
      : [{ id: 'settlement_ainkrad', name: 'Айнкрад', prefix: '', coastal: false, layout: drawFoundingSettlementLayout(rng) } satisfies FoundingHumanSettlementSpec];
    const foundingLayout = humanSeedSettlements[0].layout;
    const initialPlace = (id: string, kind: WorldPlaceKind, homeIndex = 0) =>
      foundingPlaceDefaults(placeMigrationDefaults({ id, kind }, homeIndex), foundingLayout);
    const foundingHumanCount = useThreeHumanSeeds ? 10 : names.length;
    const places: Record<string, WorldPlace> = {
      commons: createPlace(
        'commons',
        'Площадь и рынок Айнкрада',
        'commons',
        Math.max(8, foundingHumanCount * 2),
        initialPlace('commons', 'commons'),
      ),
      resource_field: createPlace(
        'resource_field',
        'Поля и фермы Айнкрада',
        'resource_field',
        Math.max(6, foundingHumanCount),
        initialPlace('resource_field', 'resource_field'),
      ),
      workshop: createPlace(
        'workshop',
        'Мастерская Айнкрада',
        'workshop',
        Math.max(6, foundingHumanCount),
        initialPlace('workshop', 'workshop'),
      ),
      quiet_space: createPlace(
        'quiet_space',
        'Тихий сад Айнкрада',
        'quiet_space',
        Math.max(4, foundingHumanCount),
        initialPlace('quiet_space', 'quiet_space'),
      ),
      outskirts: createPlace(
        'outskirts',
        'Окраина Айнкрада',
        'outskirts',
        Math.max(8, foundingHumanCount * 2),
        initialPlace('outskirts', 'outskirts'),
      ),
      ocean_ainkrad: createFoundingOcean(now),
    };
    for (const spec of humanSeedSettlements.slice(1)) {
      addSecondaryHumanSettlementPlaces(places, spec, now, 10);
    }
    const agents: Record<string, AgentState> = {};

    names.forEach((name, index) => {
      const id = `agent_${index + 1}`;
      const homeId = `home_${id}`;
      const settlementSpec = humanSeedSettlements[Math.min(humanSeedSettlements.length - 1, Math.floor(index / 10))];
      if (settlementSpec.id === 'settlement_ainkrad') {
        places[homeId] = createPlace(homeId, `Дом ${name}`, 'home', 3, initialPlace(homeId, 'home', index % 10));
      } else {
        const homePoint = secondaryHomePoint(settlementSpec, index % 10);
        places[homeId] = createPlace(homeId, `Дом ${name}`, 'home', 3, {
          biome: 'settlement', mapX: homePoint.x, mapY: homePoint.y,
          connectedPlaceIds: [`${settlementSpec.prefix}commons`], fertility: 0.52, danger: 0.03,
          surface: 'land', settlementId: settlementSpec.id, discoveredAt: now,
        });
      }

      const personality = {
        sociability: rng.between(0.18, 0.92),
        diligence: rng.between(0.18, 0.92),
        curiosity: rng.between(0.18, 0.92),
        generosity: rng.between(0.18, 0.92),
        resilience: rng.between(0.18, 0.92),
        riskTolerance: rng.between(0.18, 0.92),
      };
      const socialDrive = clamp01(
        personality.sociability * 0.75 + rng.between(0.05, 0.25),
      );
      const needs = {
        belonging: rng.between(0.35, 0.8),
        purpose: rng.between(0.35, 0.8),
      };
      const ageYears = 20 + ((index * 3) % 15);
      const partial = {
        id,
        name,
        origin: 'native' as const,
        sex: (index % 2 === 0 ? 'male' : 'female') as AgentState['sex'],
        race: 'human' as const,
        progression: {
          level: 1,
          experience: 0,
          objectControlAuthority: 0.08,
          systemControlAuthority: 0.06,
          combatMastery: 0.05,
          sacredArts: 0.02,
        },
        energy: rng.between(0.55, 0.95),
        stress: rng.between(0.05, 0.25),
        resources: rng.between(0.35, 0.8),
        socialDrive,
        personality,
        life: {
          bornAt: now - ageYears * WORLD_TICKS_PER_YEAR,
          ageYears,
          lifespanYears:
            72 + personality.resilience * 26 + (index % 5),
          stage: lifeStageForAge(ageYears),
          alive: true,
          health: clamp01(0.72 + personality.resilience * 0.24),
          physiology: physiologyForAge(
            ageYears,
            72 + personality.resilience * 26 + (index % 5),
            clamp01(0.72 + personality.resilience * 0.24),
          ),
          generation: 0,
          parentIds: [],
          childIds: [],
        },
        mind: createMindState(options.worldId, id, personality, needs),
        needs,
        skills: {
          gathering: rng.between(0.15, 0.55),
          hunting: rng.between(0.08, 0.42),
          craft: rng.between(0.15, 0.55),
          social: rng.between(0.15, 0.55),
          exploration: rng.between(0.15, 0.55),
        },
        homeId,
        locationId: homeId,
        position: {
          x: places[homeId].mapX,
          y: places[homeId].mapY,
          layerId: 'surface' as const,
        },
        lastMeaningfulEventAt: now,
      } satisfies Omit<AgentState, 'goal'>;

      agents[id] = {
        ...partial,
        goal: goalFromInitialState(partial, now),
      };
    });
    makeConnectionsReciprocal(places);
    const settlements = rebuildSettlementProjection(places, {}, now);
    const routes = rebuildWorldRoutes(places);

    const state: WorldState = {
      id: options.worldId,
      epoch: 1,
      epochStartedAt: now,
      now,
      revision: 0,
      rulesVersion: WORLD_RULES_VERSION,
      environment: {
        resourcePool: 1,
        resourceRegenerationRate: 0.012,
        socialOpportunity: 0.62,
        safetySupport: 0.64,
        habitatSupport: 0.5,
      },
      determinism: {
        rngState: rng.snapshot(),
        eventSequence: 0,
      },
      calendar: {
        elapsedWorldMinutes: 0,
      },
      growth: {
        stage: 0,
        explorationProgress: 0,
        lastExpansionAt: now,
        lastExpansionWorldMinutes: 0,
        discoveredRegionIds: [],
        frontierSequence: 0,
      },
      population: {
        nextAgentSequence: names.length + 1,
        births: 0,
        deaths: 0,
      },
      cosmology: {
        mysteryLevel: 0.12,
        omenCount: 0,
        traditions: [],
        deities: {},
      },
      governance: {
        constitutionVersion: WORLD_CONSTITUTION_VERSION,
        authorityRevision: 0,
        protectedPersonhoodDomains: [
          'identity',
          'memory',
          'agency',
          'values',
          'relationships',
        ],
        laws: defaultWorldLaws(now, 0),
      },
      places,
      routes,
      settlements,
      wildlife: {},
      agents,
      relationships: {},
      centuryHumpback: createCenturyHumpbackState(),
      v15: createWorldV15State(
        options.worldId,
        1,
        agents,
        1,
        0,
      ),
    };
    applyFounderSmithAgentSeed(state.agents, state.v15!);
    state.v16 = createWorldV16State(state, WORLD_RULES_VERSION);
    state.v18 = createWorldV18State(state, WORLD_RULES_VERSION);
    state.v19 = createWorldV19State(state, WORLD_RULES_VERSION);
    ensureFoundingPrimerV21(state);
    state.v21 = createEmbodiedWorldV21(state);
    if (useThreeHumanSeeds && repairRulidCoastalBank(state)) {
      makeConnectionsReciprocal(state.places);
      state.routes = rebuildWorldRoutes(state.places, state.routes);
      state.settlements = rebuildSettlementProjection(state.places, state.settlements, now);
    }
    repairSecretLibraryPlacementV18(state);
    repairCompactSettlementLayout(state);
    if (useThreeHumanSeeds && repairRulidCoastalBank(state)) {
      makeConnectionsReciprocal(state.places);
      state.routes = rebuildWorldRoutes(state.places, state.routes);
      state.settlements = rebuildSettlementProjection(state.places, state.settlements, now);
      // Finalize the moved coast now, not lazily on the next reload.
      repairCompactSettlementLayout(state);
    }
    if (useThreeHumanSeeds && ensureRulidHarbor(state)) {
      makeConnectionsReciprocal(state.places);
      state.routes = rebuildWorldRoutes(state.places, state.routes);
      state.settlements = rebuildSettlementProjection(state.places, state.settlements, now);
    }
    reconcileLibraryAdmissions(state, state.calendar.elapsedWorldMinutes, true);

    for (const resident of Object.values(state.agents)) observeLocalPlacesV20(state, resident);
    assertWorldState(state);
    await options.store.initializeWorld(state);
    return new WorldEngine(options.store, state);
  }

  static async open(options: OpenWorldEngineOptions): Promise<WorldEngine> {
    let state = await options.store.loadWorld(options.worldId);
    if (!state) {
      throw new Error(`World ${options.worldId} does not exist in the store.`);
    }
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      await options.store.checkpointWorld?.(state.id, state.revision, 'before-rules-migration');
    }
    if (LEGACY_WORLD_RULES_VERSIONS.has(state.rulesVersion)) {
      state = await migrateLegacyWorld(options.store, state);
    }
    if (state.rulesVersion === V15_WORLD_RULES_VERSION) {
      state = await migrateV15WorldToV16(options.store, state);
    }
    if (state.rulesVersion === WORLD_RULES_VERSION_V16) {
      state = await repairCompatibleV16World(options.store, state);
      state = await migrateV16WorldToV18(options.store, state);
    }
    if (state.rulesVersion === WORLD_RULES_VERSION_V18) {
      state = await repairCompatibleV18World(options.store, state);
      state = await migrateV18WorldToV19(options.store, state);
    }
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      throw new Error(
        `World ${options.worldId} uses rules ${state.rulesVersion}; runtime expects ${WORLD_RULES_VERSION}. Explicit migration is required.`,
      );
    }
    state = await repairCompatibleV19World(options.store, state);
    assertWorldState(state);
    return new WorldEngine(options.store, state);
  }

  snapshot(): WorldState {
    // Never expose an operation's uncommitted working copy. Sensors and other
    // readers see only the last atomically committed world projection.
    return structuredClone(this.committedState);
  }

  /**
   * Internal runtime observation view. Callers must never retain or mutate it;
   * UI, gateways and public consumers continue to receive snapshot() clones.
   * This avoids serializing a century-old world merely to read its clock.
   */
  runtimeStateView(): Readonly<WorldState> {
    return this.committedState;
  }

  async reload(): Promise<void> {
    await this.runExclusive(async () => {
      await this.reloadFromStore();
    });
  }

  async resetEpoch(
    seed: string,
    founderNames: readonly string[],
    operationId: string,
  ): Promise<WorldMutationResult> {
    if (!seed.trim() || !operationId.trim() || founderNames.length < 2) {
      throw new Error('World reset requires a seed, operation ID and at least two founders.');
    }
    if (founderNames.some((name) => !name.trim() || name.length > 64)) {
      throw new Error('World reset founder names are invalid.');
    }
    const resetAt = this.committedState.now + 512;
    const nextEpoch = (this.committedState.epoch ?? 1) + 1;
    const fingerprint = stableJsonStringify({ kind: 'world_epoch_reset', seed, founderNames, resetAt, nextEpoch });

    return await this.mutateDetailed(
      `world-reset:${operationId}`,
      fingerprint,
      async () => {
        const priorSequence = this.state.determinism.eventSequence;
        const rng = new SeededRng(`${seed}:epoch:${nextEpoch}`);
        const names = founderNames.map(toRussianWorldNameV18);
        const useThreeHumanSeeds = names.length >= 30;
        const humanSeedSettlements = useThreeHumanSeeds
          ? drawThreeHumanFoundingSettlements(rng)
          : [{ id: 'settlement_ainkrad', name: 'Айнкрад', prefix: '', coastal: false, layout: drawFoundingSettlementLayout(rng) } satisfies FoundingHumanSettlementSpec];
        const foundingLayout = humanSeedSettlements[0].layout;
        const initialPlace = (id: string, kind: WorldPlaceKind, homeIndex = 0) =>
          foundingPlaceDefaults(placeMigrationDefaults({ id, kind }, homeIndex), foundingLayout);
        const places: Record<string, WorldPlace> = {
          commons: createPlace('commons', 'Площадь и рынок Айнкрада', 'commons', Math.max(20, names.length * 2), initialPlace('commons', 'commons')),
          resource_field: createPlace('resource_field', 'Поля и фермы Айнкрада', 'resource_field', Math.max(12, names.length), initialPlace('resource_field', 'resource_field')),
          workshop: createPlace('workshop', 'Мастерская Айнкрада', 'workshop', Math.max(10, names.length), initialPlace('workshop', 'workshop')),
          quiet_space: createPlace('quiet_space', 'Тихий сад Айнкрада', 'quiet_space', Math.max(8, names.length), initialPlace('quiet_space', 'quiet_space')),
          outskirts: createPlace('outskirts', 'Окраина Айнкрада', 'outskirts', Math.max(16, names.length * 2), initialPlace('outskirts', 'outskirts')),
          ocean_ainkrad: createFoundingOcean(resetAt),
        };
        for (const spec of humanSeedSettlements.slice(1)) addSecondaryHumanSettlementPlaces(places, spec, resetAt, 10);
        const agents: Record<string, AgentState> = {};
        names.forEach((name, index) => {
          const id = `epoch_${nextEpoch}_agent_${index + 1}`;
          const homeId = `home_${id}`;
          const settlementSpec = humanSeedSettlements[Math.min(humanSeedSettlements.length - 1, Math.floor(index / 10))];
          if (settlementSpec.id === 'settlement_ainkrad') {
            places[homeId] = createPlace(homeId, `Дом ${name}`, 'home', 3, initialPlace(homeId, 'home', index % 10));
          } else {
            const homePoint = secondaryHomePoint(settlementSpec, index % 10);
            places[homeId] = createPlace(homeId, `Дом ${name}`, 'home', 3, {
              biome: 'settlement', mapX: homePoint.x, mapY: homePoint.y,
              connectedPlaceIds: [`${settlementSpec.prefix}commons`], fertility: 0.52, danger: 0.03,
              surface: 'land', settlementId: settlementSpec.id, discoveredAt: resetAt,
            });
          }
          const personality = {
            sociability: rng.between(0.25, 0.9), diligence: rng.between(0.25, 0.9), curiosity: rng.between(0.25, 0.9),
            generosity: rng.between(0.25, 0.9), resilience: rng.between(0.35, 0.92), riskTolerance: rng.between(0.22, 0.86),
          };
          const socialDrive = clamp01(personality.sociability * 0.75 + rng.between(0.05, 0.25));
          const needs = { belonging: rng.between(0.55, 0.82), purpose: rng.between(0.48, 0.78) };
          const ageYears = 21 + ((index * 5) % 24);
          const health = clamp01(0.78 + personality.resilience * 0.18);
          const lifespanYears = 76 + personality.resilience * 24 + (index % 4);
          const partial = {
            id, name, origin: 'native' as const, sex: (index % 2 === 0 ? 'male' : 'female') as AgentState['sex'], race: 'human' as const,
            progression: { level: 1, experience: 0, objectControlAuthority: 0.08, systemControlAuthority: 0.06, combatMastery: 0.05, sacredArts: 0.02 },
            energy: rng.between(0.68, 0.94), stress: rng.between(0.04, 0.16), resources: rng.between(0.52, 0.78), socialDrive, personality,
            life: { bornAt: resetAt - ageYears * WORLD_TICKS_PER_YEAR, ageYears, lifespanYears, stage: lifeStageForAge(ageYears), alive: true, health,
              physiology: physiologyForAge(ageYears, lifespanYears, health), generation: 0, parentIds: [], childIds: [] },
            mind: createMindState(this.state.id, id, personality, needs), needs,
            skills: { gathering: rng.between(0.18, 0.5), hunting: rng.between(0.08, 0.38), craft: rng.between(0.18, 0.52), social: rng.between(0.18, 0.52), exploration: rng.between(0.16, 0.48) },
            knownPlaceIds: [homeId, `${settlementSpec.prefix}commons`],
            homeId, locationId: homeId, position: { x: places[homeId].mapX, y: places[homeId].mapY, layerId: 'surface' as const },
            lastMeaningfulEventAt: resetAt,
          } satisfies Omit<AgentState, 'goal'>;
          agents[id] = { ...partial, goal: goalFromInitialState(partial, resetAt) };
        });
        makeConnectionsReciprocal(places);

        this.state.now = resetAt;
        this.state.epoch = nextEpoch;
        this.state.epochStartedAt = resetAt;
        this.state.rulesVersion = WORLD_RULES_VERSION;
        this.state.environment = { resourcePool: 1, resourceRegenerationRate: 0.012, socialOpportunity: 0.62, safetySupport: 0.64, habitatSupport: 0.5 };
        this.state.calendar = { elapsedWorldMinutes: 0 };
        this.state.growth = {
          stage: 0,
          explorationProgress: 0,
          lastExpansionAt: resetAt,
          lastExpansionWorldMinutes: 0,
          discoveredRegionIds: [],
          frontierSequence: 0,
        };
        this.state.population = { nextAgentSequence: names.length + 1, births: 0, deaths: 0 };
        this.state.cosmology = { mysteryLevel: 0.12, omenCount: 0, traditions: [], deities: {} };
        this.state.governance = {
          constitutionVersion: WORLD_CONSTITUTION_VERSION, authorityRevision: 0,
          protectedPersonhoodDomains: ['identity', 'memory', 'agency', 'values', 'relationships'], laws: defaultWorldLaws(resetAt, 0),
        };
        this.state.places = places;
        this.state.terrain = undefined;
        this.state.oceanExploration = undefined;
        this.state.cartography = undefined;
        this.state.geography = undefined;
        this.state.routes = rebuildWorldRoutes(places);
        this.state.settlements = rebuildSettlementProjection(places, {}, resetAt);
        this.state.wildlife = {};
        this.state.agents = agents;
        this.state.relationships = {};
        this.state.centuryHumpback = createCenturyHumpbackState();
        this.state.v15 = createWorldV15State(
          this.state.id,
          nextEpoch,
          agents,
          1,
          0,
        );
        applyFounderSmithAgentSeed(this.state.agents, this.state.v15);
        this.state.v16 = createWorldV16State(
          this.state,
          WORLD_RULES_VERSION,
        );
        this.state.v18 = createWorldV18State(
          this.state,
          WORLD_RULES_VERSION,
        );
        this.state.v19 = createWorldV19State(
          this.state,
          WORLD_RULES_VERSION,
        );
        ensureFoundingPrimerV21(this.state);
        this.state.v21 = createEmbodiedWorldV21(this.state);
        if (useThreeHumanSeeds && repairRulidCoastalBank(this.state)) {
          makeConnectionsReciprocal(this.state.places);
          this.state.routes = rebuildWorldRoutes(this.state.places, this.state.routes);
          this.state.settlements = rebuildSettlementProjection(this.state.places, this.state.settlements, resetAt);
        }
        repairSecretLibraryPlacementV18(this.state);
        repairCompactSettlementLayout(this.state);
        if (useThreeHumanSeeds && repairRulidCoastalBank(this.state)) {
          makeConnectionsReciprocal(this.state.places);
          this.state.routes = rebuildWorldRoutes(this.state.places, this.state.routes);
          this.state.settlements = rebuildSettlementProjection(this.state.places, this.state.settlements, resetAt);
          repairCompactSettlementLayout(this.state);
        }
        if (useThreeHumanSeeds && ensureRulidHarbor(this.state)) {
          makeConnectionsReciprocal(this.state.places);
          this.state.routes = rebuildWorldRoutes(this.state.places, this.state.routes);
          this.state.settlements = rebuildSettlementProjection(this.state.places, this.state.settlements, resetAt);
        }
        this.state.determinism.eventSequence = priorSequence;
        this.rng.restore(rng.snapshot());

        this.stageEvent({
          eventId: this.nextId('world-reset'), worldId: this.state.id, kind: 'world.epoch.started', source: 'player', occurredAt: resetAt,
          payload: { epoch: nextEpoch, founderCount: names.length, cardinalExperiencePreserved: true },
        });
      },
    );
  }

  async handleInput(input: InputEnvelope, appliedAt: number): Promise<boolean> {
    if (input.worldId !== this.committedState.id) {
      throw new Error(
        `Input belongs to world ${input.worldId}, expected ${this.committedState.id}.`,
      );
    }

    if (!Number.isFinite(appliedAt)) {
      throw new Error('Input appliedAt must be finite.');
    }

    const operationId = `input:${input.eventId}`;
    const fingerprint = stableJsonStringify({ kind: 'input', input, appliedAt });

    return await this.mutate(operationId, fingerprint, async () => {
      if (appliedAt < this.state.now) {
        throw new Error('Input appliedAt cannot precede world time.');
      }
      this.state.now = appliedAt;

      this.stageEvent({
        eventId: `input:${this.state.id}:${input.eventId}`,
        worldId: this.state.id,
        kind: `input.${input.type}`,
        source: input.source,
        occurredAt: appliedAt,
        payload: structuredClone(input.payload),
        correlationId: input.correlationId ?? input.eventId,
      });
    });
  }

  async step(
    now: number,
    elapsedWorldMinutes: number = DEFAULT_WORLD_MINUTES_PER_TICK,
  ): Promise<boolean> {
    if (!Number.isFinite(now)) {
      throw new Error('World step time must be finite.');
    }
    if (!Number.isFinite(elapsedWorldMinutes) || elapsedWorldMinutes < 0) {
      throw new Error('Elapsed world minutes must be finite and non-negative.');
    }
    const operationId = `tick:${now}`;
    const fingerprint = stableJsonStringify({
      kind: 'tick',
      now,
      elapsedWorldMinutes,
    });

    return await this.mutate(operationId, fingerprint, async () => {
      if (now < this.state.now) {
        throw new Error(
          `World cannot step backwards from ${this.state.now} to ${now}.`,
        );
      }
      this.state.now = now;
      this.advancePhysicalMovementForWorldMinutes(elapsedWorldMinutes);
      this.state.calendar.elapsedWorldMinutes += elapsedWorldMinutes;
      await this.advanceSimulationDynamics(now, elapsedWorldMinutes);
    });
  }

  /**
   * v15 live-runtime entry point.
   *
   * External worker cadence only contributes world minutes. Random world
   * dynamics run once per fixed 8,760-minute semantic quantum, so x1/x10/x100
   * produce the same future after the same accumulated Ainkrad time.
   */
  async advanceCanonicalTime(
    frameSequence: number,
    addedWorldMinutes: number,
  ): Promise<boolean> {
    if (!Number.isInteger(frameSequence) || frameSequence < 0) {
      throw new Error('Canonical frameSequence must be a non-negative integer.');
    }
    if (!Number.isFinite(addedWorldMinutes) || addedWorldMinutes < 0) {
      throw new Error('Canonical addedWorldMinutes must be finite and non-negative.');
    }
    const operationId = `canonical-frame:${frameSequence}`;
    const fingerprint = stableJsonStringify({
      kind: 'canonical_time',
      frameSequence,
      addedWorldMinutes,
    });

    return await this.mutate(operationId, fingerprint, async () => {
      await this.consumeCanonicalWorldMinutes(addedWorldMinutes);
    });
  }

  /**
   * Absolute-time variant used by the live runtime. Its idempotency identity is
   * the canonical target itself, so browser restarts and x1/x10/x100 partition
   * changes cannot manufacture or skip semantic world time.
   */
  async advanceCanonicalTimeTo(targetWorldMinutes: number, execution?: WorldTimeExecution): Promise<boolean> {
    if (!Number.isFinite(targetWorldMinutes) || targetWorldMinutes < 0) {
      throw new Error(
        'Canonical targetWorldMinutes must be finite and non-negative.',
      );
    }
    const worldEpoch = this.committedState.epoch ?? 1;
    const fromWorldMinutes = this.committedState.calendar.elapsedWorldMinutes;
    const operationId = execution
      ? `canonical-world-slice:${worldEpoch}:${fromWorldMinutes}:${targetWorldMinutes}`
      : `canonical-world-time:${worldEpoch}:${targetWorldMinutes}`;
    const fingerprint = stableJsonStringify({
      kind: 'canonical_world_time_target',
      worldEpoch,
      targetWorldMinutes,
    });

    return await this.mutate(operationId, fingerprint, async () => {
      const currentWorldMinutes = this.state.calendar.elapsedWorldMinutes;
      if (targetWorldMinutes + 1e-9 < currentWorldMinutes) {
        throw new Error(
          `Canonical world time cannot move backwards from ${currentWorldMinutes} to ${targetWorldMinutes}.`,
        );
      }
      await this.consumeCanonicalWorldMinutes(
        Math.max(0, targetWorldMinutes - currentWorldMinutes), execution,
      );
    });
  }

  private async consumeCanonicalWorldMinutes(
    addedWorldMinutes: number,
    execution?: WorldTimeExecution,
  ): Promise<void> {
    const clock = this.v15World().simulationClock;
    const quantum = clock.quantumWorldMinutes;
    let remainingWorldMinutes = addedWorldMinutes;

    // Physical travel consumes the exact canonical minutes supplied by the
    // external clock. The loop partitions only at semantic boundaries, so a
    // route created at one boundary can progress through every following
    // minute even when one caller advances many quanta at once.
    while (remainingWorldMinutes > PHYSICAL_TIME_EPSILON) {
      const untilBoundary = Math.max(
        PHYSICAL_TIME_EPSILON,
        quantum - clock.pendingWorldMinutes,
      );
      let segmentWorldMinutes = Math.min(
        remainingWorldMinutes,
        untilBoundary,
      );
      const segmentStartWorldMinute = clock.simulatedWorldMinutes + clock.pendingWorldMinutes;
      wakeDueSleepingBodiesV21(this.state, segmentStartWorldMinute);
      const nextWakeWorldMinute = nextBodyWakeWorldMinuteV21(this.state);
      if (nextWakeWorldMinute !== undefined &&
          nextWakeWorldMinute > segmentStartWorldMinute + PHYSICAL_TIME_EPSILON &&
          nextWakeWorldMinute < segmentStartWorldMinute + segmentWorldMinutes - PHYSICAL_TIME_EPSILON) {
        segmentWorldMinutes = nextWakeWorldMinute - segmentStartWorldMinute;
      }
      this.advancePhysicalMovementForWorldMinutes(segmentWorldMinutes);
      clock.pendingWorldMinutes += segmentWorldMinutes;
      remainingWorldMinutes = Math.max(
        0,
        remainingWorldMinutes - segmentWorldMinutes,
      );
      this.state.calendar.elapsedWorldMinutes =
        clock.simulatedWorldMinutes + clock.pendingWorldMinutes;
      wakeDueSleepingBodiesV21(this.state, this.state.calendar.elapsedWorldMinutes);

      if (clock.pendingWorldMinutes + PHYSICAL_TIME_EPSILON < quantum) {
        continue;
      }

      clock.pendingWorldMinutes = Math.max(
        0,
        clock.pendingWorldMinutes - quantum,
      );
      clock.simulatedWorldMinutes += quantum;
      clock.quantumIndex += 1;

      // Social, biological and Cardinal-facing world mechanics still see the
      // exact fixed semantic boundary. Continuous physics cannot add a choice
      // or a Cardinal opportunity.
      this.state.calendar.elapsedWorldMinutes = clock.simulatedWorldMinutes;
      const semanticTick = this.state.now + 1;
      this.state.now = semanticTick;
      this.activeSimulationQuantumIndex = clock.quantumIndex;
      try {
        await this.advanceSimulationDynamics(semanticTick, quantum);
      } finally {
        this.activeSimulationQuantumIndex = undefined;
      }
      if (execution) {
        await execution.afterQuantum();
        if (execution.shouldStop()) break;
      }
    }

    // Calendar remains continuous for the UI even if the remaining minutes
    // are not enough to trigger another biological/social decision quantum.
    this.state.calendar.elapsedWorldMinutes =
      clock.simulatedWorldMinutes + clock.pendingWorldMinutes;
  }

  private async advanceSimulationDynamics(
    now: number,
    elapsedWorldMinutes: number,
  ): Promise<void> {
    this.deferResourceProjection = true;
    try {
      const effectiveEnvironment = await this.effectiveEnvironment(now);
      this.advanceWildlife(effectiveEnvironment, now);
      this.advanceMonsterFeeding(now);
      this.advanceAgingAndMortality(now, elapsedWorldMinutes);
      advanceEmbodiedWorldV21(this.state);
      // Dungeon ecology/discovery is a world service, not a side effect of
      // repeatedly looking up a resident wallet at every local trade.
      syncAdventureEconomyV19(this.state);
      const livingAgents = Object.values(this.state.agents)
        .filter((agent) => agent.life.alive)
        .sort((left, right) => left.id.localeCompare(right.id));
      // Build population/location summaries before food and land accounting.
      // Previously every meal rescanned every resident, turning one quantum
      // into O(population²) work once the civilization passed one thousand.
      this.buildResidentDecisionIndexes(livingAgents);
      // v15 separates stored resources from the renewable production base.
      this.advanceV15RenewableResources(elapsedWorldMinutes);
      // One lived-action opportunity per resident per canonical quantum.
      // Population may change the CPU cost, never the amount of life a
      // descendant gets before ageing. The runtime yields between quanta;
      // indexes/caches optimize work without dropping resident opportunities.
      for (const agent of livingAgents) {
        if (advanceBodySleepV21(this.state, agent)) continue;
        this.applyPassiveNeeds(agent, effectiveEnvironment);
        if (agent.energy <= 0) advanceBodySleepV21(this.state, agent);
      }
      const agents = this.shuffled(livingAgents);
      this.beginSecretLibraryYearV18(livingAgents, now);
      const residentsStudyingInLibrary = this.advanceSecretLibraryVisitorsV18(now);
      for (const agent of agents) {
        if (residentsStudyingInLibrary.has(agent.id)) {
          recordResidentActionEvidenceV16(this.state, agent);
          continue;
        }
        this.stepAgent(agent, agents, effectiveEnvironment, now);
        recordResidentActionEvidenceV16(this.state, agent);
      }
      this.advanceBirths(now, elapsedWorldMinutes);
      this.advanceSettlementsV18(now);
      this.advanceVoluntaryResettlement(now);
      this.advanceSapientRaces(now);
      this.advanceCenturyHumpback(now);
      this.advanceSettlementMaterialProjects(now);
      this.advanceSettlementRelationsAndConflict(now);
      advanceEmergentSocietyV21(this.state);
      this.advanceBurialAftercare(now);
      this.advanceMysticism(now);
      this.advanceCollectiveMyth(now);

      // Creation sites initialize their own versioned records atomically. The
      // former full-world repair sweep here repeated the same work for every
      // resident on every six-day quantum and made century catch-up quadratic.
      // Rebuild the O(N) summary once because births, deaths and voluntary
      // resettlement above may have changed settlement membership.
      this.buildResidentDecisionIndexes(
        Object.values(this.state.agents).filter((agent) => agent.life.alive),
      );
      this.refreshSettlementLifecycleEvidenceV18(now);
    } finally {
      this.deferResourceProjection = false;
      try {
        if (this.resourceProjectionDirty) {
          this.syncV15StoredResourceProjection();
        }
      } finally {
        this.resourceProjectionDirty = false;
        this.residentsByLocation = undefined;
        this.relationshipKeysByResident = undefined;
        this.familyLifecyclesByAgentId = undefined;
        this.residentCountByHomeSettlement = undefined;
        this.residentCountByHomeRace = undefined;
        this.agricultureKnowledgeByHomeSettlement = undefined;
        this.placesBySettlement = undefined;
        this.placesByKind = undefined;
        this.huntOpportunityByLocation = undefined;
      }
    }
  }

  /**
   * One bounded selection per world year. Curiosity and prior lived learning
   * influence the invitation, but each resident still accepts or declines
   * through their own personality state. Cardinal has no input or write path.
   */
  private beginSecretLibraryYearV18(livingAgents: readonly AgentState[], now: number): void {
    const minute = this.state.calendar.elapsedWorldMinutes;
    const year = Math.floor(minute / WORLD_MINUTES_PER_YEAR) + 1;
    if (ensureElfLibraryV20(this.state)) {
      repairCompactSettlementLayout(this.state);
      this.routePathCache?.clear();
      invalidateResidentNavigation(this.state);
    }
    this.finishSecretLibraryAdmissions(minute, now);
    const library = ensureWorldV18State(this.state).secretLibrary;
    library.currentAccessYear = year;
    const literacyByAgentId = Object.fromEntries(Object.entries(ensureWorldV18State(this.state).languageByAgentId)
      .map(([id, language]) => [id, language.cyrillicLiteracy]));
    const eligibleLibraries = LIBRARY_IDS.filter(id => {
      const count = library.visitors.filter(v => libraryIdOf(v) === id).length;
      const receipt = library.annualSelections![id];
      return this.state.places[id] && count < 5 && receipt.agentIds.length < 5 && receipt.attemptedAtActiveCount !== count;
    });
    if (!eligibleLibraries.length) return;
    for (const agent of rankedSecretLibraryCandidatesV18(livingAgents, year, literacyByAgentId, library.knowledgeByAgentId)) {
      const libraryPlaceId = libraryIdForAgent(this.state, agent);
      const receipt = library.annualSelections![libraryPlaceId];
      if (!eligibleLibraries.includes(libraryPlaceId) || library.visitors.some(v => v.agentId === agent.id) ||
          receipt.agentIds.includes(agent.id) || receipt.agentIds.length >= 5 ||
          library.visitors.filter(v => libraryIdOf(v) === libraryPlaceId).length >= 5 ||
          !this.pathBetween(agent.locationId, libraryPlaceId)) continue;
      const chance = clamp01(0.16 + agent.personality.curiosity * 0.28 + agent.mind.values.knowledge * 0.22 +
        agent.mind.autonomy * 0.13 + (literacyByAgentId[agent.id] ?? 0) * 0.14 - agent.stress * 0.12);
      if (this.rng.next() >= chance) continue;
      library.visitors.push({agentId: agent.id, libraryPlaceId, readingMinutes: 0, wordsRead: 0, lastStudyWorldMinute: 0,
        accessYear: year, status: 'travelling', selectedWorldMinute: minute,
        originalLocationId: isSecretLibrary(agent.locationId) ? agent.homeId : agent.locationId,
        acceptedVoluntarily: true, studyQuanta: 0, learnedKnowledgeIds: []});
      receipt.agentIds.push(agent.id);
      library.totalVisits += 1;
      agent.knownPlaceIds = [...new Set([...(agent.knownPlaceIds ?? []), libraryPlaceId])];
    }
    for (const id of eligibleLibraries) library.annualSelections![id].attemptedAtActiveCount =
      library.visitors.filter(v => libraryIdOf(v) === id).length;
    library.opensAtWorldMinute = minute;
    library.closesAtWorldMinute = Math.max(minute, ...library.visitors.map(admissionDeadline));
    library.status = library.visitors.length ? 'open' : 'closed';
  }

  private finishSecretLibraryAdmissions(minute: number, now: number): void {
    for (const visitor of reconcileLibraryAdmissions(this.state, minute)) {
      const agent = this.state.agents[visitor.agentId];
      if (!agent?.life.alive || visitor.arrivedWorldMinute === undefined) continue;
      this.recordAgentEvent(agent, now, 'agent.secret_library.completed', {
        accessYear: visitor.accessYear, learnedCount: visitor.learnedKnowledgeIds.length, placeId: libraryIdOf(visitor),
      });
      this.stageMemory({ memoryId: this.nextId('memory'), worldId: this.state.id, agentId: agent.id,
        createdAt: now, kind: 'reflection', summary: `${agent.name} completed a voluntary visit to the Secret Library.`,
        importance: 0.76, valence: 0.58, relatedAgentIds: [] });
    }
  }

  private advanceSecretLibraryVisitorsV18(now: number): Set<string> {
    const studying = new Set<string>();
    for (const visitor of ensureWorldV18State(this.state).secretLibrary.visitors) {
      const agent = this.state.agents[visitor.agentId], id = libraryIdOf(visitor);
      if (!agent || !hasLibraryAdmission(this.state, agent, id) ||
          isBodySleepingV21(this.state, agent.id)) continue;
      if (agent.locationId === id && !agent.movement) {
        if (visitor.status !== 'studying') noteLibraryArrival(this.state, agent, this.state.calendar.elapsedWorldMinutes);
        this.performSecretLibraryStudyV18(agent, visitor, now);
        studying.add(agent.id);
      } else {
        visitor.status = 'travelling';
        if (!agent.movement) this.travelBeforeAction(agent, id, 'reflect', now);
      }
    }
    return studying;
  }

  private performSecretLibraryStudyV18(
    agent: AgentState,
    visitor: SecretLibraryVisitorV18,
    now: number,
  ): void {
    if (!canReadLibraryV20(agent, libraryIdOf(visitor), this.state)) return;
    const library = ensureWorldV18State(this.state).secretLibrary;
    const existingRecords = library.knowledgeByAgentId[agent.id] ?? [];
    const priorKnowledgeIds = existingRecords.map((record) => record.knowledgeId);
    const baseMaterial = secretLibraryStudyMaterialV18(
      agent.id,
      visitor.accessYear,
      visitor.studyQuanta,
      [...new Set([...priorKnowledgeIds, ...visitor.learnedKnowledgeIds])],
      Object.fromEntries(existingRecords.filter(record => record.bookId && record.pagesRead !== undefined)
        .map(record => [record.bookId!, record.pagesRead!])),
    );
    const material = agent.race === 'elf' ? elfStudyMaterialV20(visitor.studyQuanta, baseMaterial) : baseMaterial;
    const minute = this.state.calendar.elapsedWorldMinutes;
    const budget = readingBudgetV20(agent, this.state.v18?.languageByAgentId[agent.id]?.cyrillicLiteracy ?? 0,
      minute - (visitor.lastStudyWorldMinute ?? visitor.arrivedWorldMinute ?? minute), material.knowledge.difficulty);
    visitor.lastStudyWorldMinute = minute;
    if (budget.minutes <= 0) return;
    const words = material.knowledge.knowledge.join(' ').split(/\s+/u).length;
    const reading = consumeReadingWords(visitor, material.knowledge.id, words, budget.maximumWords);
    visitor.readingMinutes = (visitor.readingMinutes ?? 0) + reading.wordsRead / budget.wordsPerMinute;
    visitor.wordsRead = (visitor.wordsRead ?? 0) + reading.wordsRead;
    if (!reading.completed) return;
    delete visitor.pendingKnowledgeId;
    delete visitor.pendingReadWords;
    const profile = this.v15World().knowledgeByAgentId[agent.id];
    const learner = this.v15LearningPerson(agent);
    const practice = applyIndependentPractice(learner, {
      practiceId: `library:${this.state.id}:${agent.id}:${visitor.accessYear}:${visitor.studyQuanta}`,
      personId: agent.id,
      domain: material.domain,
      worldMinutes: this.state.calendar.elapsedWorldMinutes,
      durationWorldMinutes: budget.minutes,
      activityVerified: true,
      challenge: material.knowledge.difficulty,
    });
    profile.verifiedPracticeSessions += 1;
    profile.lastLearningWorldMinute = this.state.calendar.elapsedWorldMinutes;

    const language = ensureRussianKnowledgeV18(this.state, agent);
    language.cyrillicLiteracy = clamp01(
      language.cyrillicLiteracy +
        0.003 +
        agent.personality.diligence * 0.002 +
        agent.personality.curiosity * 0.0015,
    );
    language.lastLiteracyPracticeWorldMinute =
      this.state.calendar.elapsedWorldMinutes;
    language.writtenRecordCount += 1;
    const understanding = clamp01(
      0.15 +
        agent.mind.values.knowledge * 0.22 +
        agent.personality.curiosity * 0.18 +
        agent.mind.memoryCoherence * 0.14 +
        language.cyrillicLiteracy * 0.18 +
        profile.aptitude[material.domain] * 0.2 -
        material.knowledge.difficulty * 0.16,
    );
    const recordKnowledgeId = material.knowledge.sourceBookId
      ? material.knowledge.id.split(':page:')[0] : material.knowledge.id;
    const pagesRead = material.knowledge.sourceBookId
      ? Number(material.knowledge.id.split(':page:')[1] ?? 1) : undefined;
    const recordId = `library:${agent.id}:${recordKnowledgeId}:${visitor.accessYear}`;
    const priorRecord = existingRecords.find(record => record.knowledgeId === recordKnowledgeId);
    if (priorRecord) {
      priorRecord.understanding = Math.max(
        priorRecord.understanding,
        understanding,
      );
      priorRecord.acquiredWorldMinute = this.state.calendar.elapsedWorldMinutes;
      if (pagesRead !== undefined) priorRecord.pagesRead = Math.max(priorRecord.pagesRead ?? 0, pagesRead);
    } else {
      existingRecords.push({
        id: recordId,
        knowledgeId: recordKnowledgeId,
        ...(pagesRead !== undefined ? { pagesRead } : {}),
        ...(material.book ? { bookId: material.book.id } : {}),
        title: material.knowledge.title,
        category: material.knowledge.category,
        historicalSource: material.knowledge.historicalSource,
        sourceTitle: material.sourceTitle,
        sourceUrl: material.sourceUrl,
        acquiredWorldMinute: this.state.calendar.elapsedWorldMinutes,
        understanding,
        summary: material.knowledge.knowledge.slice(0, 2).join(' ').slice(0, 700),
        concepts: material.knowledge.concepts.slice(0, 12),
        practiceCount: 0,
        sharedCount: 0,
      });
      library.totalKnowledgeRecords += 1;
    }
    library.knowledgeByAgentId[agent.id] = existingRecords.slice(
      -SECRET_LIBRARY_MAX_KNOWLEDGE_PER_AGENT_V18,
    );
    recordEmbodiedReadingV21(
      this.state,
      agent,
      material.knowledge.category,
      material.knowledge.id,
      understanding,
    );
    visitor.studyQuanta = Math.min(SECRET_LIBRARY_STUDY_QUANTA_V18, visitor.studyQuanta + 1);
    if (!visitor.learnedKnowledgeIds.includes(material.knowledge.id)) {
      visitor.learnedKnowledgeIds.push(material.knowledge.id);
      visitor.learnedKnowledgeIds = visitor.learnedKnowledgeIds.slice(-32);
    }
    agent.lastAction = 'reflect';
    agent.lastMeaningfulEventAt = now;
    agent.energy = clamp01(agent.energy - 0.018);
    agent.stress = clamp01(agent.stress - 0.018);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.022);
    agent.mind.values.knowledge = clamp01(
      agent.mind.values.knowledge + 0.0018 + practice.gained * 0.08,
    );
    recordLifeRhythmActionV18(this.state, agent, 'reflect');
    recordLivelihoodPracticeV18(this.state, agent, {
      action: 'reflect',
      placeId: SECRET_LIBRARY_PLACE_ID_V18,
      professionHint: 'scribe',
      choiceRoll: this.rng.next(),
      amount: 0.55,
    });
    this.advanceMind(agent);
  }

  async applyDisturbance(
    kind: WorldDisturbanceKind,
    magnitude: number,
    now: number,
    duration: number,
    operationId: string,
  ): Promise<boolean> {
    if (!['resource_shock', 'social_barrier', 'safety_shock'].includes(kind as string)) {
      throw new Error('Unknown disturbance kind.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('Disturbance time must be finite.');
    }
    if (!Number.isFinite(magnitude) || magnitude < 0) {
      throw new Error('Disturbance magnitude must be finite and non-negative.');
    }
    if (!Number.isFinite(duration) || duration < 1) {
      throw new Error('Disturbance duration must be finite and at least 1.');
    }
    if (!operationId.trim()) {
      throw new Error('Disturbance operationId is required for retry safety.');
    }

    const amount = Math.max(0, Math.min(0.8, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'disturbance',
      disturbanceKind: kind,
      magnitude: amount,
      now,
      duration,
    });

    return await this.mutate(`disturbance:${operationId}`, fingerprint, async () => {
      if (now < this.state.now) {
        throw new Error('Disturbance cannot be applied retroactively to a progressed world.');
      }
      this.state.now = now;

      const eventKind =
        kind === 'resource_shock'
          ? 'world.disturbance.resource_shock'
          : kind === 'social_barrier'
            ? 'world.effect.social_barrier'
            : 'world.effect.safety_shock';

      if (kind === 'resource_shock') {
        this.addV15StoredResources(-amount);

        // A systemic resource shock affects both shared stored availability and
        // household reserves. The control world still retains work, gathering,
        // exploration and cooperation as endogenous recovery paths.
        for (const agent of Object.values(this.state.agents)) {
          const householdLoss = amount * 0.6;
          agent.resources = clamp01(agent.resources - householdLoss);
          agent.stress = clamp01(
            agent.stress + amount * 0.08 * (1.15 - agent.personality.resilience * 0.3),
          );
        }

        this.stageEvent({
          eventId: this.stableOperationEventId('disturbance', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'system',
          occurredAt: now,
          payload: { magnitude: amount, householdLoss: amount * 0.6 },
        });
        return;
      }

      this.stageEvent({
        eventId: this.stableOperationEventId('disturbance', operationId),
        worldId: this.state.id,
        kind: eventKind,
        source: 'system',
        occurredAt: now,
        payload: { magnitude: amount },
        activeUntil: now + Math.max(1, duration),
      });
    });
  }

  // CardinalCore never receives this capability. Only the independent
  // simulation gateway owns it.
  async applyAuthorizedIntervention(
    worldId: string,
    kind: InterventionKind,
    magnitude: number,
    now: number,
    durationWorldMinutes: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error(
        `Intervention belongs to world ${worldId}, expected ${this.committedState.id}.`,
      );
    }
    if (
      ![
        'resource_relief',
        'open_shared_space',
        'safety_support',
        'habitat_support',
      ].includes(kind as string)
    ) {
      throw new Error('Unknown intervention kind.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('Intervention time must be finite.');
    }
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new Error('Intervention magnitude must be positive and finite.');
    }
    if (!Number.isFinite(durationWorldMinutes) || durationWorldMinutes < 1) {
      throw new Error(
        'Intervention durationWorldMinutes must be finite and at least 1.',
      );
    }
    if (!operationId.trim()) {
      throw new Error('Intervention operationId is required for retry safety.');
    }
    if (!Number.isInteger(expectedWorldRevision) || expectedWorldRevision < 0) {
      throw new Error('Intervention expectedWorldRevision must be a non-negative integer.');
    }

    const amount = Math.max(0, Math.min(0.25, magnitude));
    const fingerprint = stableJsonStringify({
      kind: 'intervention',
      worldId,
      interventionKind: kind,
      magnitude: amount,
      now,
      durationWorldMinutes,
      expectedWorldRevision,
    });

    return await this.mutateDetailed(
      `intervention:${operationId}`,
      fingerprint,
      async () => {
        if (now < this.state.now) {
          throw new Error('Intervention cannot be applied retroactively to a progressed world.');
        }
        this.state.now = now;
        const requestedWorldMinutes =
          this.state.calendar.elapsedWorldMinutes;

        const eventKind =
          kind === 'resource_relief'
            ? 'cardinal.intervention.resource_relief'
            : kind === 'open_shared_space'
              ? 'cardinal.effect.open_shared_space'
              : kind === 'safety_support'
                ? 'cardinal.effect.safety_support'
                : 'cardinal.effect.habitat_support';

        if (kind === 'resource_relief') {
          // Cardinal may support damaged soil/ecology, but it cannot conjure a
          // filled granary. Residents still have to farm, forage, hunt and
          // carry every usable unit into their own settlement.
          this.supportV15RenewableBase(amount);

          this.stageEvent({
            eventId: this.stableOperationEventId('intervention', operationId),
            worldId: this.state.id,
            kind: eventKind,
            source: 'cardinal',
            occurredAt: now,
            occurredWorldMinutes: requestedWorldMinutes,
            payload: {
              magnitude: amount,
              durationWorldMinutes,
              mechanism: 'renewable_base_support_only',
              fabricatedStoredResources: 0,
            },
          });
          return;
        }

        this.stageEvent({
          eventId: this.stableOperationEventId('intervention', operationId),
          worldId: this.state.id,
          kind: eventKind,
          source: 'cardinal',
          occurredAt: now,
          occurredWorldMinutes: requestedWorldMinutes,
          payload: {
            magnitude: amount,
            durationWorldMinutes,
          },
          // Compatibility/index projection only. Canonical expiration below is
          // authoritative for v0.3.15 world semantics.
          activeUntil:
            now +
            Math.max(
              1,
              Math.ceil(
                durationWorldMinutes /
                  V15_SIMULATION_QUANTUM_WORLD_MINUTES,
              ),
            ),
          activeUntilWorldMinutes:
            requestedWorldMinutes + durationWorldMinutes,
        });
      },
      expectedWorldRevision,
    );
  }

  /** Cardinal may propose world laws, but only the independent authority
   * gateway receives this mutation capability. Personhood is not addressable
   * through this method. */
  async applyAuthorizedOceanDecision(decision:OceanDecision,revision:number):Promise<WorldMutationResult> {
    return this.mutateDetailed(`ocean-frontier:${this.committedState.epoch??1}:${decision.requestId}`,
      stableJsonStringify(decision),async()=>{
        applyOceanDecision(this.state,decision);
        this.stageEvent({eventId:this.stableOperationEventId('ocean-frontier',decision.requestId),worldId:this.state.id,
          kind:'world.geography.extended',source:'cardinal',occurredAt:this.state.now,
          payload:{requestId:decision.requestId,landKind:decision.land?.kind??'ocean',landId:decision.land?.id??null}});
      },revision);
  }

  async applyAuthorizedWorldLaw(
    worldId: string,
    lawId: string,
    domain: WorldLawDomain,
    mechanism: WorldLawMechanism,
    value: number,
    minimum: number,
    maximum: number,
    rationale: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('World-law proposal belongs to a different world.');
    }
    if (!lawId.trim() || !rationale.trim() || !operationId.trim()) {
      throw new Error('World-law mutation requires IDs and rationale.');
    }
    if (LAW_MECHANISM_DOMAINS[mechanism] !== domain) {
      throw new Error('World-law mechanism does not belong to its domain.');
    }
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum > maximum ||
      value < minimum ||
      value > maximum ||
      !Number.isFinite(now)
    ) {
      throw new Error('World-law value and time must be finite.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'world_law',
      worldId,
      lawId,
      domain,
      mechanism,
      value,
      minimum,
      maximum,
      rationale,
      now,
      worldMinutes: this.committedState.calendar.elapsedWorldMinutes,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-authority:${operationId}`,
      fingerprint,
      async () => {
        let current = this.state.governance.laws[lawId];
        const worldMinutes = this.state.calendar.elapsedWorldMinutes;
        if (!current) {
          current = {
            id: lawId,
            domain,
            mechanism,
            value,
            minimum,
            maximum,
            revision: 0,
            createdAt: now,
            updatedAt: now,
            createdWorldMinutes: worldMinutes,
            updatedWorldMinutes: worldMinutes,
            createdBy: 'cardinal',
            rationale,
          };
          this.state.governance.laws[lawId] = current;
        } else if (
          current.domain !== domain ||
          current.mechanism !== mechanism ||
          minimum < current.minimum ||
          maximum > current.maximum ||
          value < current.minimum ||
          value > current.maximum
        ) {
          throw new Error(`World law ${lawId} exceeds its constitutional range.`);
        } else {
          current.value = value;
          current.revision += 1;
          current.updatedAt = now;
          current.updatedWorldMinutes = worldMinutes;
          current.createdBy = 'cardinal';
          current.rationale = rationale;
        }
        this.state.governance.authorityRevision += 1;
        this.state.governance.lastCardinalAuthorityAt = now;
        this.state.governance.lastCardinalAuthorityWorldMinutes = worldMinutes;
        this.stageEvent({
          eventId: this.stableOperationEventId('world-law', operationId),
          worldId: this.state.id,
          kind: 'cardinal.world_law.changed',
          source: 'cardinal',
          occurredAt: now,
          payload: {
            lawId,
            domain: current.domain,
            mechanism: current.mechanism,
            value,
            lawRevision: current.revision,
            rationale,
          },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedCatastrophe(
    worldId: string,
    catastropheKind: string,
    magnitude: number,
    maxCasualtyRatio: number,
    recoveryPlan: string,
    now: number,
    durationWorldMinutes: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    const allowed = ['wildfire', 'flood', 'epidemic', 'earthquake', 'drought'];
    if (worldId !== this.committedState.id) {
      throw new Error('Catastrophe proposal belongs to a different world.');
    }
    if (!allowed.includes(catastropheKind)) {
      throw new Error('Unknown catastrophe kind.');
    }
    if (
      !Number.isFinite(magnitude) ||
      magnitude <= 0 ||
      magnitude > 0.35 ||
      !Number.isFinite(maxCasualtyRatio) ||
      maxCasualtyRatio < 0 ||
      maxCasualtyRatio > 0.18 ||
      !Number.isFinite(now) ||
      !Number.isFinite(durationWorldMinutes) ||
      durationWorldMinutes < 1 ||
      !recoveryPlan.trim() ||
      !operationId.trim()
    ) {
      throw new Error('Catastrophe parameters exceed the world safety envelope.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'catastrophe',
      worldId,
      catastropheKind,
      magnitude,
      maxCasualtyRatio,
      recoveryPlan,
      now,
      durationWorldMinutes,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-authority:${operationId}`,
      fingerprint,
      async () => {
        const living = this.shuffled(
          Object.values(this.state.agents).filter((agent) => agent.life.alive),
        );
        const maximumDeaths = Math.max(
          0,
          Math.min(
            Math.floor(living.length * maxCasualtyRatio),
            Math.max(0, living.length - 8),
          ),
        );
        let deaths = 0;
        const livingByRace = new Map<string, number>();
        for (const resident of living) {
          const race = resident.race ?? 'human';
          livingByRace.set(race, (livingByRace.get(race) ?? 0) + 1);
        }
        for (const agent of living) {
          const race = agent.race ?? 'human';
          const raceFloor = race === 'human' ? 8 : 2;
          const place = this.state.places[agent.locationId];
          const exposure = clamp01(
            magnitude *
              (0.34 + (place?.danger ?? 0.1) * 0.5) *
              (1.16 - agent.personality.resilience * 0.32),
          );
          agent.life.health = clamp01(agent.life.health - exposure);
          agent.stress = clamp01(agent.stress + magnitude * 0.32);
          agent.mind.emotions.fear = clamp01(
            agent.mind.emotions.fear + magnitude * 0.46,
          );
          agent.mind.emotions.awe = clamp01(
            agent.mind.emotions.awe + magnitude * 0.2,
          );
          const canLoseMember = (livingByRace.get(race) ?? 0) > raceFloor;
          if (
            agent.life.health <= 0.06 &&
            deaths < maximumDeaths &&
            canLoseMember
          ) {
            this.recordDeath(agent, 'catastrophe', now);
            livingByRace.set(race, (livingByRace.get(race) ?? 1) - 1);
            deaths += 1;
          } else {
            agent.life.health = Math.max(agent.life.health, 0.07);
            this.stageMemory({
              memoryId: this.nextId('memory'),
              worldId: this.state.id,
              agentId: agent.id,
              createdAt: now,
              kind: 'world_event',
              summary: `${agent.name} survived the ${catastropheKind}.`,
              importance: 0.9,
              valence: -0.74,
              relatedAgentIds: [],
            });
          }
        }

        const wildlifeLoss = clamp01(magnitude * 0.58);
        for (const population of Object.values(this.state.wildlife)) {
          population.count = Math.max(
            0,
            population.count - Math.floor(population.count * wildlifeLoss),
          );
          population.lastChangedAt = now;
        }
        if (catastropheKind === 'drought' || catastropheKind === 'wildfire') {
          this.addV15StoredResources(-magnitude * 0.62);
          this.damageRenewableBase(magnitude * 0.22);
        }
        this.state.cosmology.mysteryLevel = clamp01(
          this.state.cosmology.mysteryLevel + magnitude * 0.12,
        );
        this.state.governance.authorityRevision += 1;
        this.state.governance.lastCardinalAuthorityAt = now;
        const requestedWorldMinutes =
          this.state.calendar.elapsedWorldMinutes;
        this.state.governance.lastCardinalAuthorityWorldMinutes =
          requestedWorldMinutes;
        const recoveryMagnitude = clamp01(
          magnitude * this.lawValue('catastrophe_recovery', 0.75),
        );
        this.stageEvent({
          eventId: this.stableOperationEventId('catastrophe', operationId),
          worldId: this.state.id,
          kind: `cardinal.catastrophe.${catastropheKind}`,
          source: 'cardinal',
          occurredAt: now,
          activeUntil:
            now +
            Math.max(
              1,
              Math.ceil(
                durationWorldMinutes /
                  V15_SIMULATION_QUANTUM_WORLD_MINUTES,
              ),
            ) * 3,
          activeUntilWorldMinutes:
            requestedWorldMinutes + durationWorldMinutes * 3,
          payload: {
            magnitude,
            deaths,
            maximumDeaths,
            maxCasualtyRatio,
            recoveryPlan,
            destructiveUntil:
              now +
              Math.max(
                1,
                Math.ceil(
                  durationWorldMinutes /
                    V15_SIMULATION_QUANTUM_WORLD_MINUTES,
                ),
              ),
            destructiveUntilWorldMinutes:
              requestedWorldMinutes + durationWorldMinutes,
            durationWorldMinutes,
            recoveryMagnitude,
          },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedResidentEntry(
    worldId: string,
    entryId: string,
    name: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('Resident entry belongs to a different world.');
    }
    if (
      !entryId.trim() ||
      !name.trim() ||
      !operationId.trim() ||
      !Number.isFinite(now) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(entryId) ||
      name.length > 64
    ) {
      throw new Error('Resident entry requires stable identity and name.');
    }
    const residentId = `visitor_${entryId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const fingerprint = stableJsonStringify({
      kind: 'resident_entry',
      worldId,
      residentId,
      name,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        if (this.state.agents[residentId]) {
          throw new Error(`Resident entry ${residentId} already exists.`);
        }
        const personality: AgentState['personality'] = {
          sociability: this.rng.between(0.35, 0.8),
          diligence: this.rng.between(0.35, 0.8),
          curiosity: this.rng.between(0.55, 0.92),
          generosity: this.rng.between(0.35, 0.82),
          resilience: this.rng.between(0.45, 0.86),
          riskTolerance: this.rng.between(0.35, 0.8),
        };
        const needs = { belonging: 0.55, purpose: 0.62 };
        const homeId = `home_${residentId}`;
        const homeIndex = Object.values(this.state.places).filter(
          (place) => place.kind === 'home',
        ).length;
        this.state.places[homeId] = createPlace(
          homeId,
          `${name}'s Home`,
          'home',
          3,
          placeMigrationDefaults({ id: homeId, kind: 'home' }, homeIndex),
        );
        makeConnectionsReciprocal(this.state.places);
        this.rebuildSpatialProjection();
        const ageYears = 25;
        const partial = {
          id: residentId,
          name,
          origin: 'external_resident' as const,
          sex: (this.state.population.nextAgentSequence % 2 === 0
            ? 'female'
            : 'male') as AgentState['sex'],
          race: 'human' as const,
          progression: {
            level: 1,
            experience: 0,
            objectControlAuthority: 0.12,
            systemControlAuthority: 0.1,
            combatMastery: 0.08,
            sacredArts: 0.04,
          },
          energy: 0.84,
          stress: 0.08,
          resources: 0.62,
          socialDrive: personality.sociability,
          personality,
          life: {
            bornAt: now - ageYears * WORLD_TICKS_PER_YEAR,
            ageYears,
            lifespanYears: 78 + personality.resilience * 22,
            stage: 'adult' as const,
            alive: true,
            health: 0.92,
            physiology: physiologyForAge(
              ageYears,
              78 + personality.resilience * 22,
              0.92,
            ),
            generation: 0,
            parentIds: [],
            childIds: [],
          },
          mind: createMindState(this.state.id, residentId, personality, needs),
          needs,
          skills: {
            gathering: 0.25,
            hunting: 0.18,
            craft: 0.26,
            social: 0.3,
            exploration: 0.42,
          },
          homeId,
          locationId: 'commons',
          position: {
            x: this.state.places.commons.mapX,
            y: this.state.places.commons.mapY,
            layerId: 'surface' as const,
          },
          lastMeaningfulEventAt: now,
        } satisfies Omit<AgentState, 'goal'>;
        this.state.agents[residentId] = {
          ...partial,
          goal: goalFromInitialState(partial, now),
        };
        ensureAgentV15State(this.state, this.state.agents[residentId]);
        ensureAgentV16State(this.state, this.state.agents[residentId]);
        ensureRussianKnowledgeV18(this.state, this.state.agents[residentId]);
        ensureLivelihoodV18(this.state, this.state.agents[residentId]);
        ensureLifeRhythmV18(this.state, this.state.agents[residentId]);
        this.state.population.nextAgentSequence += 1;
        this.stageEvent({
          eventId: this.stableOperationEventId('resident-entry', operationId),
          worldId: this.state.id,
          kind: 'world.entry.resident_manifested',
          source: 'player',
          occurredAt: now,
          payload: { agentId: residentId, name },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedDeityEntry(
    worldId: string,
    deityId: string,
    name: string,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('Deity entry belongs to a different world.');
    }
    if (
      !deityId.trim() ||
      !name.trim() ||
      !operationId.trim() ||
      !Number.isFinite(now) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(deityId) ||
      name.length > 64
    ) {
      throw new Error('Deity entry requires stable identity and name.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'deity_entry',
      worldId,
      deityId,
      name,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        if (this.state.cosmology.deities[deityId]) {
          throw new Error(`Deity ${deityId} already exists.`);
        }
        this.state.cosmology.deities[deityId] = {
          id: deityId,
          name,
          origin: 'external_entry',
          enteredAt: now,
        };
        this.state.cosmology.mysteryLevel = clamp01(
          this.state.cosmology.mysteryLevel + 0.08,
        );
        this.stageEvent({
          eventId: this.stableOperationEventId('deity-entry', operationId),
          worldId: this.state.id,
          kind: 'world.entry.deity_manifested',
          source: 'player',
          occurredAt: now,
          payload: { deityId, name },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedDivineOmen(
    worldId: string,
    deityId: string,
    omen: string,
    magnitude: number,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
  ): Promise<WorldMutationResult> {
    if (worldId !== this.committedState.id) {
      throw new Error('Divine omen belongs to a different world.');
    }
    if (
      !['aurora', 'voice', 'eclipse', 'miracle', 'storm_sign'].includes(omen) ||
      !Number.isFinite(magnitude) ||
      magnitude <= 0 ||
      magnitude > 0.35 ||
      !Number.isFinite(now) ||
      !operationId.trim()
    ) {
      throw new Error('Divine omen is outside the entry gateway envelope.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'divine_omen',
      worldId,
      deityId,
      omen,
      magnitude,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        const deity = this.state.cosmology.deities[deityId];
        if (!deity) throw new Error(`Unknown deity ${deityId}.`);
        if (deity.origin !== 'external_entry') {
          throw new Error('An emergent belief cannot be impersonated by an external deity.');
        }
        deity.lastOmenAt = now;
        this.state.cosmology.omenCount += 1;
        this.state.cosmology.mysteryLevel = clamp01(
          this.state.cosmology.mysteryLevel + magnitude * 0.32,
        );
        const living = Object.values(this.state.agents).filter(
          (agent) => agent.life.alive,
        );
        const witnesses: AgentState[] = [];
        for (const agent of living) {
          const perceptionChance = clamp01(
            0.38 +
              magnitude * 0.8 +
              agent.personality.curiosity * 0.18 +
              agent.mind.beliefs.divinePresence * 0.1,
          );
          if (this.rng.next() < perceptionChance) witnesses.push(agent);
        }
        if (witnesses.length === 0 && living.length > 0) {
          witnesses.push(
            [...living].sort(
              (a, b) =>
                b.personality.curiosity + b.mind.emotions.awe -
                (a.personality.curiosity + a.mind.emotions.awe),
            )[0],
          );
        }
        for (const agent of witnesses) {
          agent.mind.emotions.awe = clamp01(
            agent.mind.emotions.awe + magnitude * 0.5,
          );
          agent.mind.emotions.fear = clamp01(
            agent.mind.emotions.fear +
              magnitude * (0.28 - agent.personality.resilience * 0.12),
          );
          agent.mind.beliefs.divinePresence = clamp01(
            agent.mind.beliefs.divinePresence + magnitude * 0.22,
          );
          this.stageMemory({
            memoryId: this.nextId('memory'),
            worldId: this.state.id,
            agentId: agent.id,
            createdAt: now,
            kind: 'omen',
            summary: `${agent.name} witnessed ${deity.name}'s ${omen}.`,
            importance: clamp01(0.66 + magnitude * 0.7),
            valence: clampSigned(0.14 - agent.mind.emotions.fear * 0.2),
            relatedAgentIds: [],
          });
        }
        this.stageEvent({
          eventId: this.stableOperationEventId('divine-omen', operationId),
          worldId: this.state.id,
          kind: `world.omen.${omen}`,
          source: 'player',
          occurredAt: now,
          payload: {
            deityId,
            deityName: deity.name,
            magnitude,
            witnessCount: witnesses.length,
          },
        });
      },
      expectedWorldRevision,
    );
  }

  async applyAuthorizedPrivateDivineAudience(
    worldId: string,
    agentId: string,
    deityId: string,
    deityName: string,
    religionName: string | undefined,
    message: string | undefined,
    gift: DivineGiftKind | undefined,
    contactKind: DivineContactKind | undefined,
    relatedPrayerId: string | undefined,
    now: number,
    operationId: string,
    expectedWorldRevision: number,
    inheritanceGift?: DivineGiftKind,
    burden?: DivineBurdenKind,
    lineageCurse?: boolean,
  ): Promise<WorldMutationResult> {
    if (
      worldId !== this.committedState.id ||
      !agentId.trim() ||
      !deityId.trim() ||
      !deityName.trim() ||
      !operationId.trim() ||
      !Number.isFinite(now) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(deityId) ||
      deityName.length > 64 ||
      (!gift && !burden && !contactKind) ||
      Boolean(gift && burden) ||
      (contactKind !== undefined && !message?.trim()) ||
      (message !== undefined && message.length > 480) ||
      (religionName !== undefined &&
        (!religionName.trim() || religionName.length > 64)) ||
      (gift !== undefined && !DIVINE_GIFTS_V19.includes(gift)) ||
      (burden !== undefined && !DIVINE_BURDENS_V22.includes(burden)) ||
      (lineageCurse !== undefined && typeof lineageCurse !== 'boolean') ||
      (contactKind !== undefined && !DIVINE_CONTACT_KINDS_V19.includes(contactKind))
    ) {
      throw new Error('Private divine audience is outside the entry gateway envelope.');
    }
    const fingerprint = stableJsonStringify({
      kind: 'private_divine_action',
      inheritanceGift,
      burden,
      lineageCurse,
      worldId,
      agentId,
      deityId,
      deityName,
      religionName,
      message,
      gift,
      contactKind,
      relatedPrayerId,
      now,
      expectedWorldRevision,
    });
    return await this.mutateDetailed(
      `world-entry:${operationId}`,
      fingerprint,
      async () => {
        const agent = this.state.agents[agentId];
        if (!agent || !agent.life.alive) {
          throw new Error(`Living audience resident ${agentId} was not found.`);
        }
        const result = applyDivineActionV19(this.state, {
          operationId,
          agentId,
          deityId,
          deityName,
          ...(religionName ? { religionName } : {}),
          ...(gift ? { gift } : {}),
          ...(inheritanceGift ? { inheritanceGift } : {}),
          ...(burden ? { burden, lineageCurse: Boolean(lineageCurse) } : {}),
          ...(contactKind ? { contactKind } : {}),
          ...(message?.trim() ? { message: message.trim() } : {}),
          ...(relatedPrayerId ? { relatedPrayerId } : {}),
          worldMinute: this.state.calendar.elapsedWorldMinutes,
          interpretationRoll: this.rng.next(),
        });

        // Deliberately no public WorldEvent: neither Cardinal nor bystanders
        // receive a direct notification. This durable memory belongs only to
        // the selected person. Consequences can become public only if that
        // person later chooses to speak or acts with changed capabilities.
        this.stageMemory({
          memoryId: this.stableOperationEventId('private-divine-audience', operationId),
          worldId: this.state.id,
          agentId: agent.id,
          createdAt: now,
          kind: 'divine_audience',
          summary: contactKind
            ? `${agent.name} privately received a ${contactKind} from ${deityName}: ${message}${gift ? `; gift: ${gift}` : ''}${burden ? `; burden: ${burden}${lineageCurse ? ' (lineage)' : ''}` : ''}`
            : `${agent.name} experienced an unexplained change: ${gift ?? burden}.`,
          importance: 1,
          valence: burden ? -0.48 : result.interpretation === 'frightening' ? -0.32 : 0.42,
          relatedAgentIds: [],
        });
      },
      expectedWorldRevision,
    );
  }

  private async mutate(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
    requiredWorldRevision?: number,
  ): Promise<boolean> {
    return (
      await this.mutateDetailed(
        operationId,
        operationFingerprint,
        apply,
        requiredWorldRevision,
      )
    ).committed;
  }

  private async mutateDetailed(
    operationId: string,
    operationFingerprint: string,
    apply: () => Promise<void>,
    requiredWorldRevision?: number,
  ): Promise<WorldMutationResult> {
    return await this.runExclusive(async () => {
      const prior = await this.store.committedOperation(
        this.committedState.id,
        operationId,
      );
      if (prior) {
        if (prior.operationFingerprint !== operationFingerprint) {
          throw new Error(
            `World operation ${operationId} was retried with different content.`,
          );
        }

        await this.reloadFromStore();
        return {
          committed: false,
          committedRevision: prior.committedRevision,
        };
      }

      if (
        requiredWorldRevision !== undefined &&
        this.committedState.revision !== requiredWorldRevision
      ) {
        throw new StaleWorldObservationError(
          this.committedState.id,
          requiredWorldRevision,
          this.committedState.revision,
        );
      }

      // committedState is never mutated in place. One working clone provides
      // rollback isolation; cloning the same mature world again before and
      // after every catch-up batch only multiplied serialization cost.
      const before = this.committedState;
      const beforeRng = this.rng.snapshot();
      this.workingState = structuredClone(before);
      bindWorldTerrain(this.workingState);
      this.rng.restore(before.determinism.rngState);
      this.stagedEvents = [];
      this.stagedMemories = [];
      this.committedSignalCache = undefined;
      this.routePathCache = new Map();

      try {
        await apply();
        this.syncDeterminismState();
        this.state.revision = before.revision + 1;
        assertWorldState(this.state);

        const result = await this.store.commit({
          operationId,
          operationFingerprint,
          worldId: before.id,
          expectedRevision: before.revision,
          nextState: this.state,
          events: this.stagedEvents,
          memories: this.stagedMemories,
        });

        this.adopt(result.state, result.committed && result.state === this.state);
        return {
          committed: result.committed,
          committedRevision: result.operation.committedRevision,
        };
      } catch (error) {
        this.rng.restore(beforeRng);
        if (error instanceof WorldRevisionConflictError) {
          await this.reloadFromStore();
        }
        throw error;
      } finally {
        this.workingState = undefined;
        this.stagedEvents = undefined;
        this.stagedMemories = undefined;
        this.committedSignalCache = undefined;
        this.routePathCache = undefined;
        this.residentsByLocation = undefined;
        this.relationshipKeysByResident = undefined;
        this.familyLifecyclesByAgentId = undefined;
        this.residentCountByHomeSettlement = undefined;
        this.residentCountByHomeRace = undefined;
        this.placesBySettlement = undefined;
        this.placesByKind = undefined;
        this.huntOpportunityByLocation = undefined;
      }
    });
  }

  private get state(): WorldState {
    if (!this.workingState) {
      throw new Error('World mutable state was accessed outside a logical operation.');
    }
    return this.workingState;
  }

  private async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.operationTail;
    let release!: () => void;
    this.operationTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async reloadFromStore(): Promise<void> {
    const worldId = this.committedState.id;
    const state = await this.store.loadWorld(worldId);
    if (!state) {
      throw new Error(`World ${worldId} disappeared from the store.`);
    }
    this.adopt(state);
  }

  private v15World(): WorldV15State {
    const v15 = this.state.v15;
    if (!v15) {
      throw new Error('v15 state is required by world-rules 0.3.15.');
    }
    return v15;
  }

  private syncV15StoredResourceProjection(): void {
    const resources = this.v15World().renewableResources;
    const localResources = Object.values(
      this.state.v16?.settlementResourcesById ?? {},
    ).filter((local) => this.state.settlements[local.settlementId] !== undefined);
    if (localResources.length > 0) {
      const settlementCounts = this.residentCountByHomeSettlement ?? (() => {
        const counts = new Map<string, number>();
        for (const resident of Object.values(this.state.agents)) {
          if (!resident.life.alive) continue;
          const settlementId = this.homeSettlementId(resident);
          if (!settlementId) continue;
          counts.set(settlementId, (counts.get(settlementId) ?? 0) + 1);
        }
        return counts;
      })();
      const weighted = localResources.map((local) => ({
        local,
        weight: Math.max(1, settlementCounts.get(local.settlementId) ?? 0),
      }));
      const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
      resources.storedResources = clamp01(
        weighted.reduce(
          (sum, item) => sum + item.local.storedResources * item.weight,
          0,
        ) / totalWeight,
      );
      resources.renewableBase = clamp01(
        weighted.reduce(
          (sum, item) => sum + item.local.renewableBase * item.weight,
          0,
        ) / totalWeight,
      );
      resources.fertility = clamp01(
        weighted.reduce(
          (sum, item) => sum + item.local.fertility * item.weight,
          0,
        ) / totalWeight,
      );
      resources.lastRecoveredWorldMinute = Math.min(
        ...localResources.map((local) => local.lastRecoveredWorldMinute),
      );
    } else {
      resources.storedResources = clamp01(resources.storedResources);
    }
    this.state.environment.resourcePool = resources.storedResources;
  }

  private refreshV15StoredResourceProjection(): void {
    if (this.deferResourceProjection) {
      this.resourceProjectionDirty = true;
      return;
    }
    this.syncV15StoredResourceProjection();
  }

  private addV15StoredResources(amount: number, settlementId?: string): void {
    if (!Number.isFinite(amount)) return;
    const localResources = this.state.v16?.settlementResourcesById;
    if (localResources && Object.keys(localResources).length > 0) {
      const targets = settlementId
        ? [localResources[settlementId]].filter(
            (value): value is NonNullable<typeof value> => value !== undefined,
          )
        : Object.values(localResources);
      for (const local of targets) {
        local.storedResources = clamp01(local.storedResources + amount);
      }
      this.refreshV15StoredResourceProjection();
      return;
    }
    const resources = this.v15World().renewableResources;
    resources.storedResources = clamp01(resources.storedResources + amount);
    this.refreshV15StoredResourceProjection();
  }

  private damageRenewableBase(amount: number, settlementId?: string): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const localResources = this.state.v16?.settlementResourcesById;
    if (localResources && Object.keys(localResources).length > 0) {
      const targets = settlementId
        ? [localResources[settlementId]].filter(
            (value): value is NonNullable<typeof value> => value !== undefined,
          )
        : Object.values(localResources);
      for (const local of targets) {
        local.renewableBase = clamp01(local.renewableBase - amount);
      }
      this.refreshV15StoredResourceProjection();
      return;
    }
    const resources = this.v15World().renewableResources;
    resources.renewableBase = clamp01(resources.renewableBase - amount);
    this.refreshV15StoredResourceProjection();
  }

  private supportV15RenewableBase(amount: number, settlementId?: string): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const localResources = this.state.v16?.settlementResourcesById;
    if (localResources && Object.keys(localResources).length > 0) {
      const targets = settlementId
        ? [localResources[settlementId]].filter(
            (value): value is NonNullable<typeof value> => value !== undefined,
          )
        : Object.values(localResources);
      for (const local of targets) {
        local.renewableBase = clamp01(local.renewableBase + amount);
        local.fertility = clamp01(local.fertility + amount * 0.28);
      }
      this.refreshV15StoredResourceProjection();
      return;
    }
    const resources = this.v15World().renewableResources;
    resources.renewableBase = clamp01(resources.renewableBase + amount);
    resources.fertility = clamp01(resources.fertility + amount * 0.28);
    this.refreshV15StoredResourceProjection();
  }

  private settlementResourcesForAgent(agent: Readonly<AgentState>) {
    const settlementId = this.homeSettlementId(agent);
    return settlementId
      ? ensureSettlementResourcesV16(this.state, settlementId)
      : this.v15World().renewableResources;
  }

  private settlementEconomyForAgent(agent: Readonly<AgentState>) {
    const settlementId = this.homeSettlementId(agent);
    return settlementId
      ? ensureSettlementEconomyV16(this.state, settlementId)
      : undefined;
  }

  private advanceV15RenewableResources(elapsedWorldMinutes: number): void {
    const v15 = this.v15World();
    const currentWorldMinutes = this.state.calendar.elapsedWorldMinutes;
    const localResources = this.state.v16?.settlementResourcesById;
    if (localResources && Object.keys(localResources).length > 0) {
      const resourceRegenerationLaw = this.lawValue('resource_regeneration', 1);
      for (const [settlementId, resources] of Object.entries(localResources)) {
        const elapsedSinceRecovery = Math.max(
          0,
          currentWorldMinutes - resources.lastRecoveredWorldMinute,
        );
        const cachedKnowledge =
          this.agricultureKnowledgeByHomeSettlement?.get(settlementId);
        const meanAgricultureKnowledge = cachedKnowledge
          ? cachedKnowledge.sum / Math.max(1, cachedKnowledge.count)
          : 0;
        const priorRenewableBase = resources.renewableBase;
        const priorFertility = resources.fertility;
        const recovered = recoverRenewableBase(
          resources,
          elapsedSinceRecovery,
          meanAgricultureKnowledge,
        );
        resources.renewableBase = clamp01(
          priorRenewableBase +
            Math.max(0, recovered.renewableBase - priorRenewableBase) *
              resourceRegenerationLaw,
        );
        resources.fertility = clamp01(
          priorFertility +
            Math.max(0, recovered.fertility - priorFertility) *
              resourceRegenerationLaw,
        );
        resources.lastRecoveredWorldMinute = currentWorldMinutes;
      }
      this.refreshV15StoredResourceProjection();
      return;
    }
    const resources = v15.renewableResources;
    const elapsedSinceRecovery = Math.max(
      0,
      currentWorldMinutes - resources.lastRecoveredWorldMinute,
    );
    const livingKnowledge = Object.values(this.state.agents)
      .filter((agent) => agent.life.alive)
      .map((agent) => {
        ensureAgentV15State(this.state, agent);
        return v15.knowledgeByAgentId[agent.id].agriculture;
      });
    const meanAgricultureKnowledge =
      livingKnowledge.length > 0
        ? livingKnowledge.reduce((sum, value) => sum + value, 0) /
          livingKnowledge.length
        : 0;

    const priorRenewableBase = resources.renewableBase;
    const priorFertility = resources.fertility;
    const recovered = recoverRenewableBase(
      resources,
      elapsedSinceRecovery,
      meanAgricultureKnowledge,
    );
    const resourceRegenerationLaw = this.lawValue('resource_regeneration', 1);
    resources.renewableBase = clamp01(
      priorRenewableBase +
        Math.max(0, recovered.renewableBase - priorRenewableBase) *
          resourceRegenerationLaw,
    );
    resources.fertility = clamp01(
      priorFertility +
        Math.max(0, recovered.fertility - priorFertility) *
          resourceRegenerationLaw,
    );
    resources.lastRecoveredWorldMinute = currentWorldMinutes;
    this.refreshV15StoredResourceProjection();
  }

  private v15LearningPerson(agent: AgentState): LearningPerson {
    ensureAgentV15State(this.state, agent);
    const profile = this.v15World().knowledgeByAgentId[agent.id];
    return {
      id: agent.id,
      generation: agent.life.generation,
      ageYears: agent.life.ageYears,
      aptitude: profile.aptitude,
      knowledge: profile,
    };
  }

  private v15Instructor(agent: AgentState): OrdinaryInstructor {
    const learner = this.v15LearningPerson(agent);
    return {
      ...learner,
      ordinaryResident: true,
    };
  }

  private v15LearningDomainForAction(
    agent: Readonly<AgentState>,
    action: AgentActionKind | undefined,
  ): { domain: GenesisDomain; challenge: number } | undefined {
    switch (action) {
      case 'gather':
        return { domain: 'agriculture', challenge: 0.48 };
      case 'work':
        return agent.lastWorkKind === 'construction'
          ? { domain: 'construction', challenge: 0.58 }
          : undefined;
      case 'socialize':
      case 'help':
      case 'bond':
        return { domain: 'household', challenge: 0.42 };
      case 'hunt':
        return { domain: 'survival', challenge: 0.88 };
      case 'explore':
      case 'walk':
        return { domain: 'survival', challenge: 0.58 };
      default:
        return undefined;
    }
  }

  private advanceV15LearningFromLivedAction(
    agent: AgentState,
    allAgents: AgentState[],
    now: number,
  ): void {
    const livedAction = agent.lastAction;
    if (livedAction) {
      const primer = studyFoundingPrimerV21(this.state, agent, livedAction);
      const primerKnowledge =
        this.state.v21?.appliedKnowledgeByAgentId[agent.id];
      if (
        primer.studied &&
        (primer.firstLesson ||
          (primerKnowledge?.foundingPrimerLessons ?? 0) % 12 === 0)
      ) {
        this.stageEvent({
          eventId: this.nextId('founding-primer'),
          worldId: this.state.id,
          kind: 'agent.education.founding_primer_studied',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: agent.id,
            ageYears: agent.life.ageYears,
            lesson: primer.lesson,
            lessonCount: primerKnowledge?.foundingPrimerLessons ?? 0,
            actionKeptVoluntary: true,
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      }
    }
    const mapped = this.v15LearningDomainForAction(agent, agent.lastAction);
    if (!mapped) return;

    const policy = learningStagePolicyV15(agent.life.ageYears);
    if (!policy.canPracticeSafely) return;

    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const v15 = this.v15World();
    const profile = v15.knowledgeByAgentId[agent.id];
    const learner = this.v15LearningPerson(agent);
    const practiceId = `practice:${this.state.id}:${++v15.learningSequence}`;
    const practice = applyIndependentPractice(learner, {
      practiceId,
      personId: agent.id,
      domain: mapped.domain,
      worldMinutes,
      durationWorldMinutes: 240 * Math.max(0.35, policy.practiceEfficiencyMultiplier),
      activityVerified: true,
      challenge: mapped.challenge,
    });
    profile.verifiedPracticeSessions += 1;
    profile.lastLearningWorldMinute = worldMinutes;

    let lessonSource: 'genesis' | 'ordinary' | undefined;
    let instructorId: string | undefined;
    let lessonGained = 0;

    // Genesis is a temporary bootstrap mentor, never population. A lesson is
    // attached to a real activity and remains bounded by the same learning
    // mechanics used for ordinary teachers.
    const genesisSettlementId = this.homeSettlementId(agent);
    const genesis = genesisBootstrapAvailableToV15(agent.race, genesisSettlementId)
      ? v15.genesisTeachers.find(
          (teacher) =>
            teacher.domain === mapped.domain &&
            isGenesisTeacherActive(teacher, worldMinutes),
        )
      : undefined;
    if (
      genesis &&
      policy.canReceiveStructuredLesson &&
      this.rng.next() < 0.32 + agent.personality.curiosity * 0.16
    ) {
      const lessonId = `lesson:${this.state.id}:${++v15.learningSequence}`;
      const result = applyGenesisLesson(
        genesis,
        learner,
        genesisReferenceKnowledgeV18(mapped.domain),
        {
          lessonId,
          domain: mapped.domain,
          instructorId: genesis.id,
          learnerId: agent.id,
          worldMinutes,
          durationWorldMinutes: 240,
          activityVerified: true,
        },
      );
      if (result.gained > 0) {
        genesis.teachingHistoryIds.push(lessonId);
        lessonSource = 'genesis';
        instructorId = genesis.id;
        lessonGained = result.gained;
      }
    }

    // After Genesis (or when no Genesis session happens), knowledge may move
    // socially between ordinary residents. The teacher retains agency: being
    // knowledgeable and nearby is not enough; a separate willingness draw is
    // required before a real lesson occurs.
    if (!lessonSource && policy.canReceiveStructuredLesson) {
      const candidates = this.shuffled(
        allAgents.filter((candidate) => {
          if (
            candidate.id === agent.id ||
            !candidate.life.alive ||
            candidate.locationId !== agent.locationId
          ) {
            return false;
          }
          const teacherPolicy = learningStagePolicyV15(candidate.life.ageYears);
          if (!teacherPolicy.mayTeachYoungerResidents) return false;
          ensureAgentV15State(this.state, candidate);
          const teacherKnowledge =
            v15.knowledgeByAgentId[candidate.id][mapped.domain];
          return teacherKnowledge > profile[mapped.domain] + 0.025;
        }),
      );

      for (const candidate of candidates) {
        const relationship = this.state.relationships[
          relationshipKey(agent.id, candidate.id)
        ];
        const willingness = clamp01(
          0.08 +
            candidate.personality.generosity * 0.3 +
            candidate.personality.sociability * 0.18 +
            (relationship?.trust ?? 0.2) * 0.18 +
            (relationship?.affinity ?? 0.2) * 0.1 -
            candidate.stress * 0.12,
        );
        if (this.rng.next() >= willingness) continue;

        const lessonId = `lesson:${this.state.id}:${++v15.learningSequence}`;
        const result = applyOrdinaryLesson(
          this.v15Instructor(candidate),
          learner,
          {
            lessonId,
            domain: mapped.domain,
            instructorId: candidate.id,
            learnerId: agent.id,
            worldMinutes,
            durationWorldMinutes: 240,
            activityVerified: true,
          },
        );
        if (result.gained > 0) {
          lessonSource = 'ordinary';
          instructorId = candidate.id;
          lessonGained = result.gained;
          // A teacher livelihood requires a verified lesson that transferred
          // knowledge. Merely chatting about learning is not teaching work.
          recordLivelihoodPracticeV18(this.state, candidate, {
            action: 'socialize',
            placeId: agent.locationId,
            choiceRoll: this.rng.next(),
            professionHint: 'teacher',
            amount: 0.25,
          });
          recordResidentContactEvidenceV16(
            this.state,
            candidate,
            agent,
            'teaching',
            0.72,
          );
          recordSettlementPracticeEvidenceV16(
            this.state,
            this.state.places[agent.locationId]?.settlementId,
            'teaching',
          );
        }
        break;
      }
    }

    if (lessonGained > 0 && mapped.domain === 'survival' &&
        (livedAction === 'explore' || livedAction === 'walk') && !agent.movement) {
      const teacher = instructorId ? this.state.agents[instructorId] : undefined;
      const practicalCeiling = lessonSource === 'genesis' ? 0.8 : teacher?.skills.exploration ?? 0;
      const gained = Math.min(0.006, lessonGained * 0.5,
        Math.max(0, practicalCeiling - agent.skills.exploration));
      if (gained > 0) {
        agent.skills.exploration = clamp01(agent.skills.exploration + gained);
        explorationEvidence(this.state, agent).practicalLessons += 1;
        const livelihood = ensureLivelihoodV18(this.state, agent);
        // mentorIds names resident entities; Genesis is recorded by the lesson receipt.
        if (teacher && instructorId && !livelihood.mentorIds.includes(instructorId)) {
          livelihood.mentorIds = [...livelihood.mentorIds, instructorId].slice(-32);
        }
      }
    }

    if (practice.gained > 0 || lessonGained > 0) {
      profile.verifiedLearningSessions += lessonGained > 0 ? 1 : 0;
      // Knowledge state and counters retain every verified session. The
      // append-only journal retains Genesis lessons, early formative evidence
      // and a stable long-term sample instead of duplicating tens of thousands
      // of tiny practice deltas per decade in a large civilization.
      const preserveLearningEvent =
        lessonSource === 'genesis' ||
        isStableRoutineEvidenceSample(`${agent.id}:${mapped.domain}`, now);
      if (preserveLearningEvent) this.stageEvent({
        eventId: this.nextId('learning'),
        worldId: this.state.id,
        kind: 'agent.learning.progressed',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          domain: mapped.domain,
          worldMinutes,
          practiceGained: practice.gained,
          lessonGained,
          lessonSource: lessonSource ?? 'none',
          instructorId: instructorId ?? null,
          knowledge: profile[mapped.domain],
          ...(lessonSource === 'genesis'
            ? {
                foundationVersion: HUMAN_KNOWLEDGE_FOUNDATION_VERSION_V18,
                curriculumTopics: [
                  ...HUMAN_KNOWLEDGE_CURRICULUM_V18[mapped.domain].topics,
                ],
              }
            : {}),
        },
      });
    }
  }

  private v15WorkshopPerson(agent: AgentState): WorkshopPersonV15 {
    ensureAgentV15State(this.state, agent);
    const profile = this.v15World().smithingByAgentId[agent.id];
    return {
      id: agent.id,
      ageYears: agent.life.ageYears,
      alive: agent.life.alive,
      craftSkill: agent.skills.craft,
      curiosity: agent.personality.curiosity,
      knowledge: profile.knowledge,
    };
  }

  private v15WeaponForAgent(agent: AgentState): HuntingWeaponV15 {
    ensureAgentV15State(this.state, agent);
    const v15 = this.v15World();
    const equipment = v15.equipmentByAgentId[agent.id];
    const item = equipment.weaponItemId
      ? v15.items[equipment.weaponItemId]
      : undefined;
    if (!item || item.kind !== 'weapon' || !item.weaponKind) {
      return { ...HUNTING_WEAPON_BASELINES_V15.none };
    }
    const baseline = HUNTING_WEAPON_BASELINES_V15[item.weaponKind];
    return {
      ...baseline,
      effectiveness: clamp01(item.effectiveness),
      reliability: clamp01(item.reliability),
    };
  }

  private tryEquipAvailableV15Weapon(agent: AgentState, now: number): boolean {
    ensureAgentV15State(this.state, agent);
    const v15 = this.v15World();
    const current = this.v15WeaponForAgent(agent);
    const candidate = Object.values(v15.items)
      .filter(
        (item) =>
          item.kind === 'weapon' &&
          item.weaponKind !== undefined &&
          (item.ownerAgentId === agent.id ||
            (item.ownerAgentId === undefined &&
              item.locationId === agent.locationId)),
      )
      .sort((a, b) => b.effectiveness - a.effectiveness)[0];
    if (!candidate || candidate.effectiveness <= current.effectiveness + 0.005) {
      return current.kind !== 'none';
    }
    candidate.ownerAgentId = agent.id;
    delete candidate.locationId;
    v15.equipmentByAgentId[agent.id].weaponItemId = candidate.id;
    this.stageEvent({
      eventId: this.nextId('equipment'),
      worldId: this.state.id,
      kind: 'agent.weapon.equipped',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        itemId: candidate.id,
        weaponKind: candidate.weaponKind ?? 'unknown',
        effectiveness: candidate.effectiveness,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
      },
    });
    return true;
  }

  private v15HasMetalSource(): boolean {
    return Object.values(this.state.places).some(
      (place) =>
        (place.discoveredAt !== undefined || place.settlementId !== undefined) &&
        ['mountains', 'ancient_ruins'].includes(place.biome),
    );
  }

  private v15HasFuelSource(): boolean {
    return Object.values(this.state.places).some(
      (place) =>
        (place.discoveredAt !== undefined || place.settlementId !== undefined) &&
        ['forest', 'plains', 'settlement'].includes(place.biome),
    );
  }

  private advanceV15SmithingFromWork(agent: AgentState, now: number): void {
    if (agent.life.ageYears < 12 || !agent.life.alive) return;
    ensureAgentV15State(this.state, agent);
    const v15 = this.v15World();
    const profile = v15.smithingByAgentId[agent.id];
    profile.verifiedWorkshopSessions += 1;
    profile.lastWorkshopWorldMinute = this.state.calendar.elapsedWorldMinutes;

    // Independent workshop practice: small bounded gains. This is not a
    // technology injection and remains available after the founding smith dies.
    const practiceScale = 0.55 + agent.personality.curiosity * 0.45;
    profile.knowledge.stoneToolmaking = clamp01(
      profile.knowledge.stoneToolmaking + 0.0024 * practiceScale,
    );
    profile.knowledge.weaponcraft = clamp01(
      profile.knowledge.weaponcraft + 0.0018 * practiceScale,
    );
    profile.knowledge.materialKnowledge = clamp01(
      profile.knowledge.materialKnowledge + 0.0017 * practiceScale,
    );
    if (this.v15HasMetalSource()) {
      profile.knowledge.primitiveSmithing = clamp01(
        profile.knowledge.primitiveSmithing + 0.0016 * practiceScale,
      );
      profile.knowledge.heatWorking = clamp01(
        profile.knowledge.heatWorking + 0.0014 * practiceScale,
      );
    }

    const learner = this.v15WorkshopPerson(agent);
    const teacherCandidates = this.shuffled(
      this.agentsAtLocation(agent.locationId).filter((candidate) => {
        if (
          candidate.id === agent.id ||
          !candidate.life.alive ||
          candidate.locationId !== agent.locationId ||
          candidate.life.ageYears < 18
        ) {
          return false;
        }
        ensureAgentV15State(this.state, candidate);
        const teacher = v15.smithingByAgentId[candidate.id];
        const teacherCore =
          teacher.knowledge.stoneToolmaking +
          teacher.knowledge.primitiveSmithing +
          teacher.knowledge.weaponcraft +
          teacher.knowledge.materialKnowledge;
        const learnerCore =
          profile.knowledge.stoneToolmaking +
          profile.knowledge.primitiveSmithing +
          profile.knowledge.weaponcraft +
          profile.knowledge.materialKnowledge;
        return teacherCore > learnerCore + 0.08;
      }),
    );

    for (const teacherAgent of teacherCandidates) {
      const relationship = this.state.relationships[
        relationshipKey(agent.id, teacherAgent.id)
      ];
      const willingness = clamp01(
        0.09 +
          teacherAgent.personality.generosity * 0.32 +
          teacherAgent.personality.sociability * 0.16 +
          (relationship?.trust ?? 0.2) * 0.18 -
          teacherAgent.stress * 0.1,
      );
      if (this.rng.next() >= willingness) continue;
      const beforeCraft = learner.craftSkill;
      const lesson = applySmithingWorkshopLessonV15(
        this.v15WorkshopPerson(teacherAgent),
        learner,
        {
          sessionId: `smithing-lesson:${this.state.id}:${++v15.learningSequence}`,
          instructorId: teacherAgent.id,
          learnerId: agent.id,
          worldMinutes: this.state.calendar.elapsedWorldMinutes,
          durationWorldMinutes: 240,
          activityVerified: true,
          demonstratedWeapon:
            this.v15WeaponForAgent(teacherAgent).kind === 'none'
              ? undefined
              : (this.v15WeaponForAgent(teacherAgent).kind as V15WeaponKind),
        },
      );
      agent.skills.craft = clamp01(Math.max(agent.skills.craft, learner.craftSkill));
      if (lesson.gainedTotal > 0 || learner.craftSkill > beforeCraft) {
        this.stageEvent({
          eventId: this.nextId('smithing-lesson'),
          worldId: this.state.id,
          kind: 'agent.smithing.learned',
          source: 'agent',
          occurredAt: now,
          payload: {
            learnerId: agent.id,
            instructorId: teacherAgent.id,
            gainedTotal: lesson.gainedTotal,
            craftSkill: agent.skills.craft,
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      }
      break;
    }

    const stored = this.settlementResourcesForAgent(agent).storedResources;
    const economy = this.settlementEconomyForAgent(agent);
    const homeSettlementId = this.homeSettlementId(agent);
    const homeSettlement = homeSettlementId
      ? this.state.settlements[homeSettlementId]
      : undefined;
    const settlementResidents = homeSettlementId
      ? this.residentCountByHomeSettlement?.get(homeSettlementId) ??
        Object.values(this.state.agents).filter(candidate => candidate.life.alive &&
          this.homeSettlementId(candidate) === homeSettlementId).length
      : 0;
    const settlementHomeCapacity = homeSettlement
      ? homeSettlement.memberPlaceIds
          .map((placeId) => this.state.places[placeId])
          .filter((place): place is WorldPlace => place?.kind === 'home')
          .reduce((sum, place) => sum + place.capacity, 0)
      : 0;
    const housingMaterialsReserved = Boolean(
      economy &&
        homeSettlement &&
        settlementResidents + 10 > settlementHomeCapacity,
    );
    const reservedWood = housingMaterialsReserved
      ? Math.min(0.65, economy?.stocks.wood ?? 0)
      : 0;
    const reservedStone = housingMaterialsReserved
      ? Math.min(0.35, economy?.stocks.stone ?? 0)
      : 0;
    const craftResources = economy
      ? {
          wood: Math.max(0, economy.stocks.wood - reservedWood),
          stone: Math.max(0, economy.stocks.stone - reservedStone),
          metal: economy.stocks.metal,
          fuel: economy.stocks.fuel,
        }
      : { wood: stored, stone: stored, metal: stored, fuel: stored };
    const hasMetal = this.v15HasMetalSource() && craftResources.metal > 0;
    const hasFuel = this.v15HasFuelSource() && craftResources.fuel > 0;
    const recipeOrder = [
      PRIMITIVE_WEAPON_RECIPES_V15.forged_spear,
      PRIMITIVE_WEAPON_RECIPES_V15.crude_metal_spear,
      PRIMITIVE_WEAPON_RECIPES_V15.crude_metal_knife,
      PRIMITIVE_WEAPON_RECIPES_V15.stone_spear,
      PRIMITIVE_WEAPON_RECIPES_V15.stone_knife,
    ];
    const recipe = recipeOrder.find((candidate) => {
      if (
        (candidate.resourceCost.metal > 0 && !hasMetal) ||
        (candidate.resourceCost.fuel > 0 && !hasFuel) ||
        agent.skills.craft < candidate.minimumCraftSkill
      ) {
        return false;
      }
      return Object.entries(candidate.requiredKnowledge).every(
        ([key, threshold]) =>
          profile.knowledge[key as keyof typeof profile.knowledge] >=
          (threshold ?? 0),
      );
    });

    const currentWeapon = this.v15WeaponForAgent(agent);
    const craftInterest = clamp01(
      (currentWeapon.kind === 'none' ? 0.42 : 0.08) +
        agent.personality.curiosity * 0.15 +
        agent.personality.diligence * 0.12,
    );
    if (recipe && this.rng.next() < craftInterest) {
      const itemId = `weapon:${this.state.id}:${++v15.itemSequence}`;
      const result = attemptWeaponCraftV15(
        this.v15WorkshopPerson(agent),
        recipe,
        craftResources,
        this.state.calendar.elapsedWorldMinutes,
        this.rng.next(),
        itemId,
      );
      const materialsConsumed =
        result.success || result.reason === 'craft_failure';
      if (materialsConsumed) {
        const aggregateCost =
          (recipe.resourceCost.wood +
            recipe.resourceCost.stone +
            recipe.resourceCost.metal +
            recipe.resourceCost.fuel) *
          0.18;
        this.addV15StoredResources(-aggregateCost, this.homeSettlementId(agent));
        if (economy) {
          economy.stocks.wood = result.resourcesAfter.wood + reservedWood;
          economy.stocks.stone = result.resourcesAfter.stone + reservedStone;
          economy.stocks.metal = result.resourcesAfter.metal;
          economy.stocks.fuel = result.resourcesAfter.fuel;
        }
      }

      if (result.success && result.weapon) {
        profile.successfulCraftAttempts += 1;
        const matchingInnovations = Object.values(v15.smithingInnovations).filter(
          (idea) => idea.parentWeaponKind === result.weapon!.kind,
        );
        const innovationEffect = matchingInnovations.reduce(
          (maximum, idea) => Math.max(maximum, idea.effectivenessDelta),
          0,
        );
        const innovationReliability = matchingInnovations.reduce(
          (maximum, idea) => Math.max(maximum, idea.reliabilityDelta),
          0,
        );
        const nameByKind: Record<V15WeaponKind, string> = {
          stone_knife: 'Каменный нож',
          stone_spear: 'Каменное копьё',
          crude_metal_knife: 'Примитивный металлический нож',
          crude_metal_spear: 'Примитивное металлическое копьё',
          forged_spear: 'Кованое копьё',
        };
        const shouldEquip =
          currentWeapon.kind === 'none' ||
          result.weapon.effectiveness + innovationEffect >
            currentWeapon.effectiveness + 0.01;
        v15.items[itemId] = {
          id: itemId,
          kind: 'weapon',
          weaponKind: result.weapon.kind,
          name: nameByKind[result.weapon.kind],
          createdByAgentId: agent.id,
          createdWorldMinute: this.state.calendar.elapsedWorldMinutes,
          ...(shouldEquip
            ? { ownerAgentId: agent.id }
            : { locationId: agent.locationId }),
          quality: result.weapon.quality,
          effectiveness: clamp01(
            result.weapon.effectiveness + innovationEffect,
          ),
          reliability: clamp01(
            result.weapon.reliability + innovationReliability,
          ),
          description:
            matchingInnovations.length > 0
              ? 'Оружие изготовлено жителем с применением собственного накопленного улучшения.'
              : 'Оружие изготовлено обычным жителем в мастерской.',
        };
        if (shouldEquip) {
          v15.equipmentByAgentId[agent.id].weaponItemId = itemId;
        }
        recordLivelihoodPracticeV18(this.state, agent, {
          action: 'work',
          placeId: agent.locationId,
          choiceRoll: this.rng.next(),
          professionHint: 'smith',
          amount: 1.5,
        });
        this.stageEvent({
          eventId: this.nextId('weapon-crafted'),
          worldId: this.state.id,
          kind: 'world.item.weapon_crafted',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: agent.id,
            itemId,
            weaponKind: result.weapon.kind,
            effectiveness: v15.items[itemId].effectiveness,
            reliability: v15.items[itemId].reliability,
            equipped: shouldEquip,
            materialCost: { ...recipe.resourceCost },
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      } else if (result.reason === 'craft_failure') {
        profile.failedCraftAttempts += 1;
        this.stageEvent({
          eventId: this.nextId('weapon-craft-failed'),
          worldId: this.state.id,
          kind: 'agent.smithing.craft_failed',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: agent.id,
            weaponKind: recipe.kind,
            failedCraftAttempts: profile.failedCraftAttempts,
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      }
    }

    if (profile.verifiedWorkshopSessions > 0 && profile.verifiedWorkshopSessions % 12 === 0) {
      const equippedItemId = v15.equipmentByAgentId[agent.id].weaponItemId;
      const parentKind =
        (equippedItemId && v15.items[equippedItemId]?.weaponKind) ||
        ('stone_spear' as const);
      const ideaId = `smithing-idea:${this.state.id}:${++v15.itemSequence}`;
      const innovation = attemptSmithingInnovationV15(
        {
          resident: this.v15WorkshopPerson(agent),
          verifiedWorkshopSessions: profile.verifiedWorkshopSessions,
          failedCraftAttempts: profile.failedCraftAttempts,
          successfulCraftAttempts: profile.successfulCraftAttempts,
          observedWeaponProblems: profile.observedWeaponProblems,
          worldMinutes: this.state.calendar.elapsedWorldMinutes,
        },
        parentKind,
        this.rng.next() * Math.max(0.65, 1 -
          giftMasteryV20(this.state, agent.id, 'discovery_spark') * 0.22 -
          giftMasteryV20(this.state, agent.id, 'genius_inventor') * 0.18) *
          (1 + burdenIntensityV22(this.state, agent.id, 'misfortune') * 0.16),
        ideaId,
      );
      if (innovation.succeeded && innovation.idea) {
        v15.smithingInnovations[ideaId] = {
          ideaId,
          inventorAgentId: agent.id,
          createdWorldMinute: this.state.calendar.elapsedWorldMinutes,
          parentWeaponKind: innovation.idea.parentWeaponKind,
          effectivenessDelta: innovation.idea.effectivenessDelta,
          reliabilityDelta: innovation.idea.reliabilityDelta,
          description: innovation.idea.description,
        };
        this.stageEvent({
          eventId: this.nextId('smithing-innovation'),
          worldId: this.state.id,
          kind: 'agent.smithing.innovation_created',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: agent.id,
            ideaId,
            parentWeaponKind: innovation.idea.parentWeaponKind,
            effectivenessDelta: innovation.idea.effectivenessDelta,
            reliabilityDelta: innovation.idea.reliabilityDelta,
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      }
    }
  }

  private stepAgent(
    agent: AgentState,
    allAgents: AgentState[],
    environment: WorldEnvironment,
    now: number,
  ): void {
    if (!canResidentAct(agent)) return;
    // The body, not Cardinal, can suspend cognition when physically exhausted.
    if (advanceBodySleepV21(this.state, agent)) return;
    // Territorial danger is evaluated while the resident is physically
    // present, before a new route can make that presence disappear. A person
    // travelling between places is not treated as having reached the target;
    // once arrival clears movement, local monsters may react on sight.
    if (!agent.movement) {
      this.advanceMonsterEncounter(agent, environment, now);
      if (!agent.life.alive) return;
    }
    const giftBefore = giftLearningSnapshotV20(this.state, agent);
    const ageAllowedActions = allowedActionsForAgeV16(
      agent.race ?? 'human',
      agent.life.ageYears,
    );
    if (
      agent.movement &&
      !ageAllowedActions.has(agent.movement.purpose)
    ) {
      // A migrated young child may have an old strenuous route in progress.
      // Cancel the purpose and begin a physical return home; do not let the
      // child finish gathering/work/hunting merely because an older build
      // already wrote the route.
      agent.movement = undefined;
      agent.plan = undefined;
      this.performRest(agent, now);
      this.advanceMind(agent);
      return;
    }
    if (agent.movement) {
      // Travelling no longer suppresses agency for an arbitrary number of
      // quanta. A resident may pause the current leg to recover; critical
      // exhaustion is a physical limit, while ordinary pauses remain
      // personality-sensitive and probabilistic. The route itself is kept, so
      // pausing does not teleport or silently cancel the chosen destination.
      const travelRecoveryPressure = clamp01(
        Math.max(0, 0.34 - agent.energy) * 1.8 +
          Math.max(0, agent.stress - 0.62) * 0.9 +
          Math.max(0, 0.16 - agent.resources) * 1.1,
      );
      const mandatoryPhysicalPause = agent.energy < 0.08;
      const voluntaryPauseChance = Math.max(
        0,
        Math.min(
          0.88,
          travelRecoveryPressure *
            (0.78 + (1 - agent.personality.riskTolerance) * 0.22),
        ),
      );
      if (mandatoryPhysicalPause || this.rng.next() < voluntaryPauseChance) {
        this.performTravelPause(agent, now);
        this.advanceMind(agent);
        return;
      }
      // Position already advanced from canonical world minutes before this
      // semantic boundary. A traveller who has not arrived keeps the route and
      // spends this decision opportunity travelling; no extra six-day leap is
      // manufactured here.
      this.advanceMind(agent);
      return;
    }
    observeLocalPlacesV20(this.state, agent);
    consultSettlementMap(this.state, agent);
    this.updateGoal(agent, now);

    const localAgents = this.agentsAtLocation(agent.locationId);
    const decision = this.chooseAction(agent, localAgents, environment);
    const reflection = residentDecisionReflection(agent, decision);
    agent.lastDecision = {
      action: decision.action,
      dominantAction: decision.dominantAction,
      consideredActionCount: decision.consideredActionCount,
      openness: decision.openness,
      chosenAt: now,
      ...reflection,
    };
    const action = decision.action;
    beginLearningAttempt(this.state, agent, action);
    switch (action) {
      case 'rest':
        this.performRest(agent, now);
        break;
      case 'relax':
        this.performRelax(agent, now);
        break;
      case 'walk':
        this.performWalk(agent, now);
        break;
      case 'gather':
        this.performGather(agent, now);
        break;
      case 'hunt':
        this.performHunt(
          agent,
          this.chooseHuntTarget(agent),
          environment,
          now,
        );
        break;
      case 'work':
        this.performWork(agent, now);
        break;
      case 'socialize': {
        const others = localAgents.filter((other) => other.id !== agent.id);
        if (others.length === 0) {
          // The resident already chose to seek company. Being alone at home
          // leads toward the public meeting place instead of silently turning
          // that choice into another day indoors.
          this.performBlockedSocialize(agent, now);
        } else {
          const accessChance = clamp01(
            0.12 +
              environment.socialOpportunity * 0.76 +
              agent.personality.sociability * 0.12,
          );
          if (this.rng.next() > accessChance) {
            this.performBlockedSocialize(agent, now);
          } else {
            const target = this.chooseSocialTarget(agent, others);
            if (target) {
              this.interact(agent, target, now);
            } else {
              if (ageAllowedActions.has('reflect')) {
                this.performBlockedSocialize(agent, now);
              } else {
                this.performRest(agent, now);
              }
            }
          }
        }
        break;
      }
      case 'help': {
        const localTarget = this.chooseHelpTarget(
          agent,
          this.agentsAtLocation(agent.locationId),
        );
        const supervision = this.youngChildNeedingSupervision(agent);
        const supervisedChild = supervision?.child;
        const target = localTarget ?? supervisedChild;
        if (!target) {
          if (ageAllowedActions.has('work')) this.performWork(agent, now);
          else if (ageAllowedActions.has('relax')) this.performRelax(agent, now);
          else this.performRest(agent, now);
        } else {
          if (target.locationId !== agent.locationId) {
            // Parents do not receive a child's live coordinates. They can go
            // only to the last place where the child was physically observed.
            const lastKnownPlaceId = localTarget
              ? target.locationId
              : supervision?.lastKnownPlaceId;
            if (
              lastKnownPlaceId &&
              (agent.knownPlaceIds ?? []).includes(lastKnownPlaceId)
            ) {
              this.travelBeforeAction(agent, lastKnownPlaceId, 'help', now);
            } else {
              this.performReflect(agent, now);
            }
            break;
          }
          this.performHelp(agent, target, now);
        }
        break;
      }
      case 'explore':
        this.performExplore(agent, now);
        break;
      case 'reflect':
        this.performReflect(agent, now);
        break;
      case 'bond': {
        const familyIntent = this.familyRendezvousForAgent(agent.id);
        const intendedPartner = familyIntent
          ? this.familyPartnerFor(familyIntent, agent.id)
          : undefined;
        if (
          familyIntent &&
          intendedPartner?.life.alive &&
          !intendedPartner.movement &&
          intendedPartner.locationId === agent.locationId &&
          !agent.movement
        ) {
          this.performBond(agent, intendedPartner, now);
          break;
        }
        if (
          familyIntent &&
          agent.locationId !== familyIntent.meetingPlaceId &&
          (agent.knownPlaceIds ?? []).includes(familyIntent.meetingPlaceId)
        ) {
          if (
            this.travelBeforeAction(
              agent,
              familyIntent.meetingPlaceId,
              'bond',
              now,
            )
          ) {
            break;
          }
        }
        if (
          familyIntent &&
          agent.locationId === familyIntent.meetingPlaceId &&
          (!intendedPartner ||
            intendedPartner.movement ||
            intendedPartner.locationId !== agent.locationId)
        ) {
          // The resident already chose bond this quantum and reached the
          // remembered rendezvous. Waiting here executes that voluntary
          // choice instead of immediately walking away to reflect elsewhere.
          // The next quantum remains a fresh autonomous decision.
          agent.energy = clamp01(agent.energy + 0.004);
          agent.stress = clamp01(agent.stress - 0.006);
          agent.lastAction = 'bond';
          break;
        }
        const target = this.chooseBondTarget(
          agent,
          this.agentsAtLocation(agent.locationId),
        );
        if (target) {
          this.performBond(agent, target, now);
        } else {
          // An agreed place is an opportunity, not a command to camp there.
          // If the partner is absent, ordinary priorities resume next quantum.
          this.performReflect(agent, now);
        }
        break;
      }
      case 'pray':
        this.performPray(agent, now);
        break;
    }
    if (!agent.life.alive) return;
    // Private recollections stay with this resident. Cardinal observes the ordinary physical action events.
    finishLearningAttempt(this.state, agent);
    const livedAction = agent.lastAction ?? action;
    recordLifeRhythmActionV18(this.state, agent, livedAction);
    if (!agent.movement || livedAction === 'explore' || livedAction === 'walk') {
      recordLivelihoodPracticeV18(this.state, agent, {
        action: livedAction,
        placeId: agent.locationId,
        choiceRoll: this.rng.next(),
        amount: agent.movement ? 0.3 : 1,
      });
    }
    this.advanceV15LearningFromLivedAction(
      agent,
      this.agentsAtLocation(agent.locationId),
      now,
    );
    practiceSecretLibraryKnowledgeV18(this.state, agent.id, livedAction);
    applyLivedGiftLearningV20(this.state, agent, giftBefore);
    this.advanceMind(agent);
  }

  private applyPassiveNeeds(agent: AgentState, environment: WorldEnvironment): void {
    const weather = worldWeatherV21(this.state);
    const placeKind = this.state.places[agent.locationId]?.kind;
    const sheltered = placeKind !== undefined &&
      ['home', 'workshop', 'village', 'city'].includes(placeKind);
    const weatherDiscomfort = (1 - weather.comfort) * (sheltered ? 0.18 : 1);
    agent.energy = clamp01(
      agent.energy -
        (0.016 + (1 - agent.life.physiology.endurance) * 0.014) *
          (1.08 - bodyRecoveryScaleV21(this.state, agent.id) * 0.08) *
          (hasGiftV20(this.state, agent.id, 'tireless') ? 0.3 : 1) -
        weatherDiscomfort * 0.004,
    );

    // Food is consumed as food. Natural fertility and a high scalar resource
    // law no longer keep everybody fed without farmers, hunters or foragers.
    // Shared meals are available only while the resident is physically inside
    // their own settlement; travellers must carry personal provisions.
    // One semantic quantum is 1/60 of a year. The former constants made a
    // short granary gap remove several years of health before farmers could
    // physically return from their fields, producing an artificial boom/bust
    // extinction cycle. Meals remain physical, but the units now match that
    // canonical clock.
    const rhythm = missMealV18(this.state, agent, 0.038);
    if (rhythm.satiety < 0.62) {
      const settlementId = this.homeSettlementId(agent);
      const localResources = this.settlementResourcesForAgent(agent);
      const economy = settlementId
        ? ensureSettlementEconomyV16(this.state, settlementId)
        : undefined;
      const residentCount = Math.max(
        1,
        settlementId
          ? this.residentCountByHomeSettlement?.get(settlementId) ?? 1
          : 1,
      );
      const sharedMealCost = 0.00065;
      const physicalMealAvailable = economy
        ? economy.stocks.food >= sharedMealCost
        : localResources.storedResources > sharedMealCost / residentCount;
      if (
        this.canAccessHomeSettlementStores(agent) &&
        physicalMealAvailable
      ) {
        const consumed = consumeStoredResources(
          localResources,
          Math.min(
            localResources.storedResources,
            sharedMealCost / residentCount,
          ),
        );
        localResources.storedResources = consumed.storedResources;
        localResources.renewableBase = consumed.renewableBase;
        localResources.fertility = consumed.fertility;
        if (economy) economy.stocks.food -= sharedMealCost;
        recordMealV18(this.state, agent, 0.22);
        this.refreshV15StoredResourceProjection();
      } else if (agent.resources >= 0.012) {
        agent.resources = clamp01(agent.resources - 0.012);
        recordMealV18(this.state, agent, 0.17);
      }
    }
    agent.resources = clamp01(agent.resources - 0.001);
    agent.needs.belonging = clamp01(agent.needs.belonging - 0.012);
    agent.needs.purpose = clamp01(agent.needs.purpose - 0.008);
    const effectiveResourceSecurity = this.v15EffectiveResourceSecurity(agent);
    agent.stress = clamp01(
      agent.stress +
        (1 - agent.energy) * 0.012 +
        (1 - effectiveResourceSecurity) * 0.006 +
        Math.max(0, 0.3 - rhythm.satiety) * 0.08 +
        weatherDiscomfort *
          (0.004 + (1 - agent.personality.resilience) * 0.004) +
        (1 - environment.safetySupport) * 0.012 -
        environment.safetySupport * (0.003 + agent.personality.resilience * 0.002),
    );
  }

  private updateGoal(agent: AgentState, now: number): void {
    const resourceSecurity = this.v15EffectiveResourceSecurity(agent);
    const scores: Array<{ kind: AgentGoalKind; strength: number }> = [
      {
        kind: 'recover',
        strength: (1 - agent.energy) * 0.85 + agent.stress * 0.55,
      },
      {
        kind: 'secure_resources',
        strength: (1 - resourceSecurity) * 0.95,
      },
      {
        kind: 'connect',
        strength:
          (1 - agent.needs.belonging) * (0.55 + agent.socialDrive * 0.55),
      },
      {
        kind: 'contribute',
        strength:
          (1 - agent.needs.purpose) * 0.5 +
          agent.personality.diligence * 0.32 +
          agent.personality.generosity * 0.18,
      },
      {
        kind: 'explore',
        strength:
          agent.personality.curiosity * 0.65 +
          agent.personality.riskTolerance * 0.12 +
          (1 - agent.needs.purpose) * 0.2,
      },
      {
        kind: 'reflect',
        strength:
          agent.stress * 0.38 +
          (1 - agent.needs.purpose) * 0.2 +
          (1 - agent.personality.riskTolerance) * 0.25 +
          (1 - agent.personality.sociability) * 0.15,
      },
      {
        kind: 'build_family',
        strength:
          (agent.life.stage === 'adult' ? 0.18 : 0) +
          agent.mind.values.care * 0.3 +
          (1 - agent.needs.belonging) * 0.2 +
          agent.mind.emotions.hope * 0.12,
      },
      {
        kind: 'seek_truth',
        strength:
          agent.mind.values.knowledge * 0.38 +
          agent.mind.emotions.awe * 0.28 +
          agent.personality.curiosity * 0.22,
      },
    ];
    scores.sort((a, b) => b.strength - a.strength);
    const next = scores[0];
    const currentAge = now - agent.goal.since;
    const shouldSwitch =
      next.kind !== agent.goal.kind &&
      (next.strength > agent.goal.strength + 0.08 || currentAge >= 5);

    if (shouldSwitch) {
      const previous = agent.goal.kind;
      agent.goal = {
        kind: next.kind,
        strength: clamp01(next.strength),
        since: now,
      };
      this.recordAgentEvent(agent, now, 'agent.goal.changed', {
        previous,
        next: next.kind,
        strength: agent.goal.strength,
      });
    } else {
      agent.goal.strength = clamp01(
        scores.find((item) => item.kind === agent.goal.kind)?.strength ?? next.strength,
      );
    }
  }

  private chooseAction(
    agent: AgentState,
    allAgents: AgentState[],
    environment: WorldEnvironment,
  ): {
    action: AgentActionKind;
    dominantAction: AgentActionKind;
    consideredActionCount: number;
    openness: number;
  } {
    const allowedActions = allowedActionsForAgeV16(
      agent.race ?? 'human',
      agent.life.ageYears,
    );
    // Helping and bonding use a two-stage resident choice. Cheap local
    // awareness keeps them in the action ballot; the exact relationship-aware
    // recipient is resolved only if the resident actually chooses that action.
    // This avoids comparing every pair in a crowded city for residents who
    // ultimately decide to rest, work, gather or travel.
    const childSupervision = this.youngChildNeedingSupervision(agent);
    const helpAvailable = Boolean(childSupervision) || allAgents.some(
      (other) =>
        other.id !== agent.id &&
        other.life.alive &&
        other.locationId === agent.locationId &&
        (other.resources < 0.5 || bodyCareNeedV21(this.state, other.id) > 0.02),
    );
    const huntTarget = allowedActions.has('hunt')
      ? this.previewHuntOpportunity(agent.locationId)
      : undefined;
    const activeFamilyIntent = this.familyRendezvousForAgent(agent.id);
    const committedFamilyIntent = this.familyIntentForAgent(agent.id);
    const familyMeetingAvailable = Boolean(
      activeFamilyIntent &&
        this.state.places[activeFamilyIntent.meetingPlaceId] &&
        (agent.knownPlaceIds ?? []).includes(activeFamilyIntent.meetingPlaceId),
    );
    const bondAvailable =
      allowedActions.has('bond') &&
      (familyMeetingAvailable ||
        allAgents.some(
          (other) =>
            other.id !== agent.id &&
            other.life.alive &&
            !other.movement &&
            other.locationId === agent.locationId &&
            this.canFormIntimateRelationship(agent, other),
        ));
    const socialAvailable = socialOpportunityAvailable(
      this.state,
      agent,
      allAgents,
    );
    const natureAvailable = this.state.growth.stage > 0;
    const goalBoost = (kind: AgentGoalKind) => (agent.goal.kind === kind ? 0.24 : 0);
    const body = agent.life.physiology;
    const emotions = agent.mind.emotions;
    const v15Resources = this.settlementResourcesForAgent(agent);
    const weather = worldWeatherV21(this.state);
    const weatherUnderstanding =
      this.v15World().knowledgeByAgentId[agent.id]?.survival ?? 0;
    const resourceSecurity = this.v15EffectiveResourceSecurity(agent);
    const sharedResourceNeed = 1 - v15Resources.storedResources;
    const settlementId = this.homeSettlementId(agent);
    const economy = settlementId
      ? ensureSettlementEconomyV16(this.state, settlementId)
      : undefined;
    const settlementResidents = Math.max(
      1,
      settlementId
        ? this.residentCountByHomeSettlement?.get(settlementId) ?? 1
        : 1,
    );
    const localSettlement = settlementId
      ? this.state.settlements[settlementId]
      : undefined;
    const localHousingCapacity = localSettlement
      ? localSettlement.memberPlaceIds
          .map((placeId) => this.state.places[placeId])
          .filter((place): place is WorldPlace => place?.kind === 'home')
          .reduce((sum, place) => sum + place.capacity, 0)
      : Number.POSITIVE_INFINITY;
    const localHousingReserve = Math.max(
      10,
      Math.ceil(settlementResidents * 0.25),
    );
    const housingPressure = Number.isFinite(localHousingCapacity)
      ? clamp01(
          (settlementResidents + localHousingReserve - localHousingCapacity) /
            Math.max(6, localHousingReserve),
        )
      : 0;
    const activeHumanConstruction = Boolean(
      economy?.activeHumanHomeProject &&
        settlementFoundingRace(this.state, settlementId ?? '') === 'human',
    );
    // Storage capacity is an upper engineering limit, not a target stock.
    // Scoring absence against the whole warehouse made every new storehouse
    // create permanent gathering urgency even when people and meals were
    // already secure. These reserves scale with the lives they support.
    const desiredStock: Record<V16MaterialKind, number> = {
      food: Math.max(1, settlementResidents * 0.12),
      wood: Math.max(
        0.55,
        settlementResidents * 0.06,
        housingPressure > 0
          ? HUMAN_HOUSE_RECIPES_V21.timber_wattle_thatch.wood * 1.08
          : 0,
      ),
      stone: Math.max(0.35, settlementResidents * 0.04),
      metal: Math.max(0.12, settlementResidents * 0.008),
      fuel: Math.max(0.18, settlementResidents * 0.025),
    };
    const stockPressure = (material: V16MaterialKind): number =>
      economy
        ? 1 -
          clamp01(
            economy.stocks[material] /
              desiredStock[material],
          )
        : sharedResourceNeed;
    const foodPressure = stockPressure('food');
    const criticalFoodReserve = economy
      ? economy.stocks.food < Math.max(0.35, settlementResidents * 0.035)
      : resourceSecurity < 0.16;
    const materialPressure =
      stockPressure('wood') * 0.34 +
      stockPressure('stone') * 0.3 +
      stockPressure('metal') * 0.2 +
      stockPressure('fuel') * 0.16;
    const craftInputAvailability = economy
      ? clamp01(
          (1 - stockPressure('wood')) * 0.32 +
            (1 - stockPressure('stone')) * 0.3 +
            (1 - stockPressure('metal')) * 0.18 +
            (1 - stockPressure('fuel')) * 0.2,
        )
      : clamp01(v15Resources.storedResources);
    const toolPressure = economy
      ? clamp01(
          1 -
            (economy.farmingTools + economy.constructionTools) /
              Math.max(2, (this.residentCountByHomeSettlement?.get(settlementId ?? '') ?? 1) / 7),
        )
      : 0.5;
    const rhythm = ensureLifeRhythmV18(this.state, agent);
    const yearsSinceOutside =
      rhythm.lastOutsideSettlementWorldMinute === undefined
        ? Math.max(1, agent.life.ageYears * 0.25)
        : Math.max(
            0,
            (this.state.calendar.elapsedWorldMinutes -
              rhythm.lastOutsideSettlementWorldMinute) /
              WORLD_MINUTES_PER_YEAR,
          );
    const frontierStagnation = clamp01(yearsSinceOutside / 3);
    const soilExhaustion =
      settlementResidents > 10
        ? clamp01(
            1 -
              (v15Resources.renewableBase * 0.55 +
                v15Resources.fertility * 0.45),
          )
        : 0;
    const vocationBoost = (action: AgentActionKind) =>
      livelihoodActionAffinityV18(this.state, agent.id, action) +
      emergentPracticeActionAffinityV21(this.state, agent.id, action);
    const learnedKnowledgeBoost = (action: AgentActionKind) =>
      secretLibraryActionAffinityV18(this.state, agent.id, action);
    const divineCapabilityBoost = (action: AgentActionKind): number =>
      divineGiftActionAffinityV19(this.state, agent.id, action);

    const scores: Array<{ action: AgentActionKind; score: number }> = [
      {
        action: 'rest',
        score:
          (1 - agent.energy) * 1.45 +
          agent.stress * 0.42 +
          Math.max(0, 0.2 - agent.resources) * 2.4 +
          (1 - body.recovery) * 0.22 +
          bodyFatigueDecisionBoostV21(this.state, agent) +
          goalBoost('recover'),
      },
      {
        action: 'relax',
        score:
          (natureAvailable ? 0.16 : 0) +
          (1 - agent.energy) * 0.62 +
          agent.stress * 0.72 +
          agent.personality.curiosity * 0.12 +
          emotions.grief * 0.2 +
          goalBoost('recover') * 0.65,
      },
      {
        action: 'walk',
        score:
          0.18 +
          agent.personality.curiosity * 0.46 +
          agent.personality.resilience * 0.08 +
          body.mobility * 0.18 +
          divineCapabilityBoost('walk') +
          learnedKnowledgeBoost('walk') +
          emotions.joy * 0.09 -
          emotions.fear * 0.12 +
          (1 - agent.stress) * 0.08 +
          (1 - agent.needs.purpose) * 0.16 +
          goalBoost('explore') * 0.6 -
          Math.max(0, 0.3 - agent.energy) * 0.8 +
          soilExhaustion * 0.14,
      },
      {
        action: 'gather',
        score:
          (1 - resourceSecurity) * 0.72 +
          foodPressure * 1.25 +
          materialPressure * 0.62 +
          housingPressure * 0.32 +
          v15Resources.renewableBase * 0.2 +
          sharedResourceNeed *
            (0.16 +
              agent.personality.generosity * 0.16 +
              agent.personality.diligence * 0.1) +
          agent.skills.gathering * 0.2 +
          body.strength * 0.13 +
          vocationBoost('gather') +
          learnedKnowledgeBoost('gather') +
          goalBoost('secure_resources') -
          soilExhaustion * Math.max(0.1, 0.65 - materialPressure * 0.55),
      },
      {
        action: 'hunt',
        score: huntTarget
          ? (1 - resourceSecurity) * 0.9 +
            agent.skills.hunting * 0.34 +
            agent.personality.riskTolerance * 0.22 +
            body.strength * 0.2 +
            body.endurance * 0.12 +
            environment.safetySupport * 0.08 +
            foodPressure * 0.42 +
            emotions.hope * 0.08 -
            emotions.fear * 0.32 -
            huntTarget.alertness * 0.34 -
            huntTarget.threat * 0.36 +
            vocationBoost('hunt') +
            divineCapabilityBoost('hunt') +
            learnedKnowledgeBoost('hunt') +
            goalBoost('secure_resources')
          : -1,
      },
      {
        action: 'work',
        score:
          0.22 +
          (1 - resourceSecurity) * 0.34 +
          toolPressure * craftInputAvailability * 0.42 +
          craftInputAvailability * 0.22 -
          materialPressure * 0.12 +
          housingPressure *
            (0.28 + agent.personality.diligence * 0.2 + agent.mind.values.care * 0.14) +
          (activeHumanConstruction ? 0.38 : 0) +
          (1 - agent.needs.purpose) * 0.34 +
          agent.personality.diligence * 0.45 +
          agent.skills.craft * 0.16 +
          body.endurance * 0.1 +
          vocationBoost('work') +
          learnedKnowledgeBoost('work') +
          goalBoost('contribute') +
          soilExhaustion * 0.12,
      },
      {
        action: 'socialize',
        score:
          (socialAvailable ? 1 : 0) *
          ((1 - agent.needs.belonging) * 0.96 +
            agent.socialDrive * 0.16 +
            agent.personality.sociability * 0.2 +
            emotions.grief * 0.08 -
            emotions.fear * 0.08 +
            environment.socialOpportunity * 0.08 +
            vocationBoost('socialize') +
            divineCapabilityBoost('socialize') +
            learnedKnowledgeBoost('socialize') +
            goalBoost('connect')),
      },
      {
        action: 'help',
        score: helpAvailable
          ? agent.personality.generosity * 0.65 +
            (childSupervision?.pressure ?? 0) *
              (0.72 + agent.mind.values.care * 0.7) +
            (1 - agent.needs.purpose) * 0.24 +
            Math.max(0, agent.resources - 0.45) * 0.35 +
            careActionAffinityV21(this.state, agent.id) +
            divineCapabilityBoost('help') +
            learnedKnowledgeBoost('help') +
            goalBoost('contribute')
          : -1,
      },
      {
        action: 'explore',
        score:
          agent.personality.curiosity * 0.46 +
          agent.personality.riskTolerance * 0.12 +
          agent.mind.values.freedom * 0.14 +
          agent.mind.values.ambition * 0.08 +
          frontierStagnation * 0.28 +
          body.mobility * 0.1 +
          agent.skills.exploration * 0.1 +
          emotions.awe * 0.08 +
          emotions.hope * 0.05 -
          emotions.fear * 0.28 +
          (1 - agent.needs.purpose) * 0.14 +
          vocationBoost('explore') +
          divineCapabilityBoost('explore') +
          learnedKnowledgeBoost('explore') +
          goalBoost('explore') * 0.65 -
          Math.max(0, 0.35 - agent.resources) * 0.8 +
          soilExhaustion * 0.58,
      },
      {
        action: 'reflect',
        score:
          0.18 +
          agent.stress * 0.55 +
          (1 - agent.needs.purpose) * 0.42 +
          (1 - agent.personality.riskTolerance) * 0.22 +
          (1 - agent.personality.sociability) * 0.08 +
          emotions.grief * 0.24 +
          emotions.fear * 0.12 +
          divineCapabilityBoost('reflect') +
          learnedKnowledgeBoost('reflect') +
          goalBoost('reflect'),
      },
      {
        action: 'bond',
        score: bondAvailable
          ? agent.mind.values.care * 0.42 +
            (1 - agent.needs.belonging) * 0.34 +
            agent.mind.emotions.hope * 0.18 +
            emotions.joy * 0.12 +
            learnedKnowledgeBoost('bond') +
            goalBoost('build_family') +
            (committedFamilyIntent ? 0.62 : activeFamilyIntent ? 0.14 : 0)
          : -1,
      },
      {
        action: 'pray',
        score:
          0.025 +
          (1 - agent.needs.purpose) * 0.56 +
          agent.mind.emotions.grief * 0.2 +
          agent.mind.emotions.awe * 0.08 +
          agent.mind.values.tradition * 0.08 +
          vocationBoost('pray') +
          divineCapabilityBoost('pray') +
          learnedKnowledgeBoost('pray') +
          goalBoost('seek_truth'),
      },
    ];

    // Weather changes the real cost and perceived risk of outdoor choices.
    // Knowledge improves judgement; it never overwrites the selected action.
    for (const item of scores) {
      if (['walk', 'gather', 'hunt', 'explore'].includes(item.action)) {
        const urgentShelterWorkScale = item.action === 'gather'
          ? 1 - housingPressure
          : 1;
        item.score -= weather.outdoorDecisionPenalty *
          (0.62 + weatherUnderstanding * 0.38) * urgentShelterWorkScale;
      } else if (item.action === 'rest') {
        item.score += weather.severity *
          (0.12 + weatherUnderstanding * 0.16);
      }
    }

    // Hunger changes the opportunities residents perceive; it does not
    // rewrite their minds or assign them a profession. A settlement with only
    // a few meals left reacts before the whole population enters the lethal
    // starvation/recovery pendulum.
    if (criticalFoodReserve) {
      for (const item of scores) {
        if (item.action === 'gather') item.score += 1.65;
        else if (item.action === 'hunt') item.score += 0.62;
        else if (item.action === 'explore') item.score -= 1.25;
        else if (item.action === 'walk') item.score -= 0.45;
        else if (item.action === 'work') item.score -= 0.32;
      }
    }

    for (const item of scores) {
      if (!allowedActions.has(item.action)) item.score = Number.NEGATIVE_INFINITY;
      else item.score -= repetitionPenaltyV18(this.state, agent.id, item.action);
    }
    if (agent.life.stage === 'elder') {
      const hunt = scores.find((item) => item.action === 'hunt');
      if (hunt) hunt.score -= 0.28;
    }
    if (body.mobility < 0.24 || body.strength < 0.2) {
      for (const item of scores) {
        if (['hunt', 'explore'].includes(item.action)) item.score = Number.NEGATIVE_INFINITY;
      }
      const rest = scores.find((item) => item.action === 'rest');
      if (rest) rest.score += 0.36;
    }

    // The resident recalls outcomes of their own attempts, including failures.
    // Invalid age/body actions remain excluded even if an old method succeeded.
    for (const item of scores) {
      if (item.score > -0.25 && allowedActions.has(item.action)) {
        item.score += learnedActionAdjustment(this.state, agent, item.action);
      }
    }

    // Repetition remains possible, but curiosity makes an unchanged routine
    // less attractive while diligence can reinforce productive habits.
    if (agent.lastAction) {
      const repeated = scores.find(
        (item) => item.action === agent.lastAction,
      );
      if (repeated) {
        const habitStrength =
          repeated.action === 'work' || repeated.action === 'gather'
            ? agent.personality.diligence
            : repeated.action === 'socialize' || repeated.action === 'help'
              ? agent.personality.sociability
              : agent.personality.resilience;
        repeated.score +=
          habitStrength * 0.08 - agent.personality.curiosity * 0.13;
      }
    }

    // Seeded noise and weighted selection preserve reproducibility without
    // reducing ordinary choice to a deterministic highest-score instruction.
    for (const item of scores) {
      if (Number.isFinite(item.score)) {
        item.score += this.rng.between(-0.045, 0.045);
      }
    }

    // A traveller can recover in camp when food remains. Only actual supply
    // shortage needs a physical resupply trip; a half-full pack is not a
    // permanent command to abandon a resident's exploration plan.
    if (
      !this.canAccessHomeSettlementStores(agent) &&
      (agent.resources < 0.12 || rhythm.satiety < 0.25 || agent.energy < 0.24)
    ) {
      return {
        action: 'rest',
        dominantAction: 'rest',
        consideredActionCount: 1,
        openness: 0,
      };
    }

    // Between 10% and 1% the body warns and slows down, but the mind may
    // still ignore fatigue. At 0% advanceBodySleepV21 physically suspends action.
    if (resourceSecurity < 0.16) {
      const survivalChoices = scores
        .filter(
          (item) =>
            allowedActions.has(item.action) &&
            ((item.action === 'gather' &&
              this.settlementResourcesForAgent(agent).renewableBase > 0.03) ||
            item.action === 'work' ||
            (item.action === 'hunt' && huntTarget !== undefined)),
        )
        .sort((a, b) => b.score - a.score);
      if (survivalChoices.length === 0) {
        return {
          action: 'rest',
          dominantAction: 'rest',
          consideredActionCount: 1,
          openness: 0,
        };
      }

      // Severe need narrows the choice set but does not turn it into a hidden
      // highest-score command. The resident still chooses among viable ways to
      // survive according to their own traits and deterministic RNG.
      const best = survivalChoices[0].score;
      const survivalTemperature = 0.07 + agent.personality.riskTolerance * 0.04;
      const survivalWeights = survivalChoices.map((item) =>
        Math.exp((item.score - best) / survivalTemperature),
      );
      const survivalTotal = survivalWeights.reduce((sum, weight) => sum + weight, 0);
      let survivalRoll = this.rng.next() * survivalTotal;
      let selectedSurvival = survivalChoices[survivalChoices.length - 1];
      for (let index = 0; index < survivalChoices.length; index += 1) {
        survivalRoll -= survivalWeights[index];
        if (survivalRoll <= 0) {
          selectedSurvival = survivalChoices[index];
          break;
        }
      }
      const survivalProbabilities = survivalWeights.map(
        (weight) => weight / survivalTotal,
      );
      const survivalEntropy = -survivalProbabilities.reduce(
        (sum, probability) =>
          sum + (probability > 0 ? probability * Math.log(probability) : 0),
        0,
      );
      return {
        action: selectedSurvival.action,
        dominantAction: survivalChoices[0].action,
        consideredActionCount: survivalChoices.length,
        openness:
          survivalChoices.length > 1
            ? clamp01(survivalEntropy / Math.log(survivalChoices.length))
            : 0,
      };
    }

    // Reaching a field, workshop, home or sacred place does not itself
    // perform an action. At the next decision boundary the resident may
    // continue the intention that caused their trip, or abandon it if their
    // condition has changed. This preserves agency without making travel
    // erase nearly every productive choice.
    const pendingAction = rhythm.pendingArrivalAction as
      | AgentActionKind
      | undefined;
    if (pendingAction) {
      const arrivedAtIntendedPlace =
        rhythm.pendingArrivalPlaceId === agent.locationId;
      const pendingIsValid =
        ACTION_KINDS.includes(pendingAction) &&
        allowedActions.has(pendingAction) &&
        arrivedAtIntendedPlace;
      if (pendingIsValid) {
        const continuationChance = clamp01(
          0.56 +
            agent.personality.diligence * 0.18 +
            agent.goal.strength * 0.06 +
            (pendingAction === 'rest' ? (1 - agent.energy) * 0.16 : 0) -
            agent.stress * 0.16 -
            Math.max(0, 0.2 - resourceSecurity) * 0.22,
        );
        rhythm.pendingArrivalAction = undefined;
        rhythm.pendingArrivalPlaceId = undefined;
        rhythm.pendingArrivalWorldMinute = undefined;
        if (this.rng.next() < continuationChance) {
          return {
            action: pendingAction,
            dominantAction: pendingAction,
            consideredActionCount: Math.max(
              2,
              scores.filter((item) => item.score > -0.25).length,
            ),
            openness: clamp01(1 - continuationChance),
          };
        }
      } else {
        rhythm.pendingArrivalAction = undefined;
        rhythm.pendingArrivalPlaceId = undefined;
        rhythm.pendingArrivalWorldMinute = undefined;
      }
    }

    if (agent.plan) {
      const plannedAction: AgentActionKind =
        agent.plan.kind === 'hunt' ? 'hunt' : 'explore';
      if (!allowedActions.has(plannedAction)) agent.plan = undefined;
    }

    if (agent.plan) {
      if (
        agent.plan.expiresAt < this.state.now ||
        !this.state.places[agent.plan.targetPlaceId]
      ) {
        agent.plan = undefined;
      } else {
        // Plans belong to the resident; they are not engine commands. Even
        // before expiry, personality and current condition decide whether the
        // resident continues the plan or re-opens the ordinary action choice.
        const recoveryPressure = clamp01(
          Math.max(0, 0.35 - agent.energy) * 1.25 +
            agent.stress * 0.32 +
            Math.max(0, 0.28 - resourceSecurity) * 0.75,
        );
        const planDrive =
          agent.plan.kind === 'hunt'
            ? 0.4 +
              agent.skills.hunting * 0.2 +
              agent.personality.riskTolerance * 0.18 +
              agent.goal.strength * 0.08
            : 0.38 +
              agent.personality.curiosity * 0.24 +
              agent.personality.riskTolerance * 0.12 +
              agent.skills.exploration * 0.12 +
              agent.goal.strength * 0.08;
        const continuePlanChance = Math.max(
          0.08,
          Math.min(0.9, planDrive - recoveryPressure * 0.55),
        );

        if (this.rng.next() < continuePlanChance) {
          const plannedAction: AgentActionKind =
            agent.plan.kind === 'hunt' ? 'hunt' : 'explore';
          return {
            action: plannedAction,
            dominantAction: plannedAction,
            consideredActionCount: Math.max(2, scores.filter((item) => item.score > -0.25).length),
            openness: clamp01(1 - continuePlanChance),
          };
        }

        agent.plan = undefined;
      }
    }

    const choiceWindow =
      0.32 +
      agent.personality.curiosity * 0.2 +
      agent.personality.riskTolerance * 0.1;
    const candidates = residentChoiceCandidates(scores,allowedActions,choiceWindow);
    const dominantAction = candidates[0].action;
    const temperature =
      0.1 +
      agent.personality.curiosity * 0.1 +
      agent.personality.riskTolerance * 0.045;
    const weights = candidates.map((item) =>
      Math.exp((item.score - candidates[0].score) / temperature),
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = this.rng.next() * total;
    let selected = candidates[candidates.length - 1];

    for (let index = 0; index < candidates.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        selected = candidates[index];
        break;
      }
    }

    const probabilities = weights.map((weight) => weight / total);
    const entropy = -probabilities.reduce(
      (sum, probability) =>
        sum +
        (probability > 0 ? probability * Math.log(probability) : 0),
      0,
    );
    const openness =
      candidates.length > 1
        ? clamp01(entropy / Math.log(candidates.length))
        : 0;

    return {
      action: selected.action,
      dominantAction,
      consideredActionCount: candidates.length,
      openness,
    };
  }

  private previewHuntOpportunity(
    locationId: string,
  ): WildlifePopulation | undefined {
    const cached = this.huntOpportunityByLocation?.get(locationId);
    if (cached !== undefined && (cached === null || cached.count > 0)) {
      return cached ?? undefined;
    }
    let best: { population: WildlifePopulation; score: number } | undefined;
    const foodSignal: Record<WildlifeSpecies, number> = {
      rabbit: 0.11,
      deer: 0.22,
      fish: 0.085,
      boar: 0.2,
      wolf: 0.16,
      bird: 0.07,
      dire_wolf: 0.24,
      ogre: 0.3,
      wraith: 0.04,
      century_humpback: 0,
    };
    for (const population of Object.values(this.state.wildlife)) {
      if (
        population.species === CENTURY_HUMPBACK_SPECIES ||
        population.count <= 0 ||
        !this.state.places[population.habitatId]
      ) {
        continue;
      }
      const route = this.pathBetween(locationId, population.habitatId);
      if (!route) continue;
      const score =
        foodSignal[population.species] * 2.4 +
        population.count / population.carryingCapacity -
        population.alertness * 0.5 -
        population.threat * 0.62 -
        Math.max(0, route.length - 1) * 0.055;
      if (!best || score > best.score) best = { population, score };
    }
    this.huntOpportunityByLocation?.set(locationId, best?.population ?? null);
    return best?.population;
  }

  private buildResidentDecisionIndexes(agents: readonly AgentState[]): void {
    this.relationshipKeysByResident = undefined;
    const familyLifecyclesByAgentId = new Map<string, V16FamilyLifecycleState[]>();
    for (const lifecycle of Object.values(
      this.state.v16?.familyLifecycleByPairId ?? {},
    )) {
      for (const agentId of [lifecycle.agentAId, lifecycle.agentBId]) {
        const records = familyLifecyclesByAgentId.get(agentId) ?? [];
        records.push(lifecycle);
        familyLifecyclesByAgentId.set(agentId, records);
      }
    }
    for (const records of familyLifecyclesByAgentId.values()) {
      records.sort(
        (left, right) =>
          right.lastAffirmedWorldMinute - left.lastAffirmedWorldMinute ||
          left.pairId.localeCompare(right.pairId),
      );
    }
    this.familyLifecyclesByAgentId = familyLifecyclesByAgentId;
    const byLocation = new Map<string, AgentState[]>();
    const bySettlement = new Map<string, number>();
    const bySettlementRace = new Map<string, number>();
    const agricultureBySettlement = new Map<
      string,
      { sum: number; count: number }
    >();
    for (const resident of agents) {
      const local = byLocation.get(resident.locationId) ?? [];
      local.push(resident);
      byLocation.set(resident.locationId, local);
      const settlementId = this.homeSettlementId(resident);
      if (!settlementId) continue;
      bySettlement.set(settlementId, (bySettlement.get(settlementId) ?? 0) + 1);
      const agriculture = this.state.v15?.knowledgeByAgentId[resident.id]?.agriculture;
      if (agriculture !== undefined) {
        const aggregate = agricultureBySettlement.get(settlementId) ?? {
          sum: 0,
          count: 0,
        };
        aggregate.sum += agriculture;
        aggregate.count += 1;
        agricultureBySettlement.set(settlementId, aggregate);
      }
      const raceKey = `${settlementId}\u0000${resident.race ?? 'human'}`;
      bySettlementRace.set(raceKey, (bySettlementRace.get(raceKey) ?? 0) + 1);
    }
    this.residentsByLocation = byLocation;
    this.residentCountByHomeSettlement = bySettlement;
    this.residentCountByHomeRace = bySettlementRace;
    this.agricultureKnowledgeByHomeSettlement = agricultureBySettlement;
    const settlementPlaces = new Map<string, WorldPlace[]>();
    const kindPlaces = new Map<WorldPlaceKind, WorldPlace[]>();
    for (const place of Object.values(this.state.places)) {
      const matchingKind = kindPlaces.get(place.kind) ?? [];
      matchingKind.push(place);
      kindPlaces.set(place.kind, matchingKind);
      if (!place.settlementId) continue;
      const places = settlementPlaces.get(place.settlementId) ?? [];
      places.push(place);
      settlementPlaces.set(place.settlementId, places);
    }
    this.placesBySettlement = settlementPlaces;
    this.placesByKind = kindPlaces;
    this.huntOpportunityByLocation = new Map();
  }

  private agentsAtLocation(locationId: string): AgentState[] {
    const candidates = this.residentsByLocation
      ? this.residentsByLocation.get(locationId) ?? []
      : Object.values(this.state.agents);
    return candidates.filter(agent => agent.life.alive && !agent.movement && agent.locationId === locationId);
  }

  private moveResidentLocationIndex(
    agent: AgentState,
    priorLocationId: string,
    nextLocationId: string,
  ): void {
    if (!this.residentsByLocation || priorLocationId === nextLocationId) return;
    const prior = this.residentsByLocation.get(priorLocationId);
    if (prior) {
      const index = prior.findIndex((resident) => resident.id === agent.id);
      if (index >= 0) prior.splice(index, 1);
      if (prior.length === 0) this.residentsByLocation.delete(priorLocationId);
    }
    const next = this.residentsByLocation.get(nextLocationId) ?? [];
    if (!next.some((resident) => resident.id === agent.id)) next.push(agent);
    this.residentsByLocation.set(nextLocationId, next);
  }

  private homeSettlementId(agent: AgentState): string | undefined {
    return this.state.places[agent.homeId]?.settlementId;
  }

  private youngChildNeedingSupervision(
    parent: Readonly<AgentState>,
  ): { child: AgentState; pressure: number; lastKnownPlaceId: string } | undefined {
    let result: {
      child: AgentState;
      pressure: number;
      lastKnownPlaceId: string;
    } | undefined;
    for (const childId of parent.life.childIds) {
      const child = this.state.agents[childId];
      if (!child?.life.alive || child.life.ageYears >= 13) continue;
      const supervision = this.state.v21?.childSupervisionByChildId[child.id];
      const lastKnownPlaceId = parent.locationId === child.locationId
        ? child.locationId
        : supervision?.lastKnownPlaceId;
      if (!lastKnownPlaceId) continue;
      const home = this.state.places[child.homeId];
      const place = this.state.places[lastKnownPlaceId];
      const outsideHome = place?.settlementId !== home?.settlementId;
      const distance = Math.hypot(
        (place?.mapX ?? parent.position.x) - parent.position.x,
        (place?.mapY ?? parent.position.y) - parent.position.y,
      );
      const unobservedYears = Math.max(
        0,
        (this.state.calendar.elapsedWorldMinutes -
          (supervision?.lastObservedWorldMinute ?? this.state.calendar.elapsedWorldMinutes)) /
          WORLD_MINUTES_PER_YEAR,
      );
      const pressure = clamp01(
        (outsideHome ? 0.52 : 0) +
          (place?.danger ?? 0) * 0.48 +
          Math.min(0.38, distance / 140) +
          Math.min(0.32, unobservedYears * 4) +
          (parent.locationId === child.locationId && child.movement ? 0.12 : 0),
      );
      if (pressure >= 0.28 && (!result || pressure > result.pressure)) {
        result = { child, pressure, lastKnownPlaceId };
      }
    }
    return result;
  }

  /** Children keep their own choices, but a child under thirteen cannot begin
   * a remote wilderness journey alone. Local movement inside the familiar
   * settlement stays available; a remote trip requires a living parent who is
   * physically present and already travelling toward the same place. */
  private youngChildMayTravelTo(
    child: Readonly<AgentState>,
    destinationId: string,
  ): boolean {
    return youngChildMayTravelToV21(this.state, child, destinationId);
  }

  private canAccessHomeSettlementStores(agent: AgentState): boolean {
    const homeSettlementId = this.homeSettlementId(agent);
    if (!homeSettlementId) return false;
    return this.state.places[agent.locationId]?.settlementId === homeSettlementId;
  }

  private v15EffectiveResourceSecurity(agent: AgentState): number {
    const rhythm = ensureLifeRhythmV18(this.state, agent);
    const personalSecurity = clamp01(
      agent.resources * 0.58 + rhythm.satiety * 0.42,
    );
    if (!this.canAccessHomeSettlementStores(agent)) {
      return personalSecurity;
    }
    const settlementId = this.homeSettlementId(agent);
    const stored = this.settlementResourcesForAgent(agent).storedResources;
    const economy = settlementId
      ? ensureSettlementEconomyV16(this.state, settlementId)
      : undefined;
    const residentCount = Math.max(
      1,
      settlementId
        ? this.residentCountByHomeSettlement?.get(settlementId) ?? 1
        : 1,
    );
    const foodCoverage = economy
      ? clamp01(economy.stocks.food / Math.max(0.025, residentCount * 0.025))
      : stored;
    // v16 food stock is the physical granary. The older normalized
    // storedResources index also includes non-food materials and can reach
    // zero while the granary still contains meals; using Math.min here made
    // children starve beside full stores.
    const sharedSecurity = economy ? foodCoverage : stored;
    // A full granary helps, but it cannot make personal hunger, tools and
    // carried supplies disappear from the resident's decision.
    return clamp01(
      Math.max(
        personalSecurity,
        rhythm.satiety * 0.42 + sharedSecurity * 0.38,
      ),
    );
  }

  private drawV15HomeSettlementRation(
    agent: AgentState,
    desiredPersonalIncrease: number,
  ): number {
    if (desiredPersonalIncrease <= 0 || !this.canAccessHomeSettlementStores(agent)) {
      return 0;
    }

    const localResources = this.settlementResourcesForAgent(agent);
    const settlementId = this.homeSettlementId(agent);
    const economy = settlementId
      ? ensureSettlementEconomyV16(this.state, settlementId)
      : undefined;
    const availableIndex = localResources.storedResources;
    if (availableIndex <= 0 && (!economy || economy.stocks.food <= 0)) return 0;
    const raceKey = `${settlementId ?? ''}\u0000${agent.race ?? 'human'}`;
    const residentCount = Math.max(
      1,
      this.residentCountByHomeRace?.get(raceKey) ??
        Object.values(this.state.agents).filter(
          (candidate) =>
            candidate.life.alive &&
            candidate.race === agent.race &&
            this.homeSettlementId(candidate) === settlementId,
        ).length,
    );

    // storedResources is a normalized settlement-level availability index, not
    // a literal copy of each resident's personal reserve. One resident drawing
    // x therefore reduces the shared index by x / residentCount. This keeps
    // access physically meaningful without making a 10-person settlement drain
    // ten times faster merely because the stock is represented on a 0..1 scale.
    const maximumPersonalRation = 0.45;
    const affordablePersonalAmount = economy
      ? economy.stocks.food / 2
      : availableIndex * residentCount;
    const drawn = Math.min(
      Math.max(0, desiredPersonalIncrease),
      affordablePersonalAmount,
      economy ? economy.stocks.food / 2 : Number.POSITIVE_INFINITY,
      maximumPersonalRation,
    );
    if (drawn <= 0) return 0;

    const sharedIndexCost = Math.min(
      localResources.storedResources,
      drawn / residentCount,
    );
    const consumed = consumeStoredResources(localResources, sharedIndexCost);
    localResources.storedResources = consumed.storedResources;
    localResources.renewableBase = consumed.renewableBase;
    localResources.fertility = consumed.fertility;
    if (economy) {
      economy.stocks.food = Math.max(0, economy.stocks.food - drawn * 2);
    }
    agent.resources = clamp01(agent.resources + drawn);
    this.refreshV15StoredResourceProjection();
    return drawn;
  }

  private localPlace(
    agent: AgentState,
    kinds: readonly WorldPlaceKind[],
    fallback: string,
  ): string {
    const settlementId = this.homeSettlementId(agent);
    if (settlementId) {
      const committedOccupancy = new Map<string, number>();
      if (!this.residentsByLocation) {
        for (const resident of Object.values(this.state.agents)) {
          if (!resident.life.alive) continue;
          const placeId = resident.movement?.targetPlaceId ?? resident.locationId;
          committedOccupancy.set(
            placeId,
            (committedOccupancy.get(placeId) ?? 0) + 1,
          );
        }
      }
      const localPlaces =
        this.placesBySettlement?.get(settlementId) ??
        Object.values(this.state.places).filter(
          (place) => place.settlementId === settlementId,
        );
      let best:
        | { place: WorldPlace; pressure: number; distance: number }
        | undefined;
      const candidates = [...new Map([...localPlaces, ...Object.values(this.state.places).filter(
        place => (agent.knownPlaceIds ?? []).includes(place.id) &&
          Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) <= 12,
      )].map(place => [place.id, place])).values()];
      for (const place of candidates) {
        if (
          !kinds.includes(place.kind) ||
          residentKnownPath(this.state, agent, place.id) === undefined
        ) {
          continue;
        }
        const pressure =
          (this.residentsByLocation?.get(place.id)?.length ??
            committedOccupancy.get(place.id) ??
            0) / Math.max(1, place.capacity);
        const distance = Math.hypot(
          place.mapX - agent.position.x,
          place.mapY - agent.position.y,
        );
        if (
          !best ||
          pressure < best.pressure - 0.0001 ||
          (Math.abs(pressure - best.pressure) <= 0.0001 &&
            (distance < best.distance ||
              (distance === best.distance &&
                place.id.localeCompare(best.place.id) < 0)))
        ) {
          best = { place, pressure, distance };
        }
      }
      if (best) return best.place.id;

      const settlement = this.state.settlements[settlementId];
      if (
        settlement?.centerPlaceId &&
        residentKnownPath(this.state, agent, settlement.centerPlaceId)
      ) {
        return settlement.centerPlaceId;
      }
    }
    return this.state.places[fallback] ? fallback : agent.homeId;
  }

  private localCommons(agent: AgentState): string {
    // Family life is a real social setting. This uses physical co-presence at
    // the known family home; it does not reveal a traveller's live position.
    const familyAtHome = this.agentsAtLocation(agent.homeId).some(
      (other) =>
        other.id !== agent.id &&
        other.life.alive &&
        other.homeId === agent.homeId,
    );
    if (
      familyAtHome &&
      residentKnownPath(this.state, agent, agent.homeId) !== undefined
    ) {
      return agent.homeId;
    }

    // Public life is distributed across several real meeting places. The
    // least crowded reachable place wins instead of a scripted square.
    return this.localPlace(
      agent,
      ['commons', 'quiet_space', 'workshop', 'village', 'city'],
      agent.homeId,
    );
  }

  private performTravelPause(agent: AgentState, now: number): void {
    agent.energy = clamp01(
      agent.energy + 0.075 + agent.life.physiology.recovery * 0.065,
    );
    agent.stress = clamp01(
      agent.stress - 0.035 - agent.personality.resilience * 0.018,
    );
    agent.lastAction = 'rest';
    this.recordAgentEvent(agent, now, 'agent.travel.paused', {
      energy: agent.energy,
      stress: agent.stress,
      targetPlaceId: agent.movement?.targetPlaceId ?? null,
      purpose: agent.movement?.purpose ?? null,
      worldMinutes: this.state.calendar.elapsedWorldMinutes,
    });
  }

  /**
   * Starts a physical trip and tells the caller whether the intended activity
   * must wait. A place label is evidence of where a body is, never a promise
   * about where it will eventually arrive.
   */
  private travelBeforeAction(
    agent: AgentState,
    destinationId: string,
    intendedAction: AgentActionKind,
    now: number,
    travelAction: AgentActionKind = 'walk',
  ): boolean {
    if (!mayKnowPlaceV20(agent, destinationId, this.state)) return true;
    if (!this.youngChildMayTravelTo(agent, destinationId)) {
      recordDeferredChildTripV21(this.state, agent);
      agent.energy = clamp01(agent.energy - 0.003);
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.003);
      agent.lastAction = travelAction;
      agent.lastMeaningfulEventAt = now;
      this.recordAgentEvent(agent, now, 'agent.child.remote_trip_deferred', {
        agentId: agent.id,
        ageYears: agent.life.ageYears,
        destinationId,
        supervisionRequired: true,
        forcedChoice: false,
      });
      return true;
    }
    const destination = this.state.places[destinationId];
    const homeSettlementId = this.homeSettlementId(agent);
    const leavesHomeSettlement =
      this.canAccessHomeSettlementStores(agent) &&
      destination?.settlementId !== homeSettlementId;
    if (leavesHomeSettlement && agent.resources < 0.42) {
      const drawn = this.drawV15HomeSettlementRation(agent, 0.42 - agent.resources);
      if (intendedAction === 'explore') explorationEvidence(this.state, agent).provisionsTaken += drawn;
    }
    this.moveAgent(agent, destinationId);
    if (agent.locationId === destinationId && !agent.movement) {
      const rhythm = ensureLifeRhythmV18(this.state, agent);
      if (
        rhythm.pendingArrivalAction === intendedAction &&
        rhythm.pendingArrivalPlaceId === destinationId
      ) {
        rhythm.pendingArrivalAction = undefined;
        rhythm.pendingArrivalPlaceId = undefined;
        rhythm.pendingArrivalWorldMinute = undefined;
      }
      return false;
    }

    if (agent.movement?.targetPlaceId !== destinationId) {
      // A selected destination is not proof that a route actually started.
      // Do not charge travel effort or award exploration practice on failure.
      agent.lastAction = 'reflect';
      this.recordAgentEvent(agent, now, 'agent.travel.unavailable', {
        fromPlaceId: agent.locationId, destinationId, intendedAction,
      });
      return true;
    }
    if (agent.movement.targetPlaceId === destinationId) {
      agent.movement.purpose = intendedAction;
      const rhythm = ensureLifeRhythmV18(this.state, agent);
      rhythm.pendingArrivalAction = intendedAction;
      rhythm.pendingArrivalPlaceId = destinationId;
      rhythm.pendingArrivalWorldMinute =
        this.state.calendar.elapsedWorldMinutes;
    }
    const effortlessHeroJourney = hasDivineGiftV19(
      this.state,
      agent.id,
      'demon_king_hero',
    );
    if (!effortlessHeroJourney) {
      agent.energy = clamp01(agent.energy - 0.008);
    }
    agent.lastAction = travelAction;
    agent.lastMeaningfulEventAt = now;
    this.recordAgentEvent(agent, now, 'agent.travel.started', {
      fromPlaceId: agent.locationId,
      destinationId,
      intendedAction,
      movementPurpose: agent.movement?.purpose ?? intendedAction,
      physicalArrivalRequired: true,
    });
    return true;
  }

  private performRest(agent: AgentState, now: number): void {
    const rhythm = ensureLifeRhythmV18(this.state, agent);
    const canCamp = !agent.movement && !this.canAccessHomeSettlementStores(agent) &&
      this.state.places[agent.locationId]?.surface !== 'water' &&
      agent.resources >= 0.12 && rhythm.satiety >= 0.25;
    if (canCamp) {
      if (agent.energy <= 0.1 && startBodySleepV21(this.state, agent, false)) return;
      const survival = this.v15World().knowledgeByAgentId[agent.id]?.survival ?? 0;
      agent.energy = clamp01(agent.energy +
        (0.12 + agent.life.physiology.recovery * 0.09 + survival * 0.025) *
        bodyRecoveryScaleV21(this.state, agent.id));
      agent.stress = clamp01(agent.stress - 0.04 - agent.personality.resilience * 0.02);
      agent.lastAction = 'rest';
      explorationEvidence(this.state, agent).campRests += 1;
      this.recordAgentEvent(agent, now, 'agent.camp.rested', {
        locationId: agent.locationId, energy: agent.energy,
        carriedProvisions: agent.resources, sharedStoresAccessed: false,
      });
      return;
    }
    if (this.travelBeforeAction(agent, agent.homeId, 'rest', now)) return;
    // Below 10% a voluntary rest becomes real six-hour sleep. The resident
    // chose to sleep; only collapse at zero is compulsory.
    if (agent.energy <= 0.1 && startBodySleepV21(this.state, agent, false)) return;
    agent.energy = clamp01(
      agent.energy +
        (0.18 + agent.life.physiology.recovery * 0.14) *
          bodyRecoveryScaleV21(this.state, agent.id),
    );
    agent.stress = clamp01(agent.stress - 0.055 - agent.personality.resilience * 0.02);
    agent.lastAction = 'rest';

    this.recordAgentEvent(agent, now, 'agent.rested', {
      energy: agent.energy,
      stress: agent.stress,
      locationId: agent.locationId,
    });
  }

  private performRelax(agent: AgentState, now: number): void {
    // Relaxation is a local recovery behavior, not an implicit expedition.
    // The old implementation could randomly choose a distant frontier meadow
    // from the global top-four list, leaving children/exhausted residents in
    // multi-week travel while their energy continued to fall. Exploration and
    // travel remain voluntary separate actions; relaxing stays within the
    // resident's own settlement when a quiet/natural place is available.
    const recoverAtHome =
      agent.energy < 0.58 ||
      agent.stress > 0.62 ||
      agent.personality.sociability < 0.42;
    const destination = recoverAtHome
      ? agent.homeId
      : this.localPlace(
          agent,
          ['quiet_space', 'meadow', 'forest', 'shore', 'river', 'lake'],
          agent.homeId,
        );

    if (this.travelBeforeAction(agent, destination, 'relax', now)) return;
    agent.energy = clamp01(
      agent.energy + 0.07 + agent.life.physiology.recovery * 0.08,
    );
    agent.stress = clamp01(
      agent.stress - 0.075 - agent.personality.resilience * 0.025,
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.012);
    agent.lastAction = 'relax';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.relaxed', {
      energy: agent.energy,
      stress: agent.stress,
      locationId: agent.locationId,
    });
  }

  private performWalk(agent: AgentState, now: number): void {
    const current = this.state.places[agent.locationId];
    const homeSettlementId = this.homeSettlementId(agent);
    const walkablePlaces = (current?.connectedPlaceIds ?? [])
      .map((placeId) => this.state.places[placeId])
      .filter(
        (place): place is WorldPlace =>
          place !== undefined &&
          place.kind !== 'home' &&
          place.id !== agent.locationId &&
          place.kind !== 'workshop' &&
          place.kind !== 'resource_field',
      );
    // An ordinary walk stays local when a local route exists. Crossing the
    // frontier remains a separate exploration choice, so routine strolling
    // cannot strand productive residents on a long expedition.
    const localDestinations = homeSettlementId
      ? walkablePlaces.filter(
          (place) => place.settlementId === homeSettlementId,
        )
      : [];
    const destinations = (localDestinations.length > 0
      ? localDestinations
      : walkablePlaces
    ).map((place) => place.id);
    const destination =
      destinations.length > 0 ? this.rng.pick(destinations) : this.localCommons(agent);

    this.moveAgent(agent, destination);
    agent.energy = clamp01(
      agent.energy - (0.012 + (1 - agent.life.physiology.mobility) * 0.016),
    );
    agent.stress = clamp01(agent.stress - 0.018);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.008);
    agent.skills.exploration = clamp01(agent.skills.exploration + 0.001);
    agent.lastAction = 'walk';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.walked', {
      locationId: agent.locationId,
    });
    const defensiveFit = clamp01(
      agent.mind.values.care * 0.34 +
        agent.personality.riskTolerance * 0.28 +
        agent.life.physiology.strength * 0.2 +
        agent.personality.diligence * 0.18,
    );
    const choseDefensivePatrol =
      agent.life.stage !== 'child' &&
      agent.life.health >= 0.45 &&
      homeSettlementId !== undefined &&
      defensiveFit >= 0.5 &&
      this.rng.next() < 0.12 + defensiveFit * 0.32;
    if (choseDefensivePatrol && homeSettlementId) {
      const livelihood = ensureLivelihoodV18(this.state, agent);
      livelihood.defensePracticeCount += 1;
      const warriorPractice =
        agent.personality.riskTolerance >= 0.58 &&
        agent.life.physiology.strength >= 0.5;
      recordLivelihoodPracticeV18(this.state, agent, {
        action: 'walk',
        placeId: agent.locationId,
        choiceRoll: this.rng.next(),
        professionHint: warriorPractice ? 'warrior' : 'guard',
        amount: warriorPractice ? 1.5 : 1.1,
      });
    }
  }

  private chooseHuntTarget(
    agent: AgentState,
  ): WildlifePopulation | undefined {
    const yieldBySpecies: Record<WildlifeSpecies, number> = {
      rabbit: 0.11,
      deer: 0.22,
      fish: 0.085,
      boar: 0.2,
      wolf: 0.16,
      bird: 0.07,
      dire_wolf: 0.24,
      ogre: 0.3,
      wraith: 0.04,
      century_humpback: 0,
    };

    const populations: Array<{
      population: WildlifePopulation;
      score: number;
    }> = [];
    let best:
      | { population: WildlifePopulation; score: number }
      | undefined;
    for (const population of Object.values(this.state.wildlife)) {
      if (
        population.species === CENTURY_HUMPBACK_SPECIES ||
        population.count <= 0 ||
        !this.state.places[population.habitatId] ||
        (population.habitatId !== agent.locationId && !(agent.knownPlaceIds ?? []).includes(population.habitatId))
      ) {
        continue;
      }
      const route = residentKnownPath(this.state, agent, population.habitatId);
      if (!route) continue;
      const distance = route.slice(1).reduce((sum, id, index) => {
        const from = this.state.places[route[index]], to = this.state.places[id];
        return sum + Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);
      }, 0);
      const candidate = {
        population,
        score:
          yieldBySpecies[population.species] * 2.4 +
          population.count / population.carryingCapacity -
          population.alertness * 0.5 +
          agent.personality.riskTolerance * population.threat * 0.18 -
          population.threat * 0.62 +
          agent.skills.hunting * 0.12 -
          distance * 0.055,
      };
      populations.push(candidate);
      if (!best || candidate.score > best.score) best = candidate;
    }
    if (agent.plan?.kind === 'hunt') {
      const planned = populations.reduce<
        { population: WildlifePopulation; score: number } | undefined
      >((current, candidate) => {
        if (candidate.population.habitatId !== agent.plan?.targetPlaceId) {
          return current;
        }
        return !current || candidate.score > current.score
          ? candidate
          : current;
      }, undefined)?.population;
      if (planned) return planned;
      agent.plan = undefined;
    }
    return best?.population;
  }

  private performHunt(
    agent: AgentState,
    selectedTarget: WildlifePopulation | undefined,
    environment: WorldEnvironment,
    now: number,
  ): void {
    const target = selectedTarget;
    if (!target) {
      this.performGather(agent, now);
      return;
    }

    ensureAgentV15State(this.state, agent);
    this.tryEquipAvailableV15Weapon(agent, now);
    const v15 = this.v15World();
    const weapon = this.v15WeaponForAgent(agent);
    const place = this.state.places[target.habitatId];
    const companions = this.agentsAtLocation(agent.locationId).filter((other) => {
      if (
        other.id === agent.id ||
        !other.life.alive ||
        other.locationId !== agent.locationId
      ) {
        return false;
      }
      const relation = this.state.relationships[relationshipKey(agent.id, other.id)];
      return relation !== undefined && relation.trust + relation.affinity > 1.05;
    }).length;
    const foodValueBySpecies: Record<WildlifeSpecies, number> = {
      rabbit: 0.45,
      deer: 0.8,
      fish: 0.34,
      boar: 0.76,
      wolf: 0.32,
      bird: 0.25,
      dire_wolf: 0.38,
      ogre: 0.2,
      wraith: 0.04,
      century_humpback: 0,
    };
    const riskDecision = decideHuntingAgencyV15(
      {
        id: agent.id,
        ageYears: agent.life.ageYears,
        level: agent.progression?.level ?? 1,
        health: agent.life.health,
        energy: agent.energy,
        stress: agent.stress,
        hungerPressure: 1 - agent.resources,
        riskTolerance: agent.personality.riskTolerance,
        curiosity: agent.personality.curiosity,
        dutyToOthers: clamp01(
          agent.mind.values.care * 0.55 + agent.personality.generosity * 0.45,
        ),
        rewardMotivation: agent.mind.values.ambition,
        physiology: { ...agent.life.physiology },
        combatMastery: agent.progression?.combatMastery ?? 0,
        huntingSkill: agent.skills.hunting,
        weapon,
        armorProtection: 0,
        groupSupport: clamp01(companions * 0.18),
        safetySupport: environment.safetySupport,
      },
      {
        targetId: target.id,
        species: target.species,
        isMonster: target.isMonster,
        threat: target.threat,
        placeDanger: place?.danger ?? 0.4,
        estimatedCount: Math.max(1, target.count),
        foodValue: foodValueBySpecies[target.species],
        rewardValue: target.isMonster ? 0.82 : 0.18,
      },
      'planned_hunt',
      this.rng.next(),
    );

    if (riskDecision.execution === 'avoid') {
      agent.plan = undefined;
      agent.energy = clamp01(agent.energy - 0.004);
      agent.stress = clamp01(agent.stress - 0.004);
      agent.lastAction = 'reflect';
      agent.lastMeaningfulEventAt = now;
      this.stageEvent({
        eventId: this.nextId('hunt-declined'),
        worldId: this.state.id,
        kind: 'agent.hunt.declined',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          species: target.species,
          estimatedLethalRisk: riskDecision.assessment.estimatedLethalRisk,
          willingnessProbability: riskDecision.willingnessProbability,
          forcedByEngine: false,
          worldMinutes: this.state.calendar.elapsedWorldMinutes,
        },
      });
      return;
    }

    if (riskDecision.execution === 'prepare_before_hunt') {
      agent.plan = {
        kind: 'hunt',
        targetPlaceId: target.habitatId,
        startedAt: agent.plan?.startedAt ?? now,
        expiresAt: now + 72,
      };
      const workshop = this.localPlace(agent, ['workshop'], 'workshop');
      if (this.travelBeforeAction(agent, workshop, 'work', now)) {
        this.stageEvent({
          eventId: this.nextId('hunt-preparation-travel'),
          worldId: this.state.id,
          kind: 'agent.hunt.preparation_travel',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: agent.id,
            species: target.species,
            workshopId: workshop,
            residentChoseGoal: true,
            physicalArrivalRequired: true,
          },
        });
        return;
      }
      this.tryEquipAvailableV15Weapon(agent, now);
      if (this.v15WeaponForAgent(agent).kind === 'none') {
        this.performWork(agent, now);
      }
      this.stageEvent({
        eventId: this.nextId('hunt-preparation'),
        worldId: this.state.id,
        kind: 'agent.hunt.prepared',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          species: target.species,
          recommendation: riskDecision.assessment.recommendation,
          residentChoseGoal: true,
          weaponKind: this.v15WeaponForAgent(agent).kind,
          worldMinutes: this.state.calendar.elapsedWorldMinutes,
        },
      });
      return;
    }

    if (agent.locationId !== target.habitatId) {
      agent.plan = {
        kind: 'hunt',
        targetPlaceId: target.habitatId,
        startedAt: agent.plan?.startedAt ?? now,
        // A plan is an intention, not a year-long command. Four canonical
        // quanta are ~24.3 Ainkrad days, after which the resident must form a
        // fresh decision. The plan can also be abandoned earlier below.
        expiresAt: now + 4,
      };
      if (
        this.travelBeforeAction(
          agent,
          target.habitatId,
          'hunt',
          now,
          'explore',
        )
      ) {
        agent.stress = clamp01(agent.stress - 0.004);
        return;
      }
    }
    agent.plan = undefined;

    const activeWeapon = this.v15WeaponForAgent(agent);
    if (target.species === 'fish' && availableBoat(this.state, agent) &&
        startBoatFishing(this.state, agent, target.id, this.rng.next(), this.rng.next())) {
      this.recordAgentEvent(agent, now, 'agent.boat.departed', { purpose: 'fishing', locationId: agent.locationId });
      return;
    }
    const activeWeaponItemId = v15.equipmentByAgentId[agent.id]?.weaponItemId;
    const yieldBySpecies: Record<WildlifeSpecies, number> = {
      rabbit: 0.11,
      deer: 0.22,
      fish: 0.085,
      boar: 0.2,
      wolf: 0.16,
      bird: 0.07,
      dire_wolf: 0.24,
      ogre: 0.3,
      wraith: 0.04,
      century_humpback: 0,
    };
    const fishingKnowledge = target.species === 'fish'
      ? this.state.v18?.secretLibrary.knowledgeByAgentId[agent.id]?.find(
          record => record.knowledgeId === 'fishing-handline-and-habitat',
        )?.understanding ?? 0 : 0;
    const successChance = clamp01(
      0.13 + fishingKnowledge * 0.16 +
        agent.skills.hunting * 0.39 +
        agent.personality.riskTolerance * 0.09 +
        agent.life.physiology.strength * 0.13 +
        agent.life.physiology.endurance * 0.09 +
        (agent.progression?.combatMastery ?? 0) * 0.11 +
        (target.species === 'fish' ? 0 : activeWeapon.effectiveness * 0.24 +
          activeWeapon.reach * 0.08 + activeWeapon.reliability * 0.05) +
        environment.safetySupport * 0.07 -
        agent.mind.emotions.fear * 0.18 -
        target.alertness * 0.31 -
        target.threat * 0.3,
    );
    const succeeded = this.rng.next() < successChance;
    const gathered = succeeded ? yieldBySpecies[target.species] : 0;

    agent.energy = clamp01(agent.energy - 0.055);
    agent.stress = clamp01(
      agent.stress + (succeeded ? -0.008 : 0.018),
    );
    agent.resources = clamp01(agent.resources + gathered);
    agent.skills.hunting = clamp01(
      agent.skills.hunting + (succeeded ? 0.006 : 0.003),
    );
    agent.needs.purpose = clamp01(
      agent.needs.purpose + (succeeded ? 0.035 : 0.008),
    );
    agent.lastAction = 'hunt';
    agent.lastMeaningfulEventAt = now;

    if (succeeded) {
      target.count -= 1;
      if (gathered > 0) {
        recordPhysicalGoodsV21(this.state, agent, 'meat', gathered * 0.62);
        if (!['fish', 'bird', 'wraith'].includes(target.species)) {
          recordPhysicalGoodsV21(this.state, agent, 'hide', gathered * 0.24);
        }
        if (target.isMonster) {
          recordPhysicalGoodsV21(
            this.state,
            agent,
            'monster_part',
            Math.max(0.02, gathered * 0.38),
          );
        }
        fulfillContractFromLivedActionV21(this.state, agent, {
          kind: 'hunt',
          settlementId: this.homeSettlementId(agent),
          targetPlaceId: target.habitatId,
          commodity: target.isMonster ? 'monster_part' : 'meat',
          quantity: 1,
          succeeded: true,
        });
      }
    } else if (activeWeapon.kind !== 'none') {
      v15.smithingByAgentId[agent.id].observedWeaponProblems += 1;
    }
    target.alertness = clamp01(
      target.alertness + (succeeded ? 0.2 : 0.11),
    );
    target.lastChangedAt = now;

    let monsterCountered = false;
    let monsterDamage = 0;
    let lethalChance = 0;
    const legendaryHero = hasDivineGiftV19(
      this.state,
      agent.id,
      'demon_king_hero',
    );
    if (
      target.threat >= 0.25 &&
      target.count > 0 &&
      (!succeeded || this.rng.next() < target.threat * 0.38)
    ) {
      monsterCountered = true;
      const equipmentProtection = clamp01(
        activeWeapon.effectiveness * 0.18 + activeWeapon.reach * 0.12,
      );
      monsterDamage = legendaryHero
        ? 0
        : clamp01(
        target.threat * 0.7 *
          this.rng.between(0.1, 0.3) *
          (1.18 - agent.life.physiology.strength * 0.38) *
          (1 - environment.safetySupport * 0.42) *
          (1 - (agent.progression?.combatMastery ?? 0) * 0.22) *
          (1 - equipmentProtection),
      );
      agent.life.health = clamp01(agent.life.health - monsterDamage);
      recordTraumaV21(
        this.state,
        agent,
        monsterDamage,
        target.isMonster ? 'monster' : 'wildlife',
        `${target.id}:${now}`,
      );
      agent.stress = clamp01(agent.stress + target.threat * 0.24);
      agent.mind.emotions.fear = clamp01(
        agent.mind.emotions.fear + target.threat * 0.36,
      );
      agent.mind.emotions.awe = clamp01(
        agent.mind.emotions.awe + target.threat * 0.12,
      );
      if (activeWeapon.kind !== 'none' && monsterDamage > 0.03) {
        v15.smithingByAgentId[agent.id].observedWeaponProblems += 1;
      }
      lethalChance = legendaryHero ? 0 : clamp01(
        (target.threat *
          (1 - agent.life.physiology.strength) *
          0.05 +
          (agent.life.health < 0.18 ? 0.055 : 0)) *
          (1 - environment.safetySupport * 0.58) *
          (1 - (agent.progression?.combatMastery ?? 0) * 0.24) *
          (1 - activeWeapon.effectiveness * 0.18),
      );
    }

    recordItemUseV21(
      this.state,
      activeWeaponItemId,
      target.threat + (succeeded ? 0.18 : 0.32),
      target.isMonster ? 0.02 : 0.006,
      agent.id,
    );

    this.recordAgentEvent(agent, now, 'agent.hunted', {
      species: target.species,
      succeeded,
      gathered,
      populationRemaining: target.count,
      monster: target.isMonster,
      monsterCountered,
      monsterDamage,
      estimatedLethalRisk: riskDecision.assessment.estimatedLethalRisk,
      willingnessProbability: riskDecision.willingnessProbability,
      weaponKind: activeWeapon.kind,
      weaponEffectiveness: activeWeapon.effectiveness,
      locationId: agent.locationId,
    });

    if (monsterCountered) {
      const livelihood = ensureLivelihoodV18(this.state, agent);
      livelihood.defensePracticeCount += 1;
      recordLivelihoodPracticeV18(this.state, agent, {
        action: 'hunt',
        placeId: agent.locationId,
        choiceRoll: this.rng.next(),
        professionHint: target.isMonster ? 'warrior' : 'guard',
        amount: target.isMonster ? 1.5 : 0.8,
      });
      this.stageEvent({
        eventId: this.nextId(target.isMonster ? 'monster-encounter' : 'wildlife-encounter'),
        worldId: this.state.id,
        kind: target.isMonster
          ? 'world.monster.encountered'
          : 'world.wildlife.defensive_encounter',
        source: 'world',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          species: target.species,
          habitatId: target.habitatId,
          reason: 'self_defense',
          damage: monsterDamage,
          lethalChance,
          weaponKind: activeWeapon.kind,
          survived: agent.life.health > 0.04,
        },
      });
      if (agent.life.health <= 0.04 || this.rng.next() < lethalChance) {
        this.recordDeath(
          agent,
          target.isMonster ? 'monster' : 'wildlife',
          now,
          {
            species: target.species,
            isMonster: target.isMonster,
            habitatId: target.habitatId,
            populationCount: target.count,
            carryingCapacity: target.carryingCapacity,
            threat: target.threat,
            escaped: false,
            damage: monsterDamage,
            lethalChance,
            encounterReason: 'self_defense',
          },
        );
      }
    }

    if (succeeded && target.count === 0) {
      this.stageEvent({
        eventId: this.nextId('wildlife'),
        worldId: this.state.id,
        kind: 'world.wildlife.depleted',
        source: 'world',
        occurredAt: now,
        payload: {
          populationId: target.id,
          species: target.species,
          habitatId: target.habitatId,
        },
      });
    }
  }

  private performBlockedSocialize(agent: AgentState, now: number): void {
    const commonsId = this.localCommons(agent);
    if (this.travelBeforeAction(agent, commonsId, 'socialize', now)) return;
    agent.energy = clamp01(agent.energy - 0.01);
    agent.stress = clamp01(agent.stress + 0.018);
    agent.needs.belonging = clamp01(agent.needs.belonging - 0.015);
    agent.lastAction = 'socialize';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.socialize.blocked', {
      socialOpportunity: 0,
      locationId: agent.locationId,
    });
  }

  private performGather(agent: AgentState, now: number): void {
    ensureAgentV15State(this.state, agent);
    const v15 = this.v15World();
    const profile = v15.knowledgeByAgentId[agent.id];
    const localResources = this.settlementResourcesForAgent(agent);
    const economy = this.settlementEconomyForAgent(agent);
    const settlementId = this.homeSettlementId(agent);
    const residents = Math.max(
      1,
      settlementId
        ? this.residentCountByHomeSettlement?.get(settlementId) ??
            Object.values(this.state.agents).filter(
              (candidate) =>
                candidate.life.alive &&
                this.homeSettlementId(candidate) === settlementId,
            ).length
        : 1,
    );
    const settlement = settlementId
      ? this.state.settlements[settlementId]
      : undefined;
    const homeCapacity = settlement
      ? settlement.memberPlaceIds
          .map((placeId) => this.state.places[placeId])
          .filter((place): place is WorldPlace => place?.kind === 'home')
          .reduce((sum, place) => sum + place.capacity, 0)
      : Number.POSITIVE_INFINITY;
    const housingReserve = Math.max(10, Math.ceil(residents * 0.25));
    const housingMaterialsNeeded = residents + housingReserve > homeCapacity;
    const desiredStocks: Record<V16MaterialKind, number> = {
      food: Math.max(1, residents * 0.18),
      wood: housingMaterialsNeeded ? 3.2 : 1.4,
      stone: housingMaterialsNeeded ? 2.4 : 1,
      metal: 0.35,
      fuel: 0.6,
    };
    const materialPriority: Record<V16MaterialKind, number> = {
      food: 1.6,
      wood: housingMaterialsNeeded ? 2.4 : 0.9,
      stone: housingMaterialsNeeded ? 2.6 : 0.8,
      metal: 0.55,
      fuel: 0.7,
    };
    const criticalFoodReserve = economy
      ? economy.stocks.food < Math.max(0.5, residents * 0.06)
      : false;
    const materialOrder = economy
      ? (Object.keys(desiredStocks) as V16MaterialKind[]).sort(
          (left, right) =>
            (criticalFoodReserve && right === 'food' ? 10 : 0) -
              (criticalFoodReserve && left === 'food' ? 10 : 0) ||
            Math.max(
              0,
              1 - economy.stocks[right] / desiredStocks[right],
            ) * materialPriority[right] -
              Math.max(
                0,
                1 - economy.stocks[left] / desiredStocks[left],
              ) * materialPriority[left] ||
            left.localeCompare(right),
        )
      : (['food'] as V16MaterialKind[]);
    const sourceKinds: Readonly<Record<V16MaterialKind, (place: WorldPlace) => boolean>> = {
      food: (place) =>
        place.kind === 'resource_field' ||
        place.kind === 'meadow' ||
        place.biome === 'plains',
      wood: (place) => place.kind === 'forest' || place.biome === 'forest',
      stone: (place) => place.kind === 'mountains' || place.kind === 'ruins',
      metal: (place) => place.kind === 'mountains' || place.kind === 'ruins',
      fuel: (place) =>
        place.kind === 'swamp' || place.kind === 'forest' || place.biome === 'forest',
    };
    let gatheredMaterial: V16MaterialKind = 'food';
    let gatheringPlace: WorldPlace | undefined;
    for (const material of materialOrder) {
      if (material === 'metal' && !this.v15HasMetalSource()) continue;
      const candidate = Object.values(this.state.places)
        .filter(
          (place) =>
            place.surface !== 'water' &&
            sourceKinds[material](place) &&
            (place.id === agent.locationId || (agent.knownPlaceIds ?? []).includes(place.id)) &&
            residentKnownPath(this.state, agent, place.id) !== undefined,
        )
        .sort((left, right) => {
          const leftLocal =
            settlementId && left.settlementId === settlementId ? 0 : 1;
          const rightLocal =
            settlementId && right.settlementId === settlementId ? 0 : 1;
          if (leftLocal !== rightLocal) return leftLocal - rightLocal;
          const routeDistance = (placeId: string) => {
            const route = residentKnownPath(this.state, agent, placeId);
            return route ? route.slice(1).reduce((sum, id, index) => {
              const from = this.state.places[route[index]], to = this.state.places[id];
              return sum + Math.hypot(to.mapX - from.mapX, to.mapY - from.mapY);
            }, 0) : Number.POSITIVE_INFINITY;
          };
          const leftDistance = routeDistance(left.id);
          const rightDistance = routeDistance(right.id);
          const recalledDifference = learnedSiteAdjustment(agent, 'gather', right.id) -
            learnedSiteAdjustment(agent, 'gather', left.id);
          return leftDistance - rightDistance + recalledDifference * 1.5 || left.id.localeCompare(right.id);
        })[0];
      if (!candidate) {
        if (material === 'food' && criticalFoodReserve) break;
        continue;
      }
      gatheredMaterial = material;
      gatheringPlace = candidate;
      break;
    }
    if (!gatheringPlace) {
      // The chosen gathering goal can require surveying a new source. Existing
      // useful supplies still take precedence over searching for a missing one.
      this.performExplore(agent, now);
      return;
    }
    if (this.travelBeforeAction(agent, gatheringPlace.id, 'gather', now)) {
      return;
    }
    const beforeBase = localResources.renewableBase;
    const capacityScale = productiveCapacityScaleV16(
      agent.race ?? 'human',
      agent.life.ageYears,
    );
    const effort = clamp01((
      0.46 +
        agent.skills.gathering * 0.3 +
        agent.life.physiology.strength * 0.14 +
        agent.personality.diligence * 0.1
    ) * capacityScale);
    const harvest = harvestRenewably(
      localResources,
      {
        id: agent.id,
        agricultureKnowledge: profile.agriculture,
        diligence: agent.personality.diligence,
      },
      {
        eventId: `harvest:${this.state.id}:${v15.learningSequence + 1}`,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
        effort,
      },
    );

    // A gatherer keeps most of the harvest while a smaller share remains in
    // communal stores. The renewable base is damaged separately and therefore
    // can recover through time/stewardship instead of being the same bucket.
    const personalShare = harvest.harvested * 0.72;
    const communityShare = harvest.harvested - personalShare;
    const farmingToolBonus = economy
      ? Math.min(0.3, economy.farmingTools * 0.04)
      : 0;
    const materialMultiplier: Record<V16MaterialKind, number> = {
      food: 1.8 + profile.agriculture * 1.2 + farmingToolBonus,
      // A deliberate building-timber trip moves logs, not handfuls of food.
      // Normalised output is therefore larger than casual fuel gathering.
      wood: housingMaterialsNeeded ? 4 : 0.9,
      stone: 0.75,
      metal: 0.22,
      fuel: 0.55,
    };
    const materialYield = harvest.harvested * materialMultiplier[gatheredMaterial];
    noteLearningMaterial(agent, gatheredMaterial, materialYield);
    let materialStored = materialYield;
    let materialOverflow = 0;
    if (economy) {
      materialStored = Math.min(
        materialYield,
        Math.max(
          0,
          economy.storageCapacity[gatheredMaterial] -
            economy.stocks[gatheredMaterial],
        ),
      );
      materialOverflow = materialYield - materialStored;
      economy.stocks[gatheredMaterial] += materialStored;
      economy.harvestEvents += 1;
      economy.harvestEventsByMaterial[gatheredMaterial] += 1;
      economy.lastHarvestWorldMinute = this.state.calendar.elapsedWorldMinutes;
    }
    localResources.storedResources = clamp01(
      localResources.storedResources + communityShare,
    );
    // renewableBase/fertility are normalized settlement-land indices, not a
    // one-person field. Applying the full normalized damage once per worker
    // made larger populations destroy the same hectare many times per tick.
    // Aggregate pressure still exhausts crowded land over decades, while
    // fallow years and learned stewardship can restore it.
    const settlementLandScale = Math.max(1, residents);
    localResources.renewableBase = clamp01(
      beforeBase - harvest.renewableBaseDamage / settlementLandScale,
    );
    localResources.fertility = clamp01(
      localResources.fertility - harvest.fertilityDamage / settlementLandScale,
    );
    this.refreshV15StoredResourceProjection();

    agent.energy = clamp01(agent.energy - 0.035);
    agent.stress = clamp01(agent.stress + 0.006);
    agent.resources = clamp01(agent.resources + personalShare);
    recordPhysicalGoodsV21(
      this.state,
      agent,
      gatheredMaterial,
      Math.min(personalShare, materialYield * 0.35),
    );
    if (gatheredMaterial === 'metal' || gatheredMaterial === 'stone') {
      fulfillContractFromLivedActionV21(this.state, agent, {
        kind: 'mining',
        settlementId,
        targetPlaceId: gatheringPlace.id,
        commodity: gatheredMaterial,
        quantity: Math.min(personalShare, materialYield * 0.35),
        succeeded: materialYield > 0,
      });
    }
    agent.skills.gathering = clamp01(
      agent.skills.gathering + 0.004 * (0.4 + capacityScale * 0.6),
    );
    agent.lastAction = 'gather';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.gathered', {
      gathered: personalShare,
      communityShare,
      material: gatheredMaterial,
      materialYield,
      materialStored,
      materialOverflow,
      settlementFood: economy?.stocks.food ?? null,
      settlementWood: economy?.stocks.wood ?? null,
      settlementStone: economy?.stocks.stone ?? null,
      settlementMetal: economy?.stocks.metal ?? null,
      settlementFuel: economy?.stocks.fuel ?? null,
      resources: agent.resources,
      poolRemaining: this.state.environment.resourcePool,
      renewableBaseBefore: beforeBase,
      renewableBaseRemaining: localResources.renewableBase,
      renewableBaseDamage: harvest.renewableBaseDamage,
      agricultureKnowledge: profile.agriculture,
      physicalCapacityScale: capacityScale,
      locationId: agent.locationId,
    });
  }

  private performWork(agent: AgentState, now: number): void {
    if (this.tryPerformHumanConstructionWork(agent, now)) return;
    const boatSite = boatWorkSite(this.state, agent);
    if (boatSite && this.rng.next() < 0.15 + agent.personality.curiosity * 0.35) {
      if (this.travelBeforeAction(agent, boatSite, 'work', now)) return;
      if (workOnBoat(this.state, agent)) {
        agent.lastAction = 'work';
        agent.lastMeaningfulEventAt = now;
        this.recordAgentEvent(agent, now, 'agent.boat.worked', { locationId: boatSite, materialsAndLaborRequired: true });
        return;
      }
    }
    const workshopId = this.localPlace(agent, ['workshop'], 'workshop');
    if (this.travelBeforeAction(agent, workshopId, 'work', now)) return;
    this.tryAdventureMarketTrade(agent, now);
    const capacityScale = productiveCapacityScaleV16(
      agent.race ?? 'human',
      agent.life.ageYears,
    );
    const produced =
      (0.018 +
        agent.skills.craft * 0.05 +
        agent.personality.diligence * 0.04 +
        agent.life.physiology.endurance * 0.022) *
      capacityScale;

    agent.resources = clamp01(agent.resources + produced);
    agent.energy = clamp01(agent.energy - 0.045);
    agent.stress = clamp01(
      agent.stress + 0.012 * (1 - agent.personality.resilience),
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.045);
    agent.skills.craft = clamp01(
      agent.skills.craft + 0.004 * (0.45 + capacityScale * 0.55),
    );
    recordMaterialPracticeV21(this.state, agent.id, produced);
    agent.lastAction = 'work';
    agent.lastWorkKind = 'ordinary';
    agent.lastMeaningfulEventAt = now;
    this.advanceV15SmithingFromWork(agent, now);

    this.recordAgentEvent(agent, now, 'agent.worked', {
      produced,
      physicalCapacityScale: capacityScale,
      resources: agent.resources,
      skill: agent.skills.craft,
      locationId: agent.locationId,
      workKind: 'ordinary',
    });
  }

  /** A resident who already chose ordinary work may freely join a known local
   * house project. Refusal falls through to their normal workshop activity. */
  private tryPerformHumanConstructionWork(
    agent: AgentState,
    now: number,
  ): boolean {
    if ((agent.race ?? 'human') !== 'human') return false;
    const settlementId = this.homeSettlementId(agent);
    if (!settlementId) return false;
    const economy = ensureSettlementEconomyV16(this.state, settlementId);
    const project = economy.activeHumanHomeProject;
    if (!project || !this.state.places[project.homeId]) return false;

    const residents = Object.values(this.state.agents).filter(
      (candidate) =>
        candidate.life.alive && this.homeSettlementId(candidate) === settlementId,
    );
    const settlement = this.state.settlements[settlementId];
    const housingCapacity = settlement.memberPlaceIds
      .map((placeId) => this.state.places[placeId])
      .filter((place): place is WorldPlace => place?.kind === 'home')
      .reduce((sum, place) => sum + place.capacity, 0);
    const localCrowding = clamp01(
      (residents.length - housingCapacity) / Math.max(6, housingCapacity),
    );
    const householdMember = project.intendedResidentIds.includes(agent.id);
    const willingness = humanConstructionVolunteerWillingnessV21(
      agent,
      householdMember,
      localCrowding,
    );
    if (willingness < 0.38 || this.rng.next() >= 0.12 + willingness * 0.62) {
      return false;
    }

    agent.knownPlaceIds ??= [];
    if (!agent.knownPlaceIds.includes(project.homeId)) {
      agent.knownPlaceIds.push(project.homeId);
      agent.knownPlaceIds = agent.knownPlaceIds.slice(-256);
    }
    if (this.travelBeforeAction(agent, project.homeId, 'work', now)) return true;

    ensureAgentV15State(this.state, agent);
    const constructionKnowledge = this.v15World().knowledgeByAgentId[agent.id].construction;
    const contribution = humanConstructionLaborV21({
      agent,
      constructionKnowledge,
      hasConstructionTool: economy.constructionTools > 0,
      season: worldCalendarAtMinutes(
        this.state.calendar.elapsedWorldMinutes,
      ).season,
    });
    project.laborCompletedPersonDays = Math.min(
      project.laborRequiredPersonDays,
      project.laborCompletedPersonDays + contribution,
    );
    project.lastProgressWorldMinute = this.state.calendar.elapsedWorldMinutes;
    project.stage = humanConstructionStageV21(
      project.laborCompletedPersonDays,
      project.laborRequiredPersonDays,
    );
    if (!project.builderIds.includes(agent.id)) {
      project.builderIds.push(agent.id);
      project.builderIds = project.builderIds.slice(-32);
    }

    agent.energy = clamp01(agent.energy - 0.052);
    agent.stress = clamp01(
      agent.stress + 0.008 * (1 - agent.personality.resilience),
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.052);
    agent.skills.craft = clamp01(agent.skills.craft + 0.0035);
    agent.lastAction = 'work';
    agent.lastWorkKind = 'construction';
    agent.lastMeaningfulEventAt = now;
    recordLivelihoodPracticeV18(this.state, agent, {
      action: 'work',
      placeId: project.homeId,
      choiceRoll: this.rng.next(),
      professionHint: 'builder',
      amount: Math.min(2, contribution / 2),
    });
    recordMaterialPracticeV21(this.state, agent.id, contribution);
    this.recordAgentEvent(agent, now, 'agent.worked', {
      workKind: 'construction',
      projectId: project.id,
      placeId: project.homeId,
      stage: project.stage,
      contributedPersonDays: contribution,
      completedPersonDays: project.laborCompletedPersonDays,
      requiredPersonDays: project.laborRequiredPersonDays,
      voluntary: true,
      locationId: agent.locationId,
    });

    if (
      project.laborCompletedPersonDays + 1e-9 >=
      project.laborRequiredPersonDays
    ) {
      this.completeHumanHomeProject(settlementId, now);
      fulfillContractFromLivedActionV21(this.state, agent, {
        kind: 'construction',
        settlementId,
        targetPlaceId: project.homeId,
        quantity: 1,
        succeeded: true,
      });
    }
    return true;
  }

  private completeHumanHomeProject(settlementId: string, now: number): void {
    const economy = ensureSettlementEconomyV16(this.state, settlementId);
    const project = economy.activeHumanHomeProject;
    if (!project) return;
    const site = this.state.places[project.homeId];
    if (!site) {
      economy.activeHumanHomeProject = undefined;
      return;
    }

    const settlement = this.state.settlements[settlementId];
    const sequence = settlement.memberPlaceIds.filter(
      (placeId) => this.state.places[placeId]?.kind === 'home',
    ).length + 1;
    site.kind = 'home';
    site.name = `Построенный дом ${sequence}`;
    site.capacity = 6;
    site.urbanLot = project.urbanLot;
    site.urbanLayoutVersion = 3;
    site.rotation = project.plotRotation;

    const movedResidentIds: string[] = [];
    for (const residentId of project.intendedResidentIds.slice(0, site.capacity)) {
      const resident = this.state.agents[residentId];
      if (
        !resident?.life.alive ||
        this.homeSettlementId(resident) !== settlementId
      ) {
        continue;
      }
      const priorHomeId = resident.homeId;
      resident.homeId = site.id;
      movedResidentIds.push(resident.id);
      this.stageEvent({
        eventId: this.nextId('household-move'),
        worldId: this.state.id,
        kind: 'agent.household.moved_home',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: resident.id,
          priorHomeId,
          homeId: site.id,
          settlementId,
          projectId: project.id,
          priorConsent: true,
        },
      });
    }

    economy.constructionEvents += 1;
    economy.lastConstructionWorldMinute = this.state.calendar.elapsedWorldMinutes;
    economy.activeHumanHomeProject = undefined;
    makeConnectionsReciprocal(this.state.places);
    this.rebuildSpatialProjection();
    refreshSettlementEconomyCapacityV16(this.state, economy);
    recordSettlementPracticeEvidenceV16(this.state, settlementId, 'craft');
    this.stageEvent({
      eventId: this.nextId('home-built'),
      worldId: this.state.id,
      kind: 'world.building.home_built',
      source: 'agent',
      occurredAt: now,
      payload: {
        settlementId,
        placeId: site.id,
        projectId: project.id,
        recipe: project.recipe,
        initiatedByAgentId: project.initiatedByAgentId,
        builderIds: [...project.builderIds],
        movedResidentIds,
        materialCost: { ...project.reservedMaterials },
        laborPersonDays: project.laborRequiredPersonDays,
        startedWorldMinute: project.startedWorldMinute,
        completedWorldMinute: this.state.calendar.elapsedWorldMinutes,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
      },
    });

    const builders = new Set(project.builderIds);
    for (const residentId of new Set([
      ...project.builderIds,
      ...movedResidentIds,
    ])) {
      const resident = this.state.agents[residentId];
      if (!resident?.life.alive) continue;
      const helpedBuild = builders.has(residentId);
      const movedIn = movedResidentIds.includes(residentId);
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: residentId,
        createdAt: now,
        kind: 'world_event',
        summary:
          helpedBuild && movedIn
            ? `${resident.name} remembers choosing to help build and move into ${site.name}.`
            : helpedBuild
              ? `${resident.name} remembers helping the household build ${site.name}.`
              : `${resident.name} remembers agreeing to move into ${site.name}.`,
        importance: movedIn ? 0.82 : 0.68,
        valence: 0.64,
        relatedAgentIds: [...new Set(project.intendedResidentIds)]
          .filter((agentId) => agentId !== residentId)
          .slice(0, 8),
      });
    }
  }

  private tryAdventureMarketTrade(agent: AgentState, now: number): void {
    const settlementId = this.state.places[agent.locationId]?.settlementId;
    if (!settlementId) return;
    const transaction = tryAdventureMarketTradeV19(
      this.state,
      agent,
      settlementId,
      this.rng.next(),
    );
    if (!transaction) return;
    this.stageEvent({
      eventId: this.nextId('adventure-market'),
      worldId: this.state.id,
      kind: `agent.market.${transaction.kind}`,
      source: 'agent',
      occurredAt: now,
      payload: {
        transactionId: transaction.id,
        agentId: agent.id,
        settlementId,
        physicalPlaceId: agent.locationId,
        originSettlementId: transaction.originSettlementId ?? null,
        coin: transaction.coin,
        food: transaction.food,
        artifactId: transaction.artifactId ?? null,
        voluntary: true,
      },
    });
  }

  private beginExplorationJourney(agent: AgentState, destinationId: string, now: number): boolean {
    const evidence = explorationEvidence(this.state, agent);
    evidence.journeyAttempts += 1;
    this.travelBeforeAction(agent, destinationId, 'explore', now, 'explore');
    if (agent.movement?.targetPlaceId !== destinationId) {
      evidence.failedRoutes += 1;
      agent.plan = undefined;
      return false;
    }
    evidence.journeysStarted += 1;
    evidence.pendingTargetPlaceId = destinationId;
    return true;
  }

  private performExplore(agent: AgentState, now: number): void {
    const evidence = explorationEvidence(this.state, agent);
    evidence.choices += 1;
    observeLocalPlacesV20(this.state, agent);
    if (availableBoat(this.state, agent) && startBoatExploration(this.state, agent, this.rng.next())) {
      // The boat has just departed from this physical shore, not yet arrived.
      evidence.provisionsTaken += this.drawV15HomeSettlementRation(agent, Math.max(0, 0.42 - agent.resources));
      evidence.journeyAttempts += 1;
      evidence.journeysStarted += 1;
      evidence.pendingTargetPlaceId = agent.movement?.targetPlaceId;
      this.recordAgentEvent(agent, now, 'agent.boat.departed', { purpose: 'exploration', locationId: agent.locationId });
      return;
    }
    const known = new Set(agent.knownPlaceIds ?? []);
    const livelihood = ensureLivelihoodV18(this.state, agent);
    const targetFrontier = residentExplorationTarget(
      this.state,
      agent,
      (placeId) => residentKnownPath(this.state, agent, placeId) !== undefined,
      residentSurveyedPlaceIds(this.state, agent),
      this.rng.next(),
    );
    if (!this.youngChildMayTravelTo(agent, targetFrontier)) {
      // The child still carries out the chosen curiosity locally; the safety
      // boundary changes distance, not personality or goal.
      this.performWalk(agent, now);
      return;
    }
    const adventure = syncAdventureEconomyV19(this.state);
    observeLocalPlacesV20(this.state, agent);
    let targetDungeon =
      agent.plan?.kind === 'dungeon_expedition'
        ? Object.values(adventure.dungeonsById).find(
            (dungeon) => dungeon.entrancePlaceId === agent.plan?.targetPlaceId,
          )
        : undefined;
    if (!targetDungeon && agent.plan?.kind !== 'dungeon_expedition') {
      const reachableDungeons = Object.values(adventure.dungeonsById)
        .map((dungeon) => ({
          dungeon,
          route: residentKnownPath(this.state, agent, dungeon.entrancePlaceId),
        }))
        .filter(
          (candidate): candidate is {
            dungeon: (typeof candidate)['dungeon'];
            route: string[];
          } => candidate.route !== undefined && known.has(candidate.dungeon.entrancePlaceId),
        )
        .sort(
          (left, right) =>
            left.route.length - right.route.length ||
            left.dungeon.id.localeCompare(right.dungeon.id),
        );
      targetDungeon = chooseDungeonExpeditionV19(
        this.state,
        agent,
        reachableDungeons.map((candidate) => candidate.dungeon.id),
        this.rng.next(),
      );
    }
    if (targetDungeon) {
      const entranceId = targetDungeon.entrancePlaceId;
      if (!this.youngChildMayTravelTo(agent, entranceId)) {
        this.performWalk(agent, now);
        return;
      }
      if (agent.locationId !== entranceId) {
        agent.plan = {
          kind: 'dungeon_expedition',
          targetPlaceId: entranceId,
          startedAt: agent.plan?.startedAt ?? now,
          expiresAt: now + 96,
        };
        if (!this.beginExplorationJourney(agent, entranceId, now)) return;
        agent.energy = clamp01(agent.energy - 0.018);
        agent.resources = clamp01(agent.resources - 0.006);
        agent.lastAction = 'explore';
        agent.lastMeaningfulEventAt = now;
        this.recordAgentEvent(agent, now, 'agent.dungeon.travel_started', {
          dungeonId: targetDungeon.id,
          entrancePlaceId: entranceId,
          rank: targetDungeon.rank,
          physicalRoute: true,
          voluntary: true,
          locationId: agent.locationId,
        });
        return;
      }

      agent.plan = undefined;
      if (!isAdventureCandidateV19(this.state, agent)) {
        // The journey remains real, but arriving exhausted does not force the
        // resident through the door. They recover and may choose again later.
        this.performRest(agent, now);
        return;
      }
      const party = formVoluntaryDungeonPartyV21(
        this.state,
        agent,
        targetDungeon,
        this.rng.next(),
      );
      const expedition = resolveDungeonExpeditionV19(
        this.state,
        agent,
        targetDungeon.id,
        {
          continuation: this.rng.next(),
          encounter: this.rng.next(),
          depth: this.rng.next(),
          artifact: this.rng.next(),
          artifactKind: this.rng.next(),
          ability: this.rng.next(),
        },
        party.map((member) => member.id),
      );
      for (const casualtyId of expedition.run.casualtyAgentIds ?? []) {
        const casualty = this.state.agents[casualtyId];
        if (!casualty?.life.alive) continue;
        this.recordDeath(casualty, 'catastrophe', now, {
          threat: targetDungeon.threat,
          escaped: false,
          damage: expedition.run.healthDamage,
          lethalChance: 1,
          encounterReason: 'dungeon',
        });
      }
      recordLivelihoodPracticeV18(this.state, agent, {
        action: 'explore',
        placeId: entranceId,
        choiceRoll: this.rng.next(),
        professionHint: 'adventurer',
        amount: expedition.run.outcome === 'success' ? 2 : 1.2,
      });
      agent.lastAction = 'explore';
      agent.lastMeaningfulEventAt = now;
      this.recordAgentEvent(agent, now, 'agent.dungeon.expedition', {
        runId: expedition.run.id,
        dungeonId: targetDungeon.id,
        entrancePlaceId: entranceId,
        outcome: expedition.run.outcome,
        rankBefore: expedition.run.rankBefore,
        rankAfter: expedition.run.rankAfter,
        clearedDepth: expedition.run.clearedDepth,
        experienceGained: expedition.run.experienceGained,
        coinRecovered: expedition.run.coinRecovered,
        artifactId: expedition.artifact?.id ?? null,
        artifactName: expedition.artifact?.name ?? null,
        learnedAbility: expedition.learnedAbility ?? null,
        healthDamage: expedition.run.healthDamage,
        partySize: expedition.run.partyAgentIds?.length ?? 1,
        partyAgentIds: (expedition.run.partyAgentIds ?? [agent.id]).join(','),
        casualtyCount: expedition.run.casualtyAgentIds?.length ?? 0,
        voluntary: true,
        locationId: agent.locationId,
      });
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'world_event',
        summary:
          expedition.run.outcome === 'success'
            ? `${agent.name} прошёл ${expedition.run.clearedDepth} уровней подземелья «${targetDungeon.name}».`
            : expedition.run.outcome === 'retreat'
              ? `${agent.name} сам решил отступить из подземелья «${targetDungeon.name}».`
              : `${agent.name} потерпел поражение и выбрался из подземелья «${targetDungeon.name}».`,
        importance: expedition.run.outcome === 'success' ? 0.76 : 0.62,
        valence:
          expedition.run.outcome === 'success'
            ? 0.58
            : expedition.run.outcome === 'retreat'
              ? -0.08
              : -0.52,
        relatedAgentIds: [],
      });
      return;
    }
    if (agent.locationId !== targetFrontier) {
      const route = residentKnownPath(this.state, agent, targetFrontier);
      const routeDistance = (route ?? []).slice(0, -1).reduce(
        (sum, placeId, index) =>
          sum +
          (this.state.routes[
            routeIdBetween(placeId, route?.[index + 1] ?? placeId)
          ]?.distance ?? 0),
        0,
      );
      const startsLongJourney =
        routeDistance >= 80 && agent.plan?.kind !== 'explore_frontier';
      agent.plan = {
        kind: 'explore_frontier',
        targetPlaceId: targetFrontier,
        startedAt: agent.plan?.startedAt ?? now,
        expiresAt: now + 48,
      };
      // Commit to the physical route once. Previously every graph hop needed
      // a fresh explore draw, so the probability of finishing a long journey
      // collapsed exponentially and residents circled their city forever.
      // The movement itself still takes time and remains interruptible by
      // physiology and later resident decisions.
      if (!this.beginExplorationJourney(agent, targetFrontier, now)) return;
      if (startsLongJourney) {
        livelihood.longJourneyCount += 1;
        recordLivelihoodPracticeV18(this.state, agent, {
          action: 'explore',
          placeId: agent.locationId,
          choiceRoll: this.rng.next(),
          professionHint: 'adventurer',
          amount: 1.4,
        });
      }
      agent.energy = clamp01(agent.energy - 0.016);
      agent.resources = clamp01(agent.resources - 0.004);
      agent.skills.exploration = clamp01(agent.skills.exploration + 0.001);
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.005);
      agent.lastAction = 'explore';
      agent.lastMeaningfulEventAt = now;
      this.recordAgentEvent(agent, now, 'agent.explored', {
        discovered: false,
        discovery: 0,
        traveling: true,
        frontierId: targetFrontier,
        growthStage: this.state.growth.stage,
        explorationProgress: this.state.growth.explorationProgress,
        discoveredRegionId: null,
        locationId: agent.locationId,
      });
      return;
    }
    // Mapping is earned here, at a physical survey, never when selecting
    // a destination or glimpsing a newly generated frontier from afar.
    if (recordResidentSurvey(this.state, agent, targetFrontier)) {
      evidence.surveys += 1;
      if (!livelihood.mappedPlaceIds.includes(targetFrontier)) livelihood.mappedPlaceIds.push(targetFrontier);
      evidence.newlyMapped += 1;
      livelihood.mappedPlaceIds = livelihood.mappedPlaceIds.slice(-128);
      recordLivelihoodPracticeV18(this.state, agent, {
        action: 'explore',
        placeId: agent.locationId,
        choiceRoll: this.rng.next(),
        professionHint: 'cartographer',
        amount: 0.7,
      });
    } else {
      evidence.frontierSearches = (evidence.frontierSearches ?? 0) + 1;
    }
    agent.plan = undefined;
    agent.energy = clamp01(agent.energy - 0.04);
    agent.resources = clamp01(agent.resources - 0.008);
    agent.skills.exploration = clamp01(agent.skills.exploration + 0.003);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.012);

    const discoveryChance = clamp01(
      0.08 +
        agent.skills.exploration * 0.2 +
        agent.personality.curiosity * 0.18 +
        agent.personality.riskTolerance * 0.08 -
        burdenIntensityV22(this.state, agent.id, 'misfortune') * 0.035,
    );
    const resourceDiscovered = this.rng.next() < discoveryChance;
    let discovery = 0;
    if (resourceDiscovered) {
      discovery = this.rng.between(0.035, 0.11);
      // Exploration may reveal or carry a small sample, but it cannot
      // teleport a discovered deposit into a settlement store. Supplying the
      // settlement still requires a later, chosen gathering trip.
      agent.resources = clamp01(agent.resources + discovery * 0.2);
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.035);
    }

    const progressGain =
      0.2 +
      agent.skills.exploration * 0.04 +
      agent.personality.curiosity * 0.03;
    const discoveredRegionId = this.advanceWorldGrowth(
      agent,
      progressGain,
      now,
    );
    if (discoveredRegionId) {
      agent.knownPlaceIds = [
        ...new Set([...(agent.knownPlaceIds ?? []), discoveredRegionId]),
      ];
      syncAdventureEconomyV19(this.state);
      if (this.youngChildMayTravelTo(agent, discoveredRegionId)) {
        agent.plan = {
          kind: 'explore_frontier', targetPlaceId: discoveredRegionId,
          startedAt: now, expiresAt: now + 48,
        };
        this.beginExplorationJourney(agent, discoveredRegionId, now);
      }

    }

    agent.lastAction = 'explore';
    agent.lastMeaningfulEventAt = now;

    this.recordAgentEvent(agent, now, 'agent.explored', {
      discovered: resourceDiscovered,
      discovery,
      carriedSample: discovery * 0.2,
      fabricatedStoredResources: 0,
      resourcePool: this.state.environment.resourcePool,
      growthStage: this.state.growth.stage,
      explorationProgress: this.state.growth.explorationProgress,
      discoveredRegionId: discoveredRegionId ?? null,
      locationId: agent.locationId,
    });
  }

  private advanceWorldGrowth(
    agent: AgentState,
    progressGain: number,
    now: number,
  ): string | undefined {
    const expansionRate =
      this.lawValue('frontier_expansion', 1);
    const currentStage = this.state.growth.stage;
    const nextStage = currentStage + 1;
    // Exploration consumes effort, not a fixed list of biomes or a ten-year lock.
    // Established worlds retain slower survey effort without prescribing distance.
    const distantFrontierMultiplier = currentStage >= 3 ? 0.18 : 1;
    const frontierDifficulty = 1 + Math.max(0, currentStage - 3) * 0.11;
    this.state.growth.explorationProgress = clamp01(
      this.state.growth.explorationProgress +
        (progressGain * expansionRate * distantFrontierMultiplier) / frontierDifficulty,
    );
    if (this.state.growth.explorationProgress < 1) {
      return undefined;
    }

    const expansion = this.createProceduralExpansion(nextStage, now, agent);
    if(!expansion)return undefined;

    this.state.places[expansion.place.id] = {
      ...structuredClone(expansion.place),
      discoveredAt: now,
    };
    for (const connectedId of expansion.place.connectedPlaceIds) {
      const connected = this.state.places[connectedId];
      if (
        connected &&
        !connected.connectedPlaceIds.includes(expansion.place.id)
      ) {
        connected.connectedPlaceIds.push(expansion.place.id);
      }
    }
    for (const population of expansion.wildlife) {
      this.state.wildlife[population.id] = {
        ...structuredClone(population),
        lastChangedAt: now,
      };
    }
    this.rebuildSpatialProjection();

    this.state.growth.stage = expansion.stage;
    this.state.growth.frontierSequence = Math.max(
      this.state.growth.frontierSequence + 1,
      expansion.stage,
    );
    this.state.growth.explorationProgress = 0;
    this.state.growth.lastExpansionAt = now;
    this.state.growth.lastExpansionWorldMinutes =
      this.state.calendar.elapsedWorldMinutes;
    this.state.growth.discoveredRegionIds.push(expansion.place.id);

    this.stageEvent({
      eventId: this.nextId('world-growth'),
      worldId: this.state.id,
      kind: 'world.region.discovered',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        regionId: expansion.place.id,
        regionKind: expansion.place.kind,
        biome: expansion.place.biome,
        stage: expansion.stage,
        connectedPlaceIds: expansion.place.connectedPlaceIds,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
      },
    });
    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: agent.id,
      createdAt: now,
      kind: 'world_event',
      summary: `${agent.name} discovered ${expansion.place.name}.`,
      importance: 0.82,
      valence: 0.62,
      relatedAgentIds: [],
    });

    return expansion.place.id;
  }

  private v15ScheduleTick(now: number): number {
    return this.activeSimulationQuantumIndex ?? now;
  }

  private advanceVoluntaryResettlement(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick) || scheduleTick % 24 !== 0) return;

    const settlements = Object.values(this.state.settlements);
    if (settlements.length < 2) return;

    const adults = this.shuffled(
      Object.values(this.state.agents).filter(
        (agent) =>
          agent.life.alive &&
          agent.life.stage === 'adult' &&
          !agent.movement &&
          !agent.plan &&
          agent.resources >= 0.24 &&
          agent.stress <= 0.78,
      ),
    );

    for (const agent of adults) {
      const currentSettlementId = this.homeSettlementId(agent);
      const currentPressure = currentSettlementId
        ? this.state.v18?.settlementLifecycleById[currentSettlementId]
            ?.departurePressure ?? 0
        : 0.45;
      const willingness = clamp01(
        agent.personality.curiosity * 0.22 +
          agent.personality.riskTolerance * 0.15 +
          agent.mind.values.ambition * 0.17 +
          agent.skills.exploration * 0.13 +
          (1 - agent.needs.purpose) * 0.12 +
          currentPressure * 0.21 -
          agent.needs.belonging * agent.mind.values.tradition * 0.12,
      );
      if (willingness < 0.5) continue;
      if (this.rng.next() >= 0.012 + willingness * 0.06) continue;

      const options = settlements
        .filter(
          (settlement) =>
            settlement.id !== currentSettlementId &&
            residentKnownPath(this.state, agent, settlement.centerPlaceId) !== undefined,
        )
        .map((settlement) => {
          const center = this.state.places[settlement.centerPlaceId];
          const distance = Math.max(
            0,
            (residentKnownPath(this.state, agent, settlement.centerPlaceId)?.length ?? 1) - 1,
          );
          const score =
            willingness * 0.34 +
            (center?.fertility ?? 0.5) * 0.24 -
            (center?.danger ?? 0.1) *
              (0.22 + (1 - agent.personality.riskTolerance) * 0.24) -
            (this.state.v18?.settlementLifecycleById[settlement.id]
              ?.departurePressure ?? 0) * 0.2 -
            distance * 0.025;
          return { settlement, score };
        })
        .sort((a, b) => b.score - a.score);

      const selected = options[0]?.settlement;
      if (!selected) continue;

      const homes = selected.memberPlaceIds
        .map((placeId) => this.state.places[placeId])
        .filter((place): place is WorldPlace => place?.kind === 'home')
        .sort((a, b) => a.id.localeCompare(b.id));
      const home = homes.find((candidate) => {
        const occupants = Object.values(this.state.agents).filter(
          (other) => other.life.alive && other.homeId === candidate.id,
        ).length;
        return occupants < candidate.capacity;
      });
      if (!home) continue;

      const priorHomeId = agent.homeId;
      const priorSettlementId = currentSettlementId ?? null;
      agent.homeId = home.id;
      this.moveAgent(agent, selected.centerPlaceId);
      agent.needs.purpose = clamp01(agent.needs.purpose + 0.06);
      agent.mind.emotions.hope = clamp01(agent.mind.emotions.hope + 0.04);
      agent.lastMeaningfulEventAt = now;

      this.stageEvent({
        eventId: this.nextId('resettlement'),
        worldId: this.state.id,
        kind: 'agent.resettled',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          priorHomeId,
          priorSettlementId,
          settlementId: selected.id,
          homeId: home.id,
          willingness,
          reason:
            currentPressure >= 0.5
              ? 'voluntary_departure_under_local_pressure'
              : 'voluntary_move_toward_opportunity',
        },
      });
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'world_event',
        summary: `${agent.name} chose to make a new home in ${selected.name}.`,
        importance: 0.78,
        valence: 0.52,
        relatedAgentIds: [],
      });
    }
  }

  private advanceSettlementMaterialProjects(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick)) return;
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;

    for (const settlement of Object.values(this.state.settlements).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const residents = Object.values(this.state.agents).filter(
        (agent) =>
          agent.life.alive && this.homeSettlementId(agent) === settlement.id,
      );
      const economy = ensureSettlementEconomyV16(this.state, settlement.id);
      const humanSettlement =
        settlementFoundingRace(this.state, settlement.id) === 'human';
      if (humanSettlement && economy.activeHumanHomeProject) {
        const project = economy.activeHumanHomeProject;
        if (!this.state.places[project.homeId]) {
          economy.stocks.wood = Math.min(
            economy.storageCapacity.wood,
            economy.stocks.wood + project.reservedMaterials.wood,
          );
          economy.stocks.stone = Math.min(
            economy.storageCapacity.stone,
            economy.stocks.stone + project.reservedMaterials.stone,
          );
          economy.activeHumanHomeProject = undefined;
        } else {
          continue;
        }
      }
      const homePlaces = settlement.memberPlaceIds
        .map((placeId) => this.state.places[placeId])
        .filter((place): place is WorldPlace => place?.kind === 'home');
      const occupancy = new Map<string, number>();
      for (const resident of residents) {
        occupancy.set(
          resident.homeId,
          (occupancy.get(resident.homeId) ?? 0) + 1,
        );
      }
      // A claimant remains a claimant while away: current body location never
      // turns an expedition or caravan journey into abandonment.
      const reusableHomes = reusableAbandonedHomesV21(
        this.state,
        settlement.id,
      );
      const homeCapacity = homePlaces.reduce(
        (sum, place) => sum + place.capacity,
        0,
      );
      // A genuine housing shortage stays salient. Residents still have to
      // choose workshop labour and independently accept the project, but the
      // engine must not sample that choice on only one arbitrary day each
      // season and miss every real opportunity.
      const housingReserve = Math.max(10, Math.ceil(residents.length * 0.25));
      const needsHome = residents.length + housingReserve > homeCapacity;
      const housingMaterialsReady = humanSettlement && needsHome &&
        selectHumanHouseRecipeV21(
          economy,
          ensureSettlementResourcesV16(this.state, settlement.id),
        ) !== undefined;
      const decisionCooldownQuanta = housingMaterialsReady ? 1 : 24;
      if (economy.lastMaterialProjectDecisionWorldMinute !== undefined &&
        worldMinutes - economy.lastMaterialProjectDecisionWorldMinute <
          decisionCooldownQuanta * V15_SIMULATION_QUANTUM_WORLD_MINUTES) continue;
      const workers = this.shuffled(
        residents.filter(
          (agent) =>
            agent.life.stage === 'adult' &&
            agent.life.health >= 0.48 &&
            agent.energy >= 0.24 &&
            !agent.movement &&
            agent.lastAction === 'work' &&
            this.state.places[agent.locationId]?.kind === 'workshop',
        ),
      ).sort(
        (a, b) =>
          b.skills.craft + b.personality.diligence -
            (a.skills.craft + a.personality.diligence) ||
          a.id.localeCompare(b.id),
      );
      const worker = workers[0];
      if (!worker) continue;
      economy.lastMaterialProjectDecisionWorldMinute = worldMinutes;
      refreshSettlementEconomyCapacityV16(this.state, economy);
      const workshopId = settlement.memberPlaceIds.find(
        (placeId) => this.state.places[placeId]?.kind === 'workshop',
      ) ?? settlement.centerPlaceId;

      const crowding = (candidate: AgentState) => {
        const home = this.state.places[candidate.homeId];
        return clamp01(
          ((occupancy.get(candidate.homeId) ?? 1) -
            (home?.capacity ?? 1)) /
            Math.max(1, home?.capacity ?? 1),
        );
      };
      const rankedInitiators = [...workers].sort(
        (left, right) =>
          humanHousingInitiativeV21(right, crowding(right)) -
            humanHousingInitiativeV21(left, crowding(left)) ||
          (occupancy.get(right.homeId) ?? 1) -
            (occupancy.get(left.homeId) ?? 1) ||
          right.skills.craft - left.skills.craft ||
          left.id.localeCompare(right.id),
      );
      const initiator = rankedInitiators[0];
      const householdCrowding = initiator ? crowding(initiator) : 0;
      const initiative = initiator
        ? humanHousingInitiativeV21(initiator, householdCrowding)
        : 0;

      // Repair and reuse precede new construction. The decision still needs a
      // willing adult who has actually chosen workshop labour, a shared home
      // to relieve, real materials and one lived work quantum. At least one
      // resident stays in the prior home, preventing pointless home swaps.
      const reusableHome = reusableHomes[0];
      const priorHouseholdSize = initiator
        ? occupancy.get(initiator.homeId) ?? 1
        : 0;
      const repairWood = 0.14;
      const repairStone = 0.04;
      if (
        initiator &&
        reusableHome &&
        priorHouseholdSize >
          (this.state.places[initiator.homeId]?.capacity ?? 1) &&
        initiative >= 0.32 &&
        economy.stocks.wood >= repairWood &&
        economy.stocks.stone >= repairStone &&
        this.rng.next() < 0.14 + initiative * 0.5
      ) {
        const priorHomeId = initiator.homeId;
        const maximumMove = Math.min(
          reusableHome.capacity,
          priorHouseholdSize - 1,
        );
        const household = residents
          .filter((resident) => resident.homeId === priorHomeId)
          .sort(
            (left, right) =>
              Number(right.id === initiator.id) -
                Number(left.id === initiator.id) ||
              Number(
                right.life.parentIds.includes(initiator.id) ||
                  initiator.life.childIds.includes(right.id),
              ) -
                Number(
                  left.life.parentIds.includes(initiator.id) ||
                    initiator.life.childIds.includes(left.id),
                ) ||
              left.id.localeCompare(right.id),
          );
        const movedResidentIds = household
          .slice(0, Math.max(1, maximumMove))
          .map((resident) => resident.id);

        economy.stocks.wood -= repairWood;
        economy.stocks.stone -= repairStone;
        economy.constructionEvents += 1;
        economy.lastConstructionWorldMinute = worldMinutes;
        initiator.energy = clamp01(initiator.energy - 0.045);
        initiator.skills.craft = clamp01(initiator.skills.craft + 0.0035);
        for (const residentId of movedResidentIds) {
          const resident = this.state.agents[residentId];
          if (!resident?.life.alive) continue;
          resident.homeId = reusableHome.id;
          resident.knownPlaceIds ??= [];
          if (!resident.knownPlaceIds.includes(reusableHome.id)) {
            resident.knownPlaceIds.push(reusableHome.id);
            resident.knownPlaceIds = resident.knownPlaceIds.slice(-256);
          }
          this.stageEvent({
            eventId: this.nextId('household-reoccupy'),
            worldId: this.state.id,
            kind: 'agent.household.moved_home',
            source: 'agent',
            occurredAt: now,
            payload: {
              agentId: resident.id,
              priorHomeId,
              homeId: reusableHome.id,
              settlementId: settlement.id,
              reason: 'voluntary_reoccupation_after_repair',
              priorConsent: true,
            },
          });
        }
        recordLivelihoodPracticeV18(this.state, initiator, {
          action: 'work',
          placeId: workshopId,
          choiceRoll: this.rng.next(),
          professionHint: 'builder',
          amount: 0.8,
        });
        recordMaterialPracticeV21(this.state, initiator.id, 0.8);
        recordSettlementPracticeEvidenceV16(
          this.state,
          settlement.id,
          'craft',
        );
        this.stageEvent({
          eventId: this.nextId('home-repaired'),
          worldId: this.state.id,
          kind: 'world.building.home_repaired',
          source: 'agent',
          occurredAt: now,
          payload: {
            settlementId: settlement.id,
            placeId: reusableHome.id,
            repairedByAgentId: initiator.id,
            movedResidentIds,
            materialCost: { wood: repairWood, stone: repairStone },
            voluntary: true,
            worldMinutes,
          },
        });
        continue;
      }

      const neededFarmingTools = Math.max(1, Math.ceil(residents.length / 8));
      const neededConstructionTools = Math.max(
        1,
        Math.ceil(residents.length / 14),
      );

      if (humanSettlement && needsHome) {
        const localLand = ensureSettlementResourcesV16(
          this.state,
          settlement.id,
        );
        const recipe = selectHumanHouseRecipeV21(economy, localLand);
        const constructionKnowledge = initiator
          ? (this.v15World().knowledgeByAgentId[initiator.id]?.construction ?? 0)
          : 0;

        if (
          initiator &&
          recipe &&
          constructionKnowledge >= 0.025 &&
          initiative >= 0.38 &&
          this.rng.next() < 0.08 + initiative * 0.44
        ) {
          let sequence = homePlaces.length + 1;
          let homeId = `${settlement.id}_built_home_${sequence}`;
          while (this.state.places[homeId]) {
            sequence += 1;
            homeId = `${settlement.id}_built_home_${sequence}`;
          }
          const center = this.state.places[settlement.centerPlaceId];
          const plot = nextUrbanHomeLot(
            this.state.places,
            { x: center.mapX, y: center.mapY },
            settlement.id,
          );
          if (plot) {
            economy.stocks.wood -= recipe.wood;
            economy.stocks.stone -= recipe.stone;
            const sameHome = residents
              .filter((resident) => resident.homeId === initiator.homeId)
              .sort(
                (left, right) =>
                  Number(right.id === initiator.id) -
                    Number(left.id === initiator.id) ||
                  Number(
                    right.life.parentIds.includes(initiator.id) ||
                      initiator.life.childIds.includes(right.id),
                  ) -
                    Number(
                      left.life.parentIds.includes(initiator.id) ||
                        initiator.life.childIds.includes(left.id),
                    ) ||
                  left.id.localeCompare(right.id),
              );
            const intendedResidentIds = [initiator.id];
            for (const candidate of sameHome) {
              if (
                candidate.id === initiator.id ||
                intendedResidentIds.length >= 6
              ) {
                continue;
              }
              const dependentChild =
                (candidate.life.stage === 'child' ||
                  candidate.life.stage === 'adolescent') &&
                (candidate.life.parentIds.includes(initiator.id) ||
                  initiator.life.childIds.includes(candidate.id));
              const acceptsHouseholdMove =
                dependentChild ||
                ((candidate.life.stage === 'adult' ||
                  candidate.life.stage === 'elder') &&
                  this.rng.next() <
                    0.34 +
                      householdCrowding * 0.28 +
                      candidate.mind.values.care * 0.16 +
                      candidate.needs.belonging * 0.1);
              if (acceptsHouseholdMove) intendedResidentIds.push(candidate.id);
            }
            const laborRequiredPersonDays = Math.round(
              recipe.laborPersonDays *
                (1.08 - constructionKnowledge * 0.18) *
                (economy.constructionTools > 0 ? 0.92 : 1.08),
            );
            this.state.places[homeId] = createPlace(
              homeId,
              `Строящийся дом ${sequence}`,
              'construction_site',
              1,
              {
                biome: 'settlement',
                mapX: plot.x,
                mapY: plot.y,
                connectedPlaceIds: [settlement.centerPlaceId],
                fertility: 0.54,
                danger: 0.045,
                surface: 'land',
                settlementId: settlement.id,
                discoveredAt: now,
              },
            );
            this.state.places[homeId].urbanLot = plot.lot;
            this.state.places[homeId].urbanLayoutVersion = 3;
            this.state.places[homeId].rotation = plot.rotation;
            economy.activeHumanHomeProject = {
              id: `human-home-project:${settlement.id}:${sequence}`,
              settlementId: settlement.id,
              homeId,
              recipe: recipe.id,
              initiatedByAgentId: initiator.id,
              intendedResidentIds,
              builderIds: [],
              plotX: plot.x,
              plotY: plot.y,
              plotRotation: plot.rotation,
              urbanLot: plot.lot,
              startedWorldMinute: worldMinutes,
              stage: 'site_selection',
              laborRequiredPersonDays,
              laborCompletedPersonDays: 0,
              reservedMaterials: {
                wood: recipe.wood,
                stone: recipe.stone,
              },
            };
            for (const residentId of intendedResidentIds) {
              const resident = this.state.agents[residentId];
              if (!resident) continue;
              resident.knownPlaceIds ??= [];
              if (!resident.knownPlaceIds.includes(homeId)) {
                resident.knownPlaceIds.push(homeId);
                resident.knownPlaceIds = resident.knownPlaceIds.slice(-256);
              }
            }
            makeConnectionsReciprocal(this.state.places);
            this.rebuildSpatialProjection();
            this.stageEvent({
              eventId: this.nextId('home-started'),
              worldId: this.state.id,
              kind: 'world.building.home_started',
              source: 'agent',
              occurredAt: now,
              payload: {
                projectId: economy.activeHumanHomeProject.id,
                settlementId: settlement.id,
                placeId: homeId,
                initiatedByAgentId: initiator.id,
                intendedResidentIds,
                recipe: recipe.id,
                materialReservation: {
                  wood: recipe.wood,
                  stone: recipe.stone,
                },
                laborRequiredPersonDays,
                voluntary: true,
                worldMinutes,
              },
            });
            continue;
          }
        }
      }

      const willingness = clamp01(
        worker.personality.diligence * 0.3 +
          worker.personality.curiosity * 0.18 +
          worker.mind.values.care * 0.18 +
          worker.skills.craft * 0.26 +
          worker.needs.purpose * 0.08,
      );
      if (this.rng.next() >= 0.08 + willingness * 0.34) continue;

      if (
        !humanSettlement &&
        needsHome &&
        economy.stocks.wood >= 0.65 &&
        economy.stocks.stone >= 0.35 &&
        (economy.constructionTools > 0 || worker.skills.craft >= 0.34)
      ) {
        economy.stocks.wood -= 0.65;
        economy.stocks.stone -= 0.35;
        let sequence = homePlaces.length + 1;
        let homeId = `${settlement.id}_built_home_${sequence}`;
        while (this.state.places[homeId]) {
          sequence += 1;
          homeId = `${settlement.id}_built_home_${sequence}`;
        }
        const center = this.state.places[settlement.centerPlaceId];
        const plot = nextUrbanHomeLot(this.state.places, { x: center.mapX, y: center.mapY }, settlement.id);
        if (!plot) {
          economy.stocks.wood += 0.65;
          economy.stocks.stone += 0.35;
          continue;
        }
        this.state.places[homeId] = createPlace(
          homeId,
          `Построенный дом ${sequence}`,
          'home',
          6,
          {
            biome: 'settlement',
            mapX: plot.x,
            mapY: plot.y,
            connectedPlaceIds: [settlement.centerPlaceId],
            fertility: 0.54,
            danger: 0.035,
            surface: 'land',
            settlementId: settlement.id,
            discoveredAt: now,
          },
        );
        this.state.places[homeId].urbanLot = plot.lot;
        this.state.places[homeId].urbanLayoutVersion = 3;
        this.state.places[homeId].rotation = plot.rotation;
        makeConnectionsReciprocal(this.state.places);
        this.rebuildSpatialProjection();
        economy.constructionEvents += 1;
        economy.lastConstructionWorldMinute = worldMinutes;
        worker.energy = clamp01(worker.energy - 0.08);
        worker.skills.craft = clamp01(worker.skills.craft + 0.006);
        recordLivelihoodPracticeV18(this.state, worker, {
          action: 'work',
          placeId: workshopId,
          choiceRoll: this.rng.next(),
          professionHint: 'builder',
          amount: 1.5,
        });
        recordSettlementPracticeEvidenceV16(
          this.state,
          settlement.id,
          'craft',
        );
        this.stageEvent({
          eventId: this.nextId('home-built'),
          worldId: this.state.id,
          kind: 'world.building.home_built',
          source: 'agent',
          occurredAt: now,
          payload: {
            settlementId: settlement.id,
            placeId: homeId,
            builderId: worker.id,
            materialCost: { wood: 0.65, stone: 0.35 },
            worldMinutes,
          },
        });
        continue;
      }

      // Once a settlement already has the competence/tool to build, do not
      // spend its reserved housing materials on additional small tools while
      // the next home is still waiting for wood and stone.
      if (
        needsHome &&
        (economy.constructionTools > 0 || worker.skills.craft >= 0.34)
      ) {
        continue;
      }

      const toolKind =
        needsHome
          ? 'construction'
          : economy.farmingTools < neededFarmingTools
          ? 'farming'
          : economy.constructionTools < neededConstructionTools
            ? 'construction'
            : undefined;
      if (!toolKind) continue;
      const metalCost = economy.stocks.metal >= 0.04 ? 0.04 : 0;
      const stoneCost = metalCost > 0 ? 0.02 : 0.08;
      if (
        economy.stocks.wood < 0.12 ||
        economy.stocks.stone < stoneCost ||
        economy.stocks.metal < metalCost
      ) {
        continue;
      }
      economy.stocks.wood -= 0.12;
      economy.stocks.stone -= stoneCost;
      economy.stocks.metal -= metalCost;
      if (toolKind === 'farming') economy.farmingTools += 1;
      else economy.constructionTools += 1;
      economy.toolsCreated += 1;
      const v15 = this.v15World();
      const itemId = `tool:${this.state.id}:${++v15.itemSequence}`;
      v15.items[itemId] = {
        id: itemId,
        kind: 'artifact',
        name:
          toolKind === 'farming'
            ? 'Сельскохозяйственный инструмент'
            : 'Строительный инструмент',
        createdByAgentId: worker.id,
        createdWorldMinute: worldMinutes,
        locationId: workshopId,
        quality: clamp01(0.35 + worker.skills.craft * 0.45),
        effectiveness: clamp01(0.28 + worker.skills.craft * 0.42),
        reliability: clamp01(0.46 + worker.personality.diligence * 0.38),
        description:
          'Обычный житель изготовил инструмент из реально доступных материалов поселения.',
      };
      worker.energy = clamp01(worker.energy - 0.055);
      worker.skills.craft = clamp01(worker.skills.craft + 0.004);
      recordLivelihoodPracticeV18(this.state, worker, {
        action: 'work',
        placeId: workshopId,
        choiceRoll: this.rng.next(),
        professionHint: 'artisan',
        amount: 1.25,
      });
      recordSettlementPracticeEvidenceV16(this.state, settlement.id, 'craft');
      this.stageEvent({
        eventId: this.nextId('tool-crafted'),
        worldId: this.state.id,
        kind: 'world.item.tool_crafted',
        source: 'agent',
        occurredAt: now,
        payload: {
          settlementId: settlement.id,
          agentId: worker.id,
          itemId,
          toolKind,
          materialCost: { wood: 0.12, stone: stoneCost, metal: metalCost },
          worldMinutes,
        },
      });
    }
  }

  /**
   * Settlements first meet through reachable residents. Scarcity, disputed
   * claims and accumulated grievances can then produce war, but only when
   * actual adults on both sides independently accept the risk. Peace, trade
   * and simple indifference remain valid outcomes.
   */
  private advanceSettlementRelationsAndConflict(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick) || scheduleTick % 24 !== 0) return;

    const settlements = Object.values(this.state.settlements).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    if (settlements.length < 2) return;
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    );
    const residentsOf = (settlementId: string) =>
      living.filter((agent) => this.homeSettlementId(agent) === settlementId);

    for (let leftIndex = 0; leftIndex < settlements.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < settlements.length;
        rightIndex += 1
      ) {
        const settlementA = settlements[leftIndex];
        const settlementB = settlements[rightIndex];
        const residentsA = residentsOf(settlementA.id);
        const residentsB = residentsOf(settlementB.id);
        if (residentsA.length < 2 || residentsB.length < 2) continue;

        const route = this.pathBetween(
          settlementA.centerPlaceId,
          settlementB.centerPlaceId,
        );
        if (!route) continue;
        // A connected atlas is not shared knowledge. Delegates and armies
        // require testimony or a resident who actually reached the other town.
        const knowsOther = (locals: AgentState[], otherId: string) =>
          locals.some(person => (person.knownPlaceIds ?? []).includes(otherId));
        if (!knowsOther(residentsA, settlementB.centerPlaceId) ||
            !knowsOther(residentsB, settlementA.centerPlaceId)) continue;
        const relationKeyId = relationshipKey(settlementA.id, settlementB.id);
        let relation = this.state.v16?.settlementRelations[relationKeyId];

        const adultsA = residentsA.filter(
          (agent) => agent.life.stage === 'adult' && !agent.movement,
        );
        const adultsB = residentsB.filter(
          (agent) => agent.life.stage === 'adult' && !agent.movement,
        );
        if (adultsA.length === 0 || adultsB.length === 0) continue;

        const delegateScore = (agent: AgentState) =>
          agent.personality.curiosity * 0.28 +
          agent.personality.sociability * 0.28 +
          agent.skills.exploration * 0.24 +
          agent.skills.social * 0.2;
        const delegateA = this.shuffled(adultsA).sort(
          (a, b) => delegateScore(b) - delegateScore(a),
        )[0];
        const delegateB = this.shuffled(adultsB).sort(
          (a, b) => delegateScore(b) - delegateScore(a),
        )[0];
        const contactChance = clamp01(
          0.008 +
            (delegateScore(delegateA) + delegateScore(delegateB)) * 0.018 -
            Math.max(0, route.length - 3) * 0.002,
        );
        if (this.rng.next() < contactChance) {
          const meetingPlaceId = route[Math.floor(route.length / 2)];
          this.moveAgent(delegateA, meetingPlaceId);
          this.moveAgent(delegateB, meetingPlaceId);
          // Choosing a distant meeting starts a real journey. Contact is
          // recorded only on a later tick after both delegates physically
          // arrive; moving 100-200 km can never create an instant encounter.
          if (
            delegateA.movement ||
            delegateB.movement ||
            delegateA.locationId !== meetingPlaceId ||
            delegateB.locationId !== meetingPlaceId
          ) {
            continue;
          }
          const securityA = this.settlementResourcesForAgent(delegateA);
          const securityB = this.settlementResourcesForAgent(delegateB);
          const scarcity =
            1 -
            Math.min(
              securityA.storedResources * 0.45 + securityA.renewableBase * 0.55,
              securityB.storedResources * 0.45 + securityB.renewableBase * 0.55,
            );
          const sentiment = clampSigned(
            this.rng.between(-0.34, 0.34) +
              (delegateA.personality.generosity +
                delegateB.personality.generosity -
                1) *
                0.2 +
              (delegateA.skills.social + delegateB.skills.social - 1) * 0.12 -
              scarcity * 0.16,
          );
          const personal = this.relationshipFor(delegateA, delegateB, now);
          personal.trust = clamp01(personal.trust + sentiment * 0.035);
          personal.affinity = clamp01(personal.affinity + sentiment * 0.03);
          personal.respect = clamp01(personal.respect + sentiment * 0.028);
          personal.conflict = clamp01(personal.conflict - sentiment * 0.04);
          personal.updatedAt = now;
          this.state.relationships[relationshipKey(delegateA.id, delegateB.id)] =
            personal;
          recordResidentContactEvidenceV16(
            this.state,
            delegateA,
            delegateB,
            'social',
            sentiment,
          );
          relation = ensureSettlementRelationV16(
            this.state,
            settlementA.id,
            settlementB.id,
          );
          this.stageEvent({
            eventId: this.nextId('settlement-contact'),
            worldId: this.state.id,
            kind: 'world.settlement.contact',
            source: 'agent',
            occurredAt: now,
            payload: {
              settlementA: settlementA.id,
              settlementB: settlementB.id,
              delegateA: delegateA.id,
              delegateB: delegateB.id,
              meetingPlaceId,
              routePlaces: route.length,
              sentiment,
              worldMinutes,
            },
          });
        }
        if (!relation) continue;

        const resourcesA = ensureSettlementResourcesV16(
          this.state,
          settlementA.id,
        );
        const resourcesB = ensureSettlementResourcesV16(
          this.state,
          settlementB.id,
        );
        const resourceSecurityA =
          resourcesA.storedResources * 0.45 + resourcesA.renewableBase * 0.55;
        const resourceSecurityB =
          resourcesB.storedResources * 0.45 + resourcesB.renewableBase * 0.55;
        const scarcity = clamp01(1 - Math.min(resourceSecurityA, resourceSecurityB));
        const landPressure = clamp01(
          Math.max(0, residentsA.length + residentsB.length - 30) / 42,
        );

        const sharedFrontier = this.state.growth.discoveredRegionIds
          .map((placeId) => this.state.places[placeId])
          .filter(
            (place): place is WorldPlace =>
              place !== undefined &&
              place.surface === 'land' &&
              this.pathBetween(settlementA.centerPlaceId, place.id) !== undefined &&
              this.pathBetween(settlementB.centerPlaceId, place.id) !== undefined,
          )
          .sort(
            (a, b) =>
              Number(b.claimedBySettlementId === undefined) -
                Number(a.claimedBySettlementId === undefined) ||
              b.fertility - a.fertility ||
              a.id.localeCompare(b.id),
          )[0];
        if (
          sharedFrontier &&
          sharedFrontier.claimedBySettlementId === undefined &&
          this.rng.next() < 0.012 + landPressure * 0.04
        ) {
          const explorationA =
            residentsA.reduce((sum, agent) => sum + agent.skills.exploration, 0) /
            residentsA.length;
          const explorationB =
            residentsB.reduce((sum, agent) => sum + agent.skills.exploration, 0) /
            residentsB.length;
          const claimant =
            explorationA + this.rng.next() * 0.18 >=
            explorationB + this.rng.next() * 0.18
              ? settlementA
              : settlementB;
          sharedFrontier.claimedBySettlementId = claimant.id;
          this.stageEvent({
            eventId: this.nextId('territory-claim'),
            worldId: this.state.id,
            kind: 'world.territory.claimed',
            source: 'agent',
            occurredAt: now,
            payload: {
              settlementId: claimant.id,
              placeId: sharedFrontier.id,
              fertility: sharedFrontier.fertility,
              worldMinutes,
            },
          });
        }
        if (
          sharedFrontier?.claimedBySettlementId &&
          [settlementA.id, settlementB.id].includes(
            sharedFrontier.claimedBySettlementId,
          ) &&
          (landPressure > 0.22 || scarcity > 0.58) &&
          this.rng.next() < 0.015 + landPressure * 0.045 + scarcity * 0.025
        ) {
          relation.contestedPlaceId = sharedFrontier.id;
          relation.landDisputes += 1;
          relation.grievance = clamp01(relation.grievance + 0.045);
        }

        relation.hostility = clamp01(
          relation.hostility +
            relation.grievance * 0.038 +
            relation.fear * 0.018 +
            scarcity * 0.018 +
            landPressure * 0.016 -
            relation.trust * 0.024 -
            relation.cooperation * 0.03,
        );
        relation.lastEvidenceWorldMinute = worldMinutes;

        const volunteers = (
          residents: AgentState[],
          defending: boolean,
        ): AgentState[] =>
          this.shuffled(
            residents.filter(
              (agent) =>
                agent.life.stage === 'adult' &&
                agent.life.health >= 0.45 &&
                agent.energy >= 0.24,
            ),
          )
            .filter((agent) => {
              // A resident may abandon an ordinary journey after choosing to
              // answer a settlement conflict. Routine movement must not act as
              // a hidden prohibition on otherwise voluntary participation.
              const willingness = clamp01(
                agent.personality.riskTolerance * 0.25 +
                  agent.mind.values.ambition * 0.19 +
                  (agent.progression?.combatMastery ?? agent.skills.hunting) *
                    0.2 +
                  relation!.grievance * 0.18 +
                  relation!.fear * (defending ? 0.2 : 0.1) +
                  agent.mind.values.care * (defending ? 0.1 : -0.08),
              );
              return (
                willingness >= 0.48 &&
                this.rng.next() < 0.025 + willingness * 0.3
              );
            })
            .slice(0, 4);

        const prospectiveA = volunteers(residentsA, false);
        const prospectiveB = volunteers(residentsB, true);
        if (
          !relation.activeWar &&
          relation.hostility >= 0.7 &&
          prospectiveA.length >= 2 &&
          prospectiveB.length >= 2 &&
          this.rng.next() < 0.025 + relation.hostility * 0.06
        ) {
          relation.activeWar = true;
          relation.warStartedWorldMinute = worldMinutes;
          this.stageEvent({
            eventId: this.nextId('settlement-war'),
            worldId: this.state.id,
            kind: 'world.settlement.war_started',
            source: 'agent',
            occurredAt: now,
            payload: {
              settlementA: settlementA.id,
              settlementB: settlementB.id,
              hostility: relation.hostility,
              resourceScarcity: scarcity,
              landPressure,
              volunteersA: prospectiveA.map((agent) => agent.id).join(','),
              volunteersB: prospectiveB.map((agent) => agent.id).join(','),
              worldMinutes,
            },
          });
          continue;
        }
        if (!relation.activeWar) continue;

        const fightersA = prospectiveA.length > 0
          ? prospectiveA
          : volunteers(residentsA, true);
        const fightersB = prospectiveB.length > 0
          ? prospectiveB
          : volunteers(residentsB, true);
        if (relation.hostility < 0.3) {
          relation.activeWar = false;
          relation.hostility = clamp01(relation.hostility - 0.12);
          this.stageEvent({
            eventId: this.nextId('settlement-peace'),
            worldId: this.state.id,
            kind: 'world.settlement.peace',
            source: 'agent',
            occurredAt: now,
            payload: {
              settlementA: settlementA.id,
              settlementB: settlementB.id,
              reason: 'hostility_subsided',
              worldMinutes,
            },
          });
          continue;
        }
        if (fightersA.length === 0 || fightersB.length === 0) {
          // One quiet mobilization window must not instantly erase an active
          // war. Participation remains voluntary: nobody is forced into a
          // fight, while repeated refusal gradually de-escalates hostility.
          relation.hostility = clamp01(relation.hostility - 0.04);
          relation.lastEvidenceWorldMinute = worldMinutes;
          continue;
        }
        if (this.rng.next() >= 0.28 + relation.hostility * 0.32) continue;

        const strength = (fighters: AgentState[]) =>
          fighters.reduce(
            (sum, agent) =>
              sum +
              agent.life.health * 0.24 +
              agent.life.physiology.strength * 0.2 +
              agent.life.physiology.endurance * 0.12 +
              (agent.progression?.combatMastery ?? agent.skills.hunting) * 0.28 +
              this.v15WeaponForAgent(agent).effectiveness * 0.16,
            0,
          );
        const strengthA = strength(fightersA) * this.rng.between(0.82, 1.18);
        const strengthB = strength(fightersB) * this.rng.between(0.82, 1.18);
        const aWon = strengthA >= strengthB;
        const winnerSettlement = aWon ? settlementA : settlementB;
        const loserSettlement = aWon ? settlementB : settlementA;
        const winners = aWon ? fightersA : fightersB;
        const losers = aWon ? fightersB : fightersA;
        const winnerResources = aWon ? resourcesA : resourcesB;
        const loserResources = aWon ? resourcesB : resourcesA;
        const contested = relation.contestedPlaceId
          ? this.state.places[relation.contestedPlaceId]
          : undefined;
        const conflictKind = contested && landPressure >= scarcity * 0.72
          ? 'land'
          : 'resources';
        let transferredResources = 0;
        if (conflictKind === 'resources') {
          transferredResources = Math.min(
            loserResources.storedResources,
            0.025 + scarcity * 0.055,
          );
          loserResources.storedResources = clamp01(
            loserResources.storedResources - transferredResources,
          );
          winnerResources.storedResources = clamp01(
            winnerResources.storedResources + transferredResources,
          );
          relation.resourceRaids += 1;
        } else if (contested) {
          contested.claimedBySettlementId = winnerSettlement.id;
        }

        let casualties = 0;
        const applyConflictDamage = (
          participants: AgentState[],
          losingSide: boolean,
        ) => {
          for (const participant of participants) {
            recordConflictParticipationEvidenceV16(this.state, participant.id);
            const damage = this.rng.between(
              losingSide ? 0.035 : 0.012,
              losingSide ? 0.12 : 0.065,
            );
            participant.life.health = clamp01(participant.life.health - damage);
            recordTraumaV21(
              this.state,
              participant,
              damage,
              'conflict',
              `${settlementA.id}:${settlementB.id}:${relation.conflictRounds}:${participant.id}`,
            );
            participant.energy = clamp01(participant.energy - 0.09);
            participant.stress = clamp01(participant.stress + 0.1);
            participant.mind.emotions.fear = clamp01(
              participant.mind.emotions.fear + 0.12,
            );
            const race = participant.race ?? 'human';
            const livingRace = Object.values(this.state.agents).filter(
              (agent) => agent.life.alive && (agent.race ?? 'human') === race,
            ).length;
            if (
              livingRace > 2 &&
              (participant.life.health <= 0.04 ||
                this.rng.next() < damage * (losingSide ? 0.07 : 0.025))
            ) {
              this.recordDeath(participant, 'war', now);
              casualties += 1;
            }
          }
        };
        applyConflictDamage(winners, false);
        applyConflictDamage(losers, true);
        relation.conflictRounds += 1;
        relation.casualties += casualties;
        relation.lastConflictWorldMinute = worldMinutes;
        relation.grievance = clamp01(relation.grievance + 0.07);
        relation.fear = clamp01(relation.fear + 0.045);
        relation.trust = clamp01(relation.trust - 0.065);
        relation.hostility = clamp01(relation.hostility + 0.035);

        // Occupation is a possible consequence of a physically won conflict,
        // not an automatic reward. Surviving winners decide again whether to
        // assume the burden and risk; defeated residents keep their identities,
        // homes and future freedom to stay, leave, resist or negotiate.
        let occupiedSettlementId: string | null = null;
        let capturedFood = 0;
        let capturedWood = 0;
        let capturedStone = 0;
        let capturedMetal = 0;
        const survivingLoserResidents = residentsOf(loserSettlement.id).filter(
          (agent) => agent.life.alive,
        );
        const occupationVolunteers = winners.filter((agent) => {
          if (!agent.life.alive) return false;
          const willingness = clamp01(
            agent.mind.values.ambition * 0.28 +
              agent.personality.riskTolerance * 0.2 +
              relation.grievance * 0.2 +
              (agent.progression?.combatMastery ?? agent.skills.hunting) * 0.16 +
              agent.mind.values.care * 0.08 -
              agent.mind.emotions.fear * 0.14,
          );
          return willingness >= 0.56 && this.rng.next() < 0.08 + willingness * 0.26;
        });
        if (
          relation.conflictRounds >= 2 &&
          relation.hostility >= 0.72 &&
          survivingLoserResidents.length <= 2 &&
          occupationVolunteers.length >= 2
        ) {
          const winnerEconomy = ensureSettlementEconomyV16(
            this.state,
            winnerSettlement.id,
          );
          const loserEconomy = ensureSettlementEconomyV16(
            this.state,
            loserSettlement.id,
          );
          refreshSettlementEconomyCapacityV16(this.state, winnerEconomy);
          refreshSettlementEconomyCapacityV16(this.state, loserEconomy);
          const transferStock = (material: V16MaterialKind): number => {
            const amount = Math.min(
              loserEconomy.stocks[material] * 0.18,
              Math.max(
                0,
                winnerEconomy.storageCapacity[material] -
                  winnerEconomy.stocks[material],
              ),
            );
            loserEconomy.stocks[material] = Math.max(
              0,
              loserEconomy.stocks[material] - amount,
            );
            winnerEconomy.stocks[material] += amount;
            return amount;
          };
          capturedFood = transferStock('food');
          capturedWood = transferStock('wood');
          capturedStone = transferStock('stone');
          capturedMetal = transferStock('metal');
          transferStock('fuel');
          const loserLifecycle = ensureWorldV18State(this.state)
            .settlementLifecycleById[loserSettlement.id] ??
            deriveSettlementLifecycleV18(this.state, loserSettlement.id);
          loserLifecycle.status = 'occupied';
          loserLifecycle.controllerSettlementId = winnerSettlement.id;
          loserLifecycle.lastStatusReason = 'voluntary_war_occupation';
          ensureWorldV18State(this.state).settlementLifecycleById[
            loserSettlement.id
          ] = loserLifecycle;
          occupiedSettlementId = loserSettlement.id;
          relation.activeWar = false;
          relation.hostility = clamp01(relation.hostility - 0.18);
          this.stageEvent({
            eventId: this.nextId('settlement-occupied'),
            worldId: this.state.id,
            kind: 'world.settlement.occupied',
            source: 'agent',
            occurredAt: now,
            payload: {
              settlementId: loserSettlement.id,
              controllerSettlementId: winnerSettlement.id,
              volunteerIds: occupationVolunteers.map((agent) => agent.id).join(','),
              remainingResidentCount: survivingLoserResidents.length,
              capturedFood,
              capturedWood,
              capturedStone,
              capturedMetal,
              worldMinutes,
            },
          });
        }
        this.refreshV15StoredResourceProjection();

        this.stageEvent({
          eventId: this.nextId('settlement-conflict'),
          worldId: this.state.id,
          kind: 'world.settlement.conflict',
          source: 'agent',
          occurredAt: now,
          payload: {
            settlementA: settlementA.id,
            settlementB: settlementB.id,
            winnerSettlementId: winnerSettlement.id,
            loserSettlementId: loserSettlement.id,
            conflictKind,
            contestedPlaceId: contested?.id ?? null,
            transferredResources,
            occupiedSettlementId,
            capturedFood,
            capturedWood,
            capturedStone,
            capturedMetal,
            participantIds: [...winners, ...losers]
              .map((agent) => agent.id)
              .join(','),
            casualties,
            worldMinutes,
          },
        });
      }
    }
  }

  private advanceBurialAftercare(now: number): void {
    const v16 = ensureWorldV16State(this.state);
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const scheduleTick = this.v15ScheduleTick(now);
    const burialOpportunity =
      Number.isInteger(scheduleTick) && scheduleTick % 6 === 0;

    for (const remains of Object.values(v16.remainsById)) {
      if (remains.status !== 'unburied') continue;
      const exposedMinutes = Math.max(0, worldMinutes - remains.deathWorldMinute);
      remains.contaminationRisk = clamp01(
        (exposedMinutes - 3 * 24 * 60) / (117 * 24 * 60),
      );
      const exposedResidents = Object.values(this.state.agents).filter(
        (agent) =>
          agent.life.alive && agent.locationId === remains.currentPlaceId,
      );
      for (const resident of exposedResidents) {
        resident.life.health = clamp01(
          resident.life.health - remains.contaminationRisk * 0.0012,
        );
        resident.stress = clamp01(
          resident.stress + remains.contaminationRisk * 0.006,
        );
        resident.mind.emotions.fear = clamp01(
          resident.mind.emotions.fear + remains.contaminationRisk * 0.004,
        );
      }
      if (!burialOpportunity) continue;

      const settlementId =
        remains.homeSettlementId ??
        this.state.places[remains.currentPlaceId]?.settlementId;
      const settlement = settlementId
        ? this.state.settlements[settlementId]
        : undefined;
      if (!settlement) continue;
      const resolvedSettlementId = settlement.id;
      if (
        this.pathBetween(settlement.centerPlaceId, remains.currentPlaceId) ===
        undefined
      ) {
        continue;
      }
      const deceased = this.state.agents[remains.agentId];
      if (!deceased) continue;
      const candidates = this.shuffled(
        Object.values(this.state.agents).filter(
          (agent) =>
            agent.life.alive &&
            this.homeSettlementId(agent) === settlementId &&
            agent.life.stage !== 'child' &&
            agent.life.health >= 0.38 &&
            agent.energy >= 0.18 &&
            !agent.movement,
        ),
      );
      const volunteers = candidates
        .filter((agent) => {
          const relationship = this.state.relationships[
            relationshipKey(agent.id, deceased.id)
          ];
          const isCloseFamily =
            deceased.life.parentIds.includes(agent.id) ||
            deceased.life.childIds.includes(agent.id) ||
            agent.life.parentIds.some((id) => deceased.life.parentIds.includes(id));
          const care = clamp01(
            agent.mind.values.care * 0.26 +
              agent.personality.generosity * 0.22 +
              agent.personality.diligence * 0.18 +
              (relationship?.trust ?? 0.2) * 0.12 +
              (relationship?.affinity ?? 0.2) * 0.1 +
              (isCloseFamily ? 0.22 : 0) +
              remains.contaminationRisk * 0.14,
          );
          return care >= 0.42 && this.rng.next() < 0.08 + care * 0.52;
        })
        .slice(0, 3);
      if (volunteers.length === 0) continue;

      let site = v16.burialSitesBySettlementId[resolvedSettlementId];
      if (!site) {
        const center = this.state.places[settlement.centerPlaceId];
        const placeId = `cemetery_${resolvedSettlementId}`;
        if (!this.state.places[placeId]) {
          const angle = Object.keys(v16.burialSitesBySettlementId).length * 1.87 + 0.9;
          this.state.places[placeId] = createPlace(
            placeId,
            `Кладбище ${settlement.name}`,
            'cemetery',
            256,
            {
              biome: 'settlement',
              mapX: center.mapX + Math.cos(angle) * 6.4,
              mapY: center.mapY + Math.sin(angle) * 6.4,
              connectedPlaceIds: [settlement.centerPlaceId],
              fertility: 0.18,
              danger: 0.025,
              surface: 'land',
              settlementId: resolvedSettlementId,
              discoveredAt: now,
            },
          );
          makeConnectionsReciprocal(this.state.places);
          this.rebuildSpatialProjection();
        }
        site = {
          settlementId: resolvedSettlementId,
          placeId,
          establishedWorldMinute: worldMinutes,
          burialCount: 0,
          interredAgentIds: [],
        };
        v16.burialSitesBySettlementId[resolvedSettlementId] = site;
        this.stageEvent({
          eventId: this.nextId('cemetery'),
          worldId: this.state.id,
          kind: 'world.cemetery.established',
          source: 'agent',
          occurredAt: now,
          payload: { settlementId: resolvedSettlementId, placeId, worldMinutes },
        });
      }

      for (const volunteer of volunteers) {
        this.moveAgent(volunteer, site.placeId);
        volunteer.energy = clamp01(volunteer.energy - 0.055);
        volunteer.stress = clamp01(volunteer.stress + 0.018);
        volunteer.needs.purpose = clamp01(volunteer.needs.purpose + 0.045);
        volunteer.lastMeaningfulEventAt = now;
        recordBurialCareEvidenceV16(this.state, volunteer.id);
        this.stageMemory({
          memoryId: this.nextId('memory'),
          worldId: this.state.id,
          agentId: volunteer.id,
          createdAt: now,
          kind: 'death',
          summary: `${volunteer.name} помог(ла) похоронить ${deceased.name}.`,
          importance: 0.76,
          valence: -0.36,
          relatedAgentIds: [deceased.id],
        });
      }
      remains.status = 'buried';
      remains.currentPlaceId = site.placeId;
      remains.burialPlaceId = site.placeId;
      remains.buriedWorldMinute = worldMinutes;
      remains.buriedByAgentIds = volunteers.map((agent) => agent.id);
      remains.contaminationRisk = 0;
      site.burialCount += 1;
      if (!site.interredAgentIds.includes(deceased.id)) {
        site.interredAgentIds.push(deceased.id);
      }
      deceased.locationId = site.placeId;
      deceased.position = {
        x: this.state.places[site.placeId].mapX,
        y: this.state.places[site.placeId].mapY,
        layerId: 'surface',
      };
      recordSettlementPracticeEvidenceV16(this.state, resolvedSettlementId, 'care');
      recordSettlementPracticeEvidenceV16(this.state, resolvedSettlementId, 'ritual');
      this.stageEvent({
        eventId: this.nextId('burial'),
        worldId: this.state.id,
        kind: 'world.resident.buried',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: deceased.id,
          race: deceased.race ?? 'human',
          settlementId: resolvedSettlementId,
          burialPlaceId: site.placeId,
          buriedByAgentIds: remains.buriedByAgentIds.join(','),
          exposedWorldMinutes: exposedMinutes,
          worldMinutes,
        },
      });
    }
  }

  private refreshSettlementLifecycleEvidenceV18(now: number): void {
    const v18 = ensureWorldV18State(this.state);
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    for (const settlementId of Object.keys(this.state.settlements).sort()) {
      const prior = v18.settlementLifecycleById[settlementId];
      const next = deriveSettlementLifecycleV18(
        this.state,
        settlementId,
        prior,
        this.residentCountByHomeSettlement?.get(settlementId) ?? 0,
      );
      if ((prior?.residentCount ?? next.residentCount) > 0 && next.residentCount === 0) {
        this.stageEvent({
          eventId: this.nextId('settlement-abandoned'),
          worldId: this.state.id,
          kind: 'world.settlement.abandoned',
          source: 'agent',
          occurredAt: now,
          payload: {
            settlementId,
            reason: next.lastStatusReason ?? 'no_living_residents',
            worldMinutes,
          },
        });
      }
      if (
        next.residentCount === 0 &&
        next.abandonedWorldMinute !== undefined &&
        next.ruinedWorldMinute === undefined &&
        worldMinutes - next.abandonedWorldMinute >= WORLD_MINUTES_PER_YEAR * 3
      ) {
        next.status = 'ruins';
        next.ruinedWorldMinute = worldMinutes;
        next.lastStatusReason = 'unmaintained_for_three_years';
        this.stageEvent({
          eventId: this.nextId('settlement-ruins'),
          worldId: this.state.id,
          kind: 'world.settlement.became_ruins',
          source: 'world',
          occurredAt: now,
          payload: {
            settlementId,
            abandonedWorldMinute: next.abandonedWorldMinute,
            ruinedWorldMinute: worldMinutes,
          },
        });
      } else if (
        next.residentCount > 0 &&
        (prior?.status === 'abandoned' || prior?.status === 'ruins')
      ) {
        next.status = prior.controllerSettlementId ? 'occupied' : 'inhabited';
        next.lastStatusReason = 'residents_returned';
        this.stageEvent({
          eventId: this.nextId('settlement-reoccupied'),
          worldId: this.state.id,
          kind: 'world.settlement.reoccupied',
          source: 'agent',
          occurredAt: now,
          payload: { settlementId, residentCount: next.residentCount, worldMinutes },
        });
      }
      v18.settlementLifecycleById[settlementId] = next;
    }
    for (const settlementId of Object.keys(v18.settlementLifecycleById)) {
      if (!this.state.settlements[settlementId]) {
        delete v18.settlementLifecycleById[settlementId];
      }
    }
  }

  private expeditionMembersV18(
    expedition: Readonly<V18FrontierExpeditionState>,
  ): AgentState[] {
    return expedition.memberIds
      .map((agentId) => this.state.agents[agentId])
      .filter((agent): agent is AgentState => agent !== undefined && agent.life.alive);
  }

  private returnFrontierExpeditionV18(
    expedition: V18FrontierExpeditionState,
    now: number,
    reason: string,
  ): void {
    const origin = this.state.settlements[expedition.originSettlementId];
    if (origin) {
      for (const member of this.expeditionMembersV18(expedition)) {
        this.moveAgent(member, origin.centerPlaceId);
      }
    }
    expedition.stage = 'returned';
    expedition.lastChangedWorldMinute = this.state.calendar.elapsedWorldMinutes;
    this.stageEvent({
      eventId: this.nextId('expedition-returned'),
      worldId: this.state.id,
      kind: 'world.expedition.returned',
      source: 'agent',
      occurredAt: now,
      payload: {
        expeditionId: expedition.id,
        originSettlementId: expedition.originSettlementId,
        memberCount: expedition.memberIds.length,
        reason,
      },
    });
  }

  private foundSettlementFromExpeditionV18(
    expedition: V18FrontierExpeditionState,
    site: Readonly<V18SiteAppraisal>,
    founders: AgentState[],
    now: number,
  ): void {
    const anchor = this.state.places[site.placeId];
    const founderMaleCount = founders.filter((founder) => founder.sex === 'male').length;
    const founderFemaleCount = founders.filter((founder) => founder.sex === 'female').length;
    if (
      !anchor ||
      founders.length < 10 ||
      founderMaleCount < 4 ||
      founderFemaleCount < 4
    ) {
      this.returnFrontierExpeditionV18(expedition, now, 'site_or_members_lost');
      return;
    }
    let sequence = Object.keys(this.state.settlements).length + 1;
    let id = `settlement_frontier_${sequence}`;
    while (this.state.places[id]) {
      sequence += 1;
      id = `settlement_frontier_${sequence}`;
    }
    const names = [
      'Ривен',
      'Лунная Долина',
      'Эльм',
      'Белый Брод',
      'Сольвей',
      'Звёздная Гавань',
      'Ясный Ручей',
      'Каменный Лог',
    ];
    const angle = sequence * 2.399963229728653;
    this.state.places[id] = createPlace(
      id,
      `Поселение ${names[(sequence - 1) % names.length]}`,
      'village',
      24,
      {
        biome: 'settlement',
        mapX: anchor.mapX + Math.cos(angle) * 5.5,
        mapY: anchor.mapY + Math.sin(angle) * 5.5,
        connectedPlaceIds: [site.placeId],
        fertility: clamp01(0.48 + site.fertility * 0.28),
        danger: clamp01(Math.max(0.04, site.danger * 0.36)),
        surface: 'land',
        settlementId: id,
        discoveredAt: now,
      },
    );
    anchor.claimedBySettlementId ??= id;

    for (let districtIndex = 0; districtIndex < 4; districtIndex += 1) {
      const districtAngle = angle + (Math.PI * 2 * districtIndex) / 4;
      const districtId = `${id}_house_${districtIndex + 1}`;
      this.state.places[districtId] = createPlace(
        districtId,
        `Дом поселенцев ${districtIndex + 1}`,
        'home',
        4,
        {
          biome: 'settlement',
          mapX: this.state.places[id].mapX + Math.cos(districtAngle) * 3.2,
          mapY: this.state.places[id].mapY + Math.sin(districtAngle) * 3.2,
          connectedPlaceIds: [id],
          fertility: 0.58,
          danger: 0.04,
          surface: 'land',
          settlementId: id,
          discoveredAt: now,
        },
      );
    }
    const services: Array<{
      suffix: string;
      name: string;
      kind: WorldPlaceKind;
      dx: number;
      dy: number;
      fertility: number;
    }> = [
      { suffix: 'field', name: 'Поля и фермы', kind: 'resource_field', dx: -5.6, dy: 2.2, fertility: clamp01(0.56 + site.fertility * 0.28) },
      { suffix: 'workshop', name: 'Мастерская', kind: 'workshop', dx: 2.4, dy: 1.2, fertility: 0.3 },
      { suffix: 'quiet', name: 'Тихий сад', kind: 'quiet_space', dx: -1.8, dy: -2.2, fertility: 0.62 },
    ];
    for (const service of services) {
      const serviceId = `${id}_${service.suffix}`;
      this.state.places[serviceId] = createPlace(
        serviceId,
        `${this.state.places[id].name}: ${service.name}`,
        service.kind,
        12,
        {
          biome: service.kind === 'resource_field' ? 'plains' : 'settlement',
          mapX: this.state.places[id].mapX + service.dx,
          mapY: this.state.places[id].mapY + service.dy,
          connectedPlaceIds: [id],
          fertility: service.fertility,
          danger: 0.04,
          surface: 'land',
          settlementId: id,
          discoveredAt: now,
        },
      );
    }

    const homes = [1, 2, 3, 4].map(
      (index) => this.state.places[`${id}_house_${index}`],
    );
    for (let index = 0; index < founders.length; index += 1) {
      const founder = founders[index];
      const home = homes[index % homes.length];
      if (!home) continue;
      const priorHomeId = founder.homeId;
      founder.homeId = home.id;
      this.moveAgent(founder, id);
      founder.needs.purpose = clamp01(founder.needs.purpose + 0.08);
      founder.mind.emotions.hope = clamp01(founder.mind.emotions.hope + 0.06);
      founder.lastMeaningfulEventAt = now;
      this.stageEvent({
        eventId: this.nextId('settlement-founder'),
        worldId: this.state.id,
        kind: 'agent.resettled',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: founder.id,
          priorHomeId,
          settlementId: id,
          homeId: home.id,
          reason: 'voluntary_frontier_founder',
          expeditionId: expedition.id,
        },
      });
    }

    makeConnectionsReciprocal(this.state.places);
    this.rebuildSpatialProjection();
    ensureSettlementEvidenceV16(this.state, id);
    ensureSettlementEconomyV16(this.state, id);
    expedition.stage = 'founded';
    expedition.resultingSettlementId = id;
    expedition.lastChangedWorldMinute = this.state.calendar.elapsedWorldMinutes;
    ensureWorldV18State(this.state).settlementLifecycleById[id] =
      deriveSettlementLifecycleV18(this.state, id);
    this.stageEvent({
      eventId: this.nextId('settlement'),
      worldId: this.state.id,
      kind: 'world.settlement.founded',
      source: 'agent',
      occurredAt: now,
      payload: {
        settlementId: id,
        name: this.state.places[id].name,
        expeditionId: expedition.id,
        originSettlementId: expedition.originSettlementId,
        founderCount: founders.length,
        foundingRace: this.state.agents[expedition.leaderId]?.race ?? 'human',
        connectedRegionId: site.placeId,
        siteScore: site.score,
        reasons: expedition.reasons.join(','),
      },
    });
  }

  private advanceSettlementsV18(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick) || scheduleTick % 24 !== 0) return;
    const v18 = ensureWorldV18State(this.state);
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;

    for (const settlement of Object.values(this.state.settlements)) {
      const residents = Object.values(this.state.agents).filter(
        (agent) => agent.life.alive && this.homeSettlementId(agent) === settlement.id,
      ).length;
      if (settlement.kind !== 'village' || residents < 18) continue;
      settlement.kind = 'city';
      settlement.radius = Math.max(20, settlement.radius);
      const center = this.state.places[settlement.centerPlaceId];
      if (center) {
        center.kind = 'city';
        center.capacity = Math.max(24, center.capacity * 2);
        center.fertility = clamp01(center.fertility + 0.06);
      }
      this.stageEvent({
        eventId: this.nextId('city'),
        worldId: this.state.id,
        kind: 'world.city.emerged',
        source: 'agent',
        occurredAt: now,
        payload: { cityId: settlement.id, name: settlement.name, residentPopulation: residents },
      });
      this.rebuildSpatialProjection();
    }

    const active = Object.values(v18.expeditionsById)
      .filter((expedition) =>
        ['considering', 'preparing', 'travelling', 'camp'].includes(expedition.stage),
      )
      .sort((left, right) => left.createdWorldMinute - right.createdWorldMinute)[0];
    if (active) {
      const members = this.expeditionMembersV18(active);
      const origin = this.state.settlements[active.originSettlementId];
      const target = this.state.places[active.targetPlaceId];
      if (members.length < 10 || !origin || !target) {
        active.stage = 'failed';
        active.lastChangedWorldMinute = worldMinutes;
        this.stageEvent({
          eventId: this.nextId('expedition-failed'),
          worldId: this.state.id,
          kind: 'world.expedition.failed',
          source: 'world',
          occurredAt: now,
          payload: { expeditionId: active.id, reason: 'members_or_route_lost' },
        });
        return;
      }
      const sites = appraiseFrontierSitesV18(
        this.state,
        active.originSettlementId,
        (placeId) => {
          const route = this.pathBetween(origin.centerPlaceId, placeId);
          return route ? Math.max(0, route.length - 1) : undefined;
        },
      );
      const site = sites.find((candidate) => candidate.placeId === active.targetPlaceId);
      if (!site || (target.claimedBySettlementId && target.claimedBySettlementId !== active.originSettlementId)) {
        this.returnFrontierExpeditionV18(active, now, 'site_no_longer_available');
        return;
      }
      if (active.stage === 'considering' || active.stage === 'preparing') {
        active.stage = 'travelling';
        active.lastChangedWorldMinute = worldMinutes;
        for (const member of members) this.moveAgent(member, active.targetPlaceId);
        this.stageEvent({
          eventId: this.nextId('expedition-departed'),
          worldId: this.state.id,
          kind: 'world.expedition.departed',
          source: 'agent',
          occurredAt: now,
          payload: {
            expeditionId: active.id,
            leaderId: active.leaderId,
            memberIds: active.memberIds.join(','),
            targetPlaceId: active.targetPlaceId,
          },
        });
        return;
      }
      if (active.stage === 'travelling') {
        if (members.some((member) => member.movement)) return;
        active.stage = 'camp';
        active.lastChangedWorldMinute = worldMinutes;
        this.stageEvent({
          eventId: this.nextId('expedition-camp'),
          worldId: this.state.id,
          kind: 'world.expedition.camp_established',
          source: 'agent',
          occurredAt: now,
          payload: { expeditionId: active.id, targetPlaceId: active.targetPlaceId, memberCount: members.length },
        });
        return;
      }
      const campDecisions = members.map((member) => ({
        member,
        decision: decideFrontierSettlementAtCampV18(
          this.state,
          member,
          active.originSettlementId,
          site,
          this.rng.next(),
        ),
      }));
      const founders = campDecisions
        .filter(
          ({ member, decision }) =>
            member.life.generation > 0 && decision.acceptsSettlement,
        )
        .map(({ member }) => member);
      const founderMaleCount = founders.filter(
        (founder) => founder.sex === 'male',
      ).length;
      const founderFemaleCount = founders.filter(
        (founder) => founder.sex === 'female',
      ).length;
      if (
        founders.length < 10 ||
        founderMaleCount < 4 ||
        founderFemaleCount < 4
      ) {
        this.returnFrontierExpeditionV18(active, now, 'members_chose_not_to_settle');
        return;
      }
      this.foundSettlementFromExpeditionV18(active, site, founders.slice(0, 12), now);
      return;
    }

    const terminal = Object.values(v18.expeditionsById)
      .filter((expedition) => ['founded', 'returned', 'failed'].includes(expedition.stage))
      .sort((left, right) => right.lastChangedWorldMinute - left.lastChangedWorldMinute);
    for (const old of terminal.slice(64)) delete v18.expeditionsById[old.id];

    const origins = Object.values(this.state.settlements)
      .map((settlement) => ({
        settlement,
        lifecycle: v18.settlementLifecycleById[settlement.id] ??
          deriveSettlementLifecycleV18(this.state, settlement.id),
      }))
      .filter(({ lifecycle }) => lifecycle.residentCount >= 36)
      .sort(
        (left, right) =>
          right.lifecycle.departurePressure - left.lifecycle.departurePressure ||
          left.settlement.id.localeCompare(right.settlement.id),
      );

    for (const { settlement, lifecycle } of origins) {
      const recentOriginExpedition = Object.values(v18.expeditionsById).some(
        (expedition) =>
          expedition.originSettlementId === settlement.id &&
          worldMinutes - expedition.createdWorldMinute <
            WORLD_MINUTES_PER_YEAR * 15,
      );
      if (recentOriginExpedition) continue;
      const sites = appraiseFrontierSitesV18(
        this.state,
        settlement.id,
        (placeId) => {
          const route = this.pathBetween(settlement.centerPlaceId, placeId);
          return route ? Math.max(0, route.length - 1) : undefined;
        },
      ).filter((site) => {
        const place = this.state.places[site.placeId];
        return !place.claimedBySettlementId || place.claimedBySettlementId === settlement.id;
      });
      const site = sites[0];
      if (!site || site.score < 0.55) continue;
      const opportunity = clamp01(
        // This roll opens a conversation about an expedition; it does not
        // select anyone. Asking only once in decades made willing descendants
        // effectively invisible in mature, well supplied towns.
        0.06 +
          lifecycle.departurePressure * 0.3 +
          Math.max(0, site.score - 0.58) * 0.25,
      );
      if (this.rng.next() >= opportunity) continue;

      const adults = this.shuffled(
        Object.values(this.state.agents).filter(
          (agent) =>
            agent.life.alive &&
            agent.life.stage === 'adult' &&
            this.homeSettlementId(agent) === settlement.id &&
            agent.resources >= 0.22 &&
            !agent.movement &&
            !agent.plan,
        ),
      );
      const decisions = adults.map((agent) => ({
        agent,
        decision: decideFrontierExpeditionV18(
          this.state,
          agent,
          settlement.id,
          site,
          this.rng.next(),
        ),
      }));
      const accepted = decisions
        .filter(({ decision }) => decision.acceptsExpedition)
        .sort(
          (left, right) =>
            right.decision.willingness - left.decision.willingness ||
            left.agent.id.localeCompare(right.agent.id),
        );
      // Generation-zero residents may freely guide an expedition, but they do
      // not crowd descendants out of the party and can never become permanent
      // frontier founders. A settlement expedition is prepared only when at
      // least two descendants independently volunteered; otherwise nobody's
      // current plan or home is disturbed.
      const descendantVolunteers = accepted.filter(
        ({ agent }) => agent.life.generation > 0,
      );
      const maleVolunteers = descendantVolunteers.filter(
        ({ agent }) => agent.sex === 'male',
      );
      const femaleVolunteers = descendantVolunteers.filter(
        ({ agent }) => agent.sex === 'female',
      );
      if (
        descendantVolunteers.length < 10 ||
        maleVolunteers.length < 4 ||
        femaleVolunteers.length < 4
      ) continue;
      const founderGuides = accepted.filter(
        ({ agent }) => agent.life.generation === 0,
      );
      const volunteers = [
        ...maleVolunteers.slice(0, 6),
        ...femaleVolunteers.slice(0, 6),
        ...founderGuides.slice(0, 1),
      ].slice(0, 12);

      const provisionShare = expeditionProvisionShareV18(
        volunteers.length,
        site.routeDistance,
      );
      const economy = ensureSettlementEconomyV16(this.state, settlement.id);
      if (economy.stocks.food < provisionShare) continue;
      economy.stocks.food -= provisionShare;
      for (const { agent } of volunteers) {
        agent.resources = clamp01(agent.resources - 0.015);
      }
      const sequence = v18.nextExpeditionSequence++;
      const id = `expedition:${this.state.id}:${sequence}`;
      const reasons = [...new Set([
        ...site.reasons,
        ...volunteers.flatMap(({ decision }) => decision.reasons),
      ])];
      v18.expeditionsById[id] = {
        id,
        originSettlementId: settlement.id,
        targetPlaceId: site.placeId,
        leaderId: volunteers[0].agent.id,
        memberIds: volunteers.map(({ agent }) => agent.id),
        stage: 'preparing',
        reasons,
        provisionShare,
        createdWorldMinute: worldMinutes,
        lastChangedWorldMinute: worldMinutes,
      };
      this.stageEvent({
        eventId: this.nextId('expedition-prepared'),
        worldId: this.state.id,
        kind: 'world.expedition.prepared',
        source: 'agent',
        occurredAt: now,
        payload: {
          expeditionId: id,
          originSettlementId: settlement.id,
          targetPlaceId: site.placeId,
          leaderId: volunteers[0].agent.id,
          memberIds: volunteers.map(({ agent }) => agent.id).join(','),
          siteScore: site.score,
          provisionShare,
          reasons: reasons.join(','),
        },
      });
      return;
    }
  }

  private advanceSettlements(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick) || scheduleTick % 24 !== 0) return;

    const livingSapients = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive && SAPIENT_RACES.includes(agent.race ?? 'human'),
    );
    const residentCount = (settlementId: string) =>
      livingSapients.filter((agent) => this.homeSettlementId(agent) === settlementId).length;

    let promoted = false;
    for (const settlement of Object.values(this.state.settlements)) {
      const residents = residentCount(settlement.id);
      if (settlement.kind !== 'village' || residents < 18) continue;

      settlement.kind = 'city';
      settlement.radius = Math.max(20, settlement.radius);
      const center = this.state.places[settlement.centerPlaceId];
      if (center) {
        if (center.kind === 'village' || settlement.id === 'settlement_ainkrad') {
          center.kind = 'city';
          if (settlement.id !== 'settlement_ainkrad') {
            center.name = center.name.replace('Поселение', 'Город');
            settlement.name = settlement.name.replace('Поселение', 'Город');
          }
        }
        center.capacity = Math.max(24, center.capacity * 2);
        center.fertility = clamp01(center.fertility + 0.06);
      }
      this.stageEvent({
        eventId: this.nextId('city'),
        worldId: this.state.id,
        kind: 'world.city.emerged',
        source: 'agent',
        occurredAt: now,
        payload: {
          cityId: settlement.id,
          name: settlement.name,
          residentPopulation: residents,
          worldStage: this.state.growth.stage,
        },
      });
      promoted = true;
    }
    if (promoted) {
      this.rebuildSpatialProjection();
      return;
    }

    // Expansion comes from real descendants. No ready-made couples or hidden
    // recovery population are injected. Humans begin branching only near the
    // proven thirty-year baseline; later local settlements can then support
    // their own voluntary family opportunities.
    const worldYears =
      this.state.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
    const expansionPlans = SAPIENT_RACES.map((race) => {
      const residents = livingSapients.filter(
        (agent) => (agent.race ?? 'human') === race,
      );
      const inhabited = Object.values(this.state.settlements).filter(
        (settlement) =>
          (race === 'human' && settlement.id === 'settlement_ainkrad') ||
          residents.some(
            (agent) => this.homeSettlementId(agent) === settlement.id,
          ),
      );
      let desired = 1;
      if (race === 'human') {
        if (worldYears >= 28 && residents.length >= 22) desired = 2;
        if (worldYears >= 42 && residents.length >= 38) desired = 3;
        if (worldYears >= 70 && residents.length >= 60) {
          desired = Math.min(6, 4 + Math.floor((residents.length - 60) / 28));
        }
      } else {
        if (residents.length >= 14) desired = 2;
        if (residents.length >= 28) desired = 3;
        if (residents.length >= 48) desired = 4;
      }
      const eligiblePioneers = residents.filter(
        (agent) =>
          agent.life.generation > 0 &&
          agent.life.stage === 'adult' &&
          agent.resources >= 0.28 &&
          !agent.movement,
      );
      return { race, residents, inhabited, desired, eligiblePioneers };
    });
    const expansion = expansionPlans.find(
      (plan) =>
        plan.inhabited.length < plan.desired &&
        plan.eligiblePioneers.some((agent) => agent.sex === 'male') &&
        plan.eligiblePioneers.some((agent) => agent.sex === 'female'),
    );
    if (!expansion) return;
    if (this.state.growth.discoveredRegionIds.length === 0) return;

    const sequence = Object.keys(this.state.settlements).length + 1;
    const frontierId = this.state.growth.discoveredRegionIds.at(-1) ?? 'outskirts';
    const anchor = this.state.places[frontierId] ?? this.state.places.outskirts;
    if (!anchor || anchor.surface !== 'land') return;

    const pioneerCandidates = this.shuffled(
      expansion.eligiblePioneers,
    );
    const willingCandidates = pioneerCandidates.filter((agent) => {
      const willingness = clamp01(
        agent.personality.curiosity * 0.24 +
          agent.personality.diligence * 0.2 +
          agent.personality.riskTolerance * 0.14 +
          agent.mind.values.ambition * 0.2 +
          agent.mind.values.care * 0.12 +
          agent.skills.exploration * 0.1,
      );
      return willingness >= 0.52 && this.rng.next() < 0.1 + willingness * 0.28;
    });
    const willingIds = new Set(willingCandidates.map((agent) => agent.id));
    const foundingRelationship = Object.values(this.state.relationships)
      .filter((relationship) => {
        const a = this.state.agents[relationship.agentA];
        const b = this.state.agents[relationship.agentB];
        return Boolean(
          a &&
          b &&
          willingIds.has(a.id) &&
          willingIds.has(b.id) &&
          this.canFormIntimateRelationship(a, b),
        );
      })
      .sort(
        (left, right) =>
          right.trust + right.affinity + right.respect - right.conflict -
          (left.trust + left.affinity + left.respect - left.conflict) ||
          relationshipKey(left.agentA, left.agentB).localeCompare(
            relationshipKey(right.agentA, right.agentB),
          ),
      )[0];
    if (!foundingRelationship) return;
    const firstFounder = this.state.agents[foundingRelationship.agentA];
    const secondFounder = this.state.agents[foundingRelationship.agentB];
    const willingFounders = [
      firstFounder,
      secondFounder,
      ...willingCandidates.filter(
        (agent) =>
          agent.id !== firstFounder.id && agent.id !== secondFounder.id,
      ),
    ].slice(0, 6);

    const names = ['Ривен', 'Лунная Долина', 'Эльм', 'Белый Брод', 'Сольвей', 'Звёздная Гавань'];
    const id = `settlement_${expansion.race}_${sequence}`;
    const angle =
      sequence * 2.399963229728653 +
      SAPIENT_RACES.indexOf(expansion.race) * 0.71;
    const site=surveySettlementSite(this.state,{x:anchor.mapX+Math.cos(angle)*(8+sequence),y:anchor.mapY+Math.sin(angle)*(8+sequence)});
    if(!site)return;
    this.state.places[id] = createPlace(
      id,
      `Поселение ${names[(sequence - 1) % names.length]}`,
      'village',
      24,
      {
        biome: 'settlement',
        mapX: site.x,
        mapY: site.y,
        connectedPlaceIds: [frontierId],
        fertility: clamp01(0.56 + anchor.fertility * 0.2),
        danger: 0.05,
        surface: 'land',
        settlementId: id,
        discoveredAt: now,
      },
    );

    for (let districtIndex = 0; districtIndex < 4; districtIndex += 1) {
      const districtAngle = angle + (Math.PI * 2 * districtIndex) / 4;
      const districtId = `${id}_house_${districtIndex + 1}`;
      this.state.places[districtId] = createPlace(
        districtId,
        `Дом поселенцев ${districtIndex + 1}`,
        'home',
        4,
        {
          biome: 'settlement',
          mapX: this.state.places[id].mapX + Math.cos(districtAngle) * 3.2,
          mapY: this.state.places[id].mapY + Math.sin(districtAngle) * 3.2,
          connectedPlaceIds: [id],
          fertility: 0.58,
          danger: 0.04,
          surface: 'land',
          settlementId: id,
          discoveredAt: now,
        },
      );
    }

    const localServices: Array<{
      suffix: string; name: string; kind: WorldPlaceKind; dx: number; dy: number; fertility: number;
    }> = [
      { suffix: 'field', name: 'Поля и фермы', kind: 'resource_field', dx: -5.6, dy: 2.2, fertility: 0.76 },
      { suffix: 'workshop', name: 'Мастерская', kind: 'workshop', dx: 2.4, dy: 1.2, fertility: 0.3 },
      { suffix: 'quiet', name: 'Тихий сад', kind: 'quiet_space', dx: -1.8, dy: -2.2, fertility: 0.62 },
    ];
    for (const service of localServices) {
      const serviceId = `${id}_${service.suffix}`;
      this.state.places[serviceId] = createPlace(
        serviceId,
        `${this.state.places[id].name}: ${service.name}`,
        service.kind,
        12,
        {
          biome: service.kind === 'resource_field' ? 'plains' : 'settlement',
          mapX: this.state.places[id].mapX + service.dx,
          mapY: this.state.places[id].mapY + service.dy,
          connectedPlaceIds: [id],
          fertility: service.fertility,
          danger: 0.04,
          surface: 'land',
          settlementId: id,
          discoveredAt: now,
        },
      );
    }

    const settlementHomes = [1, 2, 3, 4]
      .map((index) => this.state.places[`${id}_house_${index}`])
      .filter((place): place is WorldPlace => place !== undefined);
    for (let index = 0; index < willingFounders.length; index += 1) {
      const founder = willingFounders[index];
      const home = settlementHomes[index % settlementHomes.length];
      if (!home) break;
      const priorHomeId = founder.homeId;
      founder.homeId = home.id;
      this.moveAgent(founder, id);
      founder.needs.purpose = clamp01(founder.needs.purpose + 0.08);
      founder.mind.emotions.hope = clamp01(founder.mind.emotions.hope + 0.06);
      founder.lastMeaningfulEventAt = now;
      this.stageEvent({
        eventId: this.nextId('settlement-founder'),
        worldId: this.state.id,
        kind: 'agent.resettled',
        source: 'agent',
        occurredAt: now,
        payload: { agentId: founder.id, priorHomeId, settlementId: id, homeId: home.id, reason: 'voluntary_founder' },
      });
    }

    makeConnectionsReciprocal(this.state.places);
    this.rebuildSpatialProjection();
    ensureSettlementEvidenceV16(this.state, id);
    this.stageEvent({
      eventId: this.nextId('settlement'),
      worldId: this.state.id,
      kind: 'world.settlement.founded',
      source: 'agent',
      occurredAt: now,
      payload: {
        settlementId: id,
        name: this.state.places[id].name,
        foundingRace: expansion.race,
        founderCount: willingFounders.length,
        connectedRegionId: frontierId,
        livingPopulation: livingSapients.length,
        worldStage: this.state.growth.stage,
      },
    });
  }

  private createProceduralExpansion(
    stage: number,
    now: number,
    explorer: AgentState,
  ): WorldExpansionDefinition | undefined {
    const site = localSurveySite(this.state, explorer, stage, this.rng.next());
    if (!site) return undefined;
    const biome = site.biome;
    const kindByBiome: Record<WorldBiome, WorldPlaceKind> = {
      settlement: 'village',
      plains: 'meadow',
      forest: 'forest',
      coast: 'shore',
      ocean: 'ocean',
      mountains: 'mountains',
      lake: 'lake',
      river: 'river',
      swamp: 'swamp',
      ancient_ruins: 'ruins',
    };
    const regionId = `region_${stage}`;
    const mapX = site.x;
    const mapY = site.y;
    const regionName = chooseCulturalPlaceNameV18({
      world: this.state, explorer, biome, sequence: stage, x: mapX, y: mapY,
    });
    const fertilityByBiome: Record<WorldBiome, number> = {
      settlement: 0.52,
      plains: 0.78,
      forest: 0.72,
      coast: 0.64,
      ocean: 0,
      mountains: 0.3,
      lake: 0.7,
      river: 0.82,
      swamp: 0.5,
      ancient_ruins: 0.22,
    };
    const dangerByBiome: Record<WorldBiome, number> = {
      settlement: 0.05,
      plains: 0.14,
      forest: 0.3,
      coast: 0.2,
      ocean: 0.34,
      mountains: 0.42,
      lake: 0.16,
      river: 0.18,
      swamp: 0.44,
      ancient_ruins: 0.52,
    };
    const speciesByBiome: Partial<Record<WorldBiome, WildlifeSpecies>> = {
      settlement: 'bird',
      plains: 'rabbit',
      forest: stage % 3 === 0 ? 'wolf' : stage % 2 === 0 ? 'boar' : 'deer',
      coast: 'fish',
      mountains: 'wolf',
      lake: 'fish',
      river: 'fish',
      swamp: 'boar',
    };
    const species = speciesByBiome[biome];
    const ordinaryThreat: Record<WildlifeSpecies, number> = {
      rabbit: 0.04,
      deer: 0.08,
      fish: 0.02,
      boar: 0.28,
      wolf: 0.42,
      bird: 0.02,
      dire_wolf: 0.72,
      ogre: 0.86,
      wraith: 0.94,
      century_humpback: 1,
    };
    const carryingCapacity =
      4 + Math.floor(fertilityByBiome[biome] * 8 + this.rng.next() * 4);
    const initialCount = Math.max(2, Math.floor(carryingCapacity * 0.45));
    const place = createPlace(
      regionId,
      regionName,
      kindByBiome[biome],
      10 + Math.floor(this.rng.next() * 10),
      {
        biome,
        mapX,
        mapY,
        connectedPlaceIds: site.connections,
        fertility: fertilityByBiome[biome],
        danger: dangerByBiome[biome],
        discoveredAt: now,
      },
    );
    // Keep the existing physical ground; surveying does not create a new lake/forest.
    place.geographyVersion = 1;
    // Ancient ruins are a monster habitat, not a generic bird recovery zone.
    // A biome without a compatible ordinary species starts without ordinary
    // wildlife instead of assigning a knowingly incompatible population.
    const wildlife: WildlifePopulation[] = species
      ? [
          {
            id: `wildlife_${stage}_${species}`,
            species,
            habitatId: regionId,
            count: initialCount,
            carryingCapacity,
            reproductionRate: clamp01(0.07 + place.fertility * 0.12),
            alertness: clamp01(0.12 + place.danger * 0.4),
            threat: ordinaryThreat[species],
            isMonster: false,
            lastChangedAt: now,
          },
        ]
      : [];
    if (stage >= 5 && (stage - 5) % 3 === 0) {
      const monsterByBiome: Partial<Record<WorldBiome, WildlifeSpecies>> = {
        forest: 'dire_wolf',
        mountains: 'dire_wolf',
        swamp: 'ogre',
        ancient_ruins: 'wraith',
      };
      const monsterSpecies = monsterByBiome[biome];
      if (monsterSpecies && isHabitatCompatible(monsterSpecies, place)) {
        const threat = ordinaryThreat[monsterSpecies];
        place.danger = Math.max(place.danger, threat * 0.78);
        wildlife.push({
          id: `monster_${stage}_${monsterSpecies}`,
          species: monsterSpecies,
          habitatId: regionId,
          count: 1 + (stage % 2),
          carryingCapacity: 2 + (stage % 3),
          reproductionRate: 0.018,
          alertness: 0.72,
          threat,
          isMonster: true,
          lastChangedAt: now,
        });
      }
    }
    return { stage, place, wildlife };
  }

  private advanceWildlife(
    environment: WorldEnvironment,
    now: number,
  ): void {
    const recoveryLaw =
      this.lawValue('wildlife_recovery', 1);
    for (const population of Object.values(this.state.wildlife)) {
      // This singleton is advanced only by its scripted one-egg lifecycle.
      if (population.species === CENTURY_HUMPBACK_SPECIES) continue;
      const habitat = this.state.places[population.habitatId];
      if (!isHabitatCompatible(population.species, habitat)) {
        population.count = 0;
        population.lastChangedAt = now;
        continue;
      }
      population.alertness = clamp01(population.alertness - 0.025);
      if (population.count >= population.carryingCapacity) {
        continue;
      }

      // Monster populations cannot grow from danger or Cardinal habitat
      // support alone. They need reachable, actually persisted prey or a meal
      // recorded during the previous Ainkrad year. An extinct population
      // cannot return merely because its former members once ate.
      if (population.isMonster) {
        // Discovering reachable food is not resurrection. Reproduction needs
        // living parents; any future recolonization must be a separate event.
        if (population.count <= 0) continue;
        const hasReachablePrey =
          this.monsterPreyCandidates(population).length > 0;
        const recentlyFed =
          population.count > 0 &&
          population.lastFedAt !== undefined &&
          this.v15ScheduleTick(now) - population.lastFedAt <
            WORLD_TICKS_PER_YEAR;
        if (!hasReachablePrey && !recentlyFed) continue;
      }

      const density = population.count / population.carryingCapacity;
      const emptyHabitatBoost = population.count === 0 ? 0.22 : 0;
      // Cardinal habitat support protects ordinary ecology, never monsters.
      const habitatSupport = population.isMonster
        ? Math.min(0.3, environment.habitatSupport)
        : environment.habitatSupport;
      const effectiveRecoveryLaw = population.isMonster
        ? Math.min(0.35, recoveryLaw)
        : recoveryLaw;
      const recoveryChance = clamp01(
        population.reproductionRate *
          effectiveRecoveryLaw *
          (0.35 + habitatSupport * 0.8) *
          (1 - density) +
          emptyHabitatBoost * habitatSupport * (population.isMonster ? 0.08 : 1),
      );
      if (this.rng.next() >= recoveryChance) {
        continue;
      }

      population.count += 1;
      population.lastChangedAt = now;
      if (
        now <= 240 ||
        Math.floor(now) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0 ||
        population.count === population.carryingCapacity
      ) {
        this.stageEvent({
          eventId: this.nextId('wildlife'),
          worldId: this.state.id,
          kind: 'world.wildlife.recovered',
          source: 'world',
          occurredAt: now,
          payload: {
            populationId: population.id,
            species: population.species,
            habitatId: population.habitatId,
            count: population.count,
            carryingCapacity: population.carryingCapacity,
          },
        });
      }
    }
  }

  private wildlifeViableReserve(population: WildlifePopulation): number {
    return Math.min(
      population.carryingCapacity,
      Math.max(
        1,
        Math.ceil(
          population.carryingCapacity * WILDLIFE_VIABLE_RESERVE_SHARE,
        ),
      ),
    );
  }

  private monsterPreyCandidates(
    monster: WildlifePopulation,
  ): Array<{
    population: WildlifePopulation;
    reserve: number;
    sameHabitat: boolean;
  }> {
    const habitat = this.state.places[monster.habitatId];
    const allowedSpecies = MONSTER_PREY_SPECIES[monster.species] ?? [];
    if (!habitat || allowedSpecies.length === 0) return [];

    return Object.values(this.state.wildlife)
      .filter((population) => {
        if (
          population.isMonster ||
          population.count <= 0 ||
          !allowedSpecies.includes(population.species)
        ) {
          return false;
        }
        const physicallyReachable =
          population.habitatId === monster.habitatId ||
          habitat.connectedPlaceIds.includes(population.habitatId);
        return (
          physicallyReachable &&
          population.count > this.wildlifeViableReserve(population)
        );
      })
      .map((population) => ({
        population,
        reserve: this.wildlifeViableReserve(population),
        sameHabitat: population.habitatId === monster.habitatId,
      }))
      .sort((a, b) => {
        if (a.sameHabitat !== b.sameHabitat) {
          return a.sameHabitat ? -1 : 1;
        }
        const aSurplus = a.population.count - a.reserve;
        const bSurplus = b.population.count - b.reserve;
        return (
          bSurplus - aSurplus ||
          a.population.id.localeCompare(b.population.id)
        );
      });
  }

  private advanceMonsterFeeding(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (
      !Number.isInteger(scheduleTick) ||
      scheduleTick % MONSTER_FEEDING_INTERVAL_TICKS !== 0
    ) {
      return;
    }

    const monsters = Object.values(this.state.wildlife)
      .filter(
        (population) =>
          population.isMonster &&
          population.species !== CENTURY_HUMPBACK_SPECIES &&
          population.count > 0,
      )
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const monster of monsters) {
      let requiredPrey = Math.max(1, Math.ceil(monster.count / 2));
      let consumedTotal = 0;

      for (const candidate of this.monsterPreyCandidates(monster)) {
        if (requiredPrey <= 0) break;
        const available = candidate.population.count - candidate.reserve;
        const consumed = Math.min(requiredPrey, available);
        if (consumed <= 0) continue;

        candidate.population.count -= consumed;
        candidate.population.lastChangedAt = now;
        monster.lastFedAt = scheduleTick;
        monster.lastChangedAt = now;
        monster.alertness = clamp01(monster.alertness - 0.08);
        consumedTotal += consumed;
        requiredPrey -= consumed;

        this.stageEvent({
          eventId: this.nextId('monster-fed-wildlife'),
          worldId: this.state.id,
          kind: 'world.monster.hunted_prey',
          source: 'world',
          occurredAt: now,
          payload: {
            monsterPopulationId: monster.id,
            monsterSpecies: monster.species,
            monsterHabitatId: monster.habitatId,
            preyPopulationId: candidate.population.id,
            preySpecies: candidate.population.species,
            preyHabitatId: candidate.population.habitatId,
            consumed,
            preyRemaining: candidate.population.count,
            preyReserve: candidate.reserve,
            sameHabitat: candidate.sameHabitat,
            reason: 'feeding',
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      }

      if (consumedTotal > 0) continue;
      const hungryForTicks =
        monster.lastFedAt === undefined
          ? Number.POSITIVE_INFINITY
          : scheduleTick - monster.lastFedAt;
      if (
        scheduleTick % WORLD_TICKS_PER_YEAR !== 0 ||
        hungryForTicks < WORLD_TICKS_PER_YEAR
      ) {
        continue;
      }

      monster.count = Math.max(0, monster.count - 1);
      monster.lastChangedAt = now;
      monster.alertness = clamp01(monster.alertness + 0.12);
      this.stageEvent({
        eventId: this.nextId('monster-hunger'),
        worldId: this.state.id,
        kind: 'world.monster.hunger',
        source: 'world',
        occurredAt: now,
        payload: {
          monsterPopulationId: monster.id,
          monsterSpecies: monster.species,
          habitatId: monster.habitatId,
          lost: 1,
          remaining: monster.count,
          reason: 'no_reachable_prey',
          worldMinutes: this.state.calendar.elapsedWorldMinutes,
        },
      });
    }
  }

  /**
   * One scripted parasite, one host and one larva. It is deliberately outside
   * ordinary wildlife reproduction and never writes courage, obedience or any
   * other choice into a resident. Fighting is an individual voluntary act.
   */
  private advanceCenturyHumpback(now: number): void {
    const cycle = ensureCenturyHumpbackState(this.state);
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const population = cycle.populationId
      ? this.state.wildlife[cycle.populationId]
      : undefined;
    const clearPhysicalMonster = (): void => {
      if (population) {
        population.count = 0;
        population.lastChangedAt = now;
      }
    };
    const nearbyResidents = (): AgentState[] => {
      if (!cycle.nearbyRace) return [];
      const settlementId = `settlement_${cycle.nearbyRace}_homeland`;
      return Object.values(this.state.agents)
        .filter(
          (agent) =>
            agent.life.alive &&
            (agent.race ?? 'human') === cycle.nearbyRace &&
            this.homeSettlementId(agent) === settlementId,
        )
        .sort((left, right) => left.id.localeCompare(right.id));
    };

    if (cycle.phase === 'dormant') {
      if (worldMinutes < cycle.nextEmergenceWorldMinute) return;
      const possibleRaces = (['dwarf', 'goblin', 'orc', 'ogre'] as const).filter(
        (race) => this.state.places[`settlement_${race}_homeland`] !== undefined,
      );
      if (possibleRaces.length === 0) return;
      cycle.cycle += 1;
      const nearbyRace = possibleRaces[(cycle.cycle - 1) % possibleRaces.length];
      const settlementId = `settlement_${nearbyRace}_homeland`;
      const settlement = this.state.places[settlementId];
      const angle = cycle.cycle * 2.399963229728653;
      const habitatId = `century_humpback_lair_${cycle.cycle}`;
      const populationId = `century_humpback_${cycle.cycle}`;
      this.state.places[habitatId] = createPlace(
        habitatId,
        cycle.cycle % 2 === 0
          ? 'Пустошь Столетнего горбатника'
          : 'Пещера Столетнего горбатника',
        cycle.cycle % 2 === 0 ? 'ruins' : 'mountains',
        2,
        {
          biome: cycle.cycle % 2 === 0 ? 'ancient_ruins' : 'mountains',
          mapX: settlement.mapX + Math.cos(angle) * 80,
          mapY: settlement.mapY + Math.sin(angle) * 80,
          connectedPlaceIds: [settlementId],
          fertility: 0.02,
          danger: 1,
          surface: 'land',
          discoveredAt: now,
        },
      );
      makeConnectionsReciprocal(this.state.places);
      this.state.wildlife[populationId] = {
        id: populationId,
        species: CENTURY_HUMPBACK_SPECIES,
        habitatId,
        count: 1,
        carryingCapacity: 1,
        reproductionRate: 0,
        alertness: 1,
        threat: 1,
        isMonster: true,
        lastChangedAt: now,
      };
      cycle.phase = 'adult';
      cycle.phaseStartedWorldMinute = worldMinutes;
      cycle.phaseEndsWorldMinute = undefined;
      cycle.habitatId = habitatId;
      cycle.populationId = populationId;
      cycle.hostAgentId = undefined;
      cycle.nearbyRace = nearbyRace;
      this.rebuildSpatialProjection();
      this.stageEvent({
        eventId: this.nextId('century-humpback-emerged'),
        worldId: this.state.id,
        kind: 'world.monster.century_humpback.emerged',
        source: 'world',
        occurredAt: now,
        payload: {
          cycle: cycle.cycle,
          habitatId,
          nearbyRace,
          singleton: true,
          reproductionRate: 0,
          adultStrengthRequired: CENTURY_HUMPBACK_STRENGTH_THRESHOLD,
          humanKnowledge: 'countermeasures',
          elfKnowledge: 'countermeasures',
          otherRaceKnowledge: 'danger_warning_only',
          worldMinutes,
        },
      });
      return;
    }

    if (cycle.phase === 'adult') {
      if (cycle.phaseStartedWorldMinute === worldMinutes) return;
      const capable = nearbyResidents().filter(
        (agent) =>
          canDefeatAdultCenturyHumpback(agent.life.physiology.strength) &&
          agent.life.health >= 0.55 &&
          agent.life.stage === 'adult',
      );
      const volunteers = capable.filter((agent) => {
        const willingness = clamp01(
          0.04 +
            agent.personality.riskTolerance * 0.3 +
            agent.mind.values.care * 0.2 +
            (agent.progression?.combatMastery ?? 0) * 0.24 -
            agent.stress * 0.16,
        );
        return this.rng.next() < willingness;
      });
      if (volunteers.length > 0) {
        const defender = volunteers.sort(
          (left, right) =>
            right.life.physiology.strength - left.life.physiology.strength ||
            left.id.localeCompare(right.id),
        )[0];
        clearPhysicalMonster();
        cycle.phase = 'dormant';
        cycle.nextEmergenceWorldMinute = worldMinutes + CENTURY_HUMPBACK_INTERVAL;
        cycle.lastOutcome = 'adult_defeated';
        cycle.hostAgentId = undefined;
        this.stageEvent({
          eventId: this.nextId('century-humpback-defeated'),
          worldId: this.state.id,
          kind: 'world.monster.century_humpback.defeated',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: defender.id,
            strength: defender.life.physiology.strength,
            requiredStrength: CENTURY_HUMPBACK_STRENGTH_THRESHOLD,
            voluntary: true,
            forcedByEngine: false,
            nextCycleYears: 100,
            worldMinutes,
          },
        });
        return;
      }

      const hosts = nearbyResidents().filter(
        (agent) => agent.life.stage !== 'child' && agent.life.health >= 0.35,
      );
      if (hosts.length === 0) return;
      const host = hosts[Math.floor(this.rng.next() * hosts.length)];
      clearPhysicalMonster();
      cycle.phase = 'incubating';
      cycle.phaseStartedWorldMinute = worldMinutes;
      cycle.phaseEndsWorldMinute = worldMinutes + CENTURY_HUMPBACK_INCUBATION;
      cycle.hostAgentId = host.id;
      this.stageEvent({
        eventId: this.nextId('century-humpback-infected'),
        worldId: this.state.id,
        kind: 'world.monster.century_humpback.infected_host',
        source: 'world',
        occurredAt: now,
        payload: {
          hostAgentId: host.id,
          hostRace: host.race ?? 'human',
          oneEgg: true,
          hostBehaviorSuppressed: false,
          worldMinutes,
        },
      });
      return;
    }

    if (cycle.phase === 'incubating') {
      if (worldMinutes < (cycle.phaseEndsWorldMinute ?? Infinity)) return;
      const host = cycle.hostAgentId
        ? this.state.agents[cycle.hostAgentId]
        : undefined;
      if (host?.life.alive) {
        this.recordDeath(host, 'monster', now, {
          species: CENTURY_HUMPBACK_SPECIES,
          isMonster: true,
          habitatId: cycle.habitatId,
          populationCount: 1,
          carryingCapacity: 1,
          threat: 1,
          damage: 1,
          lethalChance: 1,
          encounterReason: 'territorial_defense',
        });
      }
      const larva = cycle.populationId
        ? this.state.wildlife[cycle.populationId]
        : undefined;
      if (larva) {
        larva.count = 1;
        larva.lastChangedAt = now;
      }
      cycle.phase = 'larva_crawling';
      cycle.phaseStartedWorldMinute = worldMinutes;
      cycle.phaseEndsWorldMinute = worldMinutes + CENTURY_HUMPBACK_CRAWL;
      cycle.lastOutcome = 'host_killed';
      this.stageEvent({
        eventId: this.nextId('century-humpback-larva'),
        worldId: this.state.id,
        kind: 'world.monster.century_humpback.larva_emerged',
        source: 'world',
        occurredAt: now,
        payload: {
          hostAgentId: cycle.hostAgentId ?? 'unknown',
          habitatId: cycle.habitatId ?? 'unknown',
          larvaCount: 1,
          crawlingToLair: true,
          worldMinutes,
        },
      });
      return;
    }

    if (cycle.phase === 'larva_crawling') {
      if (cycle.phaseStartedWorldMinute === worldMinutes) return;
      const volunteers = nearbyResidents().filter((agent) => {
        if (agent.life.stage === 'child' || agent.life.health < 0.4) return false;
        const willingness = clamp01(
          0.08 +
            agent.personality.riskTolerance * 0.24 +
            agent.mind.values.care * 0.18 +
            agent.skills.hunting * 0.2 -
            agent.stress * 0.12,
        );
        return this.rng.next() < willingness;
      });
      if (volunteers.length > 0) {
        const defender = volunteers[0];
        clearPhysicalMonster();
        cycle.phase = 'dormant';
        cycle.nextEmergenceWorldMinute =
          worldMinutes + CENTURY_HUMPBACK_LARVA_KILLED_INTERVAL;
        cycle.lastOutcome = 'larva_killed';
        this.stageEvent({
          eventId: this.nextId('century-humpback-larva-killed'),
          worldId: this.state.id,
          kind: 'world.monster.century_humpback.larva_killed',
          source: 'agent',
          occurredAt: now,
          payload: {
            agentId: defender.id,
            voluntary: true,
            forcedByEngine: false,
            larvaCount: 1,
            nextCycleYears: 200,
            worldMinutes,
          },
        });
        return;
      }
      if (worldMinutes < (cycle.phaseEndsWorldMinute ?? Infinity)) return;
      clearPhysicalMonster();
      cycle.phase = 'dormant';
      cycle.nextEmergenceWorldMinute = worldMinutes + CENTURY_HUMPBACK_INTERVAL;
      cycle.lastOutcome = 'larva_reached_lair';
      this.stageEvent({
        eventId: this.nextId('century-humpback-lair'),
        worldId: this.state.id,
        kind: 'world.monster.century_humpback.reached_lair',
        source: 'world',
        occurredAt: now,
        payload: { nextCycleYears: 100, worldMinutes },
      });
    }
  }

  private advanceAgingAndMortality(
    now: number,
    elapsedWorldMinutes: number,
  ): void {
    const ageDelta = elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR;
    const durationScale = ageDelta * WORLD_TICKS_PER_YEAR;
    for (const agent of Object.values(this.state.agents)) {
      if (!agent.life.alive) continue;

      const previousStage = agent.life.stage;
      const previousAgeYears = agent.life.ageYears;
      const previousHealth = agent.life.health;
      const immortal = isImmortalV20(this.state, agent.id);
      const eternalYouth = hasGiftV20(this.state, agent.id, 'eternal_youth');
      const ageless = immortal || eternalYouth;
      const longevityMastery = giftMasteryV20(this.state, agent.id, 'longevity');
      // Chronological age always advances at world speed. Gifts affect the body,
      // not the calendar or the resident's lived history.
      agent.life.ageYears += ageDelta;
      agent.life.stage = ageless
        ? 'adult'
        : lifeStageForRaceV16(agent.race ?? 'human', agent.life.ageYears);
      if (agent.life.stage !== previousStage) {
        this.recordAgentEvent(agent, now, 'agent.life.stage_changed', {
          previousStage,
          nextStage: agent.life.stage,
          ageYears: agent.life.ageYears,
        });
      }

      const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.1;
      // At home, a resident's health depends on food/material security that is
      // actually available in the settlement, not only on the small personal
      // reserve they carry. Away from home, effective security automatically
      // falls back to personal reserves, so shared stores never teleport.
      const effectiveResourceSecurity = this.v15EffectiveResourceSecurity(agent);
      const deprivation =
        Math.max(0, 0.12 - effectiveResourceSecurity) * 0.014 +
        Math.max(0, 0.1 - agent.energy) * 0.012;
      const elderAge =
        SAPIENT_RACE_LIFE_PROFILES_V16[agent.race ?? 'human'].elderAtAge;
      // Longevity slows biological ageing without lying about chronological age.
      // Immortality caps biological age at a healthy adult band while the lived
      // age displayed in history can continue for centuries.
      const biologicalAge = ageless
        ? Math.min(agent.life.ageYears, elderAge * (immortal ? 0.78 : 0.72))
        : agent.life.ageYears * (1 - longevityMastery * 0.55);
      const frailty =
        biologicalAge > elderAge
          ? ((biologicalAge - elderAge) /
              Math.max(1, agent.life.lifespanYears - elderAge)) *
            0.0018
          : 0;
      const frailtyBurden = burdenIntensityV22(this.state, agent.id, 'frailty');
      const rapidHealing = giftMasteryV20(this.state, agent.id, 'rapid_healing');
      const robustHealth = giftMasteryV20(this.state, agent.id, 'robust_health');
      const recovery =
        effectiveResourceSecurity > 0.35 && agent.energy > 0.3
          ? (0.0018 + agent.personality.resilience * 0.0014) *
            agent.life.physiology.recovery *
            Math.max(0.4, 1 - frailtyBurden * 0.45)
          : 0;
      agent.life.health = clamp01(
        agent.life.health +
          recovery * (1 + rapidHealing * 1.5) -
          deprivation * (1 + frailtyBurden * 0.35) -
          frailty * Math.max(0.05, durationScale) -
          placeDanger * (0.00022 * (1 - robustHealth * 0.68) + frailtyBurden * 0.00008),
      );
      if (immortal) agent.life.health = Math.max(agent.life.health, 0.2);
      // Passive body gifts still grow from lived evidence.  These hooks reuse
      // the ageing/health pass that already exists; no extra resident scan is
      // introduced. Longevity samples once per lived birthday, recovery only
      // when health actually rises, and robust health only after real strain.
      if (longevityMastery > 0 && Math.floor(agent.life.ageYears) > Math.floor(previousAgeYears)) {
        practiceGiftV20(this.state, agent.id, 'longevity', 0.006, this.state.calendar.elapsedWorldMinutes);
      }
      if (rapidHealing > 0 && agent.life.health > previousHealth + 0.00001) {
        practiceGiftV20(
          this.state,
          agent.id,
          'rapid_healing',
          Math.min(0.003, (agent.life.health - previousHealth) * 0.12 + 0.0002),
          this.state.calendar.elapsedWorldMinutes,
        );
      }
      if (robustHealth > 0 && agent.life.health < previousHealth - 0.00001 && agent.life.health > 0.015) {
        practiceGiftV20(
          this.state,
          agent.id,
          'robust_health',
          Math.min(0.0025, (previousHealth - agent.life.health) * 0.1 + 0.00015),
          this.state.calendar.elapsedWorldMinutes,
        );
      }
      agent.life.physiology = racePhysiology(
        agent.race ?? 'human',
        physiologyForAge(
          biologicalAge,
          agent.life.lifespanYears,
          agent.life.health,
        ),
      );
      applyPersistentDivineGiftEffectsV19(this.state, agent);

      const ageRatio = agent.life.ageYears / agent.life.lifespanYears;
      const oldAgeChance =
        ageRatio > 0.9 ? Math.pow((ageRatio - 0.9) / 0.1, 2) * 0.014 : 0;
      if (!ageless && agent.life.ageYears >= agent.life.lifespanYears) {
        this.recordDeath(agent, 'old_age', now);
      } else if (agent.life.health <= 0.015) {
        this.recordDeath(
          agent,
          effectiveResourceSecurity < 0.08 ? 'deprivation' : 'illness',
          now,
        );
      } else if (
        !ageless &&
        oldAgeChance > 0 &&
        this.rng.next() < clamp01(oldAgeChance * durationScale)
      ) {
        this.recordDeath(agent, 'old_age', now);
      }
    }
  }

  private recordDeath(
    agent: AgentState,
    cause: AgentDeathCause,
    now: number,
    threat?: DeathThreatContextV15,
  ): void {
    if (!agent.life.alive) return;
    if (isImmortalV20(this.state, agent.id)) {
      // Immortality is a mortality rule only. It never rewrites identity,
      // decisions or memories, and chronological age remains intact.
      agent.life.health = Math.max(agent.life.health, 0.2);
      agent.energy = Math.max(agent.energy, 0.08);
      agent.stress = clamp01(agent.stress + 0.06);
      return;
    }
    if (cause !== 'old_age' && triggerPhoenixV22(this.state, agent.id)) {
      // Phoenix is event-driven and one-shot: no per-tick polling or hidden
      // dependency. The fatal event happened, but the ability burns itself out.
      agent.life.health = Math.max(agent.life.health, 0.28);
      agent.energy = Math.max(agent.energy, 0.16);
      agent.stress = clamp01(agent.stress + 0.24);
      this.recordAgentEvent(agent, now, 'agent.divine.phoenix_triggered', { cause });
      return;
    }
    const protectionMastery = giftMasteryV20(this.state, agent.id, 'divine_protection');
    if (cause !== 'old_age' && protectionMastery > 0 && this.rng.next() < 0.01 + protectionMastery * 0.11) {
      agent.life.health = Math.max(agent.life.health, 0.08 + protectionMastery * 0.08);
      practiceGiftV20(this.state, agent.id, 'divine_protection', 0.01, this.state.calendar.elapsedWorldMinutes);
      this.recordAgentEvent(agent, now, 'agent.divine.protection_triggered', { cause });
      return;
    }

    const v15 = this.v15World();
    const deathId = this.nextId('death');
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.1;
    const healthBeforeDeath = agent.life.health;
    const progression = agent.progression;
    const localResources = this.settlementResourcesForAgent(agent);
    const telemetry = buildDeathTelemetryV15(
      deathId,
      cause,
      {
        agentId: agent.id,
        name: agent.name,
        ageYears: agent.life.ageYears,
        lifespanYears: agent.life.lifespanYears,
        generation: agent.life.generation,
        level: progression?.level ?? 1,
        experience: progression?.experience ?? 0,
        technicalTick: now,
        worldMinutes,
        locationId: agent.locationId,
        placeDanger,
        lastAction: agent.lastAction,
        healthBeforeDeath,
        energyBeforeDeath: agent.energy,
        resourcesBeforeDeath: agent.resources,
        stressBeforeDeath: agent.stress,
        physiology: { ...agent.life.physiology },
        combatMastery: progression?.combatMastery ?? 0,
        objectControlAuthority: progression?.objectControlAuthority ?? 0,
        renewableResourceBase: localResources.renewableBase,
        storedResourcePressure: clamp01(
          1 - localResources.storedResources,
        ),
        safetySupport: this.state.environment.safetySupport,
        threat,
      },
      {
        oldAgeTriggeredByLifespan:
          cause === 'old_age' &&
          agent.life.ageYears >= agent.life.lifespanYears,
      },
    );

    v15.deathTelemetry.push({
      deathId,
      agentId: agent.id,
      cause,
      worldMinutes,
      technicalTick: now,
      ageYears: agent.life.ageYears,
      lifespanYears: agent.life.lifespanYears,
      generation: agent.life.generation,
      level: progression?.level ?? 1,
      healthBeforeDeath,
      energyBeforeDeath: agent.energy,
      resourcesBeforeDeath: agent.resources,
      stressBeforeDeath: agent.stress,
      locationId: agent.locationId,
      placeDanger,
      lastAction: agent.lastAction,
      species: threat?.species,
      monster: threat?.isMonster,
      damage: threat?.damage,
      lethalChance: threat?.lethalChance,
      encounterReason: threat?.encounterReason,
      primaryMechanism: telemetry.primaryMechanism,
      diagnosticFactors: [...telemetry.diagnosticFactors],
      summary: telemetry.humanSummary,
    });
    if (v15.deathTelemetry.length > V15_MAX_DEATH_TELEMETRY) {
      v15.deathTelemetry.splice(
        0,
        v15.deathTelemetry.length - V15_MAX_DEATH_TELEMETRY,
      );
    }

    recordDeathRemainsV16(this.state, agent);

    agent.life.alive = false;
    agent.life.health = 0;
    agent.life.diedAt = now;
    agent.life.deathCause = cause;
    agent.lastAction = undefined;
    agent.lastDecision = undefined;
    agent.plan = undefined;
    this.state.population.deaths += 1;
    stopDeceasedActions(this.state, agent);
    if (this.state.v21) {
      delete this.state.v21.bodiesByAgentId[agent.id];
      delete this.state.v21.appliedKnowledgeByAgentId[agent.id];
      delete this.state.v21.childSupervisionByChildId[agent.id];
    }
    this.state.population.lastDeathAt = now;

    this.stageEvent({
      eventId: deathId,
      worldId: this.state.id,
      kind: 'agent.died',
      source: 'world',
      occurredAt: now,
      payload: {
        deathId,
        agentId: agent.id,
        name: agent.name,
        cause,
        ageYears: agent.life.ageYears,
        generation: agent.life.generation,
        worldMinutes,
        primaryMechanism: telemetry.primaryMechanism,
        summary: telemetry.humanSummary,
      },
    });

    const relatives = new Set([
      ...agent.life.parentIds,
      ...agent.life.childIds,
    ]);
    for (const relationship of Object.values(this.state.relationships)) {
      const otherId =
        relationship.agentA === agent.id
          ? relationship.agentB
          : relationship.agentB === agent.id
            ? relationship.agentA
            : undefined;
      if (!otherId) continue;
      const bondStrength =
        relationship.trust +
        relationship.affinity +
        relationship.respect -
        relationship.conflict;
      if (bondStrength >= 1.45) relatives.add(otherId);
    }
    for (const relativeId of relatives) {
      const relative = this.state.agents[relativeId];
      if (!relative?.life.alive) continue;
      relative.mind.emotions.grief = clamp01(
        relative.mind.emotions.grief + 0.46,
      );
      relative.mind.emotions.joy = clamp01(
        relative.mind.emotions.joy - 0.24,
      );
      relative.mind.beliefs.afterlife = clamp01(
        relative.mind.beliefs.afterlife + 0.035,
      );
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: relative.id,
        createdAt: now,
        kind: 'death',
        summary: `${relative.name} lost ${agent.name}.`,
        importance: 0.96,
        valence: -0.92,
        relatedAgentIds: [agent.id],
      });
    }
  }

  private familyLifecycleMap(): Record<string, V16FamilyLifecycleState> {
    const v16 = ensureWorldV16State(this.state);
    v16.familyLifecycleByPairId ??= {};
    return v16.familyLifecycleByPairId;
  }

  private familyIntentForAgent(
    agentId: string,
  ): V16FamilyLifecycleState | undefined {
    const indexed = this.familyLifecyclesByAgentId?.get(agentId);
    const candidates = indexed ?? Object.values(this.familyLifecycleMap()).filter(
      (lifecycle) =>
        lifecycle.agentAId === agentId || lifecycle.agentBId === agentId,
    );
    return candidates.find((lifecycle) => {
      if (lifecycle.stage !== 'intending') return false;
      const partnerId =
        lifecycle.agentAId === agentId
          ? lifecycle.agentBId
          : lifecycle.agentAId;
      return this.state.agents[partnerId]?.life.alive === true;
    });
  }

  private familyRendezvousForAgent(
    agentId: string,
  ): V16FamilyLifecycleState | undefined {
    const indexed = this.familyLifecyclesByAgentId?.get(agentId);
    const candidates = indexed ?? Object.values(this.familyLifecycleMap()).filter(
      (lifecycle) =>
        lifecycle.agentAId === agentId || lifecycle.agentBId === agentId,
    );
    return candidates.find((lifecycle) => {
      if (lifecycle.stage === 'pregnant') return false;
      const partnerId =
        lifecycle.agentAId === agentId
          ? lifecycle.agentBId
          : lifecycle.agentAId;
      return this.state.agents[partnerId]?.life.alive === true;
    });
  }

  private familyPartnerFor(
    lifecycle: Readonly<V16FamilyLifecycleState>,
    agentId: string,
  ): AgentState | undefined {
    const partnerId =
      lifecycle.agentAId === agentId
        ? lifecycle.agentBId
        : lifecycle.agentAId;
    return this.state.agents[partnerId];
  }

  private physicallyCoPresent(
    a: Readonly<AgentState>,
    b: Readonly<AgentState>,
  ): boolean {
    return (
      a.life.alive &&
      b.life.alive &&
      !a.movement &&
      !b.movement &&
      a.locationId === b.locationId
    );
  }

  private familyDecisionInputs(
    a: AgentState,
    b: AgentState,
    selectedRace: AgentRace,
  ) {
    ensureAgentV15State(this.state, a);
    ensureAgentV15State(this.state, b);
    const v15 = this.v15World();
    const aAgency = v15.familyAgencyByAgentId[a.id];
    const bAgency = v15.familyAgencyByAgentId[b.id];
    const asFamilyPerson = (
      agent: AgentState,
      agency: WorldV15State['familyAgencyByAgentId'][string],
    ): FamilyPerson => ({
      id: agent.id,
      sex: agent.sex === 'female' ? 'female' : 'male',
      ageYears: agent.life.ageYears,
      alive: agent.life.alive,
      health: agent.life.health,
      stress: agent.stress,
      resources: agent.resources,
      personality: {
        physicalIntimacyInclination: agency.physicalIntimacyInclination,
        childDesire: agency.childDesire,
        autonomy: agency.autonomy,
      },
      parentIds: [...agent.life.parentIds],
      childIds: [...agent.life.childIds],
      ...(agent.life.lastChildWorldMinute === undefined
        ? {}
        : { lastChildWorldMinute: agent.life.lastChildWorldMinute }),
    });
    const familyA = asFamilyPerson(a, aAgency);
    const familyB = asFamilyPerson(b, bAgency);
    const relationship =
      this.state.relationships[relationshipKey(a.id, b.id)] ??
      this.relationshipFor(a, b, this.state.now);
    const attachment = clamp01(
      relationship.affinity * 0.5 +
        relationship.trust * 0.28 +
        relationship.respect * 0.14 -
        relationship.conflict * 0.16,
    );
    const raceProfile = SAPIENT_RACE_LIFE_PROFILES_V16[selectedRace];
    const context = {
      worldMinutes: this.state.calendar.elapsedWorldMinutes,
      relationship: {
        trust: relationship.trust,
        affinity: relationship.affinity,
        respect: relationship.respect,
        conflict: relationship.conflict,
        attachment,
      },
      householdResourceSecurity: Math.min(
        this.v15EffectiveResourceSecurity(a),
        this.v15EffectiveResourceSecurity(b),
      ),
      physicalEligibility: {
        minimumAdultAge:
          selectedRace === 'human'
            ? HUMAN_MINIMUM_REPRODUCTIVE_AGE_V16
            : raceProfile.adultAtAge,
        maximumReproductiveAge: raceProfile.maximumReproductiveAge,
        minimumReproductiveHealth: raceProfile.minimumReproductiveHealth,
      },
      allowCloseKin: foundingCloseKinAllowedV16(
        selectedRace,
        this.state.calendar.elapsedWorldMinutes,
      ),
      developmentalReadiness: Math.min(
        reproductiveDevelopmentV16(selectedRace, a.life.ageYears),
        reproductiveDevelopmentV16(selectedRace, b.life.ageYears),
      ),
    };
    return {
      familyA,
      familyB,
      context,
      signals: evaluateFamilyAgency(familyA, familyB, context),
    };
  }

  private stageFamilyIntimacyChoice(
    a: AgentState,
    b: AgentState,
    selectedRace: AgentRace,
    settlementId: string,
    pairId: string,
    mutualAttachment: number,
    mutualIntimacyInterest: number,
    childDecisionChosen: boolean,
    now: number,
  ): void {
    recordRaceFamilyChoiceV16(this.state, selectedRace, 'intimacy');
    recordLocalFamilyChoiceV16(
      this.state,
      settlementId,
      selectedRace,
      'intimacy',
    );
    this.stageEvent({
      eventId: this.nextId('intimacy-decision'),
      worldId: this.state.id,
      kind: 'agent.family.intimacy',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentA: a.id,
        agentB: b.id,
        race: selectedRace,
        pairId,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
        voluntary: true,
        mutualAttachment,
        mutualIntimacyInterest,
        childDecisionChosen,
        physicallyCoPresent: true,
      },
    });
  }

  private pruneFamilyLifecycles(now: number): void {
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const lifecycles = this.familyLifecycleMap();
    for (const [pairId, lifecycle] of Object.entries(lifecycles)) {
      const a = this.state.agents[lifecycle.agentAId];
      const b = this.state.agents[lifecycle.agentBId];
      if (lifecycle.stage === 'pregnant') {
        const pregnant = lifecycle.pregnantAgentId
          ? this.state.agents[lifecycle.pregnantAgentId]
          : undefined;
        if (pregnant?.life.alive) continue;
        delete lifecycles[pairId];
        this.stageEvent({
          eventId: this.nextId('pregnancy-ended'),
          worldId: this.state.id,
          kind: 'agent.family.pregnancy_ended',
          source: 'world',
          occurredAt: now,
          payload: {
            pairId,
            reason: 'pregnant_resident_died',
            worldMinutes,
          },
        });
        continue;
      }
      const expiryWindow =
        lifecycle.stage === 'meeting'
          ? FAMILY_MEETING_EXPIRY_WORLD_MINUTES
          : FAMILY_INTENT_EXPIRY_WORLD_MINUTES;
      const expired =
        worldMinutes - lifecycle.lastAffirmedWorldMinute >= expiryWindow;
      const profile = SAPIENT_RACE_LIFE_PROFILES_V16[lifecycle.race];
      const reproductiveWindowClosed =
        lifecycle.stage === 'intending' &&
        (a?.life.ageYears > profile.maximumReproductiveAge ||
          b?.life.ageYears > profile.maximumReproductiveAge);
      const impossible =
        !a?.life.alive ||
        !b?.life.alive ||
        (a.race ?? 'human') !== lifecycle.race ||
        (b.race ?? 'human') !== lifecycle.race ||
        reproductiveWindowClosed ||
        !this.canFormIntimateRelationship(a, b);
      if (!expired && !impossible) continue;
      delete lifecycles[pairId];
      this.stageEvent({
        eventId: this.nextId('family-intent-ended'),
        worldId: this.state.id,
        kind: 'agent.family.intent_ended',
        source: 'agent',
        occurredAt: now,
        payload: {
          pairId,
          agentA: lifecycle.agentAId,
          agentB: lifecycle.agentBId,
          reason: impossible ? 'no_longer_possible' : 'intent_expired',
          worldMinutes,
        },
      });
    }
  }

  private advanceFamilyPregnancies(now: number): void {
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const lifecycles = this.familyLifecycleMap();
    for (const [pairId, lifecycle] of Object.entries(lifecycles)) {
      if (lifecycle.stage !== 'pregnant') continue;
      const dueWorldMinute = lifecycle.dueWorldMinute;
      if (dueWorldMinute === undefined || worldMinutes < dueWorldMinute) continue;
      const a = this.state.agents[lifecycle.agentAId];
      const b = this.state.agents[lifecycle.agentBId];
      const mother = lifecycle.pregnantAgentId
        ? this.state.agents[lifecycle.pregnantAgentId]
        : undefined;
      if (!a || !b || !mother?.life.alive) {
        delete lifecycles[pairId];
        continue;
      }
      const expectedChildCount = Math.max(
        1,
        Math.min(4, Math.trunc(lifecycle.expectedChildCount ?? 1)),
      ) as BirthMultiplicityV22;
      // Build the name registry once for this delivery. Multiple births are
      // rare, but they must not multiply an O(population) name scan.
      const existingNames = new Set(
        Object.values(this.state.agents).map((agent) =>
          agent.name.toLocaleLowerCase('ru-RU'),
        ),
      );
      const childIds: string[] = [];
      for (let birthOrder = 1; birthOrder <= expectedChildCount; birthOrder += 1) {
        childIds.push(
          this.createChild(a, b, now, mother.locationId, {
            multiplicity: expectedChildCount,
            birthOrder,
            existingNames,
          }),
        );
        recordRaceFamilyChoiceV16(this.state, lifecycle.race, 'birth');
        if (this.state.settlements[lifecycle.settlementId]) {
          recordLocalFamilyChoiceV16(
            this.state,
            lifecycle.settlementId,
            lifecycle.race,
            'birth',
          );
        }
      }

      // Multiple delivery has a bounded physical cost evaluated once, at the
      // birth event itself. It adds no recurring family-tick scan.
      const rawHealthLoss = maternalPostpartumHealthLossV22(
        expectedChildCount,
        expectedChildCount > 1 ? this.rng.next() : 0,
      );
      const fertilityRecoveryMastery = giftMasteryV20(this.state, mother.id, 'fertility');
      // Fertility supports carrying/recovery modestly. It never reduces the
      // explicit multiplicity mortality roll (quadruplets remain 50%).
      const healthLoss = rawHealthLoss * (1 - fertilityRecoveryMastery * 0.15);
      if (healthLoss > 0) {
        mother.life.health = Math.max(0.02, mother.life.health - healthLoss);
        mother.life.physiology = racePhysiology(
          mother.race ?? 'human',
          physiologyForAge(
            mother.life.ageYears,
            mother.life.lifespanYears,
            mother.life.health,
          ),
        );
      }
      const maternalMortalityRisk = maternalChildbirthMortalityRiskV22(
        expectedChildCount,
      );
      const maternalDeathTriggered =
        maternalMortalityRisk > 0 && this.rng.next() < maternalMortalityRisk;
      if (maternalDeathTriggered) {
        this.recordDeath(mother, 'childbirth', now);
      }
      const maternalDied = !mother.life.alive;
      if (!maternalDied) {
        practiceGiftV20(this.state, mother.id, 'fertility', 0.0015 + expectedChildCount * 0.0005);
      }

      this.stageEvent({
        eventId: this.nextId('pregnancy-completed'),
        worldId: this.state.id,
        kind: 'agent.family.pregnancy_completed',
        source: 'world',
        occurredAt: now,
        payload: {
          pairId,
          childId: childIds[0],
          childIds,
          childCount: childIds.length,
          multipleBirth: childIds.length > 1,
          pregnantAgentId: mother.id,
          conceptionWorldMinute: lifecycle.conceptionWorldMinute ?? null,
          dueWorldMinute,
          birthWorldMinute: worldMinutes,
          birthPlaceId: mother.locationId,
          maternalHealthLoss: healthLoss,
          maternalMortalityRisk,
          maternalDeathTriggered,
          maternalDied,
        },
      });
      delete lifecycles[pairId];
    }
  }

  private advanceExistingFamilyIntentions(now: number): void {
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    const lifecycles = this.familyLifecycleMap();
    const pregnantAgentIds = new Set(
      Object.values(lifecycles)
        .filter((lifecycle) => lifecycle.stage === 'pregnant')
        .flatMap((lifecycle) =>
          lifecycle.pregnantAgentId ? [lifecycle.pregnantAgentId] : [],
        ),
    );
    for (const lifecycle of Object.values(lifecycles)) {
      if (lifecycle.stage !== 'intending') continue;
      const a = this.state.agents[lifecycle.agentAId];
      const b = this.state.agents[lifecycle.agentBId];
      if (!a || !b || !this.physicallyCoPresent(a, b)) continue;
      if (!this.canConsiderChildDecision(a, b, now)) continue;
      const { familyA, familyB, context, signals } = this.familyDecisionInputs(
        a,
        b,
        lifecycle.race,
      );
      lifecycle.lastPhysicalMeetingWorldMinute = worldMinutes;
      lifecycle.lastAffirmedWorldMinute = worldMinutes;
      const intimacyDecision = decideIntimacyVoluntarily(
        familyA,
        familyB,
        context,
        this.rng.next(),
      );
      if (!intimacyDecision.chosen) continue;
      this.stageFamilyIntimacyChoice(
        a,
        b,
        lifecycle.race,
        lifecycle.settlementId,
        lifecycle.pairId,
        signals.mutualAttachment,
        signals.mutualIntimacyInterest,
        true,
        now,
      );
      lifecycle.lastIntimacyWorldMinute = worldMinutes;
      const mother = a.sex === 'female' ? a : b.sex === 'female' ? b : undefined;
      if (!mother || pregnantAgentIds.has(mother.id)) continue;
      const fertilitySupport = this.lawValue('fertility_support', 0.55);
      const physicalRealizationChance = clamp01(
        0.32 +
          fertilitySupport * 0.34 +
          Math.min(a.life.health, b.life.health) * 0.18 +
          signals.familyReadiness * 0.14 +
          Math.max(
            giftMasteryV20(this.state, a.id, 'fertility'),
            giftMasteryV20(this.state, b.id, 'fertility'),
          ) * 0.15,
      );
      if (this.rng.next() >= physicalRealizationChance) continue;
      lifecycle.stage = 'pregnant';
      lifecycle.pregnantAgentId = mother.id;
      lifecycle.conceptionWorldMinute = worldMinutes;
      lifecycle.dueWorldMinute = worldMinutes + FAMILY_GESTATION_WORLD_MINUTES;
      lifecycle.expectedChildCount = choosePregnancyMultiplicityV22(
        lifecycle.race,
        Math.max(
          giftMasteryV20(this.state, a.id, 'fertility'),
          giftMasteryV20(this.state, b.id, 'fertility'),
        ),
        this.rng.next(),
      );
      practiceGiftV20(this.state, a.id, 'fertility', 0.0008);
      practiceGiftV20(this.state, b.id, 'fertility', 0.0008);
      pregnantAgentIds.add(mother.id);
      this.stageEvent({
        eventId: this.nextId('conception'),
        worldId: this.state.id,
        kind: 'agent.family.conceived',
        source: 'world',
        occurredAt: now,
        payload: {
          pairId: lifecycle.pairId,
          agentA: a.id,
          agentB: b.id,
          pregnantAgentId: mother.id,
          conceptionPlaceId: mother.locationId,
          conceptionWorldMinute: worldMinutes,
          dueWorldMinute: lifecycle.dueWorldMinute,
          expectedChildCount: lifecycle.expectedChildCount ?? 1,
          voluntaryIntimacy: true,
          priorMutualChildIntent: true,
        },
      });
    }
  }

  private advanceBirths(now: number, elapsedWorldMinutes: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick)) return;

    // Pregnancy is a persistent physical state. Complete it before opening a
    // new family-opportunity window so a due birth can free the parent's
    // cooldown in the same deterministic semantic boundary.
    this.advanceFamilyPregnancies(now);
    if (scheduleTick % BIRTH_CHECK_INTERVAL !== 0) return;
    if (!(elapsedWorldMinutes > 0)) return;

    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    this.pruneFamilyLifecycles(now);
    this.advanceExistingFamilyIntentions(now);
    const lifecycles = this.familyLifecycleMap();
    const pregnantAgentIds = new Set(
      Object.values(lifecycles)
        .filter((lifecycle) => lifecycle.stage === 'pregnant')
        .flatMap((lifecycle) =>
          lifecycle.pregnantAgentId ? [lifecycle.pregnantAgentId] : [],
        ),
    );

    // Pair eligibility remains physical/lineage only. New mutual child intent
    // is considered only while the two residents are actually together. A
    // home address or relationship record is not physical co-presence.
    const candidates = Object.values(this.state.relationships)
      .map((relationship) => {
        const a = this.state.agents[relationship.agentA];
        const b = this.state.agents[relationship.agentB];
        if (!a || !b || !this.canConsiderChildDecision(a, b, now)) return undefined;
        return { a, b, relationship };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          a: AgentState;
          b: AgentState;
          relationship: RelationshipState;
        } => candidate !== undefined,
      );

    for (const selectedRace of SAPIENT_RACES) {
      const raceProfile = SAPIENT_RACE_LIFE_PROFILES_V16[selectedRace];
      const raceCandidates = candidates.filter(
        ({ a, b }) =>
          (a.race ?? 'human') === selectedRace &&
          (b.race ?? 'human') === selectedRace,
      );
      const candidatesBySettlement = new Map<string, typeof raceCandidates>();
      for (const candidate of raceCandidates) {
        const settlementId = this.familyOpportunitySettlementId(
          candidate.a,
          candidate.b,
        );
        if (!settlementId) continue;
        const local = candidatesBySettlement.get(settlementId) ?? [];
        local.push(candidate);
        candidatesBySettlement.set(settlementId, local);
      }

      for (const [settlementId, localCandidates] of [
        ...candidatesBySettlement.entries(),
      ].sort(([left], [right]) => left.localeCompare(right))) {
        const raceOpportunity = recordRaceOpportunityCheckV16(
          this.state,
          selectedRace,
          localCandidates.length,
        );
        const localOpportunity = recordLocalFamilyOpportunityCheckV16(
          this.state,
          settlementId,
          selectedRace,
          localCandidates.length,
        );
        const localRaceResidentCount =
          this.residentCountByHomeRace?.get(
            `${settlementId}\u0000${selectedRace}`,
          ) ?? 0;
        const maximumCandidateChecks = Math.min(
          localCandidates.length,
          Math.max(8, Math.ceil(localRaceResidentCount * 0.2)),
        );
        const window = residentOpportunityWindow(
          localCandidates,
          ({ a, b }) => relationshipKey(a.id, b.id),
          maximumCandidateChecks,
          localOpportunity.lastConsideredPairId,
        );
        localOpportunity.lastConsideredPairId = window.afterKey;
        raceOpportunity.scheduledPairChecks =
          (raceOpportunity.scheduledPairChecks ?? 0) + window.candidates.length;
        localOpportunity.scheduledPairChecks =
          (localOpportunity.scheduledPairChecks ?? 0) + window.candidates.length;

        for (const { a, b } of window.candidates) {
          if (!this.canConsiderChildDecision(a, b, now)) continue;
          raceOpportunity.evaluatedPairChecks =
            (raceOpportunity.evaluatedPairChecks ?? 0) + 1;
          localOpportunity.evaluatedPairChecks =
            (localOpportunity.evaluatedPairChecks ?? 0) + 1;

          const pairId = relationshipKey(a.id, b.id);
          const existingLifecycle = lifecycles[pairId];
          if (existingLifecycle?.stage === 'pregnant' || existingLifecycle?.stage === 'intending') {
            continue;
          }
          if (!this.physicallyCoPresent(a, b)) continue;
          if (existingLifecycle?.stage === 'meeting') {
            // The remembered rendezvous did its job: both residents are now
            // physically together. Only now can a child decision be discussed.
            delete lifecycles[pairId];
            this.stageEvent({
              eventId: this.nextId('family-meeting-completed'),
              worldId: this.state.id,
              kind: 'agent.family.meeting_completed',
              source: 'agent',
              occurredAt: now,
              payload: {
                pairId,
                agentA: a.id,
                agentB: b.id,
                meetingPlaceId: a.locationId,
                worldMinutes,
              },
            });
          }
          const mother = a.sex === 'female' ? a : b.sex === 'female' ? b : undefined;
          if (!mother || pregnantAgentIds.has(mother.id)) continue;

          const { familyA, familyB, context, signals } = this.familyDecisionInputs(
            a,
            b,
            selectedRace,
          );
          const intimacyDecision = decideIntimacyVoluntarily(
            familyA,
            familyB,
            context,
            this.rng.next(),
          );
          const personalBirthCooldown =
            PERSONAL_PARENT_BIRTH_COOLDOWN_WORLD_MINUTES_V15 *
            (raceProfile.raceBirthSpacingWorldMinutes /
              SAPIENT_RACE_LIFE_PROFILES_V16.human
                .raceBirthSpacingWorldMinutes);
          const decision = decideChildVoluntarily(
            familyA,
            familyB,
            context,
            this.rng.next(),
            personalBirthCooldown,
          );

          if (intimacyDecision.chosen) {
            this.stageFamilyIntimacyChoice(
              a,
              b,
              selectedRace,
              settlementId,
              intimacyDecision.pairId,
              signals.mutualAttachment,
              signals.mutualIntimacyInterest,
              decision.chosen,
              now,
            );
          }
          if (!decision.chosen) continue;

          recordRaceFamilyChoiceV16(this.state, selectedRace, 'child');
          recordLocalFamilyChoiceV16(
            this.state,
            settlementId,
            selectedRace,
            'child',
          );
          this.stageEvent({
            eventId: this.nextId('family-decision'),
            worldId: this.state.id,
            kind: 'agent.family.child_decision',
            source: 'agent',
            occurredAt: now,
            payload: {
              agentA: a.id,
              agentB: b.id,
              race: selectedRace,
              pairId: decision.pairId,
              worldMinutes,
              voluntary: true,
              mutualAttachment: signals.mutualAttachment,
              mutualIntimacyInterest: signals.mutualIntimacyInterest,
              mutualChildIntent: signals.mutualChildIntent,
              familyReadiness: signals.familyReadiness,
              physicallyCoPresent: true,
              conceptionDeferred: false,
              conceptionRequiresPhysicalRealization: true,
            },
          });

          // The mutual decision becomes persistent intent. Even if intimacy
          // also happened in this same window, conception is deliberately not
          // resolved until a later physical meeting. "Decided" is not
          // "pregnant" and never becomes an instant birth.
          lifecycles[pairId] = {
            id: pairId,
            pairId,
            agentAId: a.id,
            agentBId: b.id,
            race: selectedRace,
            settlementId,
            meetingPlaceId: a.locationId,
            stage: 'intending',
            createdWorldMinute: worldMinutes,
            lastAffirmedWorldMinute: worldMinutes,
            lastPhysicalMeetingWorldMinute: worldMinutes,
            ...(intimacyDecision.chosen
              ? { lastIntimacyWorldMinute: worldMinutes }
              : {}),
          };
          this.stageEvent({
            eventId: this.nextId('family-intent'),
            worldId: this.state.id,
            kind: 'agent.family.intent_formed',
            source: 'agent',
            occurredAt: now,
            payload: {
              pairId,
              agentA: a.id,
              agentB: b.id,
              race: selectedRace,
              settlementId,
              meetingPlaceId: a.locationId,
              worldMinutes,
              voluntary: true,
            },
          });

          // Child intent and intimacy remain separate choices. When both were
          // independently chosen during this real physical meeting, conception
          // may physically occur in the same encounter; the child still needs
          // a full gestation. If realization does not occur, the child intent
          // persists and a later physical meeting can try again.
          if (intimacyDecision.chosen) {
            const fertilitySupport = this.lawValue('fertility_support', 0.55);
            const physicalRealizationChance = clamp01(
              0.32 +
                fertilitySupport * 0.34 +
                Math.min(a.life.health, b.life.health) * 0.18 +
                signals.familyReadiness * 0.14 +
                Math.max(
                  giftMasteryV20(this.state, a.id, 'fertility'),
                  giftMasteryV20(this.state, b.id, 'fertility'),
                ) * 0.15,
            );
            if (this.rng.next() < physicalRealizationChance) {
              lifecycles[pairId].stage = 'pregnant';
              lifecycles[pairId].pregnantAgentId = mother.id;
              lifecycles[pairId].conceptionWorldMinute = worldMinutes;
              lifecycles[pairId].dueWorldMinute =
                worldMinutes + FAMILY_GESTATION_WORLD_MINUTES;
              lifecycles[pairId].expectedChildCount = choosePregnancyMultiplicityV22(
                selectedRace,
                Math.max(
          giftMasteryV20(this.state, a.id, 'fertility'),
          giftMasteryV20(this.state, b.id, 'fertility'),
        ),
                this.rng.next(),
              );
              practiceGiftV20(this.state, a.id, 'fertility', 0.0008);
              practiceGiftV20(this.state, b.id, 'fertility', 0.0008);
              pregnantAgentIds.add(mother.id);
              this.stageEvent({
                eventId: this.nextId('conception'),
                worldId: this.state.id,
                kind: 'agent.family.conceived',
                source: 'world',
                occurredAt: now,
                payload: {
                  pairId,
                  agentA: a.id,
                  agentB: b.id,
                  pregnantAgentId: mother.id,
                  conceptionPlaceId: mother.locationId,
                  conceptionWorldMinute: worldMinutes,
                  dueWorldMinute: lifecycles[pairId].dueWorldMinute,
                  expectedChildCount: lifecycles[pairId].expectedChildCount ?? 1,
                  voluntaryIntimacy: true,
                  priorMutualChildIntent: true,
                  samePhysicalMeetingAsChildDecision: true,
                },
              });
            }
          }
        }
      }
    }

  }

  private familyOpportunitySettlementId(
    a: Readonly<AgentState>,
    b: Readonly<AgentState>,
  ): string | undefined {
    const homeA = this.homeSettlementId(a);
    const homeB = this.homeSettlementId(b);
    if (homeA && homeA === homeB) return homeA;
    if (a.locationId !== b.locationId) return undefined;
    return this.state.places[a.locationId]?.settlementId;
  }

  private areCloseFamilyRelatives(a: AgentState, b: AgentState): boolean {
    const closeRelatives = new Set([
      ...a.life.parentIds,
      ...a.life.childIds,
    ]);
    if (closeRelatives.has(b.id)) return true;
    return a.life.parentIds.some((parentId) => b.life.parentIds.includes(parentId));
  }

  /**
   * Adult relationship/intimacy eligibility deliberately excludes stress,
   * resources and fertility. Those are life circumstances, not permission to
   * have a relationship.
   */
  private canFormIntimateRelationship(a: AgentState, b: AgentState): boolean {
    const race = a.race ?? 'human';
    const profile = SAPIENT_RACE_LIFE_PROFILES_V16[race];
    const minimumAge = race === 'human'
      ? HUMAN_MINIMUM_REPRODUCTIVE_AGE_V16
      : profile.adultAtAge;
    const closeKin = this.areCloseFamilyRelatives(a, b);
    const foundingCloseKinAllowed = foundingCloseKinAllowedV16(
      race,
      this.state.calendar.elapsedWorldMinutes,
    );
    return (
      a.life.alive &&
      b.life.alive &&
      a.life.ageYears >= minimumAge &&
      b.life.ageYears >= minimumAge &&
      Boolean(a.sex) &&
      Boolean(b.sex) &&
      a.sex !== b.sex &&
      race === (b.race ?? 'human') &&
      (!closeKin || foundingCloseKinAllowed)
    );
  }

  /**
   * Child decisions add physical reproductive constraints and cooldowns, but
   * still do NOT hard-gate on stress/resources. Those influence voluntary
   * desire/readiness inside FamilyAgency instead.
   */
  private canConsiderChildDecision(a: AgentState, b: AgentState, _now: number): boolean {
    const race = a.race ?? 'human';
    const profile = SAPIENT_RACE_LIFE_PROFILES_V16[race];
    if (
      isImmortalV20(this.state, a.id) ||
      isImmortalV20(this.state, b.id) ||
      !this.canFormIntimateRelationship(a, b) ||
      a.life.ageYears > profile.maximumReproductiveAge ||
      b.life.ageYears > profile.maximumReproductiveAge ||
      a.life.health < profile.minimumReproductiveHealth ||
      b.life.health < profile.minimumReproductiveHealth
    ) {
      return false;
    }
    if (
      (a.life.lastChildWorldMinute !== undefined &&
        this.state.calendar.elapsedWorldMinutes -
          a.life.lastChildWorldMinute <
          WORLD_MINUTES_PER_YEAR * 1.3) ||
      (b.life.lastChildWorldMinute !== undefined &&
        this.state.calendar.elapsedWorldMinutes -
          b.life.lastChildWorldMinute <
          WORLD_MINUTES_PER_YEAR * 1.3)
    ) {
      return false;
    }
    return true;
  }

  private createChild(
    a: AgentState,
    b: AgentState,
    now: number,
    birthPlaceId?: string,
    birthContext?: {
      multiplicity: BirthMultiplicityV22;
      birthOrder: number;
      existingNames: Set<string>;
    },
  ): string {
    const sequence = this.state.population.nextAgentSequence;
    this.state.population.nextAgentSequence += 1;
    const childId = `epoch_${this.state.epoch ?? 1}_agent_${sequence}`;
    const race = a.race ?? 'human';
    const parentView = (parent: AgentState) => ({
      id: parent.id,
      sex: parent.sex === 'female' ? ('female' as const) : ('male' as const),
      race: parent.race ?? 'human',
      generation: parent.life.generation,
      resources: parent.resources,
      homeId: parent.homeId,
      socialDrive: parent.socialDrive,
      personality: { ...parent.personality },
      values: { ...parent.mind.values },
      beliefs: { ...parent.mind.beliefs },
      skills: { ...parent.skills },
    });

    const blueprint = deriveChildContinuityBlueprintV15(
      parentView(a),
      parentView(b),
      this.rng,
    );
    const closeKinFoundingUnion = this.areCloseFamilyRelatives(a, b);
    // Close kinship raises risk; it does not predetermine illness. The draw is
    // made only after both residents independently chose the relationship and
    // child, so it can never become a demographic command.
    const inheritedHealthRiskManifested =
      closeKinFoundingUnion && this.rng.next() < 0.22;
    const inheritedHealth = clamp01(
      blueprint.health -
        (inheritedHealthRiskManifested ? this.rng.between(0.04, 0.16) : 0) -
        newbornMultipleHealthPenaltyV22(birthContext?.multiplicity ?? 1),
    );
    const nameChoice = chooseCulturalChildNameV18({
      worldId: this.state.id,
      race,
      sex: blueprint.sex,
      sequence,
      parentA: a,
      parentB: b,
      existingNames:
        birthContext?.existingNames ??
        new Set(
          Object.values(this.state.agents).map((agent) =>
            agent.name.toLocaleLowerCase('ru-RU'),
          ),
        ),
    });
    const name = nameChoice.name;
    birthContext?.existingNames.add(name.toLocaleLowerCase('ru-RU'));
    const lifespanYears =
      blueprint.lifespanYears * SAPIENT_RACE_LIFE_PROFILES_V16[race].lifespanScale;
    const physicalBirthPlaceId =
      birthPlaceId && this.state.places[birthPlaceId]
        ? birthPlaceId
        : blueprint.homeId;
    const needs = { belonging: 0.88, purpose: 0.72 };
    const mind = createMindState(
      this.state.id,
      childId,
      blueprint.personality,
      needs,
    );
    mind.values = { ...blueprint.values };
    mind.beliefs = { ...blueprint.beliefs };

    const child: AgentState = {
      id: childId,
      name,
      origin: 'native',
      sex: blueprint.sex,
      race: blueprint.race as NonNullable<AgentState['race']>,
      progression: {
        level: 1,
        experience: 0,
        objectControlAuthority: 0,
        systemControlAuthority: 0,
        combatMastery: 0,
        sacredArts: 0,
      },
      energy: blueprint.energy,
      stress: blueprint.stress,
      resources: blueprint.resources,
      socialDrive: blueprint.socialDrive,
      personality: { ...blueprint.personality },
      life: {
        bornAt: now,
        ageYears: 0,
        lifespanYears,
        stage: 'child',
        alive: true,
        health: inheritedHealth,
        physiology: racePhysiology(
          race,
          physiologyForAge(
            0,
            lifespanYears,
            inheritedHealth,
          ),
        ),
        generation: blueprint.generation,
        parentIds: [...blueprint.parentIds],
        childIds: [],
      },
      mind,
      needs,
      skills: { ...blueprint.skills },
      goal: { kind: 'recover', strength: 0.66, since: now },
      homeId: blueprint.homeId,
      locationId: physicalBirthPlaceId,
      position: {
        x: this.state.places[physicalBirthPlaceId].mapX,
        y: this.state.places[physicalBirthPlaceId].mapY,
        layerId: 'surface',
      },
      lastMeaningfulEventAt: now,
    };
    this.state.agents[childId] = child;
    observeLocalPlacesV20(this.state, child);
    // Gifts can coexist and intertwine, but inheritance is evaluated per gift.
    // Immortality/Legacy/Marked/hero-composite are explicitly non-heritable.
    const inheritedGiftKinds = new Set<DivineGiftKind>();
    const inheritedBurdenKinds = new Set<DivineBurdenKind>();
    for (const parent of [a, b]) {
      const divineProfile = this.state.v19?.divineAgency.byAgentId[parent.id];
      if (!divineProfile) continue;
      const legacy = divineProfile.gifts.find((grant) => grant.gift === 'legacy');
      for (const grant of divineProfile.gifts) {
        if (!giftIsHeritableV20(grant.gift) || inheritedGiftKinds.has(grant.gift)) continue;
        const parentMastery = giftMasteryV20(this.state, parent.id, grant.gift);
        const legacySelected = legacy?.inheritableGift === grant.gift;
        if (this.rng.next() >= giftInheritanceChanceV20(grant.gift, parentMastery, legacySelected)) continue;
        applyDivineActionV19(this.state, {
          operationId: `inherit:${childId}:${parent.id}:${grant.gift}`,
          agentId: childId,
          deityId: grant.deityId,
          deityName: grant.deityName,
          gift: grant.gift,
          worldMinute: this.state.calendar.elapsedWorldMinutes,
          interpretationRoll: 0.5,
        });
        const inheritedGrant = this.state.v19?.divineAgency.byAgentId[childId]?.gifts.find(
          (candidate) => candidate.gift === grant.gift,
        );
        if (inheritedGrant) {
          inheritedGrant.mastery = inheritedGiftMasteryV20(grant.gift, parentMastery);
          inheritedGrant.inheritedFromAgentId = parent.id;
        }
        inheritedGiftKinds.add(grant.gift);
      }
      // A lineage curse is inherited as a weakened burden. It changes external
      // circumstances/body risk, never the descendant's choices or feelings.
      for (const burden of divineProfile.burdens ?? []) {
        if (!burden.lineage || inheritedBurdenKinds.has(burden.burden)) continue;
        applyDivineActionV19(this.state, {
          operationId: `lineage:${childId}:${parent.id}:${burden.burden}`,
          agentId: childId,
          deityId: burden.deityId,
          deityName: burden.deityName,
          burden: burden.burden,
          lineageCurse: true,
          worldMinute: this.state.calendar.elapsedWorldMinutes,
          interpretationRoll: 0.5,
        });
        const inheritedBurden = this.state.v19?.divineAgency.byAgentId[childId]?.burdens?.find(
          (candidate) => candidate.burden === burden.burden,
        );
        if (inheritedBurden) {
          inheritedBurden.intensity = clamp01(Math.max(0.08, burden.intensity * 0.85));
          inheritedBurden.inheritedFromAgentId = parent.id;
        }
        inheritedBurdenKinds.add(burden.burden);
      }
    }
    ensureAgentV15State(this.state, child);
    ensureAgentV16State(this.state, child);
    ensureRussianKnowledgeV18(this.state, child);
    ensureLivelihoodV18(this.state, child);
    ensureLifeRhythmV18(this.state, child);
    // A newborn receives its body and applied-knowledge record in the same
    // atomic birth operation. Reopening must never be the moment a body appears.
    ensureAgentEmbodiedWorldV21(this.state, childId);
    this.v15World().familyAgencyByAgentId[childId] = {
      ...blueprint.protectedFamilyPersonality,
    };

    a.life.childIds.push(childId);
    b.life.childIds.push(childId);
    a.life.lastChildAt = now;
    b.life.lastChildAt = now;
    a.life.lastChildWorldMinute = this.state.calendar.elapsedWorldMinutes;
    b.life.lastChildWorldMinute = this.state.calendar.elapsedWorldMinutes;
    this.state.relationships[relationshipKey(a.id, childId)] = {
      agentA: a.id,
      agentB: childId,
      trust: 0.82,
      affinity: 0.88,
      respect: 0.58,
      conflict: 0.02,
      updatedAt: now,
    };
    this.state.relationships[relationshipKey(b.id, childId)] = {
      agentA: b.id,
      agentB: childId,
      trust: 0.82,
      affinity: 0.88,
      respect: 0.58,
      conflict: 0.02,
      updatedAt: now,
    };
    this.state.population.births += 1;
    this.state.population.lastBirthAt = now;
    this.state.population.lastBirthWorldMinute =
      this.state.calendar.elapsedWorldMinutes;
    this.stageEvent({
      eventId: this.nextId('birth'),
      worldId: this.state.id,
      kind: 'agent.born',
      source: 'world',
      occurredAt: now,
      payload: {
        agentId: childId,
        name,
        race,
        parentIds: [a.id, b.id],
        generation: child.life.generation,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
        namingStyle: nameChoice.style,
        chosenByParentIds: nameChoice.parentIds,
        closeKinFoundingUnion,
        inheritedHealthRiskManifested,
        technicalSequenceKeptOnlyInAgentId: true,
        birthPlaceId: physicalBirthPlaceId,
        multipleBirthSize: birthContext?.multiplicity ?? 1,
        birthOrder: birthContext?.birthOrder ?? 1,
      },
    });
    for (const parent of [a, b]) {
      parent.mind.emotions.joy = clamp01(parent.mind.emotions.joy + 0.28);
      parent.mind.emotions.hope = clamp01(parent.mind.emotions.hope + 0.22);
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: parent.id,
        createdAt: now,
        kind: 'birth',
        summary: `${name} was born to ${a.name} and ${b.name}.`,
        importance: 0.98,
        valence: 0.92,
        relatedAgentIds: [childId, parent.id === a.id ? b.id : a.id],
      });
    }
    return childId;
  }

  private advanceSapientRaces(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick) || scheduleTick < 600 || scheduleTick % 24 !== 0) return;
    const livingHumans = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
    ).length;
    const plans: Array<{
      race: Exclude<NonNullable<AgentState['race']>, 'human'>;
      minimumStage: number;
      names: readonly string[];
    }> = [
      {
        race: 'elf', minimumStage: 0,
        names: ['Аэлар', 'Летиэль', 'Фаэлар', 'Нимриэль', 'Саэя', 'Иривен', 'Калион', 'Элария', 'Тален', 'Наэвия', 'Лиарэль', 'Аэрис'],
      },
      {
        race: 'dwarf', minimumStage: 0,
        names: ['Борин', 'Дагна', 'Тора', 'Гарин', 'Морда', 'Дурим', 'Балгрим', 'Хильда', 'Корин', 'Фара', 'Торун', 'Брина'],
      },
      {
        race: 'goblin', minimumStage: 0,
        names: ['Рук', 'Мог', 'Вера', 'Ним', 'Тук', 'Мири', 'Век', 'Сена', 'Кип', 'Рина', 'Гор', 'Лума'],
      },
      {
        race: 'orc', minimumStage: 0,
        names: ['Гар', 'Дорн', 'Лира', 'Она', 'Бран', 'Кора', 'Тарг', 'Мира', 'Рок', 'Дара', 'Вор', 'Лена'],
      },
      {
        race: 'ogre', minimumStage: 0,
        names: ['Брам', 'Тор', 'Мара', 'Сия', 'Гром', 'Вала', 'Бора', 'Тима', 'Орр', 'Нара', 'Краг', 'Мина'],
      },
    ];

    const plan = plans.find(
      (candidate) =>
        this.state.growth.stage >= candidate.minimumStage &&
        !this.state.places[`settlement_${candidate.race}_homeland`],
    );
    if (!plan) return;

    // Prefer an ecologically compatible contact point, but do not erase an
    // entire people just because the procedurally discovered biome order did
    // not happen to include their preferred landscape yet. Their homeland is
    // remote and can connect to the nearest known frontier.
    const compatibleAnchor = [...this.state.growth.discoveredRegionIds]
      .reverse()
      .map((regionId) => this.state.places[regionId])
      .find(
        (place): place is WorldPlace =>
          place !== undefined &&
          isRaceOriginCompatible(plan.race, place),
      );
    const anchor = compatibleAnchor ??
      [...this.state.growth.discoveredRegionIds]
        .reverse()
        .map((regionId) => this.state.places[regionId])
        .find((place): place is WorldPlace => place !== undefined) ??
      this.state.places.outskirts;
    if (!anchor) return;

    const settlementId = `settlement_${plan.race}_homeland`;
    if (this.state.places[settlementId]) return;
    const foundation = SAPIENT_PEOPLE_FOUNDATIONS[plan.race];
    const homelandCenter = homelandCenterForWorld(this.state, plan.race);
    const centerX = homelandCenter.x;
    const centerY = homelandCenter.y;
    const humanCenter = homelandCenterForWorld(this.state, 'human');
    const angle = Math.atan2(centerY - humanCenter.y, centerX - humanCenter.x);
    this.state.places[settlementId] = createPlace(
      settlementId,
      foundation.homelandName,
      'village',
      40,
      {
        biome: 'settlement',
        mapX: centerX,
        mapY: centerY,
        connectedPlaceIds: [],
        fertility: 0.62,
        danger: 0.07,
        surface: 'land',
        settlementId,
        discoveredAt: now,
      },
    );

    const founders: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      const agentId = `${plan.race}_homeland_${index + 1}`;
      const homeId = `home_${agentId}`;
      const homeAngle = angle + (Math.PI * 2 * index) / 12;
      const homeRing = index % 2 === 0 ? 4.2 : 6.2;
      this.state.places[homeId] = createPlace(
        homeId,
        `Дом ${plan.names[index]}`,
        'home',
        4,
        {
          biome: 'settlement',
          mapX: this.state.places[settlementId].mapX + Math.cos(homeAngle) * homeRing,
          mapY: this.state.places[settlementId].mapY + Math.sin(homeAngle) * homeRing,
          connectedPlaceIds: [settlementId],
          fertility: 0.56,
          danger: 0.05,
          surface: 'land',
          settlementId,
          discoveredAt: now,
        },
      );

      const personality = raceFounderPersonality(
        plan.race,
        (minimum, maximum) => this.rng.between(minimum, maximum),
      );
      const needs = { belonging: 0.7, purpose: 0.62 };
      const adultAge = SAPIENT_RACE_LIFE_PROFILES_V16[plan.race].adultAtAge;
      // A viable remote community, not four same-generation specimens. Ages
      // remain comfortably inside each race's voluntary family window.
      const ageYears = adultAge + 1 + ((index * 3) % 18);
      const lifespanBase = foundation.lifespanBaseYears;
      const lifespanYears = lifespanBase + personality.resilience * 16;
      const health = 0.9;
      const partial = {
        id: agentId,
        name: plan.names[index],
        origin: 'native' as const,
        sex: (index % 2 === 0 ? 'male' : 'female') as AgentState['sex'],
        race: plan.race,
        progression: {
          level: 1, experience: 0, objectControlAuthority: 0.1, systemControlAuthority: 0.06,
          combatMastery: foundation.founderCombatMastery, sacredArts: 0.03,
        },
        energy: 0.82, stress: 0.08, resources: 0.58, socialDrive: personality.sociability, personality,
        life: {
          bornAt: now - ageYears * WORLD_TICKS_PER_YEAR, ageYears,
          lifespanYears,
          stage: lifeStageForRaceV16(plan.race, ageYears),
          alive: true, health,
          physiology: racePhysiology(
            plan.race,
            physiologyForAge(ageYears, lifespanYears, health),
          ),
          generation: 0, parentIds: [], childIds: [],
        },
        mind: createMindState(this.state.id, agentId, personality, needs),
        needs,
        skills: raceFounderSkills(
          plan.race,
          (minimum, maximum) => this.rng.between(minimum, maximum),
        ),
        homeId, locationId: settlementId,
        position: { x: this.state.places[settlementId].mapX, y: this.state.places[settlementId].mapY, layerId: 'surface' as const },
        lastMeaningfulEventAt: now,
      } satisfies Omit<AgentState, 'goal'>;
      this.state.agents[agentId] = { ...partial, goal: goalFromInitialState(partial, now) };
      ensureAgentV15State(this.state, this.state.agents[agentId]);
      ensureAgentV16State(this.state, this.state.agents[agentId]);
      ensureRussianKnowledgeV18(this.state, this.state.agents[agentId]);
      ensureLivelihoodV18(this.state, this.state.agents[agentId]);
      ensureLifeRhythmV18(this.state, this.state.agents[agentId]);
      founders.push(agentId);
    }

    const services = [
      { suffix: 'field', name: plan.race === 'dwarf' ? 'Рудные штольни' : plan.race === 'elf' ? 'Лесные сады' : 'Поля и фермы', kind: 'resource_field' as const, biome: (plan.race === 'dwarf' ? 'mountains' : plan.race === 'elf' ? 'forest' : 'plains') as WorldBiome, dx: -5.6, dy: 2.2, fertility: plan.race === 'dwarf' ? 0.38 : 0.74 },
      { suffix: 'workshop', name: 'Мастерская', kind: 'workshop' as const, biome: 'settlement' as WorldBiome, dx: 2.4, dy: 1.2, fertility: 0.3 },
      { suffix: 'quiet', name: 'Тихое место', kind: 'quiet_space' as const, biome: (plan.race === 'elf' ? 'forest' : 'settlement') as WorldBiome, dx: -1.8, dy: -2.2, fertility: 0.6 },
    ];
    for (const service of services) {
      const serviceId = `${settlementId}_${service.suffix}`;
      this.state.places[serviceId] = createPlace(serviceId, `${foundation.homelandName}: ${service.name}`, service.kind, 10, {
        biome: service.biome,
        mapX: this.state.places[settlementId].mapX + service.dx,
        mapY: this.state.places[settlementId].mapY + service.dy,
        connectedPlaceIds: [settlementId], fertility: service.fertility, danger: 0.05, surface: 'land',
        settlementId, discoveredAt: now,
      });
    }

    makeConnectionsReciprocal(this.state.places);
    this.rebuildSpatialProjection();
    ensureSettlementEvidenceV16(this.state, settlementId);
    this.stageEvent({
      eventId: this.nextId('sapient-people'), worldId: this.state.id, kind: 'world.sapient_people.discovered', source: 'world', occurredAt: now,
      payload: { race: plan.race, settlementId, originRegionId: anchor.id, originBiome: anchor.biome, founderIds: founders.join(','),
        founderCount: founders.length,
        distanceFromWorldOriginKm: Math.hypot(centerX - humanCenter.x, centerY - humanCenter.y) / 10,
        previouslyBeyondKnownFrontier: true,
        humanPopulation: Object.values(this.state.agents).filter((agent) => agent.life.alive && (agent.race ?? 'human') === 'human').length },
    });
  }

  private advanceMysticism(now: number): void {
    const scheduleTick = this.v15ScheduleTick(now);
    if (!Number.isInteger(scheduleTick) || scheduleTick % 24 !== 0) return;
    const resonance =
      this.lawValue('mystic_resonance', 0.35);
    const weatherVolatility = this.lawValue('weather_volatility', 0.2);
    const ruinCount = Object.values(this.state.places).filter(
      (place) => place.kind === 'ruins',
    ).length;
    const occurrenceChance = clamp01(
      0.09 +
        resonance * 0.12 +
        weatherVolatility * 0.035 +
        Math.min(0.08, ruinCount * 0.012),
    );
    const firstMysteryDue =
      this.state.cosmology.omenCount === 0 &&
      scheduleTick >= 96 &&
      scheduleTick % 96 === 0;
    if (!firstMysteryDue && this.rng.next() >= occurrenceChance) return;

    const phenomena = [
      {
        id: 'sky_lights',
        summary: 'unexplained lights crossing the night sky',
      },
      {
        id: 'distant_voice',
        summary: 'a distant voice with no visible speaker',
      },
      {
        id: 'silent_storm',
        summary: 'a silent storm beyond the frontier',
      },
      {
        id: 'ruin_echo',
        summary: 'an echo rising from an ancient place',
      },
    ] as const;
    const phenomenon = this.rng.pick(phenomena);
    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    );
    if (living.length === 0) return;
    const witnesses = living.filter((agent) => {
      const perceptionChance = clamp01(
        0.2 +
          resonance * 0.25 +
          agent.personality.curiosity * 0.24 +
          agent.mind.emotions.awe * 0.12,
      );
      return this.rng.next() < perceptionChance;
    });
    if (witnesses.length === 0) {
      witnesses.push(
        [...living].sort(
          (a, b) =>
            b.personality.curiosity + b.mind.values.knowledge -
            (a.personality.curiosity + a.mind.values.knowledge),
        )[0],
      );
    }

    this.state.cosmology.omenCount += 1;
    this.state.cosmology.mysteryLevel = clamp01(
      this.state.cosmology.mysteryLevel + 0.018 + resonance * 0.018,
    );
    for (const witness of witnesses) {
      witness.mind.emotions.awe = clamp01(
        witness.mind.emotions.awe + 0.07 + resonance * 0.03,
      );
      witness.mind.beliefs.divinePresence = clamp01(
        witness.mind.beliefs.divinePresence + 0.024 + resonance * 0.018,
      );
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: witness.id,
        createdAt: now,
        kind: 'omen',
        summary: `${witness.name} witnessed ${phenomenon.summary}.`,
        importance: clamp01(0.56 + witness.mind.emotions.awe * 0.24),
        valence: clampSigned(0.08 - witness.mind.emotions.fear * 0.12),
        relatedAgentIds: [],
      });
    }
    this.stageEvent({
      eventId: this.nextId('natural-omen'),
      worldId: this.state.id,
      kind: `world.omen.natural.${phenomenon.id}`,
      source: 'world',
      occurredAt: now,
      payload: {
        phenomenon: phenomenon.id,
        witnessCount: witnesses.length,
        mysteryLevel: this.state.cosmology.mysteryLevel,
      },
    });
  }

  private advanceCollectiveMyth(now: number): void {
    if (this.state.cosmology.omenCount === 0) return;
    const living = Object.values(this.state.agents).filter(
      (agent) => agent.life.alive,
    );
    if (living.length < 3) return;
    const sharedBelief =
      living.reduce(
        (sum, agent) => sum + agent.mind.beliefs.divinePresence,
        0,
      ) / living.length;
    if (
      sharedBelief < 0.58 ||
      this.state.cosmology.traditions.length >=
        Math.ceil(this.state.cosmology.omenCount / 2)
    ) {
      return;
    }
    let deity = Object.values(this.state.cosmology.deities)[0];
    if (!deity) {
      const names = [
        'Keeper of the Veil',
        'Lady of Dawn',
        'Voice Beneath the Roots',
        'Wanderer of Stars',
      ];
      const sequence = Object.keys(this.state.cosmology.deities).length + 1;
      const deityId = `belief_deity_${sequence}`;
      deity = {
        id: deityId,
        name: names[(sequence - 1) % names.length],
        origin: 'emergent_belief',
        enteredAt: now,
      };
      this.state.cosmology.deities[deityId] = deity;
    }
    const tradition = `Witnesses of ${deity.name}`;
    if (this.state.cosmology.traditions.includes(tradition)) return;
    this.state.cosmology.traditions.push(tradition);
    this.stageEvent({
      eventId: this.nextId('tradition'),
      worldId: this.state.id,
      kind: 'world.tradition.emerged',
      source: 'agent',
      occurredAt: now,
      payload: {
        tradition,
        sharedBelief,
        deityId: deity.id,
        deityOrigin: deity.origin,
      },
    });
  }

  private advanceMonsterEncounter(
    agent: AgentState,
    environment: WorldEnvironment,
    now: number,
  ): void {
    if (
      !agent.life.alive ||
      agent.movement
    ) {
      // A monster at a destination cannot attack before the resident has
      // physically completed the route.
      return;
    }
    const monster = Object.values(this.state.wildlife)
      .filter(
        (population) =>
          population.species !== CENTURY_HUMPBACK_SPECIES &&
          (population.isMonster || population.threat >= 0.28) &&
          population.count > 0 &&
          population.habitatId === agent.locationId,
      )
      .sort((a, b) => b.threat - a.threat)[0];
    if (!monster) return;
    const beastFriend = giftMasteryV20(this.state, agent.id, 'beast_friend');
    if (!monster.isMonster && beastFriend > 0 && this.rng.next() < 0.15 + beastFriend * 0.62) {
      practiceGiftV20(this.state, agent.id, 'beast_friend', 0.0014, this.state.calendar.elapsedWorldMinutes);
      return;
    }
    const premonition = giftMasteryV20(this.state, agent.id, 'premonition');
    if (premonition > 0 && this.rng.next() < 0.03 + premonition * 0.2) {
      practiceGiftV20(this.state, agent.id, 'premonition', 0.0012, this.state.calendar.elapsedWorldMinutes);
      return;
    }

    const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.5;
    const safetyFactor = 1 - environment.safetySupport * 0.78;
    const territoryPressure = clamp01(
      monster.count / Math.max(1, monster.carryingCapacity),
    );
    const intrusionPressure =
      agent.lastAction === 'explore'
        ? 0.018
        : agent.lastAction === 'gather'
          ? 0.009
          : 0.003;
    const territorialAggressionScale = monster.isMonster ? 1 : 0.52;
    const encounterChance = clamp01(
      (0.002 +
        monster.threat * placeDanger * 0.04 +
        territoryPressure * monster.threat * 0.018 +
        intrusionPressure) *
        territorialAggressionScale *
        Math.max(0.12, safetyFactor),
    );
    if (this.rng.next() >= encounterChance) return;

    ensureAgentV15State(this.state, agent);
    this.tryEquipAvailableV15Weapon(agent, now);
    const activeWeapon = this.v15WeaponForAgent(agent);
    const companions = this.agentsAtLocation(agent.locationId).filter((other) => {
      if (
        other.id === agent.id ||
        !other.life.alive ||
        other.locationId !== agent.locationId
      ) {
        return false;
      }
      const relation =
        this.state.relationships[relationshipKey(agent.id, other.id)];
      return relation !== undefined && relation.trust + relation.affinity > 1.05;
    }).length;

    const decision = decideHuntingAgencyV15(
      {
        id: agent.id,
        ageYears: agent.life.ageYears,
        level: agent.progression?.level ?? 1,
        health: agent.life.health,
        energy: agent.energy,
        stress: agent.stress,
        hungerPressure: 1 - agent.resources,
        riskTolerance: agent.personality.riskTolerance,
        curiosity: agent.personality.curiosity,
        dutyToOthers: clamp01(
          agent.mind.values.care * 0.55 +
            agent.personality.generosity * 0.45,
        ),
        rewardMotivation: agent.mind.values.ambition,
        physiology: { ...agent.life.physiology },
        combatMastery: agent.progression?.combatMastery ?? 0,
        huntingSkill: agent.skills.hunting,
        weapon: activeWeapon,
        armorProtection: 0,
        groupSupport: clamp01(companions * 0.18),
        safetySupport: environment.safetySupport,
      },
      {
        targetId: monster.id,
        species: monster.species,
        isMonster: monster.isMonster,
        threat: monster.threat,
        placeDanger,
        estimatedCount: Math.max(1, monster.count),
        foodValue: 0,
        rewardValue: 0,
      },
      'self_defense',
      this.rng.next(),
    );

    const legendaryHero = hasDivineGiftV19(
      this.state,
      agent.id,
      'demon_king_hero',
    );
    const choseFight = decision.execution === 'fight_now';
    const evasion = clamp01(
      agent.life.physiology.mobility * 0.42 +
        agent.skills.exploration * 0.18 +
        agent.personality.riskTolerance * 0.08 +
        (agent.progression?.combatMastery ?? 0) * 0.16 +
        (agent.progression?.objectControlAuthority ?? 0) * 0.08 +
        environment.safetySupport * 0.08 +
        giftMasteryV20(this.state, agent.id, 'agility') * 0.18 +
        giftMasteryV20(this.state, agent.id, 'keen_eye') * 0.1 +
        giftMasteryV20(this.state, agent.id, 'luck') * 0.03 -
        burdenIntensityV22(this.state, agent.id, 'misfortune') * 0.04,
    );
    const counterCapacity = legendaryHero ? 1 : clamp01(
      agent.life.physiology.strength * 0.18 +
        agent.life.physiology.endurance * 0.12 +
        (agent.progression?.combatMastery ?? 0) * 0.24 +
        agent.skills.hunting * 0.12 +
        activeWeapon.effectiveness * 0.2 +
        activeWeapon.reach * 0.08 +
        clamp01(companions * 0.14),
    );

    const escaped = !choseFight && this.rng.next() < evasion;
    if (escaped && giftMasteryV20(this.state, agent.id, 'luck') > 0) {
      practiceGiftV20(this.state, agent.id, 'luck', 0.0008, this.state.calendar.elapsedWorldMinutes);
    }
    const repelled = choseFight && (legendaryHero || this.rng.next() < counterCapacity);
    const equipmentProtection = clamp01(
      activeWeapon.effectiveness * 0.2 + activeWeapon.reach * 0.12,
    );
    const responseProtection = choseFight
      ? clamp01(counterCapacity * 0.34 + equipmentProtection)
      : escaped
        ? 1
        : clamp01(evasion * 0.12);

    const damage = legendaryHero || escaped
      ? 0
      : clamp01(
          monster.threat * 0.7 *
            this.rng.between(0.07, 0.24) *
            (monster.isMonster ? 1 : 0.62) *
            (1.15 - agent.life.physiology.endurance * 0.3) *
            (1 - environment.safetySupport * 0.42) *
            (1 - (agent.progression?.combatMastery ?? 0) * 0.22) *
            (1 - responseProtection * (repelled ? 0.82 : 0.55)),
        );

    agent.life.health = clamp01(agent.life.health - damage);
    recordTraumaV21(
      this.state,
      agent,
      damage,
      monster.isMonster ? 'monster' : 'wildlife',
      `${monster.id}:${now}:encounter`,
    );
    recordItemUseV21(
      this.state,
      this.v15World().equipmentByAgentId[agent.id]?.weaponItemId,
      monster.threat + (choseFight ? 0.34 : 0.12),
      monster.isMonster ? 0.02 : 0.006,
      agent.id,
    );
    agent.stress = clamp01(
      agent.stress + monster.threat * (escaped || repelled ? 0.12 : 0.28),
    );
    agent.mind.emotions.fear = clamp01(
      agent.mind.emotions.fear +
        monster.threat * (escaped || repelled ? 0.18 : 0.42),
    );
    agent.mind.emotions.awe = clamp01(
      agent.mind.emotions.awe + monster.threat * 0.1,
    );

    if (activeWeapon.kind !== 'none' && damage > 0.03) {
      this.v15World().smithingByAgentId[agent.id].observedWeaponProblems += 1;
    }

    const lethalChance = legendaryHero || escaped
      ? 0
      : clamp01(
          Math.max(
            monster.isMonster ? 0.0005 : 0.0001,
            decision.assessment.estimatedLethalRisk *
              (repelled ? 0.34 : choseFight ? 0.68 : 0.92) *
              (monster.isMonster ? 0.16 : 0.045) +
              (agent.life.health < 0.14
                ? monster.isMonster
                  ? 0.04
                  : 0.01
                : 0),
          ) *
            (1 - environment.safetySupport * 0.42) *
            (1 - activeWeapon.effectiveness * 0.12),
        );

    if (legendaryHero && choseFight && repelled && monster.isMonster && monster.count > 0) {
      monster.count -= 1;
      monster.lastChangedAt = now;
      this.stageEvent({
        eventId: this.nextId('legendary-monster-defeated'),
        worldId: this.state.id,
        kind: 'world.monster.defeated_by_hero',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          monsterPopulationId: monster.id,
          monsterSpecies: monster.species,
          remaining: monster.count,
          gift: 'demon_king_hero',
        },
      });
    }

    if (choseFight) {
      const livelihood = ensureLivelihoodV18(this.state, agent);
      livelihood.defensePracticeCount += 1;
      recordLivelihoodPracticeV18(this.state, agent, {
        action: 'hunt',
        placeId: agent.locationId,
        choiceRoll: this.rng.next(),
        professionHint: monster.isMonster ? 'warrior' : 'guard',
        amount: monster.isMonster ? (repelled ? 1.6 : 0.9) : repelled ? 1 : 0.55,
      });
    }

    this.stageEvent({
      eventId: this.nextId(
        monster.isMonster ? 'monster-encounter' : 'wildlife-encounter',
      ),
      worldId: this.state.id,
      kind: monster.isMonster
        ? 'world.monster.encountered'
        : 'world.wildlife.defensive_encounter',
      source: 'world',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        species: monster.species,
        habitatId: monster.habitatId,
        reason: 'territorial_defense',
        routeInProgress: Boolean(agent.movement),
        residentChoice: decision.residentChoice,
        forcedByEngine: false,
        escaped,
        repelled,
        damage,
        lethalChance,
        estimatedLethalRisk: decision.assessment.estimatedLethalRisk,
        willingnessProbability: decision.willingnessProbability,
        weaponKind: activeWeapon.kind,
        weaponEffectiveness: activeWeapon.effectiveness,
        survived: agent.life.health > 0.035,
        worldMinutes: this.state.calendar.elapsedWorldMinutes,
      },
    });
    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: agent.id,
      createdAt: now,
      kind: 'world_event',
      summary: `${agent.name} encountered ${monster.species} in the wilderness and chose to ${choseFight ? 'fight' : 'flee'}.`,
      importance: clamp01(0.68 + monster.threat * 0.28),
      valence: escaped || repelled ? -0.42 : -0.88,
      relatedAgentIds: [],
    });

    if (agent.life.health <= 0.035 || this.rng.next() < lethalChance) {
      this.recordDeath(
        agent,
        monster.isMonster ? 'monster' : 'wildlife',
        now,
        {
          species: monster.species,
          isMonster: monster.isMonster,
          habitatId: monster.habitatId,
          populationCount: monster.count,
          carryingCapacity: monster.carryingCapacity,
          threat: monster.threat,
          escaped,
          damage,
          lethalChance,
          encounterReason: 'territorial_defense',
        },
      );
      if (monster.isMonster && !agent.life.alive) {
        monster.lastFedAt = this.v15ScheduleTick(now);
        monster.lastChangedAt = now;
        monster.alertness = clamp01(monster.alertness - 0.1);
        this.stageEvent({
          eventId: this.nextId('monster-fed-resident'),
          worldId: this.state.id,
          kind: 'world.monster.fed',
          source: 'world',
          occurredAt: now,
          payload: {
            monsterPopulationId: monster.id,
            monsterSpecies: monster.species,
            habitatId: monster.habitatId,
            preyKind: 'sapient_resident',
            victimAgentId: agent.id,
            victimRace: agent.race ?? 'human',
            feedingUnits: 1,
            // recordDeath already created persistent remains; feeding never
            // erases the body or the community's later burial decision.
            remainsPersisted: true,
            reason: 'feeding_after_territorial_kill',
            worldMinutes: this.state.calendar.elapsedWorldMinutes,
          },
        });
      }
    }
  }

  private advanceMind(agent: AgentState): void {
    const placeDanger = this.state.places[agent.locationId]?.danger ?? 0.1;
    const action = agent.lastAction;
    const positiveAction = ['relax', 'socialize', 'help', 'bond'].includes(
      action ?? '',
    );
    agent.mind.emotions.joy = clamp01(
      agent.mind.emotions.joy * 0.985 +
        (positiveAction ? 0.022 : 0) +
        agent.needs.belonging * 0.004 -
        agent.stress * 0.008,
    );
    agent.mind.emotions.fear = clamp01(
      agent.mind.emotions.fear * 0.976 +
        agent.stress * 0.007 +
        placeDanger * 0.003,
    );
    agent.mind.emotions.grief = clamp01(agent.mind.emotions.grief * 0.994);
    agent.mind.emotions.hope = clamp01(
      agent.mind.emotions.hope * 0.99 +
        agent.needs.purpose * 0.005 +
        (action === 'explore' ? 0.006 : 0) -
        agent.mind.emotions.grief * 0.002,
    );
    const livingArchive = hasGiftV20(this.state, agent.id, 'living_archive');
    const memoryProtection = livingArchive
      ? 1
      : giftMasteryV20(this.state, agent.id, 'perfect_memory');
    agent.mind.memoryCoherence = clamp01(
      agent.mind.memoryCoherence +
        (action === 'reflect' ? 0.006 : 0.001) -
        agent.stress * (livingArchive ? 0 : 0.0014 * (1 - 0.9 * memoryProtection)),
    );
    agent.mind.autonomy = clamp01(
      0.45 +
        agent.mind.values.freedom * 0.28 +
        (agent.lastDecision?.openness ?? 0) * 0.22,
    );
    if (action === 'help' || action === 'bond') {
      agent.mind.values.care = clamp01(agent.mind.values.care + 0.0012);
    }
    if (action === 'explore' || action === 'reflect') {
      agent.mind.values.knowledge = clamp01(
        agent.mind.values.knowledge + 0.001,
      );
    }
    if (action === 'pray') {
      agent.mind.values.tradition = clamp01(
        agent.mind.values.tradition + 0.0012,
      );
    }
  }

  private chooseBondTarget(
    agent: AgentState,
    allAgents: AgentState[],
  ): AgentState | undefined {
    const activeFamilyIntent = this.familyRendezvousForAgent(agent.id);
    if (activeFamilyIntent) {
      const intendedPartner = this.familyPartnerFor(activeFamilyIntent, agent.id);
      if (
        intendedPartner &&
        allAgents.some((candidate) => candidate.id === intendedPartner.id) &&
        this.physicallyCoPresent(agent, intendedPartner) &&
        this.canFormIntimateRelationship(agent, intendedPartner)
      ) {
        return intendedPartner;
      }
    }
    let best: { other: AgentState; score: number } | undefined;
    for (const other of allAgents) {
      if (
        other.id === agent.id ||
        !other.life.alive ||
        other.locationId !== agent.locationId ||
        !this.canFormIntimateRelationship(agent, other)
      ) {
        continue;
      }
      const relationship =
        this.state.relationships[relationshipKey(agent.id, other.id)];
      const score = relationship
        ? relationship.trust * 0.28 +
          relationship.affinity * 0.38 +
          relationship.respect * 0.14 -
          relationship.conflict * 0.32
        : 0.08;
      if (score > 0.36 && (!best || score > best.score)) {
        best = { other, score };
      }
    }
    return best?.other;
  }

  private performBond(a: AgentState, b: AgentState, now: number): void {
    if (!a.life.alive || !b.life.alive || a.movement || b.movement || a.locationId !== b.locationId) return;
    const key = relationshipKey(a.id, b.id);
    const relationship = this.relationshipFor(a, b, now);
    const accepted =
      this.rng.next() <
      clamp01(
        0.28 +
          relationship.trust * 0.24 +
          relationship.affinity * 0.3 +
          b.mind.values.care * 0.12 -
          relationship.conflict * 0.25,
      );
    if (this.relationshipKeysByResident) {
      for (const id of [a.id, b.id]) {
        const keys = this.relationshipKeysByResident.get(id) ?? new Set<string>();
        keys.add(key); this.relationshipKeysByResident.set(id, keys);
      }
    }
    this.state.relationships[key] = {
      ...relationship,
      trust: clamp01(relationship.trust + (accepted ? 0.025 : 0.004)),
      affinity: clamp01(
        relationship.affinity + (accepted ? 0.032 : -0.006),
      ),
      respect: clamp01(relationship.respect + (accepted ? 0.012 : 0)),
      conflict: clamp01(
        relationship.conflict + (accepted ? -0.008 : 0.01),
      ),
      updatedAt: now,
    };

    // A successful in-person bond can establish a remembered rendezvous for
    // another meeting. This is deliberately NOT consent to intimacy and NOT a
    // child intention. It only gives both residents a causally acquired place
    // where they may choose to meet again, avoiding remote conception while
    // also preventing established couples from almost never crossing paths.
    if (accepted && this.canFormIntimateRelationship(a, b)) {
      const lifecycles = this.familyLifecycleMap();
      if (!lifecycles[key]) {
        const settlementId = this.familyOpportunitySettlementId(a, b);
        if (settlementId) {
          lifecycles[key] = {
            id: key,
            pairId: key,
            agentAId: a.id,
            agentBId: b.id,
            race: a.race ?? 'human',
            settlementId,
            meetingPlaceId: a.locationId,
            stage: 'meeting',
            createdWorldMinute: this.state.calendar.elapsedWorldMinutes,
            lastAffirmedWorldMinute: this.state.calendar.elapsedWorldMinutes,
            lastPhysicalMeetingWorldMinute: this.state.calendar.elapsedWorldMinutes,
          };
          this.stageEvent({
            eventId: this.nextId('family-meeting-planned'),
            worldId: this.state.id,
            kind: 'agent.family.meeting_planned',
            source: 'agent',
            occurredAt: now,
            payload: {
              pairId: key,
              agentA: a.id,
              agentB: b.id,
              meetingPlaceId: a.locationId,
              settlementId,
              worldMinutes: this.state.calendar.elapsedWorldMinutes,
              voluntary: true,
              impliesChildIntent: false,
              impliesIntimacyConsent: false,
            },
          });
        }
      }
    }
    a.energy = clamp01(a.energy - 0.014);
    a.needs.belonging = clamp01(
      a.needs.belonging + (accepted ? 0.07 : -0.008),
    );
    a.mind.emotions.joy = clamp01(
      a.mind.emotions.joy + (accepted ? 0.05 : -0.012),
    );
    a.lastAction = 'bond';
    a.lastMeaningfulEventAt = now;
    this.recordAgentEvent(
      a,
      now,
      accepted ? 'agent.bond.accepted' : 'agent.bond.declined',
      { targetId: b.id, locationId: a.locationId },
    );
    recordResidentContactEvidenceV16(
      this.state,
      a,
      b,
      accepted ? 'bond_accepted' : 'bond_declined',
      accepted ? 0.62 : -0.2,
    );
    this.stageMemory({
      memoryId: this.nextId('memory'),
      worldId: this.state.id,
      agentId: a.id,
      createdAt: now,
      kind: 'interaction',
      summary: accepted
        ? `${a.name} and ${b.name} grew closer.`
        : `${b.name} was not ready to grow closer to ${a.name}.`,
      importance: accepted ? 0.72 : 0.56,
      valence: accepted ? 0.62 : -0.2,
      relatedAgentIds: [b.id],
    });
  }

  private performPray(agent: AgentState, now: number): void {
    // Residents can speak to a deity where they actually are, including home.
    // A sacred place is optional, not a long mandatory journey before every prayer.
    const resonance =
      this.lawValue('mystic_resonance', 0.35);
    agent.energy = clamp01(agent.energy + 0.012);
    agent.stress = clamp01(agent.stress - 0.026);
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.04);
    agent.mind.emotions.awe = clamp01(
      agent.mind.emotions.awe + 0.012 + resonance * 0.012,
    );
    agent.mind.emotions.hope = clamp01(agent.mind.emotions.hope + 0.014);
    agent.mind.beliefs.divinePresence = clamp01(
      agent.mind.beliefs.divinePresence +
        this.state.cosmology.mysteryLevel * resonance * 0.008,
    );
    agent.lastAction = 'pray';
    agent.lastMeaningfulEventAt = now;
    const prayer = recordContextualPrayerV19(this.state, agent, {
      subject: this.rng.next(),
      deity: this.rng.next(),
      wording: this.rng.next(),
    }, this.relationshipsForResident(agent.id));
    const prayerIsMeaningful = prayer.importance >= 0.62;
    if (prayerIsMeaningful) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'reflection',
        summary: `${agent.name} prayed about ${prayer.subject}: ${prayer.generatedPrayerText}`,
        importance: prayer.importance,
        valence: clampSigned(
          prayer.emotionalState === 'gratitude'
            ? 0.55
            : prayer.emotionalState === 'hope'
              ? 0.24
              : -prayer.desperation * 0.38,
        ),
        relatedAgentIds: prayer.targetPersonId ? [prayer.targetPersonId] : [],
      });
    }
    this.recordAgentEvent(agent, now, 'agent.prayed', {
      prayerId: prayer.id,
      topic: prayer.topic,
      targetDeityId: prayer.deityId,
      targetKnown: prayer.deityKnown,
      desperation: prayer.desperation,
      beliefStrength: prayer.beliefStrength,
      mysteryLevel: this.state.cosmology.mysteryLevel,
      divineBelief: agent.mind.beliefs.divinePresence,
      locationId: agent.locationId,
    });
  }

  private performReflect(agent: AgentState, now: number): void {
    const quietPlaceId = this.localPlace(
      agent,
      ['quiet_space'],
      agent.homeId,
    );
    if (this.travelBeforeAction(agent, quietPlaceId, 'reflect', now)) return;
    agent.energy = clamp01(agent.energy + 0.025);
    agent.stress = clamp01(
      agent.stress - 0.055 - agent.personality.resilience * 0.025,
    );
    agent.needs.purpose = clamp01(agent.needs.purpose + 0.045);
    agent.lastAction = 'reflect';
    agent.lastMeaningfulEventAt = now;

    const reflectionIsMeaningful =
      agent.stress >= 0.65 ||
      agent.mind.emotions.grief >= 0.35 ||
      agent.mind.emotions.awe >= 0.45 ||
      Math.floor(now) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0;
    if (reflectionIsMeaningful) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'reflection',
        summary: `${agent.name} reflected on recent needs and priorities.`,
        importance: clamp01(0.35 + agent.stress * 0.3),
        valence: clampSigned(0.15 - agent.stress * 0.2),
        relatedAgentIds: [],
      });
    }

    this.recordAgentEvent(agent, now, 'agent.reflected', {
      stress: agent.stress,
      purpose: agent.needs.purpose,
      locationId: agent.locationId,
    });

    const writing = practiceCyrillicWritingV18(
      this.state,
      agent,
      this.rng.next(),
    );
    if (writing.practiced) {
      recordLivelihoodPracticeV18(this.state, agent, {
        action: 'reflect',
        placeId: agent.locationId,
        choiceRoll: this.rng.next(),
        professionHint: 'scribe',
        amount: 0.7,
      });
      this.stageEvent({
        eventId: this.nextId('writing'),
        worldId: this.state.id,
        kind: 'agent.writing.practiced',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          placeId: agent.locationId,
          script: 'cyrillic',
          language: 'ru',
          text: writing.text ?? '',
          literacyBefore: writing.literacyBefore,
          literacyAfter: writing.literacyAfter,
        },
      });
    }
  }

  private chooseHelpTarget(agent: AgentState, allAgents: AgentState[]): AgentState | undefined {
    const canHeal = hasDivineGiftV19(this.state, agent.id, 'healing_touch');
    let best: { other: AgentState; score: number } | undefined;
    for (const other of allAgents) {
      const physicalCareNeed = bodyCareNeedV21(this.state, other.id);
      if (
        other.id === agent.id ||
        !other.life.alive ||
        other.locationId !== agent.locationId ||
        (other.resources >= 0.5 &&
          (!canHeal || other.life.health >= 0.98) &&
          physicalCareNeed <= 0.02)
      ) {
        continue;
      }
      const relationship =
        this.state.relationships[relationshipKey(agent.id, other.id)];
      const need =
        (1 - other.resources) * 0.65 +
        (canHeal ? (1 - other.life.health) * 0.85 : 0) +
        physicalCareNeed * (0.72 + careActionAffinityV21(this.state, agent.id)) +
        other.stress * 0.2 +
        (1 - other.needs.belonging) * 0.15;
      const willingness = relationship
        ? relationship.trust * 0.3 +
          relationship.affinity * 0.2 +
          relationship.respect * 0.15 -
          relationship.conflict * 0.35
        : 0.05;
      const score = need + willingness;
      if (score > 0.42 && (!best || score > best.score)) {
        best = { other, score };
      }
    }
    return best?.other;
  }

  private performHelp(a: AgentState, b: AgentState, now: number): void {
    if (!a.life.alive || !b.life.alive || a.movement || b.movement || a.locationId !== b.locationId) return;
    const key = relationshipKey(a.id, b.id);
    const current = this.relationshipFor(a, b, now);
    if (current.trust > 0.25) {
      sharePlaceKnowledgeV20(this.state, a, b);
      sharePlaceKnowledgeV20(this.state, b, a);
    }
    const healingMastery = giftMasteryV20(this.state, a.id, 'healing_touch');
    const canHeal = healingMastery > 0 && b.life.health < 0.995;
    const physicalCareNeed = bodyCareNeedV21(this.state, b.id);
    const offered = Math.min(0.065, Math.max(0, a.resources - 0.35), 0.72 - b.resources);
    const acceptance = clamp01(
      0.35 +
        current.trust * 0.28 +
        current.affinity * 0.18 +
        current.respect * 0.12 -
        current.conflict * 0.35 +
        b.personality.sociability * 0.08 -
        burdenIntensityV22(this.state, a.id, 'discord') * 0.18,
    );
    const accepted =
      (offered > 0.005 || canHeal || physicalCareNeed > 0.02) &&
      this.rng.next() < acceptance;
    const healed = accepted && canHeal
      ? Math.min(0.015 + healingMastery * 0.085, 1 - b.life.health)
      : 0;
    const beneficiaryBefore = b.resources + b.life.health;
    let ordinaryCareImprovement = 0;

    if (accepted) {
      a.resources = clamp01(a.resources - offered);
      b.resources = clamp01(b.resources + offered);
      b.life.health = clamp01(b.life.health + healed);
      if (healed > 0) {
        // Mastery is semantic: low mastery can treat only light conditions;
        // severe wounds/diseases become reachable only close to full mastery.
        const body = this.state.v21?.bodiesByAgentId[b.id];
        const treatableSeverity = 0.12 + healingMastery * 0.88;
        const reduction = 0.015 + healingMastery * 0.12;
        if (body) {
          for (const wound of body.wounds) {
            if (wound.severity <= treatableSeverity) {
              wound.severity = clamp01(Math.max(0, wound.severity - reduction));
            }
          }
          for (const disease of body.diseases) {
            if (disease.severity <= treatableSeverity) {
              disease.severity = clamp01(Math.max(0, disease.severity - reduction * 0.8));
            }
          }
        }
        practiceGiftV20(this.state, a.id, 'healing_touch', 0.001 + healed * 0.035);
      }
      if (physicalCareNeed > 0.02) {
        ordinaryCareImprovement = recordCarePracticeV21(this.state, a, b).improvement;
      }
      a.needs.purpose = clamp01(a.needs.purpose + 0.06);
      b.needs.belonging = clamp01(b.needs.belonging + 0.06);
      b.stress = clamp01(b.stress - 0.025);
      this.state.relationships[key] = {
        ...current,
        trust: clamp01(current.trust + 0.025),
        affinity: clamp01(current.affinity + 0.018),
        respect: clamp01(current.respect + 0.03),
        conflict: clamp01(current.conflict - 0.012),
        updatedAt: now,
      };
    } else {
      a.stress = clamp01(a.stress + 0.008);
      this.state.relationships[key] = {
        ...current,
        respect: clamp01(current.respect - 0.006),
        conflict: clamp01(current.conflict + 0.01),
        updatedAt: now,
      };
    }

    noteLearningHelp(a, b.id, beneficiaryBefore, b.resources + b.life.health);
    a.energy = clamp01(a.energy - 0.018 - healed * 0.22);
    a.lastAction = 'help';
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;

    const summary = accepted
      ? healed > 0
        ? `${b.name} accepted care from ${a.name} and felt their health improve.`
        : ordinaryCareImprovement > 0
          ? `${b.name} accepted practical treatment from ${a.name}.`
        : `${b.name} accepted help from ${a.name}.`
      : `${b.name} declined help from ${a.name}.`;
    for (const agent of [a, b]) {
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'interaction',
        summary,
        importance: accepted ? 0.62 : 0.52,
        valence: accepted ? 0.45 : -0.18,
        relatedAgentIds: [agent.id === a.id ? b.id : a.id],
      });
    }

    this.recordAgentEvent(a, now, accepted ? 'agent.help.accepted' : 'agent.help.rejected', {
      targetId: b.id,
      amount: accepted ? offered : 0,
      healing: healed,
      locationId: a.locationId,
    });
    recordResidentContactEvidenceV16(
      this.state,
      a,
      b,
      accepted ? 'help_accepted' : 'help_declined',
      accepted ? 0.45 : -0.18,
      accepted ? offered : 0,
    );
    this.recordRelationshipEvent(this.state.relationships[key], accepted ? 0.45 : -0.18, now);
  }

  private chooseSocialTarget(
    agent: AgentState,
    others: AgentState[],
  ): AgentState | undefined {
    const present = others.filter(
      (other) =>
        other.life.alive &&
        other.locationId === agent.locationId,
    );
    if (present.length === 0) return undefined;
    if (this.rng.next() < 0.08) {
      return this.rng.pick(present);
    }

    // Human attention is bounded even in a crowded city. Residents consider
    // their strongest lived contacts plus a rotating window of nearby
    // strangers; an independent 8% openness draw above can still reach anyone
    // present. This keeps social freedom without pretending one person ranks
    // two hundred conversations simultaneously.
    const perceived = new Map<string, AgentState>();
    const contactCounts =
      this.state.v16?.residentEvidenceByAgentId[agent.id]?.contactCounts ?? {};
    for (const [otherId] of Object.entries(contactCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12)) {
      const other = this.state.agents[otherId];
      if (
        other?.life.alive &&
        other.locationId === agent.locationId &&
        other.id !== agent.id
      ) {
        perceived.set(other.id, other);
      }
    }
    let stableOffset = Math.floor(this.state.now);
    for (let index = 0; index < agent.id.length; index += 1) {
      stableOffset = (stableOffset * 31 + agent.id.charCodeAt(index)) >>> 0;
    }
    for (
      let offset = 0;
      offset < present.length && perceived.size < 16 && offset < 8;
      offset += 1
    ) {
      const stranger = present[(stableOffset + offset) % present.length];
      perceived.set(stranger.id, stranger);
    }
    const considered = [...perceived.values()];
    if (considered.length === 0) return present[0];

    const weighted: Array<{ other: AgentState; weight: number }> = [];

    for (const other of considered) {
      const relationship = this.state.relationships[relationshipKey(agent.id, other.id)];
      let weight = 0.55;

      if (relationship) {
        weight =
          0.18 +
          relationship.affinity * 0.34 +
          relationship.trust * 0.24 +
          relationship.respect * 0.14 -
          relationship.conflict * 0.28;
      }

      // Relationship state is the resident's live social memory. Episodic
      // records remain durable for biography/audit, but are not reread from
      // IndexedDB for every candidate in every six-day decision.
      weight += Math.min(
        0.16,
        Math.log1p(contactCounts[other.id] ?? 0) * 0.028,
      );

      // Similar interests help, but locality matters. Long-distance contact
      // remains possible for travellers; ordinary residents prefer their own settlement.
      const curiosityCompatibility = 1 - Math.abs(
        agent.personality.curiosity - other.personality.curiosity,
      );
      weight += curiosityCompatibility * 0.08;
      const sameSettlement =
        this.homeSettlementId(agent) !== undefined &&
        this.homeSettlementId(agent) === this.homeSettlementId(other);
      weight += sameSettlement ? 0.32 : 0;

      weighted.push({
        other,
        weight: Math.max(0.05, weight),
      });
    }

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.rng.next() * total;

    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.other;
      }
    }

    return weighted[weighted.length - 1].other;
  }

  private interact(a: AgentState, b: AgentState, now: number): void {
    if (!a.life.alive || !b.life.alive || a.movement || b.movement || a.locationId !== b.locationId) return;
    const key = relationshipKey(a.id, b.id);
    const current = this.relationshipFor(a, b, now);

    const priorMood =
      (current.trust + current.affinity + current.respect) / 3 - current.conflict;
    const compatibility =
      1 -
      (Math.abs(a.personality.curiosity - b.personality.curiosity) +
        Math.abs(a.personality.sociability - b.personality.sociability) +
        Math.abs(a.personality.generosity - b.personality.generosity)) /
        3;
    const stressPenalty = (a.stress + b.stress) * 0.12;
    const socialSkill = (a.skills.social + b.skills.social) / 2;
    const sentiment = clampSigned(
      this.rng.between(-0.72, 0.72) +
        (priorMood - 0.35) * 0.5 +
        (compatibility - 0.5) * 0.24 +
        socialSkill * 0.08 +
        giftMasteryV20(this.state, a.id, 'charm') * 0.07 +
        giftMasteryV20(this.state, a.id, 'eloquence') * 0.05 -
        (burdenIntensityV22(this.state, a.id, 'discord') +
          burdenIntensityV22(this.state, b.id, 'discord')) * 0.055 -
        stressPenalty,
    );

    const next: RelationshipState = {
      ...current,
      trust: clamp01(current.trust + sentiment * 0.038),
      affinity: clamp01(current.affinity + sentiment * 0.05),
      respect: clamp01(current.respect + sentiment * 0.026),
      conflict: clamp01(current.conflict - sentiment * 0.048),
      updatedAt: now,
    };

    this.state.relationships[key] = next;
    if (sentiment > 0.18 && next.trust > 0.25) {
      sharePlaceKnowledgeV20(this.state, a, b);
      sharePlaceKnowledgeV20(this.state, b, a);
      consultSettlementMap(this.state, a);
      consultSettlementMap(this.state, b);
    }
    // Visible evidence can provoke awe or fear without assigning a religion.
    if (hasGiftV20(this.state, a.id, 'marked')) {
      b.mind.emotions.awe = clamp01(b.mind.emotions.awe + 0.06);
      if (sentiment < 0) b.mind.emotions.fear = clamp01(b.mind.emotions.fear + 0.025);
    }
    const crowdCharisma = giftMasteryV20(this.state, a.id, 'crowd_charisma');
    if (crowdCharisma > 0) {
      const audienceLimit = Math.max(1, Math.round(2 + crowdCharisma * 10));
      for (const listener of this.agentsAtLocation(a.locationId).filter(person => person.id !== a.id && person.id !== b.id && !person.movement).slice(0, audienceLimit)) {
        if (this.rng.next() < listener.personality.sociability * (0.18 + crowdCharisma * 0.27)) {
          const heard = this.relationshipFor(a, listener, now);
          heard.respect = clamp01(heard.respect + sentiment * (0.004 + crowdCharisma * 0.011));
        }
      }
    }
    recordResidentContactEvidenceV16(
      this.state,
      a,
      b,
      'social',
      sentiment,
    );
    a.lastMeaningfulEventAt = now;
    b.lastMeaningfulEventAt = now;
    a.lastAction = 'socialize';
    a.energy = clamp01(a.energy - 0.018);
    this.tryAdventureMarketTrade(a, now);
    const socialCeiling = (agent: Readonly<AgentState>) => {
      const profession = this.state.v18?.livelihoodByAgentId[agent.id]?.primary;
      return clamp01(
        0.42 +
          agent.personality.sociability * 0.34 +
          agent.mind.values.knowledge * 0.08 +
          (profession === 'teacher' ? 0.14 : 0),
      );
    };
    a.skills.social = clamp01(
      a.skills.social + Math.max(0.00015, socialCeiling(a) - a.skills.social) * 0.003,
    );
    b.skills.social = clamp01(
      b.skills.social + Math.max(0.0001, socialCeiling(b) - b.skills.social) * 0.0018,
    );

    if (sentiment > 0.18) {
      a.stress = clamp01(a.stress - 0.024);
      b.stress = clamp01(b.stress - 0.018);
      a.needs.belonging = clamp01(a.needs.belonging + 0.09);
      b.needs.belonging = clamp01(b.needs.belonging + 0.07);
    } else if (sentiment < -0.18) {
      a.stress = clamp01(a.stress + 0.032);
      b.stress = clamp01(b.stress + 0.026);
      a.needs.belonging = clamp01(a.needs.belonging - 0.018);
      b.needs.belonging = clamp01(b.needs.belonging - 0.012);
    } else {
      a.needs.belonging = clamp01(a.needs.belonging + 0.035);
      b.needs.belonging = clamp01(b.needs.belonging + 0.025);
    }

    const summary =
      sentiment >= 0
        ? `${a.name} and ${b.name} had a constructive interaction.`
        : `${a.name} and ${b.name} had a tense interaction.`;

    const conversation = recordRussianConversationV18({
      id: this.nextId('conversation'),
      state: this.state,
      speaker: a,
      listener: b,
      relationship: next,
      sentiment,
      topicRoll: this.rng.next(),
      audibilityRoll: this.rng.next(),
      placeOccupancy: this.agentsAtLocation(a.locationId).length,
    });
    if (
      conversation.observerAudible ||
      (conversation.topic === 'learning' &&
        isStableRoutineEvidenceSample(
          `${conversation.speakerId}:${conversation.listenerId}:learning`,
          now,
        )) ||
      conversation.topic === 'conflict' ||
      Math.abs(sentiment) >= 0.72
    ) {
      this.stageEvent({
        eventId: conversation.id,
        worldId: this.state.id,
        kind: 'agent.conversation.spoken',
        source: 'agent',
        occurredAt: now,
        payload: {
          speakerId: conversation.speakerId,
          listenerId: conversation.listenerId,
          placeId: conversation.placeId,
          topic: conversation.topic,
          tone: conversation.tone,
          utterance: conversation.utterance,
          reply: conversation.reply,
          audibility: conversation.audibility,
          observerAudible: conversation.observerAudible,
          speakerGoal: conversation.evidence.speakerGoal,
          speakerAction: conversation.evidence.speakerAction,
          speakerResourceBand: conversation.evidence.speakerResourceBand,
          speakerStressBand: conversation.evidence.speakerStressBand,
          relationshipSentiment:
            conversation.evidence.relationshipSentiment,
          knowledgeId: conversation.evidence.knowledgeId ?? null,
          knowledgeTitle: conversation.evidence.knowledgeTitle ?? null,
          knowledgeShared: conversation.evidence.knowledgeShared ?? false,
        },
      });
    }

    const sharedContact = shareableDivineContactV19(
      this.state,
      a,
      sentiment,
      this.rng.next(),
    );
    if (sharedContact) {
      const listenerInterpretationChance = clamp01(
        0.08 +
          b.personality.curiosity * 0.2 +
          b.mind.values.tradition * 0.18 +
          next.trust * 0.18 +
          b.mind.emotions.awe * 0.12 +
          giftMasteryV20(this.state, a.id, 'crowd_charisma') * 0.28,
      );
      const listenerMoved = this.rng.next() < listenerInterpretationChance;
      recordVoluntaryDivineContactShareV19(
        this.state,
        a.id,
        b.id,
        sharedContact.id,
        listenerMoved,
      );
      b.mind.emotions.awe = clamp01(
        b.mind.emotions.awe + (listenerMoved ? 0.025 : 0.006),
      );
      if (listenerMoved) {
        b.mind.beliefs.divinePresence = clamp01(
          b.mind.beliefs.divinePresence + 0.018,
        );
      }
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: b.id,
        createdAt: now,
        kind: 'interaction',
        summary: `${a.name} chose to tell ${b.name} of ${sharedContact.deityName}: ${sharedContact.message}`,
        importance: clamp01(0.58 + next.trust * 0.18),
        valence: listenerMoved ? 0.42 : 0.08,
        relatedAgentIds: [a.id],
      });
      if (conversation.observerAudible) {
        this.stageEvent({
          eventId: this.nextId('divine-message-shared'),
          worldId: this.state.id,
          kind: 'agent.divine_message.shared',
          source: 'agent',
          occurredAt: now,
          payload: {
            speakerId: a.id,
            listenerId: b.id,
            deityName: sharedContact.deityName,
            religionName: sharedContact.religionName ?? '',
            contactKind: sharedContact.kind,
            listenerMoved,
            voluntary: true,
          },
        });
      }
      const prayerCount =
        ensureWorldV19State(this.state).divineAgency.byAgentId[a.id]
          ?.totalPrayerCount ?? 0;
      const naturallySpiritual =
        prayerCount >= 5 &&
        a.mind.beliefs.divinePresence >= 0.58 &&
        sharedContact.sharedCount >= 2;
      recordLivelihoodPracticeV18(this.state, a, {
        action: naturallySpiritual ? 'pray' : 'socialize',
        placeId: a.locationId,
        choiceRoll: this.rng.next(),
        professionHint: naturallySpiritual ? 'spiritual_keeper' : 'teacher',
        amount: 0.7,
      });
    }

    // Human-like memory is selective. Relationship state preserves ordinary
    // social continuity; only exceptional moments, or periodically sampled
    // meaningful moments, become permanent episodic memories.
    const memoryPair = [a.id, b.id].sort().join('::');
    let memorySlot = 0;
    for (let index = 0; index < memoryPair.length; index += 1) {
      memorySlot = (memorySlot * 31 + memoryPair.charCodeAt(index)) >>> 0;
    }
    const interactionIntensity = Math.abs(sentiment);
    const rememberInteraction =
      now <= 240 ||
      interactionIntensity >= 0.72 ||
      (interactionIntensity >= 0.35 &&
        (Math.floor(now) + memorySlot) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0);
    if (rememberInteraction) {
      const memories: MemoryRecord[] = [a, b].map((agent) => ({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'interaction',
        summary,
        importance: clamp01(0.4 + Math.abs(sentiment) * 0.5),
        valence: sentiment,
        relatedAgentIds: [agent.id === a.id ? b.id : a.id],
      }));

      for (const memory of memories) {
        this.stageMemory(memory);
      }
    }

    this.recordRelationshipEvent(next, sentiment, now);
  }

  private relationshipsForResident(agentId: string): RelationshipState[] {
    if (!this.relationshipKeysByResident) {
      const index = new Map<string, Set<string>>();
      for (const [key, relationship] of Object.entries(this.state.relationships)) {
        for (const id of [relationship.agentA, relationship.agentB]) {
          const keys = index.get(id) ?? new Set<string>();
          keys.add(key); index.set(id, keys);
        }
      }
      this.relationshipKeysByResident = index;
    }
    return [...(this.relationshipKeysByResident.get(agentId) ?? [])]
      .map(key => this.state.relationships[key]).filter(Boolean);
  }

  private relationshipFor(a: AgentState, b: AgentState, now: number): RelationshipState {
    const key = relationshipKey(a.id, b.id);
    const ids = [a.id, b.id].sort();
    return (
      this.state.relationships[key] ?? {
        agentA: ids[0],
        agentB: ids[1],
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        conflict: 0.1,
        updatedAt: now,
      }
    );
  }

  private recordRelationshipEvent(
    relationship: RelationshipState,
    sentiment: number,
    now: number,
  ): void {
    if (this.relationshipKeysByResident) {
      const key = relationshipKey(relationship.agentA, relationship.agentB);
      for (const id of [relationship.agentA, relationship.agentB]) {
        const keys = this.relationshipKeysByResident.get(id) ?? new Set<string>();
        keys.add(key); this.relationshipKeysByResident.set(id, keys);
      }
    }
    const pair = `${relationship.agentA}::${relationship.agentB}`;
    let stableSlot = 0;
    for (let index = 0; index < pair.length; index += 1) {
      stableSlot = (stableSlot * 31 + pair.charCodeAt(index)) >>> 0;
    }
    const intensity = Math.abs(sentiment);
    const exceptionalChange = intensity >= 0.75;
    const sampledMeaningfulChange =
      intensity >= 0.42 &&
      (Math.floor(now) + stableSlot) % ROUTINE_EVENT_SAMPLE_INTERVAL === 0;
    if (now > 240 && !exceptionalChange && !sampledMeaningfulChange) return;

    this.stageEvent({
      eventId: this.nextId('relationship'),
      worldId: this.state.id,
      kind: 'relationship.changed',
      source: 'agent',
      occurredAt: now,
      payload: {
        agentA: relationship.agentA,
        agentB: relationship.agentB,
        sentiment,
        trust: relationship.trust,
        affinity: relationship.affinity,
        respect: relationship.respect,
        conflict: relationship.conflict,
      },
    });
  }

  private moveAgent(agent: AgentState, locationId: string): void {
    const destination = this.state.places[locationId];
    if (!destination) {
      throw new Error(`Cannot move ${agent.id} to unknown place ${locationId}.`);
    }
    if (!this.youngChildMayTravelTo(agent, locationId)) return;
    if (!mayKnowPlaceV20(agent, locationId, this.state)) return;
    if (agent.movement && agent.movement.targetPlaceId !== locationId) {
      // Another resident's interaction cannot pull a traveller off a route.
      return;
    }
    if (agent.locationId === locationId && !agent.movement) return;

    if (availableBoat(this.state, agent) || Object.values(this.state.v15?.items ?? {}).some(i=>i.boat?.journey?.originPlaceId===agent.locationId)) {
      const direct = residentKnownPath(this.state, agent, locationId);
      const waterShortcut = !direct || direct.length > 3;
      if (waterShortcut && startBoatTravel(this.state, agent, locationId, agent.lastDecision?.action ?? 'walk',
          this.rng.next(), (a,b)=>this.pathBetween(a,b)!==undefined)) return;
    }
    const path = residentKnownPath(this.state, agent, locationId);
    if (!path || path.slice(1).some(id => !mayKnowPlaceV20(agent, id, this.state))) {
      // Water and disconnected territory are physical boundaries. A resident
      // never receives an implicit teleport just because an action chose it.
      return;
    }

    const waypoints: WorldPoint2D[] = [
      { x: agent.position.x, y: agent.position.y },
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      const fromId = path[index];
      const toId = path[index + 1];
      const route = this.state.routes[routeIdBetween(fromId, toId)];
      if (!route) return;
      waypoints.push(...orientedRouteWaypoints(route, fromId).slice(1));
    }

    if (waypoints.length > 1) {
      agent.movement = {
        targetPlaceId: locationId,
        purpose: agent.lastDecision?.action ?? 'walk',
        waypoints,
        nextWaypointIndex: 1,
        startedAt: this.state.now,
        worldStageAtStart: this.state.growth.stage,
        routeIds: path.slice(0, -1).map((from, index) => routeIdBetween(from, path[index + 1])),
      };
      return;
    }
    const priorLocationId = agent.locationId;
    agent.locationId = locationId;
    this.moveResidentLocationIndex(agent, priorLocationId, locationId);
    agent.position = {
      x: destination.mapX,
      y: destination.mapY,
      layerId: 'surface',
    };
    agent.movement = undefined;
  }

  private advancePhysicalMovementForWorldMinutes(elapsedWorldMinutes: number): void {
    if (elapsedWorldMinutes <= PHYSICAL_TIME_EPSILON) return;
    let minute = this.state.calendar.elapsedWorldMinutes;
    const end = minute + elapsedWorldMinutes;
    this.finishSecretLibraryAdmissions(minute, this.state.now);
    while (minute < end - PHYSICAL_TIME_EPSILON) {
      const next = Math.min(end, ...ensureWorldV18State(this.state).secretLibrary.visitors.map(admissionDeadline).filter(t => t > minute));
      const arrivedByBoat = new Set<string>();
      for (const arrival of advanceBoats(this.state, next-minute, minute)) {
        arrivedByBoat.add(arrival.agentId);
        const resident = this.state.agents[arrival.agentId];
        this.moveResidentLocationIndex(resident, arrival.fromPlaceId, arrival.toPlaceId);
        this.routePathCache?.clear();
        invalidateResidentNavigation(this.state);
        if (arrival.discovered && this.state.geography) this.state.geography.revision++;
        observeLocalPlacesV20(this.state, resident);
        recordExplorationArrival(this.state, resident);
        this.recordAgentEvent(resident, this.state.now, 'agent.boat.arrived', {...arrival});
        if (arrival.onwardPlaceId && resident.life.alive) this.moveAgent(resident, arrival.onwardPlaceId);
      }
      for (const agent of Object.values(this.state.agents)) {
        if (!canResidentAct(agent) || !agent.movement || agent.movement.boatId || arrivedByBoat.has(agent.id)) continue;
        this.advanceAgentMovement(agent, next - minute, minute);
      }
      minute = next;
      this.finishSecretLibraryAdmissions(minute, this.state.now);
    }
  }

  private advanceAgentMovement(
    agent: AgentState,
    elapsedWorldMinutes: number,
    startMinute = this.state.calendar.elapsedWorldMinutes,
  ): boolean {
    enforceLibraryBoundary(this.state, agent, startMinute);
    const movement = agent.movement;
    if (!movement) return false;

    const weatherWalkingScale = worldWeatherV21(this.state, startMinute)
      .walkingScale;
    const currentSettlementId =
      this.state.places[agent.locationId]?.settlementId;
    const targetSettlementId =
      this.state.places[movement.targetPlaceId]?.settlementId;
    const exposedWeatherScale =
      currentSettlementId && currentSettlementId === targetSettlementId
        ? 0.84 + weatherWalkingScale * 0.16
        : weatherWalkingScale;
    const mobilityScale =
      (0.8 + agent.life.physiology.mobility * 0.4) *
      bodyMobilityScaleV21(this.state, agent.id) *
      bodyFatigueMobilityScaleV21(agent) *
      exposedWeatherScale *
      (hasDivineGiftV19(this.state, agent.id, 'demon_king_hero') ? 5 : 1);
    const movementBudget =
      RESIDENT_WALK_MAP_UNITS_PER_WORLD_MINUTE *
      mobilityScale *
      Math.max(0, elapsedWorldMinutes);
    let remaining = movementBudget;
    while (remaining > 0 && agent.movement) {
      const target = movement.waypoints[movement.nextWaypointIndex];
      if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        throw new Error(`Invalid saved route for ${agent.id}: waypoint ${movement.nextWaypointIndex}. World was not committed.`);
      }
      const dx = target.x - agent.position.x;
      const dy = target.y - agent.position.y;
      const distance = Math.hypot(dx, dy);
      const groundScale=terrainWalkingScale(this.state.places,movement.waypoints[Math.max(0,movement.nextWaypointIndex-1)],target);
      const effort=distance/groundScale;
      if (effort <= remaining + 0.0001) {
        agent.position.x = target.x;
        agent.position.y = target.y;
        remaining -= effort;
        movement.nextWaypointIndex += 1;
        if (movement.nextWaypointIndex >= movement.waypoints.length) {
          const place = this.state.places[movement.targetPlaceId];
          const arrivalMinute = startMinute + (movementBudget - remaining) / (RESIDENT_WALK_MAP_UNITS_PER_WORLD_MINUTE * mobilityScale);
          if (place && isSecretLibrary(place.id) && !hasLibraryAdmission(this.state, agent, place.id, arrivalMinute)) {
            enforceLibraryBoundary(this.state, agent, arrivalMinute);
            return true;
          }
          if (place) {
            const priorLocationId = agent.locationId;
            agent.locationId = movement.targetPlaceId;
            this.moveResidentLocationIndex(
              agent,
              priorLocationId,
              movement.targetPlaceId,
            );
            agent.position.x = place.mapX;
            agent.position.y = place.mapY;
          }
          for (const id of movement.routeIds ?? []) {
            const route = this.state.routes[id];
            if (route) route.completedTraversals = (route.completedTraversals ?? 0) + 1;
          }
          agent.movement = undefined;
          recordResidentRouteArrival(this.state, agent, movement.routeIds ?? [], arrivalMinute);
          noteLibraryArrival(this.state, agent, arrivalMinute);
          observeLocalPlacesV20(this.state, agent);
          recordExplorationArrival(this.state, agent);
        }
        continue;
      }
      agent.position.x += (dx / distance) * remaining * groundScale;
      agent.position.y += (dy / distance) * remaining * groundScale;
      remaining = 0;
    }
    return true;
  }

  private rebuildSpatialProjection(): void {
    this.state.settlements = rebuildSettlementProjection(
      this.state.places,
      this.state.settlements,
      0,
    );
    // The geometry migration already rebuilds and reconciles routes when it
    // changes physical places. Never perform that expensive work twice.
    if (!repairCompactSettlementLayout(this.state)) {
      this.state.routes = rebuildWorldRoutes(this.state.places, this.state.routes);
    }
    this.routePathCache?.clear();
    invalidateResidentNavigation(this.state);
  }

  private lawValue(
    mechanism: WorldLawMechanism,
    fallback: number,
  ): number {
    const active = Object.values(this.state.governance.laws)
      .filter((worldLaw) => worldLaw.mechanism === mechanism)
      .sort(
        (a, b) =>
          b.updatedAt - a.updatedAt ||
          Number(b.createdBy === 'cardinal') -
            Number(a.createdBy === 'cardinal') ||
          b.revision - a.revision ||
          b.id.localeCompare(a.id),
      )[0];
    return active?.value ?? fallback;
  }

  private pathBetween(fromId: string, toId: string): string[] | undefined {
    if (fromId === toId) return [fromId];
    if (!this.state.places[fromId] || !this.state.places[toId]) return undefined;

    const cachedSource = this.routePathCache?.get(fromId);
    if (cachedSource) {
      const cached = cachedSource.get(toId);
      return cached ? [...cached] : undefined;
    }

    // One breadth-first traversal resolves every destination for this source.
    // A resident used to repeat almost the same graph walk separately for
    // wildlife, fields, homes and quiet spaces during every decision.
    const paths = new Map<string, string[]>([[fromId, [fromId]]]);
    const queue: string[] = [fromId];
    let queueIndex = 0;
    const visited = new Set([fromId]);
    while (queueIndex < queue.length) {
      const currentId = queue[queueIndex++];
      const path = paths.get(currentId)!;
      if (currentId !== fromId && isSecretLibrary(currentId)) continue;
      for (const connectedId of this.state.places[currentId].connectedPlaceIds) {
        const route = this.state.routes[routeIdBetween(currentId, connectedId)];
        if (
          visited.has(connectedId) ||
          !this.state.places[connectedId] ||
          !route ||
          route.traversal === 'boat'
        ) {
          continue;
        }
        const nextPath = [...path, connectedId];
        visited.add(connectedId);
        paths.set(connectedId, nextPath);
        queue.push(connectedId);
      }
    }
    this.routePathCache?.set(fromId, paths);
    const resolved = paths.get(toId);
    return resolved ? [...resolved] : undefined;
  }

  private shuffled<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.rng.next() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  private async effectiveEnvironment(now: number): Promise<WorldEnvironment> {
    const worldMinutes = this.state.calendar.elapsedWorldMinutes;
    this.committedSignalCache ??= await this.store.activeSignals(
      this.state.id,
      now,
      worldMinutes,
    );
    const committed = this.committedSignalCache.filter((event) => {
      if (
        event.occurredWorldMinutes !== undefined &&
        event.activeUntilWorldMinutes !== undefined
      ) {
        return (
          event.occurredWorldMinutes <= worldMinutes &&
          event.activeUntilWorldMinutes > worldMinutes
        );
      }
      return (
        event.occurredAt <= now &&
        event.activeUntil !== undefined &&
        event.activeUntil > now
      );
    });
    const staged = (this.stagedEvents ?? []).filter(
      (event) => {
        if (
          event.occurredWorldMinutes !== undefined &&
          event.activeUntilWorldMinutes !== undefined
        ) {
          return (
            event.occurredWorldMinutes <= worldMinutes &&
            event.activeUntilWorldMinutes > worldMinutes
          );
        }
        return (
          event.occurredAt <= now &&
          event.activeUntil !== undefined &&
          event.activeUntil > now
        );
      },
    );
    const activeSignals = [...committed, ...staged];
    let socialModifier = 0;
    let safetyModifier = 0;
    let habitatModifier = 0;

    for (const signal of activeSignals) {
      const magnitude =
        typeof signal.payload.magnitude === 'number' ? signal.payload.magnitude : 0;

      if (signal.kind === 'cardinal.effect.open_shared_space') {
        socialModifier += magnitude;
      } else if (signal.kind === 'world.effect.social_barrier') {
        socialModifier -= magnitude;
      } else if (signal.kind === 'cardinal.effect.safety_support') {
        safetyModifier += magnitude;
      } else if (signal.kind === 'world.effect.safety_shock') {
        safetyModifier -= magnitude;
        habitatModifier -= magnitude * 0.25;
      } else if (signal.kind === 'cardinal.effect.habitat_support') {
        habitatModifier += magnitude;
      } else if (signal.kind.startsWith('cardinal.catastrophe.')) {
        const destructiveUntil =
          typeof signal.payload.destructiveUntil === 'number'
            ? signal.payload.destructiveUntil
            : signal.occurredAt;
        if (now < destructiveUntil) {
          safetyModifier -= magnitude * 0.32;
          habitatModifier -= magnitude * 0.18;
        } else {
          const recoveryMagnitude =
            typeof signal.payload.recoveryMagnitude === 'number'
              ? signal.payload.recoveryMagnitude
              : 0;
          habitatModifier += recoveryMagnitude;
          safetyModifier += recoveryMagnitude * 0.35;
        }
      }
    }
    const weather = worldWeatherV21(this.state, worldMinutes);
    safetyModifier += weather.safetyModifier;
    habitatModifier += weather.habitatModifier;

    return {
      ...this.state.environment,
      socialOpportunity: clamp01(
        this.state.environment.socialOpportunity + socialModifier,
      ),
      safetySupport: clamp01(this.state.environment.safetySupport + safetyModifier),
      habitatSupport: clamp01(
        this.state.environment.habitatSupport + habitatModifier,
      ),
    };
  }

  private ensureProgression(agent: AgentState): NonNullable<AgentState['progression']> {
    agent.progression ??= progressionFromAgent(agent);
    return agent.progression;
  }

  private advanceProgressionFromEvent(
    agent: AgentState,
    kind: string,
    now: number,
  ): void {
    const gainByEvent: Record<string, number> = {
      'agent.worked': 1.1,
      'agent.gathered': 0.8,
      'agent.hunted': 1.9,
      'agent.explored': 1.35,
      'agent.help.accepted': 0.55,
      'agent.bond.accepted': 0.45,
      'agent.reflected': 0.28,
      'agent.prayed': 0.42,
    };
    const gain = gainByEvent[kind] ?? 0;
    if (gain <= 0 || !agent.life.alive) return;

    const progression = this.ensureProgression(agent);
    const previousLevel = progression.level;
    progression.experience += gain;
    progression.level = levelForExperience(progression.experience);

    if (kind === 'agent.hunted') {
      progression.combatMastery = clamp01(progression.combatMastery + 0.0028);
      progression.objectControlAuthority = clamp01(
        progression.objectControlAuthority + 0.0018,
      );
    } else if (kind === 'agent.worked' || kind === 'agent.gathered') {
      progression.objectControlAuthority = clamp01(
        progression.objectControlAuthority + 0.0015,
      );
    } else if (kind === 'agent.explored') {
      progression.objectControlAuthority = clamp01(
        progression.objectControlAuthority + 0.001,
      );
      progression.systemControlAuthority = clamp01(
        progression.systemControlAuthority + 0.0011,
      );
    } else if (kind === 'agent.reflected' || kind === 'agent.prayed') {
      progression.systemControlAuthority = clamp01(
        progression.systemControlAuthority + 0.0014,
      );
      progression.sacredArts = clamp01(progression.sacredArts + 0.0012);
    }

    if (progression.level > previousLevel) {
      this.stageEvent({
        eventId: this.nextId('level'),
        worldId: this.state.id,
        kind: 'agent.level.changed',
        source: 'agent',
        occurredAt: now,
        payload: {
          agentId: agent.id,
          race: agent.race ?? 'human',
          previousLevel,
          level: progression.level,
          experience: progression.experience,
        },
      });
      this.stageMemory({
        memoryId: this.nextId('memory'),
        worldId: this.state.id,
        agentId: agent.id,
        createdAt: now,
        kind: 'world_event',
        summary: `${agent.name} reached level ${progression.level} through lived experience.`,
        importance: 0.66,
        valence: 0.52,
        relatedAgentIds: [],
      });
    }
  }

  private recordAgentEvent(
    agent: AgentState,
    now: number,
    kind: string,
    payload: Record<string, string | number | boolean | null>,
  ): void {
    this.advanceProgressionFromEvent(agent, kind, now);
    if (ROUTINE_AGENT_EVENT_KINDS.has(kind) && now > 240) {
      if (!isStableRoutineEvidenceSample(agent.id, now)) {
        return;
      }
    }

    const decisionEvidence: Record<
      string,
      string | number | boolean | null
    > = {};
    if (
      kind !== 'agent.goal.changed' &&
      agent.lastDecision?.chosenAt === now
    ) {
      decisionEvidence.chosenAction = agent.lastDecision.action;
      decisionEvidence.dominantAction =
        agent.lastDecision.dominantAction;
      decisionEvidence.consideredActionCount =
        agent.lastDecision.consideredActionCount;
      decisionEvidence.choiceOpenness = agent.lastDecision.openness;
    }

    this.stageEvent({
      eventId: this.nextId('agent-event'),
      worldId: this.state.id,
      kind,
      source: 'agent',
      occurredAt: now,
      payload: {
        agentId: agent.id,
        ...decisionEvidence,
        ...payload,
      },
    });
  }

  private stageEvent(event: WorldEvent): void {
    if (!this.stagedEvents) {
      throw new Error('World event was produced outside a logical operation.');
    }
    this.stagedEvents.push({
      ...event,
      occurredWorldMinutes:
        event.occurredWorldMinutes ?? this.state.calendar.elapsedWorldMinutes,
      worldEpoch: event.worldEpoch ?? (this.state.epoch ?? 1),
    });
  }

  private stageMemory(memory: MemoryRecord): void {
    if (!this.stagedMemories) {
      throw new Error('World memory was produced outside a logical operation.');
    }
    const stored: MemoryRecord = {
      ...memory,
      relatedAgentIds: [...memory.relatedAgentIds],
    };
    this.stagedMemories.push(stored);
  }

  private stableOperationEventId(prefix: string, operationId: string): string {
    return `${prefix}:${this.state.id}:op:${operationId}`;
  }

  private nextId(prefix: string): string {
    this.state.determinism.eventSequence += 1;
    return `${prefix}:${this.state.id}:${this.state.determinism.eventSequence.toString(36)}`;
  }

  private syncDeterminismState(): void {
    this.state.determinism.rngState = this.rng.snapshot();
  }

  private adopt(state: WorldState, alreadyValidated = false): void {
    if (!alreadyValidated) assertWorldState(state);
    if (state.rulesVersion !== WORLD_RULES_VERSION) {
      throw new Error(
        `World ${state.id} uses rules ${state.rulesVersion}; runtime expects ${WORLD_RULES_VERSION}. Explicit migration is required.`,
      );
    }
    // Both persistence adapters return a caller-owned state object detached
    // from their durable projection. WorldEngine takes ownership and never
    // mutates it until cloning the next working transaction.
    this.committedState = state;
    bindWorldTerrain(state);
    this.rng.restore(state.determinism.rngState);
  }
}
