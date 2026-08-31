import { characters, districts, missions, upgrades, STORY_REWARD, SAVE_KEY, LEGACY_SAVE_KEY, type CharacterId, type DistrictId, type Mission } from './game-data';
import content from './district-content.json';

export type Counters = { clicks: number; earned: number; passive: number; choices: number; upgrades: number };
export type ActiveMission = { id: string; crew: CharacterId[]; baseline: Counters; reward: number };
export type GameState = {
  version: 2; authority: number; lifetime: number; owned: number[]; sound: boolean; selected: number;
  district: DistrictId; heat: number; stats: Counters; activeMission: ActiveMission | null;
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
  | { type: 'claim-story'; character: CharacterId };

const MAX = Number.MAX_SAFE_INTEGER;
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? Math.min(MAX, Math.max(0, value)) : fallback;
const integer = (value: unknown, fallback = 0) => Math.floor(number(value, fallback));
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const characterIds = characters.map(({ id }) => id);
const isCharacter = (id: unknown): id is CharacterId => characterIds.includes(id as CharacterId);
const counters = (value: unknown): Counters => {
  const input = object(value);
  return { clicks: integer(input.clicks), earned: number(input.earned), passive: number(input.passive), choices: integer(input.choices), upgrades: integer(input.upgrades) };
};

export function createGameState(): GameState {
  return {
    version: 2, authority: 0, lifetime: 0, owned: upgrades.map(() => 0), sound: true, selected: 0,
    district: 'garages', heat: 0, stats: counters(null), activeMission: null, missionRuns: {},
    bonds: { valera: 0, viktoria: 0, sara: 0, misha: 0, zina: 0 }, storyClaims: [],
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
  return !!character && state.lifetime >= character.unlockAt;
}
export function getPowers(state: GameState) {
  const character = characters[state.selected] ?? characters[0];
  const district = districts.find(({ id }) => id === state.district) ?? districts[0];
  const baseClick = upgrades.reduce((sum, upgrade, index) => sum + upgrade.click * state.owned[index], 1);
  const basePassive = upgrades.reduce((sum, upgrade, index) => sum + upgrade.passive * state.owned[index], 0);
  return {
    click: Math.max(1, Math.min(MAX, Math.round(baseClick * character.clickMultiplier * district.clickBonus))),
    passive: Math.min(MAX, basePassive * character.passiveMultiplier * district.passiveBonus),
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
export function missionProgress(state: GameState) {
  const active = state.activeMission;
  const mission = missions.find(({ id }) => id === active?.id);
  if (!active || !mission) return 0;
  const progress = state.stats[mission.metric] - active.baseline[mission.metric];
  return Math.min(mission.target, Math.max(0, progress));
}
export function missionQuote(state: GameState, mission: Mission, crew: CharacterId[]) {
  return Math.floor(mission.reward * (crew.includes(mission.specialist) ? 1.25 : 1) * (crew.length > 1 ? 1.1 : 1) * (state.heat >= 70 ? .8 : 1) * ((state.missionRuns[mission.id] ?? 0) > 0 ? .35 : 1));
}
export function eventRewards(state: GameState) {
  const base = state.pendingEvent?.baseReward ?? 0;
  return [base, Math.floor(base * 2.4)];
}
function earn(state: GameState, amount: number): GameState {
  return { ...state, authority: Math.min(MAX, state.authority + amount), lifetime: Math.min(MAX, state.lifetime + amount), stats: { ...state.stats, earned: Math.min(MAX, state.stats.earned + amount) } };
}
function log(state: GameState, title: string, text: string, amount = 0): GameState {
  const id = state.sequence + 1;
  return { ...state, sequence: id, journal: [{ id, title, text, amount }, ...state.journal].slice(0, 8) };
}

// v1 is read without altering or deleting it. A new v2 record is saved separately.
export function restoreGameState(value: unknown): GameState {
  const input = object(value);
  const state = createGameState();
  state.authority = number(input.authority);
  state.lifetime = Math.max(state.authority, number(input.lifetime));
  state.owned = upgrades.map((_, index) => Array.isArray(input.owned) ? integer(input.owned[index]) : 0);
  state.sound = typeof input.sound === 'boolean' ? input.sound : true;
  state.selected = integer(input.selected);
  if (state.selected >= characters.length || !characterUnlocked(state, characters[state.selected].id)) state.selected = 0;
  state.stats = counters(input.stats);
  state.stats.upgrades = Math.min(MAX, state.owned.reduce((sum, count) => sum + count, 0));
  state.heat = Math.min(100, number(input.heat));
  const runs = object(input.missionRuns);
  for (const mission of missions) if (integer(runs[mission.id])) state.missionRuns[mission.id] = integer(runs[mission.id]);
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
      state.activeMission = { id: mission.id, crew, baseline, reward };
      state.district = mission.district;
    }
  }
  return state;
}

export function readGameSave(read: (key: string) => string | null) {
  let unreadable = false;
  for (const key of [SAVE_KEY, LEGACY_SAVE_KEY]) {
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
      return { state: restoreGameState(value), migrated: key === LEGACY_SAVE_KEY, unreadable: false };
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
      return { ...next, heat: Math.max(0, state.heat - seconds * .1), stats: { ...next.stats, passive: Math.min(MAX, state.stats.passive + amount) } };
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
      return { ...state, activeMission: { id: mission.id, crew, baseline: { ...state.stats }, reward: missionQuote(state, mission, crew) } };
    }
    case 'cancel-mission': return { ...state, activeMission: null };
    case 'claim-mission': {
      const active = state.activeMission;
      const mission = missions.find(({ id }) => id === active?.id);
      if (!active || !mission || missionProgress(state) < mission.target) return state;
      const next = earn(state, active.reward);
      next.missionRuns = { ...state.missionRuns, [mission.id]: (state.missionRuns[mission.id] ?? 0) + 1 };
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
      next.heat = Math.max(0, Math.min(100, state.heat + (action.choice === 0 ? -12 : 18)));
      return log(next, event.title, event.choices[action.choice].result, reward);
    }
    case 'claim-story': {
      if (!isCharacter(action.character) || state.bonds[action.character] < 2 || state.storyClaims.includes(action.character)) return state;
      const story = content.stories.find(({ characterId }) => characterId === action.character);
      const next = earn(state, STORY_REWARD);
      next.storyClaims = [...state.storyClaims, action.character];
      return log(next, 'Свой человек: ' + characters.find(({ id }) => id === action.character)!.name, story?.quote ?? 'Теперь мы знаем больше.', STORY_REWARD);
    }
  }
}
