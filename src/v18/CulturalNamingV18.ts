import type {
  AgentRace,
  AgentSex,
  AgentState,
  WorldState,
} from '../world/types';

export type CulturalNamingStyleV18 = 'lineage' | 'blended' | 'novel';

export interface CulturalNameChoiceV18 {
  name: string;
  style: CulturalNamingStyleV18;
  parentIds: [string, string];
}

interface NamingCultureV18 {
  onsets: readonly string[];
  cores: readonly string[];
  maleEndings: readonly string[];
  femaleEndings: readonly string[];
  legacyBases: readonly string[];
}

const CULTURES_V18: Readonly<Record<AgentRace, NamingCultureV18>> = {
  human: {
    onsets: [
      'Al', 'Ar', 'Bel', 'Cor', 'Da', 'El', 'Fa', 'Il', 'Ka', 'Le', 'Mar',
      'Mir', 'Na', 'Or', 'Ra', 'Sa', 'Ser', 'Ta', 'Tor', 'Val', 'Ye', 'Zor',
    ],
    cores: ['a', 'e', 'i', 'o', 'u', 'ai', 'el', 'en', 'ia', 'or', 'ri', 'ya'],
    maleEndings: ['n', 'r', 's', 'l', 'm', 'd', 'k', 'o', 'en', 'ar'],
    femaleEndings: ['a', 'ia', 'ra', 'na', 'elle', 'is', 'ya', 'e', 'in', 'ora'],
    legacyBases: ['Ari', 'Lio', 'Sena', 'Tali', 'Neri', 'Eden', 'Sora', 'Ayla', 'Lev', 'Yuna'],
  },
  elf: {
    onsets: ['Ae', 'Al', 'Cele', 'Ela', 'Eli', 'Fa', 'Iri', 'Lae', 'Lia', 'Na', 'Sae', 'Tha'],
    cores: ['a', 'e', 'ia', 'iel', 'ien', 'ir', 'ae', 'ora', 'yth'],
    maleEndings: ['l', 'r', 'n', 's', 'th', 'ion', 'iel'],
    femaleEndings: ['a', 'iel', 'wen', 'ria', 'thea', 'ine', 'ya'],
    legacyBases: ['Aelar', 'Lethiel', 'Faelar', 'Nimriel', 'Saeya', 'Iriwen'],
  },
  dwarf: {
    onsets: ['Bal', 'Bar', 'Bor', 'Dor', 'Dur', 'Far', 'Gar', 'Har', 'Kor', 'Mor', 'Thar', 'Tor'],
    cores: ['a', 'o', 'u', 'ar', 'or', 'ur', 'in', 'un'],
    maleEndings: ['k', 'n', 'r', 'm', 'din', 'grim', 'gar'],
    femaleEndings: ['a', 'da', 'dis', 'hild', 'na', 'ra', 'rin'],
    legacyBases: ['Borin', 'Dagna', 'Thora', 'Garin', 'Morda', 'Durim'],
  },
  goblin: {
    onsets: ['Br', 'Dr', 'Gr', 'Kr', 'M', 'N', 'R', 'Sk', 'Sn', 'T', 'V', 'Z'],
    cores: ['a', 'e', 'i', 'o', 'u', 'ak', 'ik', 'og', 'ur'],
    maleEndings: ['k', 'g', 'r', 'n', 't', 'z', 'ik'],
    femaleEndings: ['a', 'i', 'ka', 'ri', 'na', 'et', 'ya'],
    legacyBases: ['Rik', 'Nim', 'Vek', 'Miri', 'Tuk', 'Sena'],
  },
  orc: {
    onsets: ['Br', 'D', 'Gar', 'Gor', 'Kar', 'Kor', 'Lar', 'Mor', 'Nar', 'R', 'Tar', 'Vor'],
    cores: ['a', 'o', 'u', 'ar', 'or', 'ur', 'ra', 'ro'],
    maleEndings: ['g', 'k', 'n', 'r', 'm', 'th', 'ak'],
    femaleEndings: ['a', 'ra', 'na', 'sha', 'ka', 'ia', 'or'],
    legacyBases: ['Gar', 'Dora', 'Lir', 'Kora', 'Bran', 'Ona'],
  },
  ogre: {
    onsets: ['B', 'Br', 'G', 'Gr', 'Kr', 'M', 'R', 'St', 'T', 'Th', 'V'],
    cores: ['a', 'o', 'u', 'am', 'om', 'or', 'ur', 'ra'],
    maleEndings: ['m', 'g', 'r', 'n', 'th', 'ok', 'um'],
    femaleEndings: ['a', 'ma', 'ra', 'na', 'la', 'ia', 'um'],
    legacyBases: ['Bram', 'Mara', 'Tor', 'Sia', 'Grom', 'Vala'],
  },
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compactNamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^A-Za-zА-Яа-яЁё]/g, '')
    .toLocaleLowerCase('ru-RU');
}

/** Keeps a cultural sound while writing native world names in Cyrillic. */
export function toRussianWorldNameV18(value: string): string {
  const pairs: Readonly<Record<string, string>> = {
    shch: 'щ', zh: 'ж', kh: 'х', ts: 'ц', ch: 'ч', sh: 'ш',
    ya: 'я', yu: 'ю', yo: 'ё', ye: 'е', ia: 'ия', ae: 'э',
    ph: 'ф', th: 'т', qu: 'кв', ck: 'к',
  };
  const letters: Readonly<Record<string, string>> = {
    a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г',
    h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н',
    o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у',
    v: 'в', w: 'в', x: 'кс', y: 'й', z: 'з',
  };
  const lower = value.toLocaleLowerCase('ru-RU');
  let result = '';
  for (let index = 0; index < lower.length;) {
    const pair = Object.keys(pairs).find((candidate) =>
      lower.startsWith(candidate, index));
    if (pair) {
      result += pairs[pair];
      index += pair.length;
      continue;
    }
    const character = lower[index];
    result += letters[character] ?? character;
    index += 1;
  }
  return result.replace(/(^|[\s-])([а-яё])/g, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toLocaleUpperCase('ru-RU')}`);
}

function finishName(onset: string, core: string, ending: string): string {
  const raw = toRussianWorldNameV18(`${onset}${core}${ending}`
    .replace(/([aeiouy])\1+/gi, '$1')
    .replace(/([^aeiouy])\1{2,}/gi, '$1$1'));
  return raw.charAt(0).toLocaleUpperCase('ru-RU') + raw.slice(1);
}

function namingStyle(
  parentA: Readonly<AgentState>,
  parentB: Readonly<AgentState>,
): CulturalNamingStyleV18 {
  const tradition =
    (parentA.mind.values.tradition + parentB.mind.values.tradition) / 2;
  const curiosity =
    (parentA.personality.curiosity + parentB.personality.curiosity) / 2;
  if (tradition > curiosity + 0.12) return 'lineage';
  if (curiosity > tradition + 0.12) return 'novel';
  return 'blended';
}

/**
 * Models a bounded parental naming choice. The result is deterministic for a
 * replay, but comes from both parents' lineage, values and the child's culture
 * rather than an engine counter. Numeric uniqueness remains solely in agentId.
 */
export function chooseCulturalChildNameV18(input: {
  worldId: string;
  race: AgentRace;
  sex: AgentSex;
  sequence: number;
  parentA: Readonly<AgentState>;
  parentB: Readonly<AgentState>;
  existingNames: ReadonlySet<string>;
}): CulturalNameChoiceV18 {
  const {
    worldId,
    race,
    sex,
    sequence,
    parentA,
    parentB,
    existingNames,
  } = input;
  const culture = CULTURES_V18[race];
  const endings = sex === 'female' ? culture.femaleEndings : culture.maleEndings;
  const style = namingStyle(parentA, parentB);
  const lineage = `${compactNamePart(parentA.name)}:${compactNamePart(parentB.name)}`;
  const seed = [
    worldId,
    race,
    sex,
    parentA.id,
    parentB.id,
    lineage,
    style,
    Math.max(1, Math.floor(sequence)),
  ].join(':');
  const total = culture.onsets.length * culture.cores.length * endings.length;
  const start = stableHash(seed) % total;
  // An odd stride walks the whole practical name space without clustering
  // siblings around adjacent syllables.
  const stride = 97;

  for (let attempt = 0; attempt < total; attempt += 1) {
    let encoded = (start + attempt * stride) % total;
    const ending = endings[encoded % endings.length];
    encoded = Math.floor(encoded / endings.length);
    const core = culture.cores[encoded % culture.cores.length];
    encoded = Math.floor(encoded / culture.cores.length);
    const lineageOffset = style === 'lineage'
      ? stableHash(lineage) % culture.onsets.length
      : style === 'blended'
        ? stableHash(`${lineage}:${sequence}`) % culture.onsets.length
        : 0;
    const onset = culture.onsets[(encoded + lineageOffset) % culture.onsets.length];
    const candidate = finishName(onset, core, ending);
    if (!existingNames.has(candidate.toLocaleLowerCase('ru-RU'))) {
      return {
        name: candidate,
        style,
        parentIds: [parentA.id, parentB.id],
      };
    }
  }

  // Extremely large histories may exhaust one simple-name culture. A compound
  // remains a normal cultural name and never leaks the internal sequence.
  const first = finishName(
    culture.onsets[start % culture.onsets.length],
    culture.cores[(start + 3) % culture.cores.length],
    endings[(start + 5) % endings.length],
  );
  const second = finishName(
    culture.onsets[(start + 7) % culture.onsets.length],
    culture.cores[(start + 11) % culture.cores.length],
    endings[(start + 13) % endings.length],
  );
  return {
    name: `${first}-${second}`,
    style,
    parentIds: [parentA.id, parentB.id],
  };
}

export function isLegacyTechnicalChildNameV18(
  name: string,
  race: AgentRace,
): boolean {
  const match = /^(.*?)\s+\d+$/.exec(name.trim());
  return Boolean(match && CULTURES_V18[race].legacyBases.includes(match[1]));
}

/** Replaces only the exact old generated aliases; user-authored names survive. */
export function repairLegacyTechnicalChildNamesV18(state: WorldState): number {
  const candidates = Object.values(state.agents)
    .filter(
      (agent) =>
        agent.origin === 'native' &&
        agent.life.generation > 0 &&
        isLegacyTechnicalChildNameV18(agent.name, agent.race ?? 'human'),
    )
    .sort((left, right) =>
      left.life.bornAt - right.life.bornAt || left.id.localeCompare(right.id),
    );
  if (candidates.length === 0) return 0;

  const candidateIds = new Set(candidates.map((agent) => agent.id));
  const usedNames = new Set(
    Object.values(state.agents)
      .filter((agent) => !candidateIds.has(agent.id))
      .map((agent) => agent.name.toLocaleLowerCase('ru-RU')),
  );
  let repaired = 0;
  for (const agent of candidates) {
    const parentA = state.agents[agent.life.parentIds[0]];
    const parentB = state.agents[agent.life.parentIds[1]];
    if (!parentA || !parentB || !agent.sex) continue;
    const numericId = Number(/(\d+)$/.exec(agent.id)?.[1]);
    const choice = chooseCulturalChildNameV18({
      worldId: state.id,
      race: agent.race ?? 'human',
      sex: agent.sex,
      sequence: Number.isFinite(numericId) ? numericId : repaired + 1,
      parentA,
      parentB,
      existingNames: usedNames,
    });
    agent.name = choice.name;
    usedNames.add(choice.name.toLocaleLowerCase('ru-RU'));
    repaired += 1;
  }
  return repaired;
}

/**
 * Migrates only native world identities that still contain Latin letters.
 * IDs and all accumulated mind/body/history records remain unchanged.
 */
export function repairRussianNativeNamesV18(state: WorldState): number {
  let repaired = 0;
  for (const agent of Object.values(state.agents)) {
    if (agent.origin !== 'native' || !/[A-Za-z]/.test(agent.name)) continue;
    agent.name = toRussianWorldNameV18(agent.name);
    repaired += 1;
  }
  return repaired;
}
