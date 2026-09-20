const assert=require('node:assert/strict');
const {test}=require('node:test');
const {runtime}=require('./helpers/typescript-runtime.cjs');
const {simulator}=require('./helpers/endless-simulation.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
test('80 complete seeded mixed-theme runs have valid snapshots, bounded wallets and no stalled rounds',()=>{
 const {run,config}=simulator();
 for(const policy of ['none','adaptive','shield','offense'])for(let seed=1;seed<=20;seed++){
  const r=run(seed,policy,{validate:true});assert(!r.capped);assert(r.spent<=r.kills*config.coinsPerDefeat+config.startingSupplyCoins);
  assert(r.payout<=r.kills*45);assert(r.net>=-config.entryCost);assert.equal(r.finalSnapshot.endlessEndReason,'defeat');
 }
});
test('repeated reloads reproduce an uninterrupted complete run including passive RNG, accounting and items',()=>{
 const {run}=simulator();
 for(const policy of ['adaptive','shield','offense'])for(let seed=1;seed<=12;seed++){
  const a=run(seed,policy,{validate:true}), b=run(seed,policy,{validate:true,restoreEvery:3});
  assert.deepEqual(plain(b),plain(a),'seed '+seed+' / '+policy);
 }
});
test('economy price tuning leaves already-open shop prices fixed across restore and uses new prices next window',()=>{
 const r=runtime(), {BattleEngine}=r.load('src/game/engine/BattleEngine.ts');
 const b=new BattleEngine({mode:'endless',runId:'pricing',endlessSeed:2});
 for(let n=0;n<3;n++)b.endlessLedger.recordDefeat('a'+n,'e'+n,'goblin',false);
 b.phase='round-result';b.openEndlessShop();const snapshot=b.exportEndlessSnapshot();
 snapshot.ledger.shop.visit.prices.holy_shield=55;snapshot.ledger.shop.visit.prices.resonance_dust=35;
 const restored=new BattleEngine({mode:'endless',endlessSnapshot:snapshot});
 assert.equal(restored.getState().endlessAccounting.shop.visit.prices.holy_shield,55);
 while(restored.endlessLedger.shop.isOpen)restored.finishEndlessShopVisit(restored.getState().endlessAccounting.shop.visit.id);
 for(let n=3;n<5;n++)restored.endlessLedger.recordDefeat('a'+n,'e'+n,'goblin',false);
 restored.openEndlessShop();assert.equal(restored.getState().endlessAccounting.shop.visit.prices.holy_shield,50);
 assert.equal(restored.getState().endlessAccounting.shop.visit.prices.resonance_dust,35);
});
test('all four formal themes and three difficulties retain HP, victory and absent endless state',()=>{
 const r=runtime(),{BattleEngine}=r.load('src/game/engine/BattleEngine.ts'),{TABLE_THEMES}=r.load('src/game/data/tableThemes.ts');
 const hand=['S9','H9','D9','C9'].map(r.load('src/game/card.ts').cardFromCode);
 for(const theme of TABLE_THEMES)for(const difficulty of [1,2,3]){
  const b=new BattleEngine({mode:'formal',tableThemeConfig:theme,stakeMultiplier:difficulty});
  assert.equal(b.player.maxHp,theme.playerHp);assert.equal(b.enemies.length,3);assert.equal(b.endlessLedger,undefined);
  for(let turns=0;!b.battleOutcome&&turns<30;turns++){
   if(b.pendingSoulRedeem)b.resolveSoulRedeem();else if(b.pendingEnemySoulRedeem)b.resolveEnemySoulRedeem();
   else if(b.phase==='choice'){b.player.hand=hand.map(c=>({...c}));b.chooseViewHand();}
   else if(b.phase==='enemy-turn')b.compareCurrentEnemy();else if(b.phase==='player-turn')b.playerStand();else if(b.phase==='round-result')b.nextRound();
  }
  assert.equal(b.battleOutcome,'victory',theme.id+' / '+difficulty);assert.equal(b.getState().endlessAccounting,undefined);
 }
});
test('every first-chapter lesson starts its original scripted cards and keeps its mechanic restrictions',()=>{
 const r=runtime(),{BattleEngine}=r.load('src/game/engine/BattleEngine.ts'),{CHAPTER_ONE_LEVELS}=r.load('src/game/data/chapterOne.ts');
 const card=r.load('src/game/card.ts').cardFromCode;
 for(const level of CHAPTER_ONE_LEVELS){
  const b=new BattleEngine({mode:'story',levelId:level.id});assert.equal(b.levelConfig.id,level.id);assert.equal(b.player.maxHp,level.playerHp);
  if(level.fixedRounds?.length)assert.deepEqual(plain(b.player.hand),plain(level.fixedRounds[0].playerCards.map(card)));
  assert.equal(b.endlessLedger,undefined);assert.equal(b.getState().endlessAccounting,undefined);
  if(!level.unlockedMechanics.includes('skills'))assert.equal(b.useResonanceShift().used,false);
 }
 const skill=new BattleEngine({levelId:'chapter1_6'});assert(skill.isSkillAvailable('resonance_shift'));assert.equal(skill.isSkillAvailable('resonance_summon'),false);
 skill.round=2;assert(skill.isSkillAvailable('resonance_shift'));assert(skill.isSkillAvailable('resonance_summon'));
});
test('outside purchases and PvP economics keep their prices, inventory and formal-stat isolation',()=>{
 const r=runtime({saved:{soulCoins:1000}}), economy=r.load('src/game/economy.ts');
 const before=plain(r.progress.getProgress().formalTableStats);r.progress.spendSoulCoins('item_purchase',20,{itemId:'heal_potion'});r.progress.addItem('heal_potion');
 assert.equal(r.progress.getProgress().soulCoins,980);assert.equal(r.progress.getProgress().ownedItems.heal_potion,1);
 economy.settlePvpDuelEconomy('victory');assert.equal(r.progress.getProgress().soulCoins,1000);
 economy.settlePvpDuelEconomy('defeat');assert.equal(r.progress.getProgress().soulCoins,980);assert.deepEqual(plain(r.progress.getProgress().formalTableStats),before);
 assert.equal(r.progress.getProgress().endlessSession,undefined);
});
test('PvP ready, private hands, item restriction, draw limit and round scoring remain independent',()=>{
 const r=runtime(), rules=r.load('src/game/pvp/PvpRules.ts');const room=rules.createPvpRoom('qa-room','host','Host',1000);
 assert(rules.joinPvpRoom(room,'guest','Guest',1000).ok);rules.setPvpReady(room,'host',1000);rules.setPvpReady(room,'guest',1000);
 assert.equal(room.phase,'playing');const view=rules.createPublicPvpState(room,'host',1000);
 assert(view.players.find(p=>p.id==='host').hand.length===2);assert(view.players.find(p=>p.id==='guest').hand.some(c=>c.hidden&&!c.card));
 assert.equal(rules.applyPvpAction(room,'host',{type:'use-item',itemId:'holy_shield'},1000).ok,false);
 assert(rules.applyPvpAction(room,'host',{type:'draw'},1000).ok);assert(rules.applyPvpAction(room,'host',{type:'draw'},1000).ok);
 assert.equal(rules.applyPvpAction(room,'host',{type:'draw'},1000).ok,false);
 assert(rules.applyPvpAction(room,'host',{type:'stand'},1000).ok);assert(rules.applyPvpAction(room,'guest',{type:'stand'},1000).ok);
 assert(room.lastRoundResult);assert.equal(r.progress.getProgress().endlessSession,undefined);
});
test('100 successive replenishments survive late growth, keep unique instances and preserve valid save state',()=>{
 const r=runtime(),{BattleEngine}=r.load('src/game/engine/BattleEngine.ts'),{validEndlessSnapshot}=r.load('src/game/endless/EndlessSnapshot.ts');
 const b=new BattleEngine({mode:'endless',runId:'late-growth',endlessSeed:777});const instances=new Set();
 for(let round=0;round<100;round++){
  for(const enemy of b.enemies){assert(!instances.has(enemy.instanceId));instances.add(enemy.instanceId);enemy.hp=0;b.applyDefeatAndReward(enemy);}
  b.phase='round-result';b.openEndlessShop();while(b.endlessLedger.shop.isOpen)b.finishEndlessShopVisit(b.getState().endlessAccounting.shop.visit.id);
  b.nextRound();assert(validEndlessSnapshot(b.exportEndlessSnapshot(),'late-growth'));
  assert.equal(b.enemies.length,3);assert(b.enemies.every(e=>!e.defeated&&e.hp===e.maxHp));
 }
 assert.equal(b.getState().endlessAccounting.defeatedCount,300);assert.equal(b.endlessLedger.currentStage,60);assert.equal(b.endlessLedger.currentAttackBonus,30);
});
test('stale ordinary writes cannot refund entry fees, erase settlement coins or lose economic transactions',()=>{
 const r=runtime({saved:{soulCoins:1000,ownedCosmetics:['thunder_hammer']}});const old=runtime({storage:r.storage});
 for(const theme of ['evernight_tavern','northern_longhouse','dragon_gate','edo_teahouse'])for(const d of [1,2,3])r.progress.recordFormalTableResult('victory',theme,d);
 r.progress.reserveEndlessEntry('currency-run');old.progress.recordBattleResult('victory');
 assert.equal(old.progress.getProgress().soulCoins,900);assert.equal(old.progress.getProgress().economyStats.spendingBySink.endless_entry,100);
 old.progress.spendSoulCoins('item_purchase',10);old.progress.addItem('heal_potion');assert.equal(old.progress.getProgress().soulCoins,890);
 const stale=runtime({storage:r.storage});const {summarizeEndlessRun}=r.load('src/game/endless/EndlessSettlement.ts');
 const {BattleEngine}=r.load('src/game/engine/BattleEngine.ts');const b=new BattleEngine({mode:'endless',runId:'currency-run',endlessSeed:2});b.endlessLedger.recordDefeat('a','dead','goblin',false);
 const summary=summarizeEndlessRun('currency-run',1,b.getState().endlessAccounting,'exit');assert.equal(r.progress.settleEndlessProgress(summary).status,'settled');
 stale.progress.equipAttackEffect('thunder_hammer');assert.equal(stale.progress.getProgress().soulCoins,925);
 assert.equal(stale.progress.getProgress().lastEndlessSettlement.runId,'currency-run');assert.equal(stale.progress.getProgress().endlessBestScore.runId,'currency-run');
 assert.equal(stale.progress.getProgress().economyTransactions.filter(t=>t.category==='endless_settlement').length,1);
 stale.progress.grantSoulCoins('story_first_clear',25);assert.equal(stale.progress.getProgress().soulCoins,950);assert.equal(stale.progress.getProgress().ownedItems.heal_potion,1);
});
test('reused battle scene clears item overlays and shield/death display overrides before creating a new battle',()=>{
 const r=runtime({external:{phaser:{default:{Scene:class{}}}}}),{BattleScene}=r.load('src/scenes/BattleScene.ts');const scene=new BattleScene();
 Object.assign(scene,{itemModalOpen:true,itemFeedback:{title:'old'},visualHpOverride:{player:0,enemies:[0,0,0]},visualEnemyDefeated:[true,true,true],visualPlayerShieldChargesOverride:2,dealtPlayerCards:4,dealtEnemyCards:[4,4,4]});
 scene.revealFocusPendingEnemyIds.add('old');scene.resetTransientPresentationState();
 assert.equal(scene.itemModalOpen,false);assert.equal(scene.itemFeedback,undefined);assert.equal(scene.visualHpOverride,undefined);
 assert.equal(scene.visualEnemyDefeated,undefined);assert.equal(scene.visualPlayerShieldChargesOverride,undefined);assert.equal(scene.revealFocusPendingEnemyIds.size,0);
 assert.equal(scene.dealtPlayerCards,0);assert.deepEqual(plain(scene.dealtEnemyCards),[0,0,0]);
});
