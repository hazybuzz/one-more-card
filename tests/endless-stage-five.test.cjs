const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');
function setup() {
  const r=runtime({saved:{soulCoins:900,ownedItems:{heal_potion:9,holy_shield:9,cooling_charm:9,resonance_dust:9}},
    external:{phaser:{default:{Scene:class {}}}}});
  const {BattleEngine}=r.load('src/game/engine/BattleEngine.ts');
  const battle=new BattleEngine({mode:'endless',enemyIds:['goblin','gambler','werewolf'],endlessSeed:42,runId:'shop'});
  const {useBattleItem}=r.load('src/game/itemEffects.ts');
  const {BattleScene}=r.load('src/scenes/BattleScene.ts');
  const scene=Object.create(BattleScene.prototype);scene.battle=battle;scene.temporaryItems={heal_potion:10};
  scene.battleItemUses=0;scene.battleItemUseCounts={};scene.textures={exists:()=>false};
  const card=r.load('src/game/card.ts').cardFromCode;
  return {r,battle,scene,use:(id)=>useBattleItem(id,battle),hand:(codes)=>codes.map(card)};
}
function kills(battle,count) {for(let i=0;i<count;i++)battle.endlessLedger.recordDefeat(`k${i}`,`enemy${i}`,'goblin',false);}
function visit(battle) {return battle.getState().endlessAccounting.shop.visit;}
function skipAll(battle) {while(visit(battle))battle.finishEndlessShopVisit(visit(battle).id);}
function stock(battle,count,items) {
  kills(battle,count);battle.phase='round-result';assert(battle.openEndlessShop());
  for(const id of items) {
    assert(battle.buyEndlessItem(id,visit(battle).id).bought);
    battle.finishEndlessShopVisit(visit(battle).id);
  }
  skipAll(battle);battle.nextRound();
}

test('first shop uses isolated wallet and bag; failed purchase does not debit anything',()=>{
  const {r,battle,scene}=setup();r.progress.getProgress();const external=JSON.stringify([...r.storage]);
  assert.equal(scene.totalBattleItemCount(),0);kills(battle,1);battle.phase='round-result';battle.nextRound();
  assert.equal(battle.round,1);assert.equal(visit(battle).prices.heal_potion,20);
  const before=JSON.stringify(battle.getState().endlessAccounting);
  assert.equal(battle.buyEndlessItem('holy_shield',visit(battle).id).reason,'not-enough-coins');
  assert.equal(JSON.stringify(battle.getState().endlessAccounting),before);
  assert(battle.buyEndlessItem('heal_potion',visit(battle).id).bought);
  const state=battle.getState().endlessAccounting;assert.equal(state.wallet,5);assert.equal(state.spentCoins,20);
  assert.equal(scene.battleItemCounts().heal_potion,1);assert.equal(JSON.stringify([...r.storage]),external);
  assert.equal(battle.buyEndlessItem('heal_potion',visit(battle).id).reason,'sold-out');
  assert.equal(battle.getState().endlessAccounting.spentCoins,20);
});

test('each visit has one stock per item and a two-purchase limit; next visit restocks once',()=>{
  const {battle}=setup();kills(battle,7);battle.phase='round-result';battle.openEndlessShop();const first=visit(battle).id;
  assert(battle.buyEndlessItem('heal_potion',first).bought);assert(battle.buyEndlessItem('cooling_charm',first).bought);
  assert.equal(battle.buyEndlessItem('resonance_dust',first).reason,'purchase-limit');
  assert.equal(battle.finishEndlessShopVisit(first),true);const second=visit(battle).id;
  assert.equal(visit(battle).purchases,0);assert.equal(visit(battle).stock.heal_potion,1);
  assert.equal(battle.finishEndlessShopVisit(first),false);assert.equal(visit(battle).id,second);
  assert.equal(battle.buyEndlessItem('heal_potion',first).reason,'stale-visit');
  battle.openEndlessShop();assert.equal(visit(battle).id,second);assert.equal(visit(battle).remaining,3);
});

test('total bag capacity counts individual items and blocks the fifth purchase without spending',()=>{
  const {battle}=setup();kills(battle,9);battle.phase='round-result';battle.openEndlessShop();
  for(let i=0;i<2;i++){const id=visit(battle).id;assert(battle.buyEndlessItem('heal_potion',id).bought);assert(battle.buyEndlessItem('cooling_charm',id).bought);battle.finishEndlessShopVisit(id);}
  const before=battle.getState().endlessAccounting.spentCoins;
  assert.equal(battle.getState().endlessAccounting.shop.inventoryCount,4);
  assert.equal(battle.buyEndlessItem('resonance_dust',visit(battle).id).reason,'inventory-full');
  assert.equal(battle.getState().endlessAccounting.spentCoins,before);
});

test('prices use shop-opening kills and remain frozen across opportunities in the same window',()=>{
  const {battle}=setup();kills(battle,5);battle.phase='round-result';battle.openEndlessShop();
  assert.equal(visit(battle).prices.holy_shield,50);const remaining=visit(battle).remaining;kills(battle,10);
  battle.openEndlessShop();assert.equal(visit(battle).prices.holy_shield,50);assert.equal(visit(battle).remaining,remaining);
  for(let i=0;i<remaining;i++)battle.finishEndlessShopVisit(visit(battle).id);
  assert.equal(visit(battle),undefined);battle.openEndlessShop();assert.equal(visit(battle).prices.holy_shield,55);
});

test('skipping all visits resumes replacement and dealing without awarding extra visits',()=>{
  const {battle,hand}=setup();battle.player.hand=hand(['SK','HK','DK']);
  for(const enemy of battle.enemies){enemy.hp=1;enemy.hand=hand(['S2','C3']);}
  battle.revealByItem();const ids=battle.enemies.map(e=>e.instanceId);battle.nextRound();
  assert.equal(battle.round,1);assert.equal(visit(battle).remaining,2);
  skipAll(battle);battle.nextRound();assert.equal(battle.round,2);assert.equal(battle.phase,'choice');
  assert(battle.enemies.every((e,i)=>e.instanceId!==ids[i]&&e.hand.length===2));
  assert.equal(battle.getState().endlessAccounting.shop.pendingVisits,0);assert.equal(battle.openEndlessShop(),false);
});

test('shop only opens at living safe round end; pending redemption blocks purchases',()=>{
  const {battle}=setup();kills(battle,1);assert.equal(battle.openEndlessShop(),false);
  battle.phase='round-result';battle.pendingSoulRedeem=true;assert.equal(battle.openEndlessShop(),false);
  assert.equal(battle.buyEndlessItem('heal_potion',1).reason,'closed');
  battle.pendingSoulRedeem=false;battle.player.hp=0;assert.equal(battle.openEndlessShop(),false);
  battle.player.hp=3;battle.battleOutcome='defeat';assert.equal(battle.openEndlessShop(),false);
});

test('redemption completes before pending shopping and does not skip opportunities',()=>{
  const {battle}=setup();kills(battle,3);battle.player.hp=0;battle.updateBattleOutcome();
  assert.equal(battle.pendingSoulRedeem,true);battle.resolveSoulRedeem();assert.equal(battle.player.hp,3);
  assert.equal(battle.round,1);assert.equal(battle.phase,'round-result');battle.nextRound();
  assert.equal(visit(battle).remaining,2);skipAll(battle);battle.nextRound();assert.equal(battle.round,2);
  assert.equal(battle.player.soulRedeemUsed,true);
});

test('four beers may be used in one run; full HP or wrong timing never consumes inventory',()=>{
  const {battle,scene,use}=setup();stock(battle,15,['heal_potion','heal_potion','heal_potion','heal_potion']);
  assert.equal(use('heal_potion').used,false);assert.equal(scene.totalBattleItemCount(),4);
  battle.player.hp=1;battle.phase='player-turn';assert.equal(use('heal_potion').used,false);
  for(let i=0;i<4;i++) {battle.phase='choice';battle.player.hp=1;scene.battleItemUses=i;
    assert.equal(scene.remainingBattleItemUses(),Infinity);assert.equal(use('heal_potion').used,true);assert.equal(battle.player.hp,4);}
  assert.equal(scene.totalBattleItemCount(),0);assert.equal(use('heal_potion').used,false);
});

test('shield can be used three times after exhausting charges; active shield cannot stack',()=>{
  const {battle,scene,use,hand}=setup();stock(battle,21,['holy_shield','holy_shield','holy_shield']);
  const item=scene.battleItemCardStates().find(i=>i.id==='holy_shield');assert(item);
  const {ITEMS}=setup().r.load('src/game/items.ts');const shield=ITEMS.find(i=>i.id==='holy_shield');
  for(let i=0;i<3;i++) {
    scene.battleItemUseCounts.holy_shield=i;assert.equal(scene.itemUseLimitReached(shield),false);
    battle.phase='player-turn';assert.equal(use('holy_shield').used,true);
    const count=scene.totalBattleItemCount();assert.equal(use('holy_shield').used,false);assert.equal(scene.totalBattleItemCount(),count);
    const enemy=battle.enemies[0];enemy.hand=hand(['SK','HK','DK']);battle.player.hand=hand(['S2','C3']);
    const hp=battle.player.hp;battle.compareEnemy(enemy);battle.compareEnemy(enemy);
    assert.equal(battle.player.shieldCharges,0);assert.equal(battle.player.hp,hp);
  }
  assert.equal(scene.totalBattleItemCount(),0);
});

test('fate reroll and horn retain timing, consume run stock once and never touch external inventory',()=>{
  const {r,battle,scene,use}=setup();r.progress.getProgress();const external=JSON.stringify([...r.storage]);
  stock(battle,9,['cooling_charm','resonance_dust']);assert.equal(use('cooling_charm').used,false);
  assert.equal(use('resonance_dust').used,true);assert.equal(scene.battleItemCounts().resonance_dust,undefined);
  battle.phase='enemy-turn';assert.equal(use('cooling_charm').used,false);
  battle.phase='player-turn';assert.equal(use('cooling_charm').used,true);
  scene.consumeBattleItem('cooling_charm');assert.equal(scene.totalBattleItemCount(),0);
  assert.equal(JSON.stringify([...r.storage]),external);
});

test('scene waits for animations and windows, then opens shop before next-round presentation',()=>{
  const {battle,scene}=setup();kills(battle,1);battle.phase='round-result';
  const callbacks=[];scene.time={delayedCall:(_,callback)=>callbacks.push(callback)};let renders=0;
  scene.render=()=>{renders++};scene.presentationSequencePlaying=true;
  scene.scheduleNextRound();callbacks.shift()();assert.equal(visit(battle),undefined);assert.equal(battle.round,1);
  scene.presentationSequencePlaying=false;callbacks.shift()();callbacks.shift()();
  assert(visit(battle));assert.equal(renders,1);assert.equal(battle.round,1);
  scene.scheduleNextRound();assert.equal(callbacks.length,0);
});

test('formal policy keeps three uses and one shield; endless ignores both limits',()=>{
  const r=runtime();const policy=r.load('src/game/battleItemPolicy.ts');
  const {ITEMS}=r.load('src/game/items.ts');const shield=ITEMS.find(i=>i.id==='holy_shield');
  assert.equal(policy.remainingBattleItemUses('formal',3),0);assert.equal(policy.remainingBattleItemUses('story',2),1);
  assert.equal(policy.battleItemUseLimitReached('formal',shield,{holy_shield:1}),true);
  assert.equal(policy.battleItemUseLimitReached('endless',shield,{holy_shield:100}),false);
});

test('shop UI renders local prices and disabled offers; buy callback uses the active visit ID',()=>{
  const {r,battle,scene}=setup();kills(battle,1);battle.phase='round-result';battle.openEndlessShop();
  class DisplayObject {
    constructor(kind,x,y,text){Object.assign(this,{kind,x,y,text,list:[],events:{}});}
    add(nodes){this.list.push(...(Array.isArray(nodes)?nodes:[nodes]));return this;}
    setDepth(){return this;}setInteractive(){this.interactive=true;return this;}setStrokeStyle(){return this;}
    setFillStyle(){return this;}setOrigin(){return this;}setShadow(){return this;}setY(y){this.y=y;return this;}setColor(){return this;}
    on(name,callback){this.events[name]=callback;return this;}
  }
  scene.add={container:(x,y)=>new DisplayObject('container',x,y),rectangle:(x,y)=>new DisplayObject('rectangle',x,y),
    text:(x,y,text)=>new DisplayObject('text',x,y,text)};scene.ui=[];scene.playClickSound=()=>{};scene.render=()=>{};
  scene.renderEndlessShop();const root=scene.ui[0];
  const buttons=root.list.filter(o=>o.kind==='container'&&o.list.some(n=>n.kind==='text'));
  assert.equal(buttons.filter(o=>o.list[0].interactive).length,4);
  const beer=buttons.find(o=>o.x===-460);beer.list[0].events.pointerdown();
  assert.equal(battle.getState().endlessAccounting.wallet,5);
  assert(scene.endlessShopMessage.includes('20'));assert.equal(scene.totalBattleItemCount(),1);
  r.load('src/game/i18n/index.ts').setLanguage('en');scene.renderEndlessShop();
  const labels=scene.ui[1].list.filter(o=>o.kind==='text').map(o=>o.text);
  assert(labels.includes('Endless Supplies'));assert(labels.some(label=>label.includes('Coins 5')));
  assert(!labels.some(label=>label.startsWith('endless.')));
});

test('shop state snapshots cannot alter inventory, frozen prices or stock',()=>{
  const {battle}=setup();kills(battle,3);battle.phase='round-result';battle.openEndlessShop();
  assert(battle.buyEndlessItem('heal_potion',visit(battle).id).bought);
  const snapshot=battle.getState().endlessAccounting;snapshot.shop.ownedItems.heal_potion=999;
  snapshot.shop.visit.stock.heal_potion=9;snapshot.shop.visit.prices.heal_potion=0;
  assert.equal(battle.getState().endlessAccounting.shop.ownedItems.heal_potion,1);
  assert.equal(visit(battle).stock.heal_potion,0);assert.equal(visit(battle).prices.heal_potion,20);
});
