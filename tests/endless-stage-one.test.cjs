const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');

const themes = ['evernight_tavern', 'northern_longhouse', 'dragon_gate', 'edo_teahouse'];
function clearAll(progress, skip) {
  for (const theme of themes) for (const difficulty of [1, 2, 3]) {
    if (`${theme}:${difficulty}` !== skip) progress.recordFormalTableResult('victory', theme, difficulty);
  }
}

test('old theme victories do not invent difficulty clears; coins and inventory survive', () => {
  const r = runtime({ saved: { soulCoins: 437, ownedItems: { holy_shield: 2 },
    formalTableStats: { wins: 40, losses: 3, battlesPlayed: 43, winsByTheme: { edo_teahouse: 20 } } } });
  const p = r.progress.getProgress();
  assert.equal(p.soulCoins, 437); assert.equal(p.ownedItems.holy_shield, 2);
  assert.equal(p.formalTableStats.wins, 40);
  assert.equal(Object.keys(p.formalTableStats.winsByThemeAndDifficulty).length, 0);
  assert.equal(p.economyStats.spendingBySink.endless_entry, 0);
  assert.equal(r.progress.reserveEndlessEntry('locked').status, 'locked');
});

test('11 distinct victories stay locked; only the missing victory unlocks', () => {
  const r = runtime(); const rules = r.load('src/game/endless/EndlessRules.ts');
  clearAll(r.progress, 'edo_teahouse:3');
  const state = () => rules.getEndlessUnlockProgress(r.progress.getProgress().formalTableStats.winsByThemeAndDifficulty);
  assert.equal(state().completed, 11); assert.equal(state().unlocked, false);
  r.progress.recordFormalTableResult('defeat', 'edo_teahouse', 3);
  r.progress.recordFormalTableResult('victory', 'evernight_tavern', undefined); // unqualified result cannot clear a difficulty
  assert.equal(state().completed, 11);
  r.progress.recordFormalTableResult('victory', 'edo_teahouse', 3);
  assert.equal(state().completed, 12); assert.equal(state().unlocked, true);
});

test('formal settlement credits its actual difficulty; unrelated modes do not', () => {
  const r = runtime(); const economy = r.load('src/game/economy.ts');
  economy.settleBattleEconomy('victory', 6, 105, 1.8, 'edo_teahouse', 3);
  assert.equal(r.progress.getProgress().formalTableStats.winsByThemeAndDifficulty.edo_teahouse[3], 1);
  economy.settleReliefBattleEconomy('victory');
  assert.equal(Object.keys(r.progress.getProgress().formalTableStats.winsByThemeAndDifficulty).length, 1);
});

test('99 coins cannot pay; 100 pays exactly once and creates an empty isolated run', () => {
  const poor = runtime({ saved: { soulCoins: 99 } }); clearAll(poor.progress);
  assert.equal(poor.progress.reserveEndlessEntry('poor').status, 'not-enough-coins');
  assert.equal(poor.progress.getProgress().soulCoins, 99);
  const r = runtime(); clearAll(r.progress);
  const first = r.progress.reserveEndlessEntry('run-one');
  assert.equal(first.status, 'created'); assert.equal(first.amount, 100); assert.equal(first.total, 0);
  assert.equal(first.session.playerHp, 12); assert.equal(first.session.wallet, 70);
  assert.equal(Object.keys(first.session.ownedItems).length, 0);
  assert.equal(r.progress.getProgress().ownedItems.heal_potion, 2);
  assert.equal(r.progress.getProgress().formalTableStats.battlesPlayed, 12);
  const second = r.progress.reserveEndlessEntry('run-two');
  assert.equal(second.status, 'resumed'); assert.equal(second.amount, 0); assert.equal(second.session.runId, 'run-one');
  const transactions = r.progress.getProgress().economyTransactions.filter((t) => t.category === 'endless_entry');
  assert.equal(transactions.length, 1); assert.equal(transactions[0].runId, 'run-one');
  assert.equal(r.progress.getProgress().economyStats.spendingBySink.formal_entry, 0);
});

test('reload and a second tab recover the paid reservation without another payment', () => {
  const shared = new Map(); const first = runtime({ storage: shared }); const second = runtime({ storage: shared });
  clearAll(first.progress); first.progress.reserveEndlessEntry('saved-run');
  assert.equal(second.progress.reserveEndlessEntry('other-tab').status, 'resumed');
  const reloaded = runtime({ storage: shared });
  assert.equal(reloaded.progress.getProgress().endlessSession.runId, 'saved-run');
  assert.equal(reloaded.progress.getProgress().soulCoins, 0);
  assert.equal(reloaded.progress.getProgress().economyTransactions.at(-1).runId, 'saved-run');
});

test('failed storage write does not consume coins or leave a partial session', () => {
  const r = runtime(); clearAll(r.progress); r.failWrite();
  const result = r.progress.reserveEndlessEntry('denied');
  assert.equal(result.status, 'storage-unavailable'); assert.equal(result.amount, 0);
  assert.equal(r.progress.getProgress().soulCoins, 100); assert.equal(r.progress.getProgress().endlessSession, undefined);
  assert.equal(r.progress.getProgress().economyStats.spendingBySink.endless_entry, 0);
});

test('test reset explicitly fills all 12 clears; existing test saves do not invent them', () => {
  const r = runtime({ mode: 'test' });
  const rules = r.load('src/game/endless/EndlessRules.ts');
  assert.equal(rules.getEndlessUnlockProgress(r.progress.getProgress().formalTableStats.winsByThemeAndDifficulty).completed, 12);
  const old = runtime({ mode: 'test', saved: { soulCoins: 9999 } });
  assert.equal(rules.getEndlessUnlockProgress(old.progress.getProgress().formalTableStats.winsByThemeAndDifficulty).completed, 0);
  old.progress.resetTestProgress();
  assert.equal(rules.getEndlessUnlockProgress(old.progress.getProgress().formalTableStats.winsByThemeAndDifficulty).completed, 12);
});

test('settlement examples and resonance farming cap match the plan', () => {
  const r = runtime(); const rules = r.load('src/game/endless/EndlessRules.ts');
  assert.equal(rules.calculateEndlessSettlement(5, 12, 55).total, 144);
  assert.equal(rules.calculateEndlessSettlement(10, 28, 140).total, 266);
  assert.equal(rules.calculateEndlessSettlement(20, 60, 320).total, 500);
  assert.equal(rules.calculateEndlessSettlement(0, 9999, 0).total, 0);
  assert.equal(rules.calculateEndlessSettlement(1, 9999, 0).resonanceBonus, 10);
});


test('production entry opens after refresh recovery and charges once', async () => {
  const r = runtime(); clearAll(r.progress);
  const result = await r.load('src/game/economy.ts').tryEnterEndlessMode();
  assert.equal(result.status, 'created'); assert.equal(result.amount, 100);
  assert.equal(r.progress.getProgress().soulCoins, 0);
  assert(r.progress.getProgress().endlessSession);
});
