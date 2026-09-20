const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');
function setup(ids) {
  const r=runtime(); const { BattleEngine }=r.load('src/game/engine/BattleEngine.ts');
  const battle=new BattleEngine({mode:'endless',enemyIds:ids,endlessSeed:42,runId:'loop'});
  battle.consumePresentationEvents();
  return {r,battle,pools:r.load('src/game/endless/EndlessRoster.ts').ENDLESS_SEAT_POOLS};
}
function finishRound(battle) { battle.phase='round-result'; battle.roundRevealed=true; }
function defeat(enemy) { enemy.hp=0; enemy.defeated=true; }

test('default endless creates exactly three Hard opponents in their original seats',()=>{
  const {battle,pools}=setup();
  assert.equal(battle.enemies.length,3); assert.equal(battle.player.maxHp,12);
  for(const [seat,enemy] of battle.enemies.entries()) assert(pools[seat].includes(enemy.id));
});

test('each seat bag is fair over four draws and has no boundary repeats',()=>{
  const r=runtime();const {EndlessRoster,ENDLESS_SEAT_POOLS}=r.load('src/game/endless/EndlessRoster.ts');
  for(const seed of [0,1,42,0xffffffff]) for(const seat of [0,1,2]) {
    const roster=new EndlessRoster(seed);let previous;
    for(let cycle=0;cycle<20;cycle++) {
      const drawn=[];
      for(let i=0;i<4;i++) { const id=roster.draw(seat);assert(ENDLESS_SEAT_POOLS[seat].includes(id));assert.notEqual(id,previous);previous=id;drawn.push(id); }
      assert.equal(new Set(drawn).size,4);
    }
  }
});

test('seed and identical seat operations reproduce roster choices; snapshots are detached',()=>{
  const r=runtime();const {EndlessRoster}=r.load('src/game/endless/EndlessRoster.ts');
  const a=new EndlessRoster(99),b=new EndlessRoster(99);
  for(const seat of [0,1,2,2,0,0,1,2,1,0,1,2,2]) assert.equal(a.draw(seat),b.draw(seat));
  const before=JSON.stringify(a.getState());const snapshot=a.getState();snapshot.bags[0].push('keeper');snapshot.lastDraws[0]='keeper';
  assert.equal(JSON.stringify(a.getState()),before);
});

test('a defeated seat waits until nextRound, while survivors preserve HP and permanent state',()=>{
  const {battle,pools}=setup(['goblin','gambler','werewolf']);
  const previous=battle.enemies[0],survivor=battle.enemies[2];survivor.hp=4;survivor.attackBonus=2;
  defeat(previous); finishRound(battle);
  assert.equal(battle.enemies[0],previous);
  battle.nextRound();
  assert.notEqual(battle.enemies[0].instanceId,previous.instanceId);assert(pools[0].includes(battle.enemies[0].id));
  assert.equal(battle.enemies[2],survivor);assert.equal(survivor.hp,4);assert.equal(survivor.attackBonus,2);
  assert.equal(battle.enemies[0].hand.length,2);assert.equal(battle.phase,'choice');
  const entries=battle.consumePresentationEvents().filter(e=>e.type==='enemy-entered');
  assert.equal(entries.length,1);assert.equal(entries[0].enemyInstanceId,battle.enemies[0].instanceId);
});

test('no defeats cause no roster draws or instance replacements',()=>{
  const {battle}=setup(['goblin','gambler','werewolf']);const ids=battle.enemies.map(e=>e.instanceId);
  const roster=JSON.stringify(battle.endlessRoster.getState());finishRound(battle);battle.nextRound();
  assert.equal(JSON.stringify(battle.endlessRoster.getState()),roster);
  assert.equal(JSON.stringify(battle.enemies.map(e=>e.instanceId)),JSON.stringify(ids));
  assert.equal(battle.consumePresentationEvents().filter(e=>e.type==='enemy-entered').length,0);
});

test('real full-table elimination ends the round and refills all three seats',()=>{
  const {r,battle,pools}=setup(['goblin','gambler','werewolf']);const card=r.load('src/game/card.ts').cardFromCode;
  battle.player.hand=['SK','HK','DK'].map(card);
  for(const enemy of battle.enemies) {enemy.hp=1;enemy.hand=['S2','C3'].map(card);}
  const previous=battle.enemies.map(e=>e.instanceId);battle.revealByItem();
  assert(battle.enemies.every(e=>e.defeated));assert.equal(battle.phase,'round-result');assert.equal(battle.battleOutcome,undefined);
  assert.equal(battle.consumePresentationEvents().filter(e=>e.type==='battle-ended').length,0);
  battle.execute({type:'next-round'});
  assert.equal(battle.round,1);assert.equal(battle.endlessLedger.shop.isOpen,true);
  while(battle.endlessLedger.shop.isOpen) battle.finishEndlessShopVisit(battle.getState().endlessAccounting.shop.visit.id);
  battle.execute({type:'next-round'});
  for(const [seat,enemy] of battle.enemies.entries()) {assert.notEqual(enemy.instanceId,previous[seat]);assert(pools[seat].includes(enemy.id));assert.equal(enemy.defeated,false);}
  assert.equal(battle.round,2);assert.equal(battle.consumePresentationEvents().filter(e=>e.type==='enemy-entered').length,3);
});

test('low-HP valkyrie gets one spirit before ordinary empty seats are filled',()=>{
  const {battle,pools}=setup(['goblin','gambler','valkyrie']);
  const valkyrie=battle.enemies[2];valkyrie.hp=1;defeat(battle.enemies[0]);defeat(battle.enemies[1]);
  finishRound(battle);battle.nextRound();
  assert.equal(battle.enemies[0].id,'einherjar');assert.equal(battle.enemies[0].hp,1);
  assert(pools[1].includes(battle.enemies[1].id));assert.equal(valkyrie.summonCount,1);assert.equal(valkyrie.passiveTriggeredThisRound,true);
  const events=battle.consumePresentationEvents();assert.equal(events.filter(e=>e.passiveId==='einherjar_summon').length,1);
  assert.equal(events.filter(e=>e.type==='enemy-entered').length,1);
});

test('live spirit prevents another summon; the next spirit and two-summon limit work across rounds',()=>{
  const {battle,pools}=setup(['goblin','gambler','valkyrie']);const valkyrie=battle.enemies[2];valkyrie.hp=1;
  defeat(battle.enemies[0]);finishRound(battle);battle.nextRound();const first=battle.enemies[0];
  defeat(battle.enemies[1]);finishRound(battle);battle.nextRound();
  assert.equal(battle.enemies[0],first);assert.equal(valkyrie.summonCount,1);assert(pools[1].includes(battle.enemies[1].id));
  defeat(first);finishRound(battle);battle.nextRound();assert.equal(battle.enemies[0].id,'einherjar');assert.notEqual(battle.enemies[0].instanceId,first.instanceId);assert.equal(valkyrie.summonCount,2);
  defeat(battle.enemies[0]);finishRound(battle);battle.nextRound();assert(pools[0].includes(battle.enemies[0].id));assert.equal(valkyrie.summonCount,2);
});

test('healthy or defeated valkyrie does not reserve a spirit seat',()=>{
  for(const dead of [false,true]) { const {battle,pools}=setup(['goblin','gambler','valkyrie']);
    defeat(battle.enemies[0]);if(dead)defeat(battle.enemies[2]);finishRound(battle);battle.nextRound();
    assert(pools[0].includes(battle.enemies[0].id));assert(!battle.enemies.some(e=>e.id==='einherjar'));
  }
});

test('ordinary start passives can target a newly filled seat after roster preparation',()=>{
  const {battle}=setup(['goblin','gambler','oiran']);defeat(battle.enemies[0]);defeat(battle.enemies[1]);
  finishRound(battle);battle.nextRound();const fan=battle.consumePresentationEvents().find(e=>e.passiveId==='hanami_dance'&&e.effect==='mark');
  assert(fan);const target=battle.enemies[fan.targetEnemyIndexes[0]];
  assert.equal(fan.targetEnemyInstanceIds[0],target.instanceId);assert.equal(target.defeated,false);
});

test('simultaneous player and whole-table death checks soul redemption before defeat',()=>{
  const {battle}=setup(['goblin','gambler','werewolf']);battle.enemies.forEach(defeat);battle.player.hp=0;
  battle.updateBattleOutcome();assert.equal(battle.pendingSoulRedeem,true);assert.equal(battle.battleOutcome,undefined);
  const round=battle.round;battle.phase='round-result';battle.nextRound();assert.equal(battle.round,round);
  battle.resolveSoulRedeem();assert.equal(battle.player.hp,3);assert.equal(battle.player.soulRedeemUsed,true);
  assert.equal(battle.round,round+1);assert(battle.enemies.every(e=>!e.defeated));
  battle.enemies.forEach(defeat);battle.player.hp=0;battle.updateBattleOutcome();
  assert.equal(battle.phase,'battle-result');assert.equal(battle.battleOutcome,'defeat');assert.equal(battle.pendingSoulRedeem,false);
});

test('duplicate nextRound requests cannot skip rounds; ended battles cannot replenish',()=>{
  const {battle}=setup(['goblin','gambler','werewolf']);finishRound(battle);battle.nextRound();const round=battle.round;
  battle.nextRound();assert.equal(battle.round,round);
  battle.enemies.forEach(defeat);battle.player.hp=0;battle.player.soulRedeemUsed=true;battle.updateBattleOutcome();
  const ids=battle.enemies.map(e=>e.instanceId);battle.nextRound();assert.equal(battle.round,round);
  assert.equal(JSON.stringify(battle.enemies.map(e=>e.instanceId)),JSON.stringify(ids));
});

test('formal full-table elimination still wins and never replenishes',()=>{
  const r=runtime();const {Battle}=r.load('src/game/battle.ts');const theme=r.load('src/game/data/tableThemes.ts').TABLE_THEMES[0];
  const battle=new Battle({tableThemeConfig:theme,stakeMultiplier:3});battle.enemies.forEach(defeat);battle.updateBattleOutcome();
  assert.equal(battle.battleOutcome,'victory');assert.equal(battle.phase,'battle-result');assert.equal(battle.endlessRoster,undefined);
});
