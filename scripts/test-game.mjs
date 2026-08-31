import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const project = path.resolve(import.meta.dirname, '..');
const compiled = mkdtempSync(path.join(tmpdir(), 'kumovya-game-'));
after(() => rmSync(compiled, { recursive: true, force: true }));
writeFileSync(path.join(compiled, 'package.json'), '{"type":"commonjs"}');

for (const file of ['asset-path.ts', 'game-data.ts', 'campaign-data.ts', 'game-engine.ts']) {
  const source = readFileSync(path.join(project, 'app', file), 'utf8');
  const output = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  }).outputText;
  writeFileSync(path.join(compiled, file.replace(/\.ts$/, '.js')), output);
}
copyFileSync(path.join(project, 'app', 'district-content.json'), path.join(compiled, 'district-content.json'));
copyFileSync(path.join(project, 'app', 'campaign-content.json'), path.join(compiled, 'campaign-content.json'));
mkdirSync(path.join(compiled, 'noop'), { recursive: true });

const require = createRequire(path.join(compiled, 'noop', 'test.cjs'));
const engine = require(path.join(compiled, 'game-engine.js'));
const data = require(path.join(compiled, 'game-data.js'));
const campaign = require(path.join(compiled, 'campaign-data.js'));
const campaignContent = require(path.join(compiled, 'campaign-content.json'));

function oldSave(overrides = {}) {
  return { authority: 321, lifetime: 3000, owned: [1, 2, 3, 4, 5, 6], sound: false, selected: 3, ...overrides };
}

test('legacy saves migrate without losing money, purchases, sound or character slot', () => {
  const loaded = engine.readGameSave((key) => key === data.LEGACY_SAVE_KEY ? JSON.stringify(oldSave()) : null);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.unreadable, false);
  assert.equal(loaded.state.authority, 321);
  assert.equal(loaded.state.lifetime, 3000);
  assert.deepEqual(loaded.state.owned, [1, 2, 3, 4, 5, 6]);
  assert.equal(loaded.state.sound, false);
  assert.equal(data.characters[loaded.state.selected].id, 'misha');
  assert.equal(loaded.state.stats.upgrades, 21);
});

test('an invalid current record cannot hide a healthy legacy save', () => {
  const records = new Map([
    [data.SAVE_KEY, '{}'],
    [data.LEGACY_SAVE_KEY, JSON.stringify(oldSave({ authority: 888 }))],
  ]);
  const loaded = engine.readGameSave((key) => records.get(key) ?? null);
  assert.equal(loaded.state.authority, 888);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.unreadable, false);
  const broken = engine.readGameSave((key) => key === data.SAVE_KEY ? '{}' : null);
  assert.equal(broken.unreadable, true);
});

test('district gates use lifetime authority and unique completed missions', () => {
  const state = engine.createGameState();
  assert.equal(engine.districtUnlocked(state, 'garages'), true);
  state.lifetime = 1200;
  state.missionRuns = { chair: 7 };
  assert.equal(engine.completedMissions(state), 1);
  assert.equal(engine.districtUnlocked(state, 'market'), false);
  state.missionRuns.grill = 1;
  assert.equal(engine.districtUnlocked(state, 'market'), true);
  state.lifetime = 6000;
  assert.equal(engine.districtUnlocked(state, 'council'), false);
  for (const id of ['last-toast', 'chat-alive', 'discount', 'wreaths']) state.missionRuns[id] = 1;
  assert.equal(engine.completedMissions(state), 6);
  assert.equal(engine.districtUnlocked(state, 'council'), true);
});

test('upgrade missions require new purchases on every run', () => {
  let state = engine.createGameState();
  state.authority = 100000;
  state.lifetime = 100000;
  state.selected = data.characters.findIndex(({ id }) => id === 'valera');
  state.owned = [2, 0, 0, 0, 0, 0];
  state.stats.upgrades = 2;
  state = engine.gameReducer(state, { type: 'start-mission', id: 'grill', support: 'viktoria' });
  assert.equal(state.activeMission.reward, 357);
  assert.equal(engine.missionProgress(state), 0);
  assert.strictEqual(engine.gameReducer(state, { type: 'claim-mission' }), state);
  state = engine.gameReducer(state, { type: 'buy', index: 0 });
  state = engine.gameReducer(state, { type: 'buy', index: 1 });
  assert.equal(engine.missionProgress(state), 2);
  state = engine.gameReducer(state, { type: 'claim-mission' });
  assert.equal(state.missionRuns.grill, 1);
  assert.equal(state.bonds.valera, 1);
  assert.equal(state.bonds.viktoria, 1);
  state = engine.gameReducer(state, { type: 'start-mission', id: 'grill', support: 'viktoria' });
  assert.equal(engine.missionProgress(state), 0);
  assert.strictEqual(engine.gameReducer(state, { type: 'claim-mission' }), state);
});

test('mission crew and quoted reward stay frozen through hero changes and reloads', () => {
  let state = engine.createGameState();
  state.authority = 5000;
  state.lifetime = 5000;
  state = engine.gameReducer(state, { type: 'start-mission', id: 'chair', support: 'viktoria' });
  const reward = state.activeMission.reward;
  state = engine.gameReducer(state, { type: 'select', index: 3 });
  state.heat = 100;
  const restored = engine.restoreGameState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.activeMission.reward, reward);
  assert.deepEqual(restored.activeMission.crew, ['valera', 'viktoria']);
  restored.stats.clicks += 18;
  const paid = engine.gameReducer(restored, { type: 'claim-mission' });
  assert.equal(paid.authority, state.authority + reward);
  assert.equal(paid.activeMission, null);
  assert.strictEqual(engine.gameReducer(paid, { type: 'claim-mission' }), paid);
});

test('choice events have explicit payouts, heat effects and cannot be claimed twice', () => {
  let state = engine.createGameState();
  state.heat = 50;
  state.eventClicks = 35;
  state = engine.gameReducer(state, { type: 'click', roll: 1 });
  assert.ok(state.pendingEvent);
  assert.equal(state.eventClicks, 0);
  const [quiet, loud] = engine.eventRewards(state);
  assert.ok(loud > quiet);
  assert.strictEqual(engine.gameReducer(state, { type: 'resolve-event', choice: 7 }), state);
  const authority = state.authority;
  const resolved = engine.gameReducer(state, { type: 'resolve-event', choice: 0 });
  assert.equal(resolved.authority, authority + quiet);
  assert.equal(resolved.heat, 38);
  assert.equal(resolved.stats.choices, 1);
  assert.equal(resolved.pendingEvent, null);
  assert.strictEqual(engine.gameReducer(resolved, { type: 'resolve-event', choice: 0 }), resolved);
});

test('character perks and personal-story rewards still work', () => {
  let state = engine.createGameState();
  state.lifetime = 3000;
  state.selected = data.characters.findIndex(({ id }) => id === 'viktoria');
  state.characterClicks = 11;
  assert.equal(engine.nextClickReward(state), engine.getPowers(state).click * 8);
  state.selected = data.characters.findIndex(({ id }) => id === 'misha');
  assert.equal(engine.upgradePrice(state, 0), 20);
  state.bonds.valera = 2;
  const paid = engine.gameReducer(state, { type: 'claim-story', character: 'valera' });
  assert.equal(paid.authority, data.STORY_REWARD);
  assert.ok(paid.storyClaims.includes('valera'));
  assert.strictEqual(engine.gameReducer(paid, { type: 'claim-story', character: 'valera' }), paid);
});

test('all ten missions form a completable campaign', () => {
  let state = engine.createGameState();
  state.authority = 10000000;
  state.lifetime = 10000000;
  for (const mission of data.missions) {
    state = engine.gameReducer(state, { type: 'district', id: mission.district });
    assert.equal(state.district, mission.district, `district for ${mission.id}`);
    state = engine.gameReducer(state, { type: 'select', index: data.characters.findIndex(({ id }) => id === mission.specialist) });
    state = engine.gameReducer(state, { type: 'start-mission', id: mission.id });
    assert.equal(state.activeMission?.id, mission.id);
    state = { ...state, stats: { ...state.stats, [mission.metric]: state.stats[mission.metric] + mission.target } };
    state = engine.gameReducer(state, { type: 'claim-mission' });
    assert.equal(state.missionRuns[mission.id], 1, mission.id);
  }
  assert.equal(engine.completedMissions(state), 10);
  assert.equal(state.activeMission, null);
});

function fundedState() {
  const state = engine.createGameState();
  state.authority = 100000000;
  state.lifetime = 100000000;
  return state;
}

function satisfyStage(state) {
  const stage = engine.currentCampaignStage(state);
  const next = { ...state, stats: { ...state.stats } };
  for (const [metric, goal] of Object.entries(stage.goals)) {
    next.stats[metric] = state.campaign.active.baseline[metric] + goal;
  }
  if (stage.maxHeat !== undefined) next.heat = stage.maxHeat;
  if (stage.minHeat !== undefined) next.heat = stage.minHeat;
  return next;
}

test('seven heroes retain the original slots and fantasy guests require completed chapters', () => {
  const state = fundedState();
  assert.deepEqual(data.characters.map(({ id }) => id), ['valera', 'viktoria', 'sara', 'misha', 'zina', 'azazel', 'yaga']);
  assert.equal(engine.characterUnlocked(state, 'azazel'), false);
  assert.equal(engine.characterUnlocked(state, 'yaga'), false);
  state.campaign.completed = Array(4).fill('quiet');
  assert.equal(engine.characterUnlocked(state, 'azazel'), true);
  assert.equal(engine.characterUnlocked(state, 'yaga'), false);
  state.campaign.completed.push('bold');
  assert.equal(engine.characterUnlocked(state, 'yaga'), true);
});

test('v2 migrates intact including in-flight mission, personal stories and pending event', () => {
  let old = fundedState();
  old.selected = 3;
  old.sound = false;
  old.owned = [3, 2, 1, 0, 0, 0];
  old.stats.upgrades = 6;
  old.missionRuns = { chair: 2 };
  old.bonds = { ...old.bonds, valera: 2, misha: 3 };
  old.storyClaims = ['misha'];
  old = engine.gameReducer(old, { type: 'start-mission', id: 'chair', support: 'sara' });
  old.stats.clicks += 5;
  old.eventClicks = 35;
  old = engine.gameReducer(old, { type: 'click', roll: 1 });
  old.version = 2;
  delete old.campaign;
  delete old.activeMission.target;
  delete old.stats.quiet;
  delete old.stats.bold;
  delete old.stats.missions;
  const oldText = JSON.stringify(old);
  const loaded = engine.readGameSave((key) => key === data.PREVIOUS_SAVE_KEY ? oldText : null);
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.state.version, 3);
  for (const key of ['authority', 'lifetime', 'owned', 'selected', 'sound', 'pendingEvent', 'storyClaims', 'missionRuns']) assert.deepEqual(loaded.state[key], old[key], key);
  assert.deepEqual(loaded.state.activeMission.crew, old.activeMission.crew);
  assert.equal(loaded.state.activeMission.reward, old.activeMission.reward);
  assert.equal(loaded.state.activeMission.target, data.missions.find(({ id }) => id === 'chair').target);
  assert.equal(engine.missionProgress(loaded.state), 6);
  assert.deepEqual(loaded.state.campaign, { completed: [], stage: 0, active: null });
  assert.equal(loaded.state.stats.missions, 2);
  assert.equal(loaded.state.bonds.misha, 3);
});

test('current save wins over older versions; corrupt current save falls back to v2', () => {
  const current = JSON.stringify({ ...fundedState(), authority: 123 });
  const previous = JSON.stringify(oldSave({ authority: 456 }));
  const records = new Map([[data.SAVE_KEY, current], [data.PREVIOUS_SAVE_KEY, previous]]);
  assert.equal(engine.readGameSave((key) => records.get(key) ?? null).state.authority, 123);
  records.set(data.SAVE_KEY, '{broken');
  const fallback = engine.readGameSave((key) => records.get(key) ?? null);
  assert.equal(fallback.state.authority, 456);
  assert.equal(fallback.migrated, true);
});

test('campaign work starts from zero, freezes crew, persists, and costs nothing to start or cancel', () => {
  let state = fundedState();
  state.stats.earned = 123456;
  state = engine.gameReducer(state, { type: 'start-campaign-stage', support: 'sara' });
  const authority = state.authority;
  assert.ok(engine.campaignProgress(state).every(({ value }) => value === 0));
  assert.equal(state.authority, 100000000);
  state = engine.gameReducer(state, { type: 'select', index: 3 });
  state = engine.gameReducer(state, { type: 'buy', index: 0 });
  state = engine.gameReducer(state, { type: 'click', roll: 1 });
  const progress = engine.campaignProgress(state);
  const restored = engine.restoreGameState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.campaign.active.crew, ['valera', 'sara']);
  assert.deepEqual(engine.campaignProgress(restored), progress);
  assert.equal(restored.authority, state.authority);
  const cancelled = engine.gameReducer(restored, { type: 'cancel-campaign-stage' });
  assert.equal(cancelled.authority, restored.authority);
  assert.equal(cancelled.campaign.active, null);
  assert.ok(engine.campaignProgress(cancelled).every(({ value }) => value === 0));
  assert.ok(authority > cancelled.authority);
});

test('campaign stage gates crew, goals, money, location, and heat, then pays only once', () => {
  let state = fundedState();
  state.campaign.stage = 2;
  state.selected = 3;
  assert.strictEqual(engine.gameReducer(state, { type: 'start-campaign-stage' }), state);
  state = engine.gameReducer(state, { type: 'start-campaign-stage', support: 'valera' });
  assert.ok(state.campaign.active);
  assert.strictEqual(engine.gameReducer(state, { type: 'claim-campaign-stage' }), state);
  state = satisfyStage(state);
  const stage = engine.currentCampaignStage(state);
  assert.equal(engine.campaignCanClaim({ ...state, authority: stage.investment - 1 }), false);
  assert.equal(engine.campaignCanClaim({ ...state, district: 'market' }), false);
  assert.equal(engine.campaignCanClaim({ ...state, heat: stage.maxHeat + 1 }), false);
  assert.equal(engine.campaignCanClaim(state), true);
  const paid = engine.gameReducer(state, { type: 'claim-campaign-stage' });
  assert.equal(paid.authority, state.authority - stage.investment + stage.reward);
  assert.equal(paid.campaign.stage, 3);
  assert.equal(paid.campaign.active, null);
  assert.equal(paid.bonds.misha, 1);
  assert.equal(paid.bonds.valera, 1);
  assert.strictEqual(engine.gameReducer(paid, { type: 'claim-campaign-stage' }), paid);
});

test('chapter resolution requires three stages and permanently awards exactly one route', () => {
  const state = fundedState();
  assert.strictEqual(engine.gameReducer(state, { type: 'resolve-chapter', route: 'quiet' }), state);
  state.campaign.stage = 3;
  const paid = engine.gameReducer(state, { type: 'resolve-chapter', route: 'quiet' });
  assert.equal(paid.authority, state.authority + campaign.campaignChapters[0].reward);
  assert.deepEqual(paid.campaign, { completed: ['quiet'], stage: 0, active: null });
  assert.deepEqual(engine.campaignBonuses(paid), { click: 1, passive: 1.05 });
  assert.strictEqual(engine.gameReducer(paid, { type: 'resolve-chapter', route: 'bold' }), paid);
  paid.campaign.stage = 3;
  const louder = engine.gameReducer(paid, { type: 'resolve-chapter', route: 'bold' });
  assert.deepEqual(engine.campaignBonuses(louder), { click: 1.05, passive: 1.05 });
});

test('all 21 stages are reachable with required crews and unlock both guests in sequence', () => {
  let state = fundedState();
  state.missionRuns = Object.fromEntries(data.missions.map(({ id }) => [id, 1]));
  state.stats.missions = data.missions.length;
  let count = 0;
  for (const [chapterIndex, chapter] of campaign.campaignChapters.entries()) {
    state = engine.gameReducer(state, { type: 'district', id: chapter.district });
    assert.equal(state.district, chapter.district);
    for (const stage of chapter.stages) {
      const required = stage.crew ?? ['valera'];
      for (const hero of required) assert.equal(engine.characterUnlocked(state, hero), true, `${chapter.id}: ${hero}`);
      state = engine.gameReducer(state, { type: 'select', index: data.characters.findIndex(({ id }) => id === required[0]) });
      state = engine.gameReducer(state, { type: 'start-campaign-stage', support: required[1] });
      assert.ok(state.campaign.active, `${chapter.id} stage ${state.campaign.stage}`);
      state = satisfyStage(state);
      if (stage.minHeat) assert.equal(engine.campaignCanClaim({ ...state, heat: stage.minHeat - 1 }), false);
      assert.equal(engine.campaignCanClaim(state), true);
      state = engine.gameReducer(state, { type: 'claim-campaign-stage' });
      count++;
    }
    state = engine.gameReducer(state, { type: 'resolve-chapter', route: chapterIndex % 2 ? 'bold' : 'quiet' });
    assert.equal(state.campaign.completed.length, chapterIndex + 1);
    if (chapter.unlock) assert.equal(engine.characterUnlocked(state, chapter.unlock), true);
  }
  assert.equal(count, 21);
  assert.equal(engine.currentCampaignStage(state), undefined);
  assert.equal(engine.characterUnlocked(state, 'azazel'), true);
  assert.equal(engine.characterUnlocked(state, 'yaga'), true);
  assert.strictEqual(engine.gameReducer(state, { type: 'resolve-chapter', route: 'quiet' }), state);
});

test('repeat income missions scale to current power but their targets remain frozen', () => {
  let state = fundedState();
  state.owned = [10, 10, 10, 10, 10, 10];
  state.stats.upgrades = 60;
  for (const metric of ['passive', 'earned']) {
    const mission = data.missions.find((item) => item.metric === metric);
    state.missionRuns[mission.id] = 1;
    const target = engine.missionTarget(state, mission);
    assert.ok(target > mission.target);
    assert.ok(target >= engine.getPowers(state).passive * 35);
  }
  const mission = data.missions.find((item) => item.metric === 'passive' && item.district === 'garages');
  state = engine.gameReducer(state, { type: 'start-mission', id: mission.id });
  const target = state.activeMission.target;
  state = engine.gameReducer(state, { type: 'select', index: 2 });
  state = engine.gameReducer(state, { type: 'buy', index: 1 });
  assert.equal(state.activeMission.target, target);
  state = engine.restoreGameState(JSON.parse(JSON.stringify(state)));
  assert.equal(state.activeMission.target, target);
  assert.equal(engine.missionProgress(state), 0);
});

test('Azazel heat bonus, Yaga cooling, and upgrade milestones match their descriptions', () => {
  let state = fundedState();
  state.campaign.completed = Array(5).fill('bold');
  state.owned = [10, 5, 0, 0, 0, 0];
  state.selected = 5;
  const baseClick = data.upgrades.reduce((sum, item, index) => sum + item.click * state.owned[index] * engine.upgradeMilestone(state.owned[index]), 1);
  state.heat = 70;
  assert.equal(engine.getPowers(state).click, Math.round(baseClick * 1.4 * 1.1 * 1.25 * 1.5));
  state.heat = 69;
  assert.equal(engine.getPowers(state).click, Math.round(baseClick * 1.4 * 1.1 * 1.25));
  state.selected = 6;
  state.heat = 80;
  const passive = engine.getPowers(state).passive;
  const basePassive = data.upgrades.reduce((sum, item, index) => sum + item.passive * state.owned[index] * engine.upgradeMilestone(state.owned[index]), 0);
  assert.equal(passive, basePassive * 1.6);
  const cooled = engine.gameReducer(state, { type: 'tick', seconds: 2 });
  assert.equal(cooled.heat, 79);
  assert.equal(cooled.stats.passive, passive * 2);
  assert.equal(engine.upgradeMilestone(4), 1);
  assert.equal(engine.upgradeMilestone(5), 1.5);
  assert.equal(engine.upgradeMilestone(10), 2);
});

test('chapter text, artwork and stories cover all seven heroes and all 21 stages', () => {
  assert.equal(campaignContent.chapters.length, 7);
  assert.deepEqual(campaignContent.chapters.map(({ id }) => id), campaign.campaignChapters.map(({ id }) => id));
  for (const chapter of campaignContent.chapters) assert.equal(chapter.stages.length, 3);
  const originalContent = require(path.join(compiled, 'district-content.json'));
  assert.deepEqual([...originalContent.stories, ...campaignContent.stories].map(({ characterId }) => characterId).sort(), data.characters.map(({ id }) => id).sort());
  for (const character of data.characters.slice(5)) {
    const image = path.join(project, 'public', character.image.replace(/^\//, ''));
    assert.ok(readFileSync(image).length > 100000);
    const state = fundedState();
    state.campaign.completed = Array(5).fill('quiet');
    state.bonds[character.id] = 2;
    const paid = engine.gameReducer(state, { type: 'claim-story', character: character.id });
    assert.ok(paid.storyClaims.includes(character.id));
    assert.strictEqual(engine.gameReducer(paid, { type: 'claim-story', character: character.id }), paid);
  }
});
