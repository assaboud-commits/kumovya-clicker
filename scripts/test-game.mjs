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

for (const file of ['asset-path.ts', 'game-data.ts', 'game-engine.ts']) {
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
mkdirSync(path.join(compiled, 'noop'), { recursive: true });

const require = createRequire(path.join(compiled, 'noop', 'test.cjs'));
const engine = require(path.join(compiled, 'game-engine.js'));
const data = require(path.join(compiled, 'game-data.js'));

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

test('an invalid v2 record cannot hide a healthy legacy save', () => {
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
