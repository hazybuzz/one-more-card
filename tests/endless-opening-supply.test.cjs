const assert=require('node:assert/strict');
const {test}=require('node:test');
const {runtime}=require('./helpers/typescript-runtime.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
function setup(){const r=runtime({saved:{soulCoins:5000,ownedItems:{heal_potion:5}}});
 for(const theme of ['evernight_tavern','northern_longhouse','dragon_gate','edo_teahouse'])for(const difficulty of [1,2,3])r.progress.recordFormalTableResult('victory',theme,difficulty);
 const paid=r.progress.reserveEndlessEntry('opening');const {BattleEngine}=r.load('src/game/engine/BattleEngine.ts');
 const b=new BattleEngine({mode:'endless',runId:'opening',endlessSeed:42,startingSupplyCoins:paid.session.startingSupplyCoins});
 const valid=s=>r.load('src/game/endless/EndlessSnapshot.ts').validEndlessSnapshot(s,'opening');
 const restore=s=>new BattleEngine({mode:'endless',endlessSnapshot:s});return{r,b,valid,restore};}
test('new paid run shops before dealing or passives and cannot reveal cards early',()=>{
 const {r,b,valid}=setup();assert.equal(r.progress.getProgress().soulCoins,4900);assert.equal(b.round,0);assert.equal(b.player.hand.length,0);
 assert.equal(b.enemies.length,3);assert(b.enemies.every(n=>n.hand.length===0&&!n.passiveTriggeredThisRound));
 assert.equal(b.getState().endlessAccounting.wallet,70);assert(valid(b.exportEndlessSnapshot()));
 const before=plain(b.exportEndlessSnapshot());b.chooseViewHand();b.chooseFate();b.revealByItem();assert.deepEqual(plain(b.exportEndlessSnapshot()),before);
 assert(b.finishEndlessShopVisit(0));assert.equal(b.round,1);assert.equal(b.player.hand.length,2);assert.equal(b.getState().endlessAccounting.shop.completedVisits,0);
 assert(!b.finishEndlessShopVisit(0));assert.equal(b.round,1);assert(valid(b.exportEndlessSnapshot()));
});
test('opening purchase stock and exact RNG survive reload; first odd kill still earns a shop',()=>{
 const {r,b,valid,restore}=setup();assert(b.buyEndlessItem('holy_shield',0).bought);assert(b.buyEndlessItem('heal_potion',0).bought);
 assert(!b.buyEndlessItem('cooling_charm',0).bought);assert.equal(b.getState().endlessAccounting.wallet,5);assert.equal(r.progress.getProgress().ownedItems.heal_potion,5);
 const saved=b.exportEndlessSnapshot();assert(valid(saved));const again=restore(saved);assert.deepEqual(plain(again.exportEndlessSnapshot()),plain(saved));
 assert(!again.buyEndlessItem('holy_shield',0).bought);assert(again.finishEndlessShopVisit(0));assert(b.finishEndlessShopVisit(0));assert.deepEqual(plain(again.exportEndlessSnapshot()),plain(b.exportEndlessSnapshot()));
 again.endlessLedger.recordDefeat('a','dead','goblin',false);again.phase='round-result';assert(again.openEndlessShop());assert.equal(again.getState().endlessAccounting.shop.visit.id,1);
 assert.equal(again.getState().endlessAccounting.shop.visit.stock.holy_shield,1);assert.equal(again.getState().endlessAccounting.wallet,30);
});
test('saved opening commits purchases, restores them, and rolls back a failed first-round write',()=>{
 const {r,b,restore}=setup();const claim=r.progress.claimEndlessRun('opening','owner');let revision=claim.session.revision;
 const commit=s=>{const result=r.progress.saveEndlessBattle('opening','owner',revision,s);if(result.status!=='saved')throw Error('save failed');revision=result.session.revision;};
 commit(b.exportEndlessSnapshot());b.configureEndlessPersistence({before:()=>{},commit});assert(b.buyEndlessItem('holy_shield',0).bought);
 const saved=r.progress.getProgress().endlessSession.snapshot;assert.deepEqual(plain(restore(saved).exportEndlessSnapshot()),plain(b.exportEndlessSnapshot()));
 const before=plain(b.exportEndlessSnapshot());r.failWrite();assert.throws(()=>b.finishEndlessShopVisit(0));assert.deepEqual(plain(b.exportEndlessSnapshot()),before);
 r.failWrite(false);assert(b.finishEndlessShopVisit(0));assert.equal(b.round,1);
});
test('supply is spent first, never cashed out, and zero-kill purchased exits pay zero exactly once',()=>{
 const {r,b,valid}=setup();const rules=r.load('src/game/endless/EndlessRules.ts');
 assert.deepEqual(plain(rules.calculateEndlessBalance(75,65,70)),{supplyRemaining:5,cashWallet:75,wallet:80});
 assert.equal(rules.calculateEndlessSettlement(3,3,65,70).total,111);assert.equal(rules.calculateEndlessSettlement(3,3,100,70).total,81);
 assert.equal(rules.calculateEndlessSettlement(0,0,0,70).total,0);
 assert(b.buyEndlessItem('holy_shield',0).bought);assert(b.buyEndlessItem('heal_potion',0).bought);assert(b.endEndlessRun());assert(valid(b.exportEndlessSnapshot()));
 const {summarizeEndlessRun}=r.load('src/game/endless/EndlessSettlement.ts');
 const summary=summarizeEndlessRun('opening', b.round, b.getState().endlessAccounting, 'exit');assert.equal(summary.total,0);
 const result=r.progress.settleEndlessProgress(summary);assert.equal(result.status,'settled');assert.equal(r.progress.getProgress().soulCoins,4900);
 assert.equal(r.progress.settleEndlessProgress(summary).status,'already-settled');
});
test('legacy paid reservations and snapshots receive no retroactive supply or opening',()=>{
 const {r,b,valid,restore}=setup();const {BattleEngine}=r.load('src/game/engine/BattleEngine.ts');
 const legacy=new BattleEngine({mode:'endless',runId:'opening',endlessSeed:42});const snapshot=plain(legacy.exportEndlessSnapshot());
 delete snapshot.ledger.startingSupplyCoins;delete snapshot.ledger.shop.openingCompleted;assert(valid(snapshot));const old=restore(snapshot);
 assert.equal(old.round,1);assert.equal(old.getState().endlessAccounting.startingSupplyCoins,0);assert.equal(old.getState().endlessAccounting.shop.visit,undefined);
 const progress=plain(r.progress.getProgress());progress.endlessSession.wallet=0;delete progress.endlessSession.startingSupplyCoins;
 const reloaded=runtime({saved:progress});assert.equal(reloaded.progress.reserveEndlessEntry('another').status,'resumed');assert.equal(reloaded.progress.getProgress().endlessSession.wallet,0);
 const bad=plain(b.exportEndlessSnapshot());bad.player.hand=[{suit:'spades',rank:2}];assert(!valid(bad));
});
