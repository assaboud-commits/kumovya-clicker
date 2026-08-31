import { characters, characterChapterGates, districts, missions, upgrades, STORY_REWARD, SAVE_KEY, PREVIOUS_SAVE_KEY, LEGACY_SAVE_KEY, type CharacterId, type DistrictId, type Mission } from './game-data';
import { campaignChapters, type CampaignRoute, type CampaignStage, type CampaignMetric } from './campaign-data';
import content from './district-content.json';
import campaignContent from './campaign-content.json';

export type Counters = { clicks: number; earned: number; passive: number; choices: number; upgrades: number; quiet: number; bold: number; missions: number };
export type ActiveMission = { id: string; crew: CharacterId[]; baseline: Counters; reward: number; target: number };
export type CampaignState = { completed: CampaignRoute[]; stage: number; active: { baseline: Counters; crew: CharacterId[] } | null };
export type GameState = {
  version: 3; authority: number; lifetime: number; owned: number[]; sound: boolean; selected: number;
  district: DistrictId; heat: number; stats: Counters; activeMission: ActiveMission | null;
  campaign: CampaignState;
  missionRuns: Record<string, number>; bonds: Record<CharacterId, number>; storyClaims: CharacterId[];
  pendingEvent: { id: string; baseReward: number } | null; eventClicks: number; eventSerial: number;
  characterClicks: number; sequence: number;
  journal: { id: number; title: string; text: string; amount: number }[];
};
export type GameAction =
  | { type: 'load'; state: GameState }
  | { type: 'click'; roll: number }
  | { type: 'tick'; seconds: number }
  | { type: 'buy'; index: number }
  | { type: 'select'; index: number }
  | { type: 'sound' }
  | { type: 'district'; id: DistrictId }
  | { type: 'start-mission'; id: string; support?: CharacterId }
  | { type: 'cancel-mission' }
  | { type: 'claim-mission' }
  | { type: 'resolve-event'; choice: number }
  | { type: 'start-campaign-stage'; support?: CharacterId }
  | { type: 'claim-campaign-stage' }
  | { type: 'cancel-campaign-stage' }
  | { type: 'resolve-chapter'; route: CampaignRoute }
  | { type: 'claim-story'; character: CharacterId };

const MAX = Number.MAX_SAFE_INTEGER;
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? Math.min(MAX, Math.max(0, value)) : fallback;
const integer = (value: unknown, fallback = 0) => Math.floor(number(value, fallback));
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const characterIds = characters.map(({ id }) => id);
const isCharacter = (id: unknown): id is CharacterId => characterIds.includes(id as CharacterId);
const counters = (value: unknown): Counters => {
  const input = object(value);
  return { clicks: integer(input.clicks), earned: number(input.earned), passive: number(input.passive), choices: integer(input.choices), upgrades: integer(input.upgrades), quiet: integer(input.quiet), bold: integer(input.bold), missions: integer(input.missions) };
};

export function createGameState(): GameState {
  return {
    version: 3, authority: 0, lifetime: 0, owned: upgrades.map(() => 0), sound: true, selected: 0,
    district: 'garages', heat: 0, stats: counters(null), activeMission: null, missionRuns: {},
    campaign: { completed: [], stage: 0, active: null },
    bonds: { valera: 0, viktoria: 0, sara: 0, misha: 0, zina: 0, azazel: 0, yaga: 0 }, storyClaims: [],
    pendingEvent: null, eventClicks: 0, eventSerial: 0, characterClicks: 0, sequence: 0, journal: [],
  };
}

export function completedMissions(state: GameState) {
  return missions.filter(({ id }) => (state.missionRuns[id] ?? 0) > 0).length;
}
export function districtUnlocked(state: GameState, id: DistrictId) {
  const district = districts.find((item) => item.id === id);
  return !!district && state.lifetime >= district.unlockAt && completedMissions(state) >= district.requiredMissions;
}
export function characterUnlocked(state: GameState, id: CharacterId) {
  const character = characters.find((item) => item.id === id);
  return !!character && state.lifetime >= character.unlockAt && state.campaign.completed.length >= (characterChapterGates[id] ?? 0);
}
export function upgradeMilestone(count: number) { return 1 + Math.floor(count / 5) * .5; }
export function campaignBonuses(state: GameState) {
  return {
    click: 1 + state.campaign.completed.filter((route) => route === 'bold').length * .05,
    passive: 1 + state.campaign.completed.filter((route) => route === 'quiet').length * .05,
  };
}
export function getPowers(state: GameState) {
  const character = characters[state.selected] ?? characters[0];
  const district = districts.find(({ id }) => id === state.district) ?? districts[0];
  const baseClick = upgrades.reduce((sum, upgrade, index) => sum + upgrade.click * state.owned[index] * upgradeMilestone(state.owned[index]), 1);
  const basePassive = upgrades.reduce((sum, upgrade, index) => sum + upgrade.passive * state.owned[index] * upgradeMilestone(state.owned[index]), 0);
  const bonuses = campaignBonuses(state);
  const infernal = character.id === 'azazel' && state.heat >= 70 ? 1.5 : 1;
  return {
    click: Math.max(1, Math.min(MAX, Math.round(baseClick * character.clickMultiplier * district.clickBonus * bonuses.click * infernal))),
    passive: Math.min(MAX, basePassive * character.passiveMultiplier * district.passiveBonus * bonuses.passive),
  };
}
export function nextClickReward(state: GameState) {
  return Math.min(MAX, getPowers(state).click * (characters[state.selected]?.id === 'viktoria' && (state.characterClicks + 1) % 12 === 0 ? 8 : 1));
}
export function upgradePrice(state: GameState, index: number) {
  if (!upgrades[index]) return MAX;
  const character = characters[state.selected] ?? characters[0];
  return Math.min(MAX, Math.floor(Math.floor(upgrades[index].baseCost * Math.pow(1.72, state.owned[index])) * character.priceMultiplier));
}
export function missionTarget(state: GameState, mission: Mission) {
  const runs = state.missionRuns[mission.id] ?? 0;
  if (!runs || mission.metric === 'upgrades') return mission.target;
  const powers = getPowers(state);
  const growth = mission.target * (1 + .5 * Math.min(runs, 12));
  if (mission.metric === 'passive') return Math.ceil(Math.min(MAX, Math.max(growth, powers.passive * (30 + 10 * Math.min(runs, 6)))));
  if (mission.metric === 'earned') return Math.ceil(Math.min(MAX, Math.max(growth, (powers.passive + powers.click * 2) * (25 + 10 * Math.min(runs, 6)))));
  if (mission.metric === 'choices') return mission.target + Math.min(runs, 4);
  return Math.ceil(mission.target * (1 + .35 * Math.min(runs, 12)));
}
export function missionProgress(state: GameState) {
  const active = state.activeMission;
  const mission = missions.find(({ id }) => id === active?.id);
  if (!active || !mission) return 0;
  const progress = state.stats[mission.metric] - active.baseline[mission.metric];
  return Math.min(active.target, Math.max(0, progress));
}
export function missionQuote(state: GameState, mission: Mission, crew: CharacterId[]) {
  return Math.floor(mission.reward * (crew.includes(mission.specialist) ? 1.25 : 1) * (crew.length > 1 ? 1.1 : 1) * (state.heat >= 70 ? .8 : 1) * ((state.missionRuns[mission.id] ?? 0) > 0 ? .35 : 1));
}
export function eventRewards(state: GameState) {
  const base = state.pendingEvent?.baseReward ?? 0;
  return [base, Math.floor(base * 2.4)];
}
export function currentCampaignStage(state: GameState): CampaignStage | undefined {
  return campaignChapters[state.campaign.completed.length]?.stages[state.campaign.stage];
}
export function campaignProgress(state: GameState) {
  const stage = currentCampaignStage(state);
  if (!stage) return [];
  return (Object.entries(stage.goals) as [CampaignMetric, number][]).map(([metric, target]) => ({
    metric, target, value: state.campaign.active ? Math.min(target, Math.max(0, state.stats[metric] - state.campaign.active.baseline[metric])) : 0,
  }));
}
export function campaignCanClaim(state: GameState) {
  const chapter = campaignChapters[state.campaign.completed.length];
  const stage = currentCampaignStage(state);
  return !!state.campaign.active && !!chapter && !!stage && state.district === chapter.district
    && state.authority >= stage.investment && campaignProgress(state).every(({ value, target }) => value >= target)
    && (stage.maxHeat === undefined || state.heat <= stage.maxHeat) && (stage.minHeat === undefined || state.heat >= stage.minHeat);
}
function earn(state: GameState, amount: number): GameState {
  return { ...state, authority: Math.min(MAX, state.authority + amount), lifetime: Math.min(MAX, state.lifetime + amount), stats: { ...state.stats, earned: Math.min(MAX, state.stats.earned + amount) } };
}
function log(state: GameState, title: string, text: string, amount = 0): GameState {
  const id = state.sequence + 1;
  return { ...state, sequence: id, journal: [{ id, title, text, amount }, ...state.journal].slice(0, 8) };
}

// Earlier versions remain untouched. The longer campaign is stored separately in v3.
export function restoreGameState(value: unknown): GameState {
  const input = object(value);
  const state = createGameState();
  state.authority = number(input.authority);
  state.lifetime = Math.max(state.authority, number(input.lifetime));
  state.owned = upgrades.map((_, index) => Array.isArray(input.owned) ? integer(input.owned[index]) : 0);
  state.sound = typeof input.sound === 'boolean' ? input.sound : true;
  const campaign = object(input.campaign);
  if (Array.isArray(campaign.completed)) {
    for (const route of campaign.completed.slice(0, campaignChapters.length)) {
      if (route !== 'quiet' && route !== 'bold') break;
      state.campaign.completed.push(route);
    }
  }
  state.campaign.stage = state.campaign.completed.length === campaignChapters.length ? 0 : Math.min(3, integer(campaign.stage));
  state.selected = integer(input.selected);
  if (state.selected >= characters.length || !characterUnlocked(state, characters[state.selected].id)) state.selected = 0;
  state.stats = counters(input.stats);
  state.stats.upgrades = Math.min(MAX, state.owned.reduce((sum, count) => sum + count, 0));
  state.heat = Math.min(100, number(input.heat));
  const runs = object(input.missionRuns);
  for (const mission of missions) if (integer(runs[mission.id])) state.missionRuns[mission.id] = integer(runs[mission.id]);
  state.stats.missions = Math.min(MAX, Object.values(state.missionRuns).reduce((sum, count) => sum + count, 0));
  const bonds = object(input.bonds);
  for (const id of characterIds) state.bonds[id] = integer(bonds[id]);
  state.storyClaims = Array.isArray(input.storyClaims) ? [...new Set(input.storyClaims.filter(isCharacter))] : [];
  if (districts.some(({ id }) => id === input.district) && districtUnlocked(state, input.district as DistrictId)) state.district = input.district as DistrictId;
  state.eventClicks = Math.min(36, integer(input.eventClicks));
  state.eventSerial = integer(input.eventSerial);
  state.characterClicks = integer(input.characterClicks) % 12;
  state.sequence = integer(input.sequence);
  if (Array.isArray(input.journal)) state.journal = input.journal.slice(0, 8).map((entry) => {
    const item = object(entry);
    return { id: integer(item.id), title: typeof item.title === 'string' ? item.title.slice(0, 140) : '', text: typeof item.text === 'string' ? item.text.slice(0, 500) : '', amount: number(item.amount) };
  }).filter(({ title }) => !!title);
  const pending = object(input.pendingEvent);
  if (content.events.some(({ id }) => id === pending.id)) state.pendingEvent = { id: String(pending.id), baseReward: Math.max(1, Math.min(100000, integer(pending.baseReward, 35))) };
  const active = object(input.activeMission);
  const mission = missions.find(({ id }) => id === active.id);
  if (mission && districtUnlocked(state, mission.district)) {
    const crew = Array.isArray(active.crew) ? [...new Set(active.crew.filter(isCharacter))].filter((id) => characterUnlocked(state, id)).slice(0, 2) : [];
    if (crew.length) {
      const baseline = counters(active.baseline);
      for (const metric of Object.keys(baseline) as (keyof Counters)[]) baseline[metric] = Math.min(state.stats[metric], baseline[metric]);
      const reward = Math.max(1, Math.min(Math.floor(mission.reward * 1.375), integer(active.reward, missionQuote(state, mission, crew))));
      state.activeMission = { id: mission.id, crew, baseline, reward, target: Math.max(1, integer(active.target, mission.target)) };
      state.district = mission.district;
    }
  }
  const project = object(campaign.active);
  const stage = currentCampaignStage(state);
  if (stage && Array.isArray(project.crew)) {
    const crew = [...new Set(project.crew.filter(isCharacter))].filter((id) => characterUnlocked(state, id)).slice(0, 2);
    if (crew.length && (stage.crew ?? []).every((id) => crew.includes(id))) {
      const baseline = counters(project.baseline);
      for (const metric of Object.keys(baseline) as (keyof Counters)[]) baseline[metric] = Math.min(state.stats[metric], baseline[metric]);
      state.campaign.active = { crew, baseline };
    }
  }
  return state;
}

export function readGameSave(read: (key: string) => string | null) {
  let unreadable = false;
  for (const key of [SAVE_KEY, PREVIOUS_SAVE_KEY, LEGACY_SAVE_KEY]) {
    try {
      const raw = read(key);
      if (!raw) continue;
      const value: unknown = JSON.parse(raw);
      const candidate = object(value);
      // Empty or unrelated JSON must not hide a usable legacy save.
      if (typeof candidate.authority !== 'number' || !Number.isFinite(candidate.authority) || candidate.authority < 0
        || typeof candidate.lifetime !== 'number' || !Number.isFinite(candidate.lifetime) || candidate.lifetime < 0
        || !Array.isArray(candidate.owned) || !candidate.owned.length
        || !candidate.owned.every((count) => typeof count === 'number' && Number.isFinite(count) && count >= 0)) {
        unreadable = true; continue;
      }
      return { state: restoreGameState(value), migrated: key !== SAVE_KEY, unreadable: false };
    } catch { unreadable = true; }
  }
  return { state: createGameState(), migrated: false, unreadable };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'load': return action.state;
    case 'sound': return { ...state, sound: !state.sound };
    case 'select': {
      const character = characters[action.index];
      return character && characterUnlocked(state, character.id) ? { ...state, selected: action.index, characterClicks: 0 } : state;
    }
    case 'district':
      return !state.activeMission && districtUnlocked(state, action.id) ? { ...state, district: action.id } : state;
    case 'tick': {
      const seconds = Math.min(2, number(action.seconds));
      const amount = getPowers(state).passive * seconds;
      if (!amount && !state.heat) return state;
      const next = earn(state, amount);
      const cooling = characters[state.selected].id === 'yaga' ? .5 : .1;
      return { ...next, heat: Math.max(0, state.heat - seconds * cooling), stats: { ...next.stats, passive: Math.min(MAX, state.stats.passive + amount) } };
    }
    case 'click': {
      const amount = nextClickReward(state);
      const next = earn(state, amount);
      next.stats.clicks = Math.min(MAX, state.stats.clicks + 1);
      next.characterClicks = (state.characterClicks + 1) % 12;
      next.eventClicks = Math.min(36, state.eventClicks + 1);
      const character = characters[state.selected] ?? characters[0];
      if (!state.pendingEvent && next.eventClicks >= 12 && (action.roll < character.eventChance || next.eventClicks >= 36)) {
        const pool = content.events.filter(({ district }) => district === state.district);
        const event = pool[state.eventSerial % pool.length];
        const tier = districts.findIndex(({ id }) => id === state.district) + 1;
        next.pendingEvent = { id: event.id, baseReward: Math.min(100000, Math.floor((35 * tier + getPowers(state).click * 3) * character.eventMultiplier)) };
        next.eventClicks = 0;
        next.eventSerial = state.eventSerial + 1;
      }
      return next;
    }
    case 'buy': {
      if (!Number.isInteger(action.index) || !upgrades[action.index]) return state;
      const cost = upgradePrice(state, action.index);
      if (state.authority < cost || state.owned[action.index] >= MAX) return state;
      return { ...state, authority: state.authority - cost, owned: state.owned.map((count, index) => index === action.index ? count + 1 : count), stats: { ...state.stats, upgrades: Math.min(MAX, state.stats.upgrades + 1) } };
    }
    case 'start-mission': {
      const mission = missions.find(({ id }) => id === action.id);
      if (state.activeMission || !mission || mission.district !== state.district || !districtUnlocked(state, mission.district)) return state;
      const crew: CharacterId[] = [characters[state.selected].id];
      if (action.support && action.support !== crew[0] && characterUnlocked(state, action.support)) crew.push(action.support);
      return { ...state, activeMission: { id: mission.id, crew, baseline: { ...state.stats }, reward: missionQuote(state, mission, crew), target: missionTarget(state, mission) } };
    }
    case 'cancel-mission': return { ...state, activeMission: null };
    case 'claim-mission': {
      const active = state.activeMission;
      const mission = missions.find(({ id }) => id === active?.id);
      if (!active || !mission || missionProgress(state) < active.target) return state;
      const next = earn(state, active.reward);
      next.missionRuns = { ...state.missionRuns, [mission.id]: (state.missionRuns[mission.id] ?? 0) + 1 };
      next.stats.missions = Math.min(MAX, state.stats.missions + 1);
      next.bonds = { ...state.bonds };
      for (const id of active.crew) next.bonds[id] = Math.min(MAX, next.bonds[id] + 1);
      next.activeMission = null;
      next.heat = Math.min(100, state.heat + 4);
      return log(next, 'Дело закрыто: ' + mission.title, mission.success, active.reward);
    }
    case 'resolve-event': {
      const event = content.events.find(({ id }) => id === state.pendingEvent?.id);
      if (!event || (action.choice !== 0 && action.choice !== 1)) return state;
      const reward = eventRewards(state)[action.choice];
      const next = earn(state, reward);
      next.pendingEvent = null;
      next.stats.choices = Math.min(MAX, state.stats.choices + 1);
      const route = action.choice === 0 ? 'quiet' : 'bold';
      next.stats[route] = Math.min(MAX, state.stats[route] + 1);
      next.heat = Math.max(0, Math.min(100, state.heat + (action.choice === 0 ? -12 : 18)));
      return log(next, event.title, event.choices[action.choice].result, reward);
    }
    case 'start-campaign-stage': {
      const chapter = campaignChapters[state.campaign.completed.length];
      const stage = currentCampaignStage(state);
      if (!chapter || !stage || state.campaign.active || state.district !== chapter.district || !districtUnlocked(state, chapter.district)) return state;
      const crew: CharacterId[] = [characters[state.selected].id];
      if (action.support && action.support !== crew[0] && characterUnlocked(state, action.support)) crew.push(action.support);
      if (!(stage.crew ?? []).every((id) => crew.includes(id))) return state;
      return { ...state, campaign: { ...state.campaign, active: { crew, baseline: { ...state.stats } } } };
    }
    case 'cancel-campaign-stage': return { ...state, campaign: { ...state.campaign, active: null } };
    case 'claim-campaign-stage': {
      if (!campaignCanClaim(state)) return state;
      const chapterIndex = state.campaign.completed.length;
      const stage = currentCampaignStage(state)!;
      const next = earn({ ...state, authority: state.authority - stage.investment }, stage.reward);
      next.bonds = { ...state.bonds };
      for (const id of state.campaign.active!.crew) next.bonds[id] = Math.min(MAX, next.bonds[id] + 1);
      next.campaign = { ...state.campaign, stage: state.campaign.stage + 1, active: null };
      const story = campaignContent.chapters[chapterIndex];
      return log(next, 'Большое дело: ' + story.stages[state.campaign.stage].title, 'Этап закреплён. Вклад в район: ' + stage.investment + ' авторитета. Команда стала ближе.', stage.reward);
    }
    case 'resolve-chapter': {
      const index = state.campaign.completed.length;
      const chapter = campaignChapters[index];
      if (!chapter || state.campaign.stage !== chapter.stages.length || state.campaign.active || (action.route !== 'quiet' && action.route !== 'bold')) return state;
      const next = earn(state, chapter.reward);
      next.campaign = { completed: [...state.campaign.completed, action.route], stage: 0, active: null };
      const story = campaignContent.chapters[index];
      return log(next, 'Глава закрыта: ' + story.title, story.ending + ' ' + (action.route === 'quiet' ? story.quietResult : story.boldResult), chapter.reward);
    }
    case 'claim-story': {
      if (!isCharacter(action.character) || state.bonds[action.character] < 2 || state.storyClaims.includes(action.character)) return state;
      const story = [...content.stories, ...campaignContent.stories].find(({ characterId }) => characterId === action.character);
      const next = earn(state, STORY_REWARD);
      next.storyClaims = [...state.storyClaims, action.character];
      return log(next, 'Свой человек: ' + characters.find(({ id }) => id === action.character)!.name, story?.quote ?? 'Теперь мы знаем больше.', STORY_REWARD);
    }
  }
}
