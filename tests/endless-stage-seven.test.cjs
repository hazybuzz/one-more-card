const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
function setup(storage) {
  const r = runtime({ storage, saved: storage ? undefined : { soulCoins: 5000 } });
  if (!storage) {
    for (const theme of ['evernight_tavern','northern_longhouse','dragon_gate','edo_teahouse'])
      for (const difficulty of [1,2,3]) r.progress.recordFormalTableResult('victory',theme,difficulty);
    assert.equal(r.progress.reserveEndlessEntry('saved-run').status,'created');
  }
  const { BattleEngine } = r.load('src/game/engine/BattleEngine.ts');
  const battle = new BattleEngine({mode:'endless',runId:'saved-run',endlessSeed:42});
  const valid = snapshot => r.load('src/game/endless/EndlessSnapshot.ts').validEndlessSnapshot(snapshot,'saved-run');
  const restore = snapshot => new BattleEngine({mode:'endless',endlessSnapshot:snapshot});
  return {r,battle,valid,restore};
}
function attach(s,owner='window-a') {
  const claimed=s.r.progress.claimEndlessRun('saved-run',owner); assert.equal(claimed.status,'saved');
  let revision=claimed.session.revision;
  const commit=snapshot=>{const result=s.r.progress.saveEndlessBattle('saved-run',owner,revision,snapshot); assert.equal(result.status,'saved'); revision=result.session.revision;};
  commit(s.battle.exportEndlessSnapshot());
  s.battle.configureEndlessPersistence({before:()=>assert.equal(s.r.progress.checkEndlessOwner('saved-run',owner,revision).status,'saved'),commit});
  return {owner,commit};
}
function kills(battle,count=3) {
  for(let i=0;i<count;i++) battle.endlessLedger.recordDefeat('attack'+i,'dead'+i,'goblin',false);
  battle.endlessLedger.recordResonance('resonance','dead0',3,1);
}
test('full initial snapshot restores deck, random state, cards and next decisions without reapplying passives',()=>{
  const s=setup(); const snapshot=s.battle.exportEndlessSnapshot(); assert(s.valid(snapshot));
  const restored=s.restore(snapshot); assert.deepEqual(plain(restored.exportEndlessSnapshot()),plain(snapshot));
  s.battle.chooseViewHand(); restored.chooseViewHand();
  s.battle.inviteCurrentEnemy(); restored.inviteCurrentEnemy();
  assert.deepEqual(plain(restored.exportEndlessSnapshot()),plain(s.battle.exportEndlessSnapshot()));
});
test('passive relationships, cooldowns, shields and redemption usage survive restoration',()=>{
  const s=setup(); const b=s.battle;
  Object.assign(b.player,{shieldCharges:2,soulRedeemUsed:true,resonanceShiftCooldown:2,resonanceSummonCooldown:1});
  Object.assign(b.enemies[0],{smokeScreenArmed:true,attackBonus:2,iaijutsuStacks:3,hanamiDamageBank:4});
  const snapshot=b.exportEndlessSnapshot(); assert(s.valid(snapshot));
  assert.deepEqual(plain(s.restore(snapshot).exportEndlessSnapshot()),plain(snapshot));
});
test('active shop restores frozen prices, purchase limits, inventory, ledger and deduplication',()=>{
  const s=setup(); kills(s.battle); s.battle.phase='round-result'; s.battle.openEndlessShop();
  const id=s.battle.getState().endlessAccounting.shop.visit.id;
  assert(s.battle.buyEndlessItem('heal_potion',id).bought);
  const snapshot=s.battle.exportEndlessSnapshot(); assert(s.valid(snapshot)); const b=s.restore(snapshot);
  assert.deepEqual(plain(b.exportEndlessSnapshot()),plain(snapshot));
  b.endlessLedger.recordDefeat('replay','dead0','goblin',false); b.endlessLedger.recordResonance('resonance','dead0',3,1);
  assert.equal(b.getState().endlessAccounting.defeatedCount,3); assert.equal(b.getState().endlessAccounting.resonancePoints,3);
  assert.equal(b.buyEndlessItem('heal_potion',id).bought,false);
});
test('interrupted beer feedback saves one heal and consumption; resumed reveal does not repeat them',()=>{
  const s=setup(); kills(s.battle); s.battle.phase='round-result';s.battle.openEndlessShop();
  s.battle.buyEndlessItem('heal_potion',1);while(s.battle.endlessLedger.shop.isOpen)s.battle.finishEndlessShopVisit(s.battle.getState().endlessAccounting.shop.visit.id);
  s.battle.phase='choice';s.battle.player.hp=5;attach(s);
  const result=s.r.load('src/game/itemEffects.ts').useBattleItem('heal_potion',s.battle);assert(result.used);
  const saved=s.r.progress.getProgress().endlessSession.snapshot;assert(saved.pendingItemReveal);assert.equal(saved.player.hp,8);
  const b=s.restore(saved);b.revealByItem();assert.equal(b.player.hp,8);assert.equal(b.pendingItemReveal,false);assert.equal(b.endlessLedger.shop.inventoryCount,0);
});
test('pending soul redemption resumes once and keeps whole-run usage',()=>{
  const s=setup();s.battle.player.hp=0;s.battle.updateBattleOutcome();assert(s.battle.pendingSoulRedeem);
  const b=s.restore(s.battle.exportEndlessSnapshot());b.resolveSoulRedeem();assert.equal(b.player.hp,3);assert(b.player.soulRedeemUsed);
  b.resolveSoulRedeem();assert.equal(b.player.hp,3);b.player.hp=0;b.updateBattleOutcome();assert.equal(b.endlessEndReason,'defeat');
});
test('failed action storage rolls back logical state and RNG, then permits retry',()=>{
  const s=setup(); const {owner}=attach(s);const before=plain(s.battle.exportEndlessSnapshot());const saved=s.r.storage.get(s.r.key);
  s.r.failWrite();assert.throws(()=>s.battle.chooseViewHand());assert.deepEqual(plain(s.battle.exportEndlessSnapshot()),before);assert.equal(s.r.storage.get(s.r.key),saved);
  s.r.failWrite(false);s.battle.chooseViewHand();assert.equal(s.r.progress.getProgress().endlessSession.snapshot.phase,s.battle.phase);
  assert.equal(s.r.progress.getProgress().endlessSession.owner.id,owner);
});
test('reload resumes paid session and saved actions without a second entry charge',()=>{
  const s=setup();attach(s);s.battle.chooseViewHand(); const second=setup(s.r.storage);
  const entry=second.r.progress.reserveEndlessEntry('replacement');assert.equal(entry.status,'resumed');assert.equal(second.r.progress.getProgress().soulCoins,4900);
  assert.deepEqual(plain(second.restore(entry.session.snapshot).exportEndlessSnapshot()),plain(s.battle.exportEndlessSnapshot()));
});
test('ended snapshot reload settles exactly once and records best without touching formal stats',()=>{
  const s=setup();kills(s.battle); const {owner}=attach(s);const stats=plain(s.r.progress.getProgress().formalTableStats);s.battle.endEndlessRun();
  assert.equal(s.r.progress.getProgress().endlessSession.status,'ended');const summary=s.r.load('src/game/endless/EndlessSettlement.ts').summarizeEndlessRun('saved-run',s.battle.round,s.battle.getState().endlessAccounting,'exit');
  const next=setup(s.r.storage);assert.equal(next.r.progress.settleEndlessProgress(summary,owner).status,'settled');const balance=next.r.progress.getProgress().soulCoins;
  assert.equal(next.r.progress.settleEndlessProgress(summary,owner).status,'already-settled');assert.equal(next.r.progress.getProgress().soulCoins,balance);
  assert.deepEqual(plain(next.r.progress.getProgress().formalTableStats),stats);assert.equal(next.r.progress.getProgress().endlessBestScore.defeatedCount,3);
});
test('live owner blocks another window; expired owner is fenced and stale revisions cannot overwrite',()=>{
  const s=setup();attach(s);const other=setup(s.r.storage);
  assert.equal(other.r.progress.claimEndlessRun('saved-run','window-b').status,'busy');
  assert.equal(other.r.progress.claimEndlessRun('saved-run','window-b',Date.now()+20000).status,'saved');
  assert.equal(s.r.progress.checkEndlessOwner('saved-run','window-a',1).status,'stale');
  assert.equal(other.r.progress.saveEndlessBattle('saved-run','window-b',0,s.battle.exportEndlessSnapshot()).status,'stale');
});
test('corrupted active save is retained as invalid and cannot silently restart or charge again',()=>{
  const s=setup();attach(s);const saved=JSON.parse(s.r.storage.get(s.r.key));saved.endlessSession.snapshot.deck=null;s.r.storage.set(s.r.key,JSON.stringify(saved));
  const next=setup(s.r.storage);assert.equal(next.r.progress.getProgress().endlessSession.status,'invalid');
  assert.equal(next.r.progress.reserveEndlessEntry('new').status,'invalid-save');assert.equal(next.r.progress.getProgress().soulCoins,4900);
});
test('local best prioritizes kills, then resonance and preserves exact ties across reload',()=>{
  const s=setup();const summarize=s.r.load('src/game/endless/EndlessSettlement.ts').summarizeEndlessRun;
  function settle(id,k,r){if(id!=='saved-run')assert.equal(s.r.progress.reserveEndlessEntry(id).status,'created'); const b=s.restore(s.battle.exportEndlessSnapshot());kills(b,k);b.endlessLedger.recordResonance('more','dead0',r,1);const sum=summarize(id,2,b.getState().endlessAccounting,'exit');assert.equal(s.r.progress.settleEndlessProgress(sum).status,'settled');}
  settle('saved-run',3,4);settle('less',2,100);assert.equal(s.r.progress.getProgress().endlessBestScore.runId,'saved-run');
  settle('higher-r',3,8);assert.equal(s.r.progress.getProgress().endlessBestScore.runId,'higher-r');settle('tie',3,8);assert.equal(s.r.progress.getProgress().endlessBestScore.runId,'higher-r');
  settle('higher-k',4,2);assert.equal(setup(s.r.storage).r.progress.getProgress().endlessBestScore.runId,'higher-k');
});
test('Web Locks holds a single controller, releases on exit and permits continuation',async()=>{
  let locked=false;
  const navigator={locks:{request:async(name,options,callback)=>{
    if(locked)return callback(null);locked=true;try{return await callback({name});}finally{locked=false;}
  }}};
  const s=setup();const a=runtime({storage:s.r.storage,globals:{navigator}}), b=runtime({storage:s.r.storage,globals:{navigator}});
  const A=a.load('src/game/endless/EndlessRunController.ts').EndlessRunController;
  const B=b.load('src/game/endless/EndlessRunController.ts').EndlessRunController;
  const first=await A.acquire('saved-run');assert.equal(first.status,'acquired');assert.equal((await B.acquire('saved-run')).status,'busy');
  first.controller.commit(s.battle.exportEndlessSnapshot());first.controller.release();await new Promise(resolve=>setImmediate(resolve));
  const next=await B.acquire('saved-run');assert.equal(next.status,'acquired');assert.equal(next.controller.session.status,'active');next.controller.release();
});
test('heartbeat and unrelated progress save preserve the latest snapshot and best receipt',()=>{
  const s=setup();const other=setup(s.r.storage);attach(s);s.battle.chooseViewHand();const saved=plain(s.r.progress.getProgress().endlessSession.snapshot);
  other.r.progress.recordFormalTableResult('victory','edo_teahouse',3);
  assert.deepEqual(JSON.parse(s.r.storage.get(s.r.key)).endlessSession.snapshot,saved);
  assert(s.r.progress.renewEndlessOwner('saved-run','window-a'));assert.deepEqual(plain(s.r.progress.getProgress().endlessSession.snapshot),saved);
});
test('snapshot access is isolated and invalid deck, seat or counters are rejected',()=>{
  const s=setup();const snapshot=s.battle.exportEndlessSnapshot();snapshot.player.hp=1;assert.equal(s.battle.player.hp,12);
  for(const change of [x=>x.enemies[0].seatIndex=2,x=>x.randomState=-1,x=>x.deck=null,x=>x.ledger.shop.spent=999]){
    const copy=s.battle.exportEndlessSnapshot();change(copy);assert.equal(s.valid(copy),false);
  }
});
