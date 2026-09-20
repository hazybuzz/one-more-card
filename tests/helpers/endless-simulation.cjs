const { runtime } = require('./typescript-runtime.cjs');
const ITEMS = ['heal_potion','cooling_charm','resonance_dust','holy_shield'];
function simulator(overrides = {}) {
  const r = runtime();
  const { BattleEngine } = r.load('src/game/engine/BattleEngine.ts');
  const { useBattleItem } = r.load('src/game/itemEffects.ts');
  const { calculateEndlessSettlement } = r.load('src/game/endless/EndlessRules.ts');
  const { validEndlessSnapshot } = r.load('src/game/endless/EndlessSnapshot.ts');
  const config = r.load('src/game/endless/EndlessConfig.ts').ENDLESS_CONFIG;
  if (overrides.baseItemPrices) Object.assign(config.baseItemPrices, overrides.baseItemPrices);
  Object.assign(config, Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'baseItemPrices')));
  function run(seed, policy='adaptive', { restoreEvery=0, maxRounds=200, validate=false }={}) {
    const runId='simulation-'+seed;
    let battle=new BattleEngine({mode:'endless',runId,endlessSeed:seed,startingSupplyCoins:config.startingSupplyCoins});
    const purchases=Object.fromEntries(ITEMS.map(id=>[id,0])), uses={...purchases};
    let actions=0,firstShopRound,redeemRound,incomingHits=0,shieldedHits=0,shieldStreak=0,maxShieldStreak=0;
    const own = id => (battle.endlessLedger.shop.ownedItems[id]??0)>0;
    function use(id){const result=useBattleItem(id,battle);if(result.used)uses[id]++;return result;}
    function validateAndRestore() {
      const snapshot=battle.exportEndlessSnapshot();
      if(validate&&!validEndlessSnapshot(snapshot,runId))throw new Error('Invalid snapshot: '+policy+' / '+seed+' / '+battle.phase);
      if(restoreEvery&&actions%restoreEvery===0)battle=new BattleEngine({mode:'endless',endlessSnapshot:snapshot});
    }
    while(!battle.battleOutcome&&battle.round<=maxRounds) {
      if(++actions>maxRounds*45)throw new Error('Stalled run '+seed+' '+battle.phase);
      if(battle.pendingSoulRedeem){redeemRound=battle.round;battle.resolveSoulRedeem();}
      else if(battle.pendingEnemySoulRedeem)battle.resolveEnemySoulRedeem();
      else if(battle.endlessLedger.shop.isOpeningVisit) {
        const order=policy==='none'?[]:policy==='offense'?['resonance_dust','cooling_charm']:['holy_shield','heal_potion'];
        for(const id of order)if(battle.buyEndlessItem(id,0).bought)purchases[id]++;
        battle.finishEndlessShopVisit(0);
      }
      else if(battle.phase==='choice') {
        if(policy!=='none'&&own('heal_potion')&&battle.player.hp<=9) {
          if(use('heal_potion').used)battle.revealByItem();
        }else {
          if(policy!=='none'&&own('resonance_dust'))use('resonance_dust');
          battle.chooseViewHand();
        }
      } else if(battle.phase==='enemy-turn') {
        // Uses only player-visible information; never reads hidden NPC cards.
        if(battle.playerScore().point>=8&&battle.playerScore().resonance!=='none')battle.compareCurrentEnemy();
        else battle.inviteCurrentEnemy();
      } else if(battle.phase==='player-turn') {
        if(policy!=='none'&&own('holy_shield')&&battle.player.shieldCharges===0)use('holy_shield');
        if(policy!=='none'&&own('cooling_charm')&&battle.playerScore().point<=3)use('cooling_charm');
        if(battle.playerScore().point<=5&&!battle.player.drawLocked&&battle.player.drawCountThisRound===0)battle.playerDraw();
        if(battle.playerScore().resonance==='none'&&battle.playerScore().point>=5)battle.useResonanceShift();
        if(battle.playerScore().resonance!=='none'&&battle.playerScore().point<=5)battle.useResonanceSummon();
        battle.playerStand();
      } else if(battle.phase==='round-result') {
        if(battle.openEndlessShop()) {
          firstShopRound??=battle.round;
          const visit=battle.getState().endlessAccounting.shop.visit;
          let order=[];
          if(policy==='shield')order=['holy_shield','heal_potion'];
          if(policy==='offense')order=['resonance_dust','cooling_charm'];
          if(policy==='adaptive')order=battle.player.hp<=6?['heal_potion','holy_shield','resonance_dust','cooling_charm']:['holy_shield','resonance_dust','heal_potion','cooling_charm'];
          for(const id of order)if(!own(id)&&(id!=='heal_potion'||battle.player.hp<=9)){
            if(battle.buyEndlessItem(id,visit.id).bought)purchases[id]++;
          }
          battle.finishEndlessShopVisit(visit.id);
        } else battle.nextRound();
      } else throw new Error('Unexpected phase '+battle.phase);
      for(const event of battle.consumePresentationEvents()) {
        if(event.type==='damage'&&event.attacker==='enemy'&&(event.originalAmount??event.amount)>0){
          incomingHits++;if(event.shielded){shieldedHits++;maxShieldStreak=Math.max(maxShieldStreak,++shieldStreak);}else shieldStreak=0;
        }
      }
      battle.clearPendingPresentationEvents();
      validateAndRestore();
    }
    const capped=!battle.battleOutcome;
    if(capped)battle.endEndlessRun();
    const a=battle.getState().endlessAccounting, payout=calculateEndlessSettlement(a.defeatedCount,a.resonancePoints,a.spentCoins,a.startingSupplyCoins);
    return {seed,policy,kills:a.defeatedCount,resonance:a.resonancePoints,spirits:a.clearedSpiritCount,rounds:battle.round,
      spent:a.spentCoins,payout:payout.total,net:payout.total-config.entryCost,purchases,uses,firstShopRound:firstShopRound??null,
      diedBeforeFirstShop:firstShopRound===undefined&&!capped,redeemRound:redeemRound??null,
      roundsAfterRedeem:redeemRound===undefined?null:battle.round-redeemRound,incomingHits,shieldedHits,maxShieldStreak,capped,
      finalSnapshot:validate?battle.exportEndlessSnapshot():undefined};
  }
  return {run,config};
}
function summarize(runs) {
  const sorted=key=>runs.map(r=>r[key]).sort((a,b)=>a-b), mean=key=>runs.reduce((n,r)=>n+r[key],0)/runs.length;
  const percentile=(key,p)=>sorted(key)[Math.floor((runs.length-1)*p)];
  const total=key=>runs.reduce((n,r)=>n+r[key],0);
  const after=runs.filter(r=>r.roundsAfterRedeem!==null);
  return {samples:runs.length,kills:{p10:percentile('kills',.1),median:percentile('kills',.5),p90:percentile('kills',.9),max:percentile('kills',1),mean:mean('kills')},
    roundsMedian:percentile('rounds',.5),spentMean:mean('spent'),netMean:mean('net'),netMedian:percentile('net',.5),netP90:percentile('net',.9),
    profitableRate:runs.filter(r=>r.net>0).length/runs.length,firstShopFailureRate:runs.filter(r=>r.diedBeforeFirstShop).length/runs.length,
    cappedRuns:runs.filter(r=>r.capped).length,shieldCoverage:total('incomingHits')?total('shieldedHits')/total('incomingHits'):0,
    maxShieldStreak:Math.max(...runs.map(r=>r.maxShieldStreak)),roundsAfterRedeemMean:after.length?after.reduce((n,r)=>n+r.roundsAfterRedeem,0)/after.length:null,
    items:Object.fromEntries(ITEMS.map(id=>[id,{purchased:runs.reduce((n,r)=>n+r.purchases[id],0),used:runs.reduce((n,r)=>n+r.uses[id],0)}]))};
}
module.exports={simulator,summarize};
