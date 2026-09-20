const assert=require('node:assert/strict');const {test}=require('node:test');
const {runtime}=require('./helpers/typescript-runtime.cjs');const plain=v=>JSON.parse(JSON.stringify(v));
function setup(){const r=runtime(),{BattleEngine}=r.load('src/game/engine/BattleEngine.ts'),{cardFromCode}=r.load('src/game/card.ts');return{r,BattleEngine,cards:codes=>codes.map(cardFromCode),use:r.load('src/game/itemEffects.ts').useBattleItem};}
test('dice changes points while preserving ordinary, strong, triple and quadruple resonance and jokers',()=>{
 const {r,cards}=setup(),{rerollResonancePoint}=r.load('src/game/resonanceReroll.ts'),{scoreHand}=r.load('src/game/scoring.ts');
 const hands=[cards(['S2','S5']),cards(['S3','H3']),cards(['S2','S3','S7']),cards(['S4','H4','D4']),cards(['S4','H4','D4','C4']),[{rank:'小王'},{rank:'大王'}],[...cards(['S3','S8']),{rank:'小王'}]];
 for(const hand of hands)for(let i=0;i<100;i++){let n=i;const result=rerollResonancePoint(hand,()=>((n++*37)%100)/100);assert(result);const before=scoreHand(hand),after=scoreHand(result);assert.notEqual(after.point,before.point);assert.equal(after.resonance,before.resonance);assert.equal(after.multiplier,before.multiplier);assert.equal(result.length,hand.length);}
 assert.equal(rerollResonancePoint(cards(['S2','H5'])),undefined);assert.equal(rerollResonancePoint([]),undefined);
});
test('UI and logic require existing resonance on the player turn; success keeps turn, cooldowns and penalties',()=>{
 const {r,BattleEngine,cards,use}=setup(),b=new BattleEngine();const {canUseBattleItemFromState}=r.load('src/ui/state/UIState.ts');
 b.player.hand=cards(['S2','S5']);for(const phase of ['choice','enemy-turn','round-result']){b.phase=phase;assert(!use('resonance_dice',b).used);assert(!canUseBattleItemFromState('resonance_dice',b.getState()));}
 b.phase='player-turn';b.player.hand=cards(['S2','H5']);assert(!use('resonance_dice',b).used);assert(!canUseBattleItemFromState('resonance_dice',b.getState()));
 b.player.hand=cards(['S2','S5']);Object.assign(b.player,{resonanceShiftCooldown:2,resonanceSummonCooldown:1,drawLocked:true,incomingDamageBonus:1});const before=plain(b.player);assert(canUseBattleItemFromState('resonance_dice',b.getState()));assert(use('resonance_dice',b).used);assert.equal(b.phase,'player-turn');
 const after=plain(b.player);delete before.hand;delete after.hand;assert.deepEqual(after,before);
});
test('endless dice consumes local inventory, survives reload with seeded RNG and rolls back failed saves',()=>{
 const {r,BattleEngine,cards,use}=setup();const b=new BattleEngine({mode:'endless',runId:'dice',endlessSeed:123,startingSupplyCoins:70});
 assert(b.buyEndlessItem('resonance_dice',0).bought);assert.equal(b.getState().endlessAccounting.wallet,45);assert(b.finishEndlessShopVisit(0));b.phase='player-turn';b.player.hand=cards(['S2','S5']);
 const before=b.exportEndlessSnapshot();const {validEndlessSnapshot}=r.load('src/game/endless/EndlessSnapshot.ts');assert(validEndlessSnapshot(before,'dice'));
 const restored=new BattleEngine({mode:'endless',endlessSnapshot:before});assert(use('resonance_dice',b).used);assert(use('resonance_dice',restored).used);assert.deepEqual(plain(b.exportEndlessSnapshot()),plain(restored.exportEndlessSnapshot()));assert.equal(b.getState().endlessAccounting.shop.ownedItems.resonance_dice,undefined);
 const failing=new BattleEngine({mode:'endless',endlessSnapshot:before});failing.configureEndlessPersistence({before:()=>{},commit:()=>{throw Error('write denied');}});assert(!use('resonance_dice',failing).used);assert.deepEqual(plain(failing.exportEndlessSnapshot()),plain(before));
});
test('old saved shops with four products remain valid and do not grant free dice stock',()=>{
 const {r,BattleEngine}=setup(),b=new BattleEngine({mode:'endless',runId:'legacy',endlessSeed:123,startingSupplyCoins:70});const saved=plain(b.exportEndlessSnapshot());delete saved.ledger.shop.visit.stock.resonance_dice;delete saved.ledger.shop.visit.prices.resonance_dice;
 const {validEndlessSnapshot}=r.load('src/game/endless/EndlessSnapshot.ts');assert(validEndlessSnapshot(saved,'legacy'));const restored=new BattleEngine({mode:'endless',endlessSnapshot:saved});assert.equal(restored.getState().endlessAccounting.shop.visit.stock.resonance_dice,0);assert(!restored.buyEndlessItem('resonance_dice',0).bought);assert(validEndlessSnapshot(restored.exportEndlessSnapshot(),'legacy'));
});
