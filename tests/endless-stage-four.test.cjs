const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');
function setup(ids=['goblin','gambler','werewolf'], mode='endless') {
  const r=runtime(); const {BattleEngine}=r.load('src/game/engine/BattleEngine.ts');
  const battle=new BattleEngine({mode,enemyIds:ids,endlessSeed:42,runId:'score'});
  const card=r.load('src/game/card.ts').cardFromCode;
  return {r,battle,hand:(codes)=>codes.map(card)};
}
function registerKills(battle,count) {
  for(let i=0;i<count;i++) battle.endlessLedger.recordDefeat(`kill-${i}`,`npc-${i}`,'goblin',false);
}

function skipShop(battle) {
  battle.openEndlessShop();
  while(battle.endlessLedger.shop.isOpen) battle.finishEndlessShopVisit(battle.getState().endlessAccounting.shop.visit.id);
}

test('full table elimination earns 75 coins, two shop visits and per-target resonance points',()=>{
  const {battle,hand}=setup();battle.player.hp=5;battle.player.hand=hand(['SK','HK','DK']);
  for(const enemy of battle.enemies){enemy.hp=1;enemy.hand=hand(['S2','C3']);}
  battle.revealByItem();const state=battle.getState().endlessAccounting;
  assert.equal(state.defeatedCount,3);assert.equal(state.wallet,75);assert.equal(state.resonancePoints,12);
  assert.equal(state.shopOpportunities,2);assert.equal(battle.player.hp,8);
  const before=JSON.stringify(state);battle.consumePresentationEvents();battle.consumePresentationEvents();
  for(const enemy of battle.enemies)battle.applyDefeatAndReward(enemy);
  assert.equal(JSON.stringify(battle.getState().endlessAccounting),before);
  for(const event of state.events.filter(e=>e.type==='npc-defeated')) {
    assert(state.events.some(e=>e.type==='resonance-scored'&&e.actionId===event.actionId));
  }
});

test('spirit elimination gives no coins, healing, shop progress or resonance',()=>{
  const {battle,hand}=setup(['einherjar','gambler','werewolf']);battle.player.hp=5;
  const enemy=battle.enemies[0];enemy.hand=hand(['S2','C3']);battle.player.hand=hand(['SK','HK','DK']);
  battle.compareEnemy(enemy);battle.applyDefeatAndReward(enemy);
  const state=battle.getState().endlessAccounting;assert.equal(state.clearedSpiritCount,1);
  assert.equal(state.defeatedCount,0);assert.equal(state.wallet,0);assert.equal(state.resonancePoints,0);
  assert.equal(state.shopOpportunities,0);assert.equal(battle.player.hp,5);
});

test('smoke evasion, ordinary attacks, ties and shielded incoming hits do not score',()=>{
  for(const type of ['smoke','ordinary','tie','shield']) {
    const {battle,hand}=setup(['goblin','ninja','werewolf']);const enemy=battle.enemies[1];
    battle.player.hand=hand(['SK','HK','DK']);enemy.hand=hand(['S2','C3']);
    if(type==='smoke')enemy.smokeScreenArmed=true;
    else if(type==='ordinary')battle.player.hand=hand(['S4','H5']);
    else if(type==='tie')enemy.hand=battle.player.hand.slice();
    else {battle.player.hand=hand(['S2','C3']);enemy.hand=hand(['SK','HK','DK']);battle.player.shieldCharges=1;}
    battle.compareEnemy(enemy);assert.equal(battle.getState().endlessAccounting.resonancePoints,0,type);
  }
});

test('swordsman redirected damage scores once and credits the actual damaged instance',()=>{
  const {battle,hand}=setup(['swordsman','gambler','werewolf']);const protector=battle.enemies[0],target=battle.enemies[1];
  protector.hp=1;target.hp=1;target.hand=hand(['S2','C3']);battle.player.hand=hand(['SK','HK','DK']);
  const result=battle.compareEnemy(target);assert.equal(result.damage,0);assert.equal(target.hp,1);
  const state=battle.getState().endlessAccounting;assert.equal(state.defeatedCount,1);assert.equal(state.resonancePoints,4);
  const events=state.events.filter(e=>e.type==='resonance-scored');assert.equal(events.length,1);
  assert.equal(events[0].enemyInstanceId,protector.instanceId);assert.equal(events[0].actualDamage,1);
  assert.equal(events[0].actionId,state.events.find(e=>e.type==='npc-defeated').actionId);
});

test('ledger guards unique instances and actions; snapshots cannot mutate accounting',()=>{
  const {battle}=setup();const ledger=battle.endlessLedger;
  ledger.recordDefeat('a','one','goblin',false);ledger.recordDefeat('b','one','goblin',false);
  ledger.recordResonance('hit','one',8,1);ledger.recordResonance('hit','other',8,1);
  assert.equal(ledger.getState().defeatedCount,1);assert.equal(ledger.getState().resonancePoints,8);
  const snapshot=ledger.getState();snapshot.events[0].coins=900;snapshot.nextItemPrices.heal_potion=0;
  assert.equal(ledger.getState().events[0].coins,25);assert.equal(ledger.getState().nextItemPrices.heal_potion,20);
});

test('5-kill HP and 10-kill attack growth wait until next round; survivors and thresholds persist',()=>{
  const {battle}=setup();const survivor=battle.enemies[2];survivor.hp=2;
  const threshold=battle.enemyPassiveHpThreshold(survivor.id);registerKills(battle,5);
  let state=battle.getState().endlessAccounting;assert.equal(state.stage,0);assert.equal(state.nextStage,1);
  assert.equal(state.nextItemPrices.heal_potion,25);
  battle.enemies[0].hp=0;battle.enemies[0].defeated=true;battle.phase='round-result';skipShop(battle);battle.nextRound();
  state=battle.getState().endlessAccounting;assert.equal(state.stage,1);assert.equal(state.attackBonus,0);
  const {ENEMY_CONFIGS}=setup().r.load('src/game/data/enemies.ts');
  assert.equal(battle.enemies[0].maxHp,ENEMY_CONFIGS[battle.enemies[0].id].maxHp+2);
  assert.equal(survivor.hp,2);assert.equal(battle.enemyPassiveHpThreshold(survivor.id),threshold);
  registerKills(battle,10);state=battle.getState().endlessAccounting;
  assert.equal(state.defeatedCount,10);assert.equal(state.attackBonus,0);assert.equal(state.nextAttackBonus,1);
  const before=battle.enemyAttackBonus(survivor);battle.phase='round-result';skipShop(battle);battle.nextRound();
  assert.equal(battle.enemyAttackBonus(survivor),before+1);assert.equal(battle.getState().endlessAccounting.stage,2);
  assert.equal(battle.getState().endlessAccounting.events.filter(e=>e.type==='endless-stage-changed').length,2);
});

test('growth applies as flat incoming damage and can be fully shielded',()=>{
  const {battle,hand}=setup();registerKills(battle,10);battle.phase='round-result';skipShop(battle);battle.nextRound();
  const enemy=battle.enemies[0];enemy.hand=hand(['SK','HK','DK']);battle.player.hand=hand(['S2','C3']);
  const hp=battle.player.hp;const result=battle.compareEnemy(enemy);
  assert.equal(result.damage,5);assert.equal(battle.player.hp,hp-5);
  battle.player.shieldCharges=1;const shield=battle.compareEnemy(enemy);assert.equal(shield.damage,0);assert.equal(shield.shielded,true);
});

test('formal battles have no endless accounting or extra damage',()=>{
  const {battle}=setup(undefined,'formal');assert.equal(battle.endlessLedger,undefined);
  assert.equal(battle.getState().endlessAccounting,undefined);
});

test('resonance records 2, 3, 4 and 8 without multiplying fate-mode points',()=>{
  for(const [codes,points] of [[['S4','S5'],2],[['S2','S3','S4'],3],[['SK','HK','DK'],4],[['SK','HK','DK','CK'],8]]) {
    const {battle,hand}=setup();const enemy=battle.enemies[0];enemy.hp=20;enemy.hand=hand(['S2','C3']);
    battle.player.hand=hand(codes);battle.player.fateMode=true;battle.compareEnemy(enemy);
    assert.equal(battle.getState().endlessAccounting.resonancePoints,points);
  }
});

test('nonlethal redirected hit scores once without registering a defeat',()=>{
  const {battle,hand}=setup(['swordsman','gambler','werewolf']);const target=battle.enemies[1];
  battle.enemies[0].hp=10;target.hp=1;target.hand=hand(['S2','C3']);battle.player.hand=hand(['SK','HK','DK']);
  battle.compareEnemy(target);const state=battle.getState().endlessAccounting;
  assert.equal(state.defeatedCount,0);assert.equal(state.resonancePoints,4);assert.equal(battle.enemies[0].hp,6);
});
