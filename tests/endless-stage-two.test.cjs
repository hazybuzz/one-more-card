const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runtime } = require('./helpers/typescript-runtime.cjs');
function setup(ids) {
  const r = runtime(); const { Battle } = r.load('src/game/battle.ts');
  const battle = new Battle({ mode: 'endless', enemyIds: ids, runId: 'mixed-run' });
  battle.consumePassiveEffectEvents();
  return { r, battle };
}

test('all 12 NPCs retain their source theme, unique instance, seat and Hard HP', () => {
  const { r } = setup(['goblin']);
  const themes = r.load('src/game/data/tableThemes.ts').TABLE_THEMES;
  const config = r.load('src/game/data/enemies.ts').ENEMY_CONFIGS;
  const { Battle } = r.load('src/game/battle.ts');
  const battle = new Battle({ mode: 'endless', enemyIds: themes.flatMap(t => t.enemyIds), runId: 'origins' });
  assert.equal(new Set(battle.enemies.map(e=>e.instanceId)).size, 12);
  for (const [i, enemy] of battle.enemies.entries()) {
    assert.equal(enemy.sourceThemeId, themes.find(t=>t.enemyIds.includes(enemy.id)).id);
    assert.equal(enemy.maxHp, config[enemy.id].maxHp + 1);
    assert.equal(enemy.seatIndex, i);
  }
  assert.equal(battle.enemyPassiveHpThreshold('viking_warrior'), 4);
  assert.equal(battle.enemyPassiveHpThreshold('rune_shaman'), 5);
  assert.equal(battle.enemyPassiveHpThreshold('valkyrie'), 5);
  assert.equal(battle.enemyPassiveHpThreshold('goblin'), 6);
});

test('mixed round-start passives run together without the table theme gate', () => {
  const { battle } = setup(['rune_shaman', 'taoist', 'oiran']);
  battle.enemies[0].hp = 2;
  battle.prepareEnemyRoundStartPassives();
  const events = battle.consumePassiveEffectEvents();
  for (const passive of ['rune_blessing','heavenly_insight','hanami_dance']) assert(events.some(e=>e.passiveId===passive));
  for (const event of events) {
    assert.equal(event.sourceEnemyInstanceId, battle.enemies[event.sourceEnemyIndex].instanceId);
    assert.equal(event.targetEnemyInstanceIds[0], battle.enemies[event.targetEnemyIndexes[0]].instanceId);
  }
});

test('songstress buffs a cross-theme ally and war horn strengthens mixed allies', () => {
  const { battle } = setup(['songstress','viking_warrior','ninja']);
  battle.enemies[1].hp = 1;
  battle.applyRedSilkToast();
  assert.equal(battle.enemies[1].hp, 2); assert.equal(battle.enemies[1].roundAttackBonus, 1);
  battle.applyWarHornIfNeeded(battle.enemies[1]);
  assert(battle.enemies.every(e=>e.attackBonus===1));
});

test('ninja smoke and samurai charge work independently of background', () => {
  const { battle } = setup(['goblin','ninja','shogun_samurai']);
  const ninja = battle.enemies[1], samurai = battle.enemies[2];
  ninja.hp=1; battle.applySmokeScreenArm(); assert.equal(ninja.smokeScreenArmed,true);
  assert.equal(battle.applySmokeSubstitutionIfNeeded(ninja,3),true);
  assert.equal(battle.applySmokeSubstitutionIfNeeded(ninja,3),false);
  battle.applyIaijutsuChargeIfNeeded(samurai); battle.applyIaijutsuChargeIfNeeded(samurai); battle.applyIaijutsuChargeIfNeeded(samurai);
  assert.equal(samurai.iaijutsuStacks,2); assert.equal(battle.consumeIaijutsuOnWin(samurai),2);
  assert.equal(samurai.iaijutsuStacks,0);
});

test('swordsman guards another theme and preserves protector instance metadata', () => {
  const { battle } = setup(['swordsman','goblin','werewolf']);
  const goblin=battle.enemies[1], swordsman=battle.enemies[0]; goblin.hp=1;
  const protectedHit=battle.applyBladeToRescueIfNeeded(goblin,2);
  assert(protectedHit); assert.equal(protectedHit.damageAfter,0);
  assert.equal(protectedHit.guard.protectorEnemyInstanceId,swordsman.instanceId);
});

test('same-type replacement has fresh state and cannot inherit an old fan reward', () => {
  const { battle } = setup(['goblin','ninja','oiran']);
  const old=battle.enemies[0], oiran=battle.enemies[2];
  oiran.hanamiFanTargetId=old.id; oiran.hanamiFanTargetInstanceId=old.instanceId; oiran.hanamiDamageBank=2;
  old.attackBonus=4; old.smokeScreenUsed=true; old.taoistTalismaned=true;
  const next=battle.replaceEnemyAt(0,'goblin',{maxHp:6});
  assert.notEqual(next.instanceId,old.instanceId); assert.equal(next.sourceThemeId,'evernight_tavern');
  assert.equal(next.attackBonus,0); assert.equal(next.smokeScreenUsed,false); assert.equal(next.taoistTalismaned,false);
  assert.equal(oiran.hanamiFanTargetInstanceId,undefined); assert.equal(oiran.hanamiDamageBank,0);
  battle.applyHanamiDance(); assert.equal(next.roundAttackBonus,0);
});

test('taoist replacement invalidates talismans from that exact caster', () => {
  const { battle } = setup(['goblin','ninja','taoist']);
  const target=battle.enemies[0], caster=battle.enemies[2];
  target.taoistTalismaned=true; target.talismanSourceInstanceId=caster.instanceId;
  battle.replaceEnemyAt(2,'taoist');
  assert.equal(target.taoistTalismaned,false); assert.equal(target.talismanSourceInstanceId,undefined);
});

test('valkyrie creates a fresh 1-HP spirit while old result identity remains intact', () => {
  const { battle } = setup(['swordsman','ninja','valkyrie']);
  const previous=battle.enemies[0], valkyrie=battle.enemies[2]; previous.defeated=true; previous.hp=0; valkyrie.hp=1;
  battle.applyEinherjarSummon(); const spirit=battle.enemies[0];
  assert.equal(previous.id,'swordsman'); assert.equal(previous.defeated,true);
  assert.notEqual(spirit,previous); assert.notEqual(spirit.instanceId,previous.instanceId);
  assert.equal(spirit.id,'einherjar'); assert.equal(spirit.maxHp,1); assert.equal(spirit.sourceThemeId,'northern_longhouse');
  assert.equal(spirit.seatIndex,0); assert.equal(spirit.summoned,true); assert.equal(valkyrie.summonCount,1);
  battle.applyEinherjarSummon(); assert.equal(valkyrie.summonCount,1);
  spirit.defeated=true; spirit.hp=0; battle.applyEinherjarSummon(); assert.equal(valkyrie.summonCount,2);
  battle.enemies[0].defeated=true; battle.applyEinherjarSummon(); assert.equal(valkyrie.summonCount,2);
});

test('formal difficulty attributes and disabled tutorial passives retain their behavior', () => {
  const r=runtime(); const { Battle }=r.load('src/game/battle.ts');
  const themes=r.load('src/game/data/tableThemes.ts').TABLE_THEMES;
  const configs=r.load('src/game/data/enemies.ts').ENEMY_CONFIGS;
  for (const theme of themes) for (const difficulty of [1,2,3]) {
    const battle=new Battle({tableThemeConfig:theme,stakeMultiplier:difficulty});
    assert.equal(battle.mode,'formal');
    for (const enemy of battle.enemies) {
      assert.equal(enemy.maxHp,configs[enemy.id].maxHp+difficulty-2);
      assert.equal(battle.enemyPassiveHpThreshold(enemy.id),(theme.passiveHpThresholds?.[enemy.id]??3)+difficulty-2);
    }
  }
  const tutorial=new Battle({levelConfig:{id:'test',enemyIds:['rune_shaman','taoist','oiran'],unlockedMechanics:[]}});
  assert.equal(tutorial.mode,'story'); assert.equal(tutorial.consumePassiveEffectEvents().length,0);
});

test('endless art preload includes all source characters and origin frames, including spirit', () => {
  const r=runtime({external:{phaser:{Textures:{FilterMode:{NEAREST:0}}}}});
  const art=r.load('src/ui/art/BattleArtPreloader.ts'); const registry=r.load('src/ui/art/BattleArtRegistry.ts');
  const ids=r.load('src/game/data/npcOrigins.ts').ENDLESS_NPC_ART_IDS;
  const loaded=new Set(); const scene={textures:{exists:()=>false},load:{image:k=>loaded.add(k),spritesheet:k=>loaded.add(k)}};
  art.preloadBattleArt(scene,{themeId:'evernight_tavern',enemyIds:['goblin'],preloadAllNpcArt:true});
  for (const id of ids) assert(loaded.has(registry.getEnemyCharacterArt(id).asset.textureKey),id);
  for (const theme of ['evernight_tavern','northern_longhouse','dragon_gate','edo_teahouse']) {
    const frame=registry.getBattleThemeArt(theme).enemyFrame; if (frame) assert(loaded.has(frame.textureKey),theme);
  }
});


test('evernight goblin, gambler and werewolf passives survive a mixed roster', () => {
  const { r, battle }=setup(['goblin','gambler','werewolf']);
  const card=r.load('src/game/card.ts').cardFromCode;
  battle.enemies[0].hp=1; battle.chooseViewHand(); battle.inviteCurrentEnemy();
  assert(battle.consumePassiveEffectEvents().some(e=>e.passiveId==='goblin_instinct'));
  const gambler=battle.enemies[1]; gambler.hp=1; gambler.hand=[card('SA')];
  battle.applyPreComparePassive(gambler);
  const gamblerEvents=battle.consumePassiveEffectEvents();
  assert(gamblerEvents.some(e=>e.passiveId==='gambler_blessing'));
  assert.equal(gamblerEvents.find(e=>e.type==='cards-redealt').targetEnemyInstanceId,gambler.instanceId);
  const wolf=battle.enemies[2]; wolf.hp=1; battle.applyPostDamagePassive(wolf,2);
  assert.equal(wolf.hp,3); assert(battle.consumePassiveEffectEvents().some(e=>e.passiveId==='werewolf_lifesteal'));
});

test('fan reward follows the surviving marked instance and talisman rerolls its actual target', () => {
  const { r, battle }=setup(['goblin','taoist','oiran']);
  const [target,taoist,oiran]=battle.enemies;
  oiran.hanamiFanTargetId=target.id; oiran.hanamiFanTargetInstanceId=target.instanceId;
  battle.recordHanamiDamage(2); battle.applyHanamiDance();
  assert.equal(target.roundAttackBonus,2);
  const reward=battle.consumePassiveEffectEvents().find(e=>e.effect==='reward_attack');
  assert.equal(reward.targetEnemyInstanceIds[0],target.instanceId);
  const card=r.load('src/game/card.ts').cardFromCode;
  target.taoistTalismaned=true; target.talismanSourceInstanceId=taoist.instanceId; target.hand=[card('SA')];
  battle.applyHeavenlyInsightIfNeeded(target,target.hand[0]);
  const replaced=battle.consumePassiveEffectEvents().find(e=>e.type==='card-replaced');
  assert.equal(replaced.targetEnemyInstanceId,target.instanceId); assert.equal(target.taoistTalismaned,false);
});

test('damage, clash and state snapshots retain the exact enemy instance', () => {
  const r=runtime(); const { BattleEngine }=r.load('src/game/engine/BattleEngine.ts');
  const engine=new BattleEngine({mode:'endless',enemyIds:['goblin','ninja','oiran'],runId:'events'});
  engine.consumePresentationEvents();
  const enemy=engine.enemies[0];
  engine.damageEvents=[{type:'damage',attacker:'player',enemyId:enemy.id,enemyInstanceId:enemy.instanceId,amount:2},
    {type:'clash',enemyId:enemy.id,enemyInstanceId:enemy.instanceId,amount:0}];
  const events=engine.consumePresentationEvents();
  assert(events.every(e=>e.enemyInstanceId===enemy.instanceId));
  const state=engine.getState(); assert.equal(state.mode,'endless');
  assert.equal(state.enemies[0].instanceId,enemy.instanceId); assert.equal(state.enemies[0].sourceThemeId,'evernight_tavern');
});
