import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync('src/scenes/BattleScene.ts','utf8');
const ast=ts.createSourceFile('s.ts',src,ts.ScriptTarget.Latest,true);
const cls=ast.statements.find(ts.isClassDeclaration);
const method=cls.members.find(n=>n.name?.getText(ast)==='playHanamiDanceEffect').getText(ast);
const vfx=fs.readFileSync('src/ui/effects/passives/HanamiDanceVfx.ts','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const ctx=vm.createContext({});
vm.runInContext(ts.transpile(vfx+'\nglobalThis.palettes = HANAMI_PALETTES;', {target:ts.ScriptTarget.ES2022}),ctx);
ctx.HANAMI_PALETTES=ctx.palettes;ctx.t=(key)=>key;
let flight;
ctx.playHanamiDanceVfx=(_scene,options)=>{flight=options;};
vm.runInContext(ts.transpile(`class Harness {${method}};globalThis.Harness=Harness;`,{target:ts.ScriptTarget.ES2022}),ctx);
for(const effect of ['mark','reward_heal','reward_attack']) {
 const h=new ctx.Harness();const enemy={id:'ninja',hp:8};let hp=6,done=0,renders=0;const flashes=[];
 h.battle={enemies:[enemy]};h.hiddenHanamiFanTargetIds=new Set(['ninja']);h.hiddenRoundAttackBonusEnemyIds=new Set(['ninja']);
 h.visualHpOverride={enemies:[6]};h.enemyDisplayHp=()=>hp;h.setEnemyVisualHp=(_i,value)=>hp=value;
 h.setEnemyPortraitPose=()=>{};h.sound={play(){}};h.flashEnemySeat=(...args)=>flashes.push(args);h.enemySeatCenter=()=>({x:0,y:0});h.render=()=>renders++;
 h.playHanamiDanceEffect({sourceEnemyIndex:0,targetEnemyIndexes:[0],effect,amount:2},()=>done++);
 assert.equal(flight.effect,effect);assert.equal(hp,6);assert.equal(done,0);assert.equal(renders,0);
 assert.ok(h.hiddenHanamiFanTargetIds.has('ninja'));assert.ok(h.hiddenRoundAttackBonusEnemyIds.has('ninja'));
 flight.onHit();assert.equal(done,0);
 assert.equal(flashes.at(-1)[1],ctx.palettes[effect].color);
 if(effect==='mark') assert.equal(h.hiddenHanamiFanTargetIds.has('ninja'),false);
 if(effect==='reward_heal') assert.equal(hp,8);
 if(effect==='reward_attack') assert.equal(h.hiddenRoundAttackBonusEnemyIds.has('ninja'),false);
 flight.onComplete();assert.equal(done,1);
}
assert.equal(new Set(Object.values(ctx.palettes).map(p=>p.color)).size,3);
assert.ok(!method.includes('playRedSilkRibbon'));
// Run actual VFX with instrumented Phaser objects and manually complete tween phases.
const logs=[],tweens=[],timers=[];
function obj() { const o={scene:true,x:0,y:0,angle:0,once(){return o;},destroy(){o.scene=false;},add(){return o;}};
 for(const key of ['setDepth','setScale','setAlpha','setRotation','setStrokeStyle','setOrigin','setAngle','setBlendMode'])o[key]=()=>o;
 return o;
}
ctx.Phaser={BlendModes:{ADD:1},GameObjects:{Events:{DESTROY:'destroy'}},Scenes:{Events:{SHUTDOWN:'shutdown'}},Math:{
 Angle:{Between:()=>0},Distance:{Between:()=>200},Clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),Between:(l)=>l,FloatBetween:(l)=>l}};
ctx.createMeteorTail=()=>obj();
const scene={add:{container:obj,circle:obj,arc:obj,rectangle:obj,ellipse:()=>{logs.push('particle');return obj();}},
 tweens:{add:c=>tweens.push(c),killTweensOf(){}},events:{once(){},off(){}},time:{now:0,delayedCall:(ms,fn)=>timers.push({ms,fn})}};
vm.runInContext(ts.transpile(vfx+'\nglobalThis.runVfx = playHanamiDanceVfx;', {target:ts.ScriptTarget.ES2022}),vm.createContext({...ctx, HANAMI_PALETTES:undefined}));
// Re-evaluate in a fresh context because the exported palette is a lexical binding.
const visualCtx=vm.createContext({Phaser:ctx.Phaser,createMeteorTail:ctx.createMeteorTail});
vm.runInContext(ts.transpile(vfx+'\nglobalThis.runVfx = playHanamiDanceVfx;', {target:ts.ScriptTarget.ES2022}),visualCtx);
visualCtx.runVfx(scene,{from:{x:0,y:0},to:{x:200,y:0},effect:'mark',onHit:()=>logs.push('hit'),onComplete:()=>logs.push('done')});
assert.deepEqual(logs,[]);
tweens.find(t=>t.duration===280).onComplete();assert.deepEqual(logs,[]);
tweens.find(t=>t.x===200).onComplete();assert.equal(logs[0],'hit');assert.equal(logs.filter(x=>x==='particle').length,48);assert.ok(!logs.includes('done'));
timers.find(t=>t.ms===1040).fn();assert.equal(logs.at(-1),'done');
console.log('PASS: three palettes; no ribbon; benefits only on hit; impact particles after state reveal; completion after particle tail.');
