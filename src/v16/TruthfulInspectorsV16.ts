import type {
  AgentActionKind,
  AgentRace,
  AgentState,
  WildlifePopulation,
  WorldPlace,
  WorldState,
} from '../world/types';
import type {
  V18LivelihoodKind,
  V18LivelihoodStage,
} from '../v18/types';

export interface TruthfulInspectorRowV16 {
  label: string;
  value: string;
}

export interface TruthfulInspectorSectionV16 {
  title: string;
  rows: TruthfulInspectorRowV16[];
}

export interface TruthfulInspectorReportV16 {
  kind: 'resident' | 'wildlife' | 'place';
  title: string;
  subtitle: string;
  badge: string;
  sections: TruthfulInspectorSectionV16[];
  evidenceNote: string;
}

const actionLabels: Readonly<Record<AgentActionKind, string>> = {
  rest: 'отдых',
  relax: 'отдых на природе',
  walk: 'прогулки',
  gather: 'сбор ресурсов',
  hunt: 'охота',
  work: 'ремесленная работа',
  socialize: 'общение',
  help: 'помощь другим',
  explore: 'исследование',
  reflect: 'размышления',
  bond: 'построение близости',
  pray: 'поиск смысла',
};

const raceLabels: Readonly<Record<AgentRace, string>> = {
  human: 'человек',
  goblin: 'гоблин',
  orc: 'орк',
  ogre: 'огр',
};

const skillLabels: Readonly<Record<keyof AgentState['skills'], string>> = {
  gathering: 'сбор',
  hunting: 'охота',
  craft: 'ремесло',
  social: 'общение',
  exploration: 'исследование',
};

const livelihoodLabels: Readonly<Record<V18LivelihoodKind, string>> = {
  undecided: 'основное дело ещё не выбрано',
  farmer: 'земледелец',
  forager: 'собиратель',
  woodcutter: 'лесоруб',
  miner: 'рудокоп',
  fisher: 'рыбак',
  hunter: 'охотник',
  artisan: 'ремесленник',
  smith: 'кузнец',
  builder: 'строитель',
  caregiver: 'попечитель',
  scout: 'разведчик',
  teacher: 'наставник',
  scribe: 'писец',
  guard: 'страж',
  spiritual_keeper: 'хранитель традиций',
};

const livelihoodStageLabels: Readonly<Record<V18LivelihoodStage, string>> = {
  observing: 'наблюдает и пробует',
  apprentice: 'ученик',
  practitioner: 'опытный практик',
  master: 'мастер',
};

const wildlifeLabels: Readonly<Record<WildlifePopulation['species'], string>> = {
  rabbit: 'Кролики',
  deer: 'Олени',
  fish: 'Рыба',
  boar: 'Кабаны',
  wolf: 'Волки',
  bird: 'Птицы',
  dire_wolf: 'Лютоволки',
  ogre: 'Дикие огры',
  wraith: 'Тени',
};

const biomeLabels: Readonly<Record<WorldPlace['biome'], string>> = {
  settlement: 'поселение',
  plains: 'равнины',
  forest: 'лес',
  coast: 'побережье',
  mountains: 'горы',
  lake: 'озеро',
  river: 'речные земли',
  swamp: 'болото',
  ancient_ruins: 'древние руины',
};

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function agentName(
  world: Readonly<WorldState>,
  agentId: string,
): string {
  const agent = world.agents[agentId];
  if (!agent) return agentId;
  return agent.life.alive ? agent.name : `${agent.name} (умер)`;
}

function topCountEntries(
  record: Readonly<Record<string, number>>,
  maximum: number,
): Array<[string, number]> {
  return Object.entries(record)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort(([leftId, left], [rightId, right]) =>
      right - left || leftId.localeCompare(rightId),
    )
    .slice(0, maximum);
}

function lineageNames(
  world: Readonly<WorldState>,
  ids: readonly string[],
  empty: string,
): string {
  return ids.length > 0
    ? ids.map((id) => agentName(world, id)).join(', ')
    : empty;
}

export function inspectResidentV16(
  world: Readonly<WorldState>,
  agentId: string,
): TruthfulInspectorReportV16 | undefined {
  const agent = world.agents[agentId];
  if (!agent) return undefined;
  const race = agent.race ?? 'human';
  const evidence = world.v16?.residentEvidenceByAgentId[agent.id];
  const knowledge = world.v15?.knowledgeByAgentId[agent.id];
  const livelihood = world.v18?.livelihoodByAgentId[agent.id];
  const rhythm = world.v18?.lifeRhythmByAgentId[agent.id];
  const language = world.v18?.languageByAgentId[agent.id];
  const smithing = world.v15?.smithingByAgentId[agent.id];
  const createdItems = Object.values(world.v15?.items ?? {}).filter(
    (item) => item.createdByAgentId === agent.id,
  );
  const inventions = Object.values(
    world.v15?.smithingInnovations ?? {},
  ).filter((idea) => idea.inventorAgentId === agent.id);
  const remains = world.v16?.remainsById[`remains:${agent.id}`];

  const actions = topCountEntries(evidence?.actionCounts ?? {}, 5).map(
    ([action, count]) =>
      `${actionLabels[action as AgentActionKind] ?? action} — ${count}`,
  );
  const places = topCountEntries(evidence?.placeVisitCounts ?? {}, 4).map(
    ([placeId, count]) =>
      `${world.places[placeId]?.name ?? placeId} — ${count}`,
  );
  const contacts = topCountEntries(evidence?.contactCounts ?? {}, 6).map(
    ([otherId, count]) => `${agentName(world, otherId)} — ${count}`,
  );
  const relationships = Object.values(world.relationships)
    .filter(
      (relationship) =>
        relationship.agentA === agent.id || relationship.agentB === agent.id,
    )
    .map((relationship) => {
      const otherId =
        relationship.agentA === agent.id
          ? relationship.agentB
          : relationship.agentA;
      const score =
        relationship.trust +
        relationship.affinity +
        relationship.respect -
        relationship.conflict;
      return { otherId, score, relationship };
    })
    .sort((left, right) =>
      right.score - left.score || left.otherId.localeCompare(right.otherId),
    )
    .slice(0, 6)
    .map(
      ({ otherId, relationship }) =>
        `${agentName(world, otherId)}: доверие ${percent(relationship.trust)}, близость ${percent(relationship.affinity)}, конфликт ${percent(relationship.conflict)}`,
    );
  const skills = (Object.entries(agent.skills) as Array<
    [keyof AgentState['skills'], number]
  >)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([skill, value]) => `${skillLabels[skill]} ${percent(value)}`);

  const verifiedWork: string[] = [];
  if (smithing) {
    if (smithing.verifiedWorkshopSessions > 0) {
      verifiedWork.push(
        `подтверждённых занятий в мастерской: ${smithing.verifiedWorkshopSessions}`,
      );
    }
    if (smithing.successfulCraftAttempts > 0) {
      verifiedWork.push(
        `успешных изготовлений: ${smithing.successfulCraftAttempts}`,
      );
    }
  }
  if (createdItems.length > 0) {
    verifiedWork.push(
      `создано предметов: ${createdItems.map((item) => item.name).join(', ')}`,
    );
  }
  if (inventions.length > 0) {
    verifiedWork.push(
      `проверенные изобретения: ${inventions.map((idea) => idea.description).join('; ')}`,
    );
  }

  return {
    kind: 'resident',
    title: agent.name,
    subtitle: `${raceLabels[race]} · ${agent.life.ageYears.toFixed(1)} года · поколение ${agent.life.generation}`,
    badge: agent.life.alive ? 'ЖИВОЙ РАЗУМНЫЙ ЖИТЕЛЬ' : 'ИСТОРИЯ ЖИТЕЛЯ',
    sections: [
      {
        title: 'Сейчас',
        rows: [
          {
            label: 'Действие',
            value: agent.lastAction
              ? actionLabels[agent.lastAction]
              : 'решение ещё не зафиксировано',
          },
          {
            label: 'Место',
            value: world.places[agent.locationId]?.name ?? agent.locationId,
          },
          { label: 'Цель', value: agent.goal.kind },
        ],
      },
      {
        title: 'Родословная',
        rows: [
          {
            label: 'Родители',
            value: lineageNames(
              world,
              agent.life.parentIds,
              agent.life.generation === 0
                ? 'основатель: родители в этом мире не записаны'
                : 'запись отсутствует',
            ),
          },
          {
            label: 'Дети',
            value: lineageNames(world, agent.life.childIds, 'нет'),
          },
        ],
      },
      {
        title: 'Реально освоено',
        rows: [
          {
            label: 'Дело жизни',
            value: livelihood
              ? `${livelihoodLabels[livelihood.primary]} · ${livelihoodStageLabels[livelihood.stage]} · практик ${Math.round(livelihood.totalPractice)}`
              : 'запись прежней версии ещё не восстановлена',
          },
          { label: 'Навыки', value: skills.join(' · ') },
          {
            label: 'Обучение',
            value: knowledge
              ? `${knowledge.verifiedLearningSessions} уроков · ${knowledge.verifiedPracticeSessions} практик`
              : 'подтверждённых записей нет',
          },
          {
            label: 'Труд и созданное',
            value:
              verifiedWork.length > 0
                ? verifiedWork.join(' · ')
                : 'подтверждённых изделий или изобретений пока нет',
          },
          {
            label: 'Забота о погибших',
            value: `${evidence?.burialCareCount ?? 0} подтверждённых захоронений`,
          },
          {
            label: 'Участие в конфликтах',
            value: `${evidence?.conflictParticipationCount ?? 0} подтверждённых столкновений`,
          },
          {
            label: 'Питание',
            value: rhythm
              ? `сытость ${percent(rhythm.satiety)} · приёмов пищи ${rhythm.mealsConsumed} · пропущено ${rhythm.missedMealQuanta}`
              : 'данные прежней версии отсутствуют',
          },
          {
            label: 'Русская речь и письмо',
            value: language
              ? `понимание ${percent(language.spokenComprehension)} · речь ${percent(language.spokenExpression)} · словарь ${percent(language.vocabulary)} · кириллица ${percent(language.cyrillicLiteracy)}`
              : 'обучение ещё не зафиксировано',
          },
        ],
      },
      ...(agent.life.alive
        ? []
        : [
            {
              title: 'Смерть и захоронение',
              rows: [
                {
                  label: 'Причина смерти',
                  value: agent.life.deathCause ?? 'не записана',
                },
                {
                  label: 'Состояние останков',
                  value:
                    remains?.status === 'buried'
                      ? `похоронен(а): ${world.places[remains.burialPlaceId ?? '']?.name ?? remains.burialPlaceId}`
                      : remains?.status === 'unburied'
                        ? `не похоронен(а), риск загрязнения ${percent(remains.contaminationRisk)}`
                        : 'для смерти до v0.3.16 физический исход не реконструируется',
                },
              ],
            },
          ]),
      {
        title: 'Наблюдаемые привычки',
        rows: [
          {
            label: 'Чаще выбирает',
            value: actions.length > 0 ? actions.join(' · ') : 'данные ещё накапливаются',
          },
          {
            label: 'Чаще бывает',
            value: places.length > 0 ? places.join(' · ') : 'данные ещё накапливаются',
          },
        ],
      },
      {
        title: 'Круг общения',
        rows: [
          {
            label: 'Фактические контакты',
            value: contacts.length > 0 ? contacts.join(' · ') : 'контакты ещё не зафиксированы',
          },
          {
            label: 'Сложившиеся связи',
            value: relationships.length > 0 ? relationships.join(' · ') : 'устойчивых связей пока нет',
          },
        ],
      },
    ],
    evidenceNote:
      'Показаны только сохранённое состояние и подсчитанные реальные действия. Биография не дописывается художественным текстом.',
  };
}

export function inspectWildlifeV16(
  world: Readonly<WorldState>,
  populationId: string,
): TruthfulInspectorReportV16 | undefined {
  const population = world.wildlife[populationId];
  if (!population) return undefined;
  const habitat = world.places[population.habitatId];
  const fill =
    population.carryingCapacity > 0
      ? population.count / population.carryingCapacity
      : 0;
  return {
    kind: 'wildlife',
    title: wildlifeLabels[population.species],
    subtitle: population.isMonster
      ? 'популяция монстров'
      : 'популяция животных',
    badge: population.isMonster ? 'МОНСТР' : 'ЖИВОТНОЕ',
    sections: [
      {
        title: 'Популяция',
        rows: [
          {
            label: 'Численность',
            value: `${population.count} из вместимости ${population.carryingCapacity}`,
          },
          { label: 'Заполнение среды', value: percent(fill) },
          { label: 'Темп размножения', value: percent(population.reproductionRate) },
        ],
      },
      {
        title: 'Поведение и опасность',
        rows: [
          { label: 'Настороженность', value: percent(population.alertness) },
          { label: 'Угроза', value: percent(population.threat) },
        ],
      },
      {
        title: 'Среда',
        rows: [
          { label: 'Место', value: habitat?.name ?? population.habitatId },
          { label: 'Биом', value: habitat ? biomeLabels[habitat.biome] : 'неизвестно' },
          { label: 'Опасность местности', value: habitat ? percent(habitat.danger) : 'нет данных' },
        ],
      },
    ],
    evidenceNote:
      'Это агрегированная популяция мира, а не выдуманная отдельная особь.',
  };
}

export function inspectPlaceV16(
  world: Readonly<WorldState>,
  placeId: string,
): TruthfulInspectorReportV16 | undefined {
  const place = world.places[placeId];
  if (!place) return undefined;
  const residents = Object.values(world.agents).filter(
    (agent) => agent.life.alive && agent.locationId === place.id,
  );
  const wildlife = Object.values(world.wildlife).filter(
    (population) => population.habitatId === place.id && population.count > 0,
  );
  const settlement = place.settlementId
    ? world.settlements[place.settlementId]
    : undefined;
  const practice = place.settlementId
    ? world.v16?.settlementEvidenceById[place.settlementId]
    : undefined;
  const practices = practice
    ? topCountEntries(practice.practiceCounts, 5).map(
        ([kind, count]) => `${kind} — ${count}`,
      )
    : [];
  const connected = place.connectedPlaceIds.map(
    (id) => world.places[id]?.name ?? id,
  );
  const localResources = place.settlementId
    ? world.v16?.settlementResourcesById[place.settlementId]
    : undefined;
  const localEconomy = place.settlementId
    ? world.v16?.settlementEconomyById[place.settlementId]
    : undefined;
  const burialSite = place.settlementId
    ? world.v16?.burialSitesBySettlementId[place.settlementId]
    : undefined;
  const unburied = Object.values(world.v16?.remainsById ?? {}).filter(
    (remains) =>
      remains.status === 'unburied' && remains.currentPlaceId === place.id,
  );
  const settlementRelations = place.settlementId
    ? Object.values(world.v16?.settlementRelations ?? {})
        .filter(
          (relation) =>
            relation.settlementA === place.settlementId ||
            relation.settlementB === place.settlementId,
        )
        .sort(
          (left, right) =>
            Number(right.activeWar) - Number(left.activeWar) ||
            right.hostility - left.hostility ||
            left.id.localeCompare(right.id),
        )
    : [];

  return {
    kind: 'place',
    title: place.name,
    subtitle: settlement
      ? `${settlement.kind === 'city' ? 'город' : 'поселение'} ${settlement.name}`
      : biomeLabels[place.biome],
    badge: place.surface === 'water' ? 'ВОДНАЯ МЕСТНОСТЬ' : 'МЕСТНОСТЬ',
    sections: [
      {
        title: 'Физическая местность',
        rows: [
          { label: 'Биом', value: biomeLabels[place.biome] },
          { label: 'Поверхность', value: place.surface },
          { label: 'Плодородие', value: percent(place.fertility) },
          { label: 'Опасность', value: percent(place.danger) },
          { label: 'Вместимость', value: String(place.capacity) },
          {
            label: 'Земельная принадлежность',
            value: place.claimedBySettlementId
              ? world.settlements[place.claimedBySettlementId]?.name ??
                place.claimedBySettlementId
              : settlement?.name ?? 'не заявлена',
          },
        ],
      },
      ...(localResources
        ? [
            {
              title: 'Локальное хозяйство',
              rows: [
                { label: 'Запасы поселения', value: percent(localResources.storedResources) },
                { label: 'Возобновляемая база', value: percent(localResources.renewableBase) },
                { label: 'Плодородие хозяйства', value: percent(localResources.fertility) },
                {
                  label: 'Материальные запасы',
                  value: localEconomy
                    ? `еда ${localEconomy.stocks.food.toFixed(2)}/${localEconomy.storageCapacity.food.toFixed(2)} · дерево ${localEconomy.stocks.wood.toFixed(2)}/${localEconomy.storageCapacity.wood.toFixed(2)} · камень ${localEconomy.stocks.stone.toFixed(2)}/${localEconomy.storageCapacity.stone.toFixed(2)} · металл ${localEconomy.stocks.metal.toFixed(2)}/${localEconomy.storageCapacity.metal.toFixed(2)} · топливо ${localEconomy.stocks.fuel.toFixed(2)}/${localEconomy.storageCapacity.fuel.toFixed(2)}`
                    : 'детализация ещё не создана',
                },
                {
                  label: 'Инструменты',
                  value: localEconomy
                    ? `земледельческие ${localEconomy.farmingTools} · строительные ${localEconomy.constructionTools}`
                    : 'нет данных',
                },
                {
                  label: 'Подтверждённая работа',
                  value: localEconomy
                    ? `урожаев/добычи ${localEconomy.harvestEvents} (еда ${localEconomy.harvestEventsByMaterial.food}, дерево ${localEconomy.harvestEventsByMaterial.wood}, камень ${localEconomy.harvestEventsByMaterial.stone}, металл ${localEconomy.harvestEventsByMaterial.metal}, топливо ${localEconomy.harvestEventsByMaterial.fuel}) · построек ${localEconomy.constructionEvents} · инструментов ${localEconomy.toolsCreated}`
                    : 'нет данных',
                },
              ],
            },
          ]
        : []),
      ...(place.kind === 'cemetery' && burialSite?.placeId === place.id
        ? [
            {
              title: 'Захоронения',
              rows: [
                { label: 'Погребено', value: String(burialSite.burialCount) },
                {
                  label: 'Имена',
                  value: burialSite.interredAgentIds.length > 0
                    ? burialSite.interredAgentIds.map((id) => agentName(world, id)).join(', ')
                    : 'пока нет',
                },
              ],
            },
          ]
        : []),
      ...(settlementRelations.length > 0
        ? [
            {
              title: 'Отношения поселения',
              rows: settlementRelations.slice(0, 6).map((relation) => {
                const otherId =
                  relation.settlementA === place.settlementId
                    ? relation.settlementB
                    : relation.settlementA;
                const other = world.settlements[otherId]?.name ?? otherId;
                return {
                  label: other,
                  value: relation.activeWar
                    ? `война · враждебность ${percent(relation.hostility)} · столкновений ${relation.conflictRounds}`
                    : `доверие ${percent(relation.trust)} · враждебность ${percent(relation.hostility)} · контактов ${relation.contactEvents}`,
                };
              }),
            },
          ]
        : []),
      ...(unburied.length > 0
        ? [
            {
              title: 'Незахороненные останки',
              rows: unburied.map((remains) => ({
                label: agentName(world, remains.agentId),
                value: `загрязнение ${percent(remains.contaminationRisk)}`,
              })),
            },
          ]
        : []),
      {
        title: 'Кто здесь сейчас',
        rows: [
          {
            label: 'Жители',
            value: residents.length > 0
              ? residents.map((agent) => agent.name).join(', ')
              : 'никого',
          },
          {
            label: 'Животные и монстры',
            value: wildlife.length > 0
              ? wildlife
                  .map(
                    (population) =>
                      `${wildlifeLabels[population.species]} — ${population.count}`,
                  )
                  .join(' · ')
              : 'не зафиксированы',
          },
        ],
      },
      {
        title: 'Связи и деятельность',
        rows: [
          {
            label: 'Дороги',
            value: connected.length > 0 ? connected.join(', ') : 'нет',
          },
          {
            label: 'Практики поселения',
            value: practices.length > 0 ? practices.join(' · ') : 'данные ещё накапливаются',
          },
        ],
      },
    ],
    evidenceNote:
      'Описание построено из географии, текущей заселённости и накопленных действий.',
  };
}
