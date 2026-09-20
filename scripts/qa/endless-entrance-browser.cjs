// Run with QA_PLAYWRIGHT_MODULE pointing to an isolated Playwright installation.
// Browser storage lives in temporary contexts; no developer save is touched.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.QA_PLAYWRIGHT_MODULE||'playwright');
const {runtime}=require('../../tests/helpers/typescript-runtime.cjs');
const url=process.env.QA_BASE_URL||'http://127.0.0.1:5179';
const output=process.env.QA_OUTPUT||'tmp/endless-stage-eight';fs.mkdirSync(output,{recursive:true});
const themes=['evernight_tavern','northern_longhouse','dragon_gate','edo_teahouse'];
function seedSave(){const r=runtime({saved:{soulCoins:5000,ownedItems:{heal_potion:5},ownedCosmetics:['thunder_hammer','jade_sword_array','sakura_slash'],equippedAttackEffect:'thunder_hammer',unlockedTableThemeIds:themes}});
 for(const theme of themes)for(const difficulty of [1,2,3])r.progress.recordFormalTableResult('victory',theme,difficulty);
 return JSON.parse(JSON.stringify(r.progress.getProgress()));}
async function labels(page){return page.evaluate(()=>{
 const output=[];function visit(node){if(node.visible===false||node.active===false)return;if(node.type==='Text'){const m=node.getWorldTransformMatrix();output.push({text:node.text,x:m.tx+(0.5-node.originX)*node.width,y:m.ty+(0.5-node.originY)*node.height});}if(node.list)node.list.forEach(visit);}
 qaGame.scene.getScenes(true).forEach(scene=>scene.children.list.forEach(visit));return output;
 });}
async function click(page,text,nearX){const nodes=(await labels(page)).filter(n=>n.text===text);assert(nodes.length,'Missing label '+text);
 if(nearX!==undefined)nodes.sort((a,b)=>Math.abs(a.x-nearX)-Math.abs(b.x-nearX));else assert.equal(nodes.length,1,'Ambiguous label '+text);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.mouse.click(nodes[0].x,nodes[0].y);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function ready(page,key='BattleScene'){await page.waitForFunction(key=>{
 const s=globalThis.qaGame?.scene.getScene(key);return s?.sys.isActive()&&(key!=='BattleScene'||s.battle&&!s.isPresentationBusy()&&!s.endlessSaveError);
 },key,{timeout:40000}).catch(async error=>{console.error('Browser state',await page.evaluate(()=>({game:!!globalThis.qaGame,fonts:document.fonts.status,url:location.href,body:document.body.innerHTML.slice(0,200),scenes:globalThis.qaGame?.scene.scenes.map(s=>({key:s.sys.settings.key,status:s.sys.settings.status,active:s.sys.isActive(),battle:!!s.battle,error:s.endlessSaveError}))})));await page.screenshot({path:path.join(output,'failure.png'),timeout:5000});throw error;});}
async function screenshot(page,name){await page.screenshot({path:path.join(output,name+'.png')});}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.QA_CHROME_PATH?{executablePath:process.env.QA_CHROME_PATH}:{})});
 const report={checks:[],errors:[],missingAssets:[]};
 try{
 const context=await browser.newContext({viewport:{width:1280,height:720}});
 await context.addInitScript(save=>{if(!localStorage.getItem('one-more-card-progress'))localStorage.setItem('one-more-card-progress',JSON.stringify(save));},seedSave());
 async function newPage(){const page=await context.newPage();
  page.on('pageerror',error=>{report.errors.push(error.message);console.error('PAGE ERROR',error.message);});page.on('response',response=>{if(response.status()>=400)report.missingAssets.push(response.url());});
  // Expose the game instance in this test response only; application source is unchanged.
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch();const body=await response.text();assert(body.includes('new Phaser.Game(config)'));await route.fulfill({response,body:body.replace('new Phaser.Game(config)','globalThis.qaGame = new Phaser.Game(config)')});});
  await page.goto(url);console.log('Navigated',await page.evaluate(()=>({game:!!globalThis.qaGame,fonts:document.fonts.status,resources:performance.getEntriesByType('resource').length})));await ready(page,'StartScene');return page;
 }
 const page=await newPage();await screenshot(page,'01-lobby');await click(page,'无尽模式');await screenshot(page,'02-entry');await click(page,'支付并进入');await ready(page);
 const before=await page.evaluate(()=>{const s=qaGame.scene.getScene('BattleScene');return{snapshot:s.battle.exportEndlessSnapshot(),saved:JSON.parse(localStorage.getItem('one-more-card-progress')),textures:['endless-hell-tavern-background','thunder-hammer','jade-sword','sakura-katana'].map(k=>[k,s.textures.exists(k)])};});
 assert.equal(before.saved.soulCoins,4900);assert.equal(before.saved.ownedItems.heal_potion,5);assert.equal(before.saved.endlessSession.status,'active');await screenshot(page,'03-battle');report.checks.push('Real homepage entry charges 100 once and loads endless scene');
 const other=await newPage();await click(other,'无尽模式');await click(other,'继续无尽');
 await other.waitForFunction(()=>qaGame.scene.getScene('BattleScene').children.list.some(n=>n.type==='Text'&&n.text.includes('另一个窗口')));
 await screenshot(other,'04-owner-blocked');await other.close();report.checks.push('Second window blocked by actual Web Lock');
 await page.reload();await ready(page,'StartScene');await click(page,'无尽模式');await click(page,'继续无尽');await ready(page);
 const after=await page.evaluate(()=>({snapshot:qaGame.scene.getScene('BattleScene').battle.exportEndlessSnapshot(),coins:JSON.parse(localStorage.getItem('one-more-card-progress')).soulCoins}));
 assert.deepEqual(after.snapshot,before.snapshot);assert.equal(after.coins,4900);report.checks.push('Reload restores exact logical snapshot without fee');
 assert.equal(after.snapshot.round,0);assert.equal(after.snapshot.player.hand.length,0);assert.equal(after.snapshot.ledger.startingSupplyCoins,70);
 await click(page,'购买',830);await click(page,'购买',286);await screenshot(page,'opening-purchases');
 const openingBought=await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.exportEndlessSnapshot());assert.equal(openingBought.ledger.shop.spent,65);
 await page.reload();await ready(page,'StartScene');await click(page,'无尽模式');await click(page,'继续无尽');await ready(page);
 assert.deepEqual(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.exportEndlessSnapshot()),openingBought);
 await click(page,'准备好了 · 开始牌局');await ready(page);assert.equal(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.round),1);
 await screenshot(page,'opening-first-round');report.checks.push('Opening supplies, purchased stock and RNG restore exactly; first round starts only after confirmation');

 await page.evaluate(()=>{
  const s=qaGame.scene.getScene('BattleScene');globalThis.qaEntry={reveals:[],passives:[],dealAt:null};
  const original=s.playPassiveEffect.bind(s);s.playPassiveEffect=(event,done)=>{qaEntry.passives.push({at:performance.now(),event:event.passiveId,entering:s.enteringEnemyInstances.size});original(event,done);};
  for(const enemy of s.battle.enemies){enemy.hp=0;s.battle.applyDefeatAndReward(enemy);}
  s.battle.phase='round-result';s.battle.openEndlessShop();while(s.battle.endlessLedger.shop.isOpen)s.battle.finishEndlessShopVisit(s.battle.getState().endlessAccounting.shop.visit.id);
  s.battle.execute({type:'next-round'});const events=s.battle.consumePresentationEvents();qaEntry.arrivals=events.filter(e=>e.type==='enemy-entered');
  qaEntry.start=performance.now();s.playPassiveEffectEvents(events,()=>{qaEntry.dealAt=performance.now();s.startDealPresentation();});
 });
 const initial=await page.evaluate(()=>{const s=qaGame.scene.getScene('BattleScene');return {count:s.enteringEnemyInstances.size,alpha:s.battle.enemies.map(e=>s.seatContainers.get(e.id).alpha),cards:s.dealtEnemyCards,busy:s.isPresentationBusy()};});
 assert.equal(initial.count,3);assert(initial.alpha.every(a=>a===0));assert(initial.cards.every(n=>n===0));assert(initial.busy);
 await page.waitForTimeout(360);await screenshot(page,'entrance-mid');
 const middle=await page.evaluate(()=>{const s=qaGame.scene.getScene('BattleScene');s.render();return {alpha:s.battle.enemies.map(e=>s.seatContainers.get(e.id).alpha),passives:qaEntry.passives.length,cards:s.dealtEnemyCards};});
 assert(middle.alpha.some(a=>a>0&&a<1));assert.equal(middle.passives,0);assert(middle.cards.every(n=>n===0));
 await page.waitForFunction(()=>qaEntry.dealAt!==null,null,{timeout:20000});await ready(page);await screenshot(page,'entrance-complete');
 const completed=await page.evaluate(()=>{const s=qaGame.scene.getScene('BattleScene');return {entry:qaEntry,count:s.enteringEnemyInstances.size,cards:s.dealtEnemyCards,alpha:s.battle.enemies.map(e=>s.seatContainers.get(e.id).alpha),snapshot:s.battle.exportEndlessSnapshot()};});
 assert.equal(completed.count,0);assert(completed.alpha.every(a=>a===1));assert(completed.cards.every(n=>n===2));assert(completed.entry.dealAt-completed.entry.start>=1000);
 assert(completed.entry.passives.every(p=>p.entering===0&&p.at-completed.entry.start>=1000));
 await page.reload();await ready(page,'StartScene');await click(page,'无尽模式');await click(page,'继续无尽');await ready(page);
 assert.deepEqual(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.exportEndlessSnapshot()),completed.snapshot);
 assert.equal(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').enteringEnemyInstances.size),0);
 report.checks.push('Three replacements fade in with stagger; render preserves fade; passives and cards wait; reload does not replay arrival');
 await context.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.missingAssets,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
