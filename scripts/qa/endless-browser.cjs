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
 for(const weapon of ['thunder_hammer','jade_sword_array','sakura_slash'])for(const tier of ['none','resonance','strong']){
  await page.evaluate(async({weapon,tier})=>{const p=await import('/src/game/progress.ts');p.equipAttackEffect(weapon);const s=qaGame.scene.getScene('BattleScene');globalThis.qaEffect={hit:0,complete:0};s.playEquippedPlayerAttackEffect(s.playerSeatCenter(),s.enemySeatCenter(1),tier,3,()=>qaEffect.hit++,()=>qaEffect.complete++);},{weapon,tier});
  await page.waitForTimeout(450);if(tier==='strong')await screenshot(page,'weapon-'+weapon);
  await page.waitForFunction(()=>qaEffect.complete===1,null,{timeout:12000});assert.equal(await page.evaluate(()=>qaEffect.hit),1);
 }
 report.checks.push('Three real weapon animations hit and complete exactly once at ordinary/resonance/strong tiers');
 // Safe integration fixture: three real logical defeats followed by the real shop UI.
 await page.evaluate(()=>{const s=qaGame.scene.getScene('BattleScene');s.battle.endlessTransaction(()=>{for(let i=0;i<3;i++)s.battle.endlessLedger.recordDefeat('qa-kill'+i,'qa-dead'+i,'goblin',false);s.battle.endlessLedger.recordResonance('qa-score','qa-dead0',3,1);s.battle.phase='round-result';s.battle.roundRevealed=true;s.battle.openEndlessShop();});s.render();});
 await screenshot(page,'05-shop');await click(page,'购买',286);
 const purchase=await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.exportEndlessSnapshot());assert.equal(purchase.ledger.shop.spent,85);assert.equal(purchase.ledger.shop.ownedItems.heal_potion,2);
 await page.reload();await ready(page,'StartScene');await click(page,'无尽模式');await click(page,'继续无尽');await ready(page);
 const restoredShop=await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.exportEndlessSnapshot());assert.deepEqual(restoredShop,purchase);report.checks.push('Actual shop purchase and reload preserve wallet, stock and opportunities');
 await click(page,'结束本次 · 下一次补给');await click(page,'结束购物 · 继续牌局');await ready(page);
 await page.evaluate(()=>{const s=qaGame.scene.getScene('BattleScene');s.playStatusGainText(s.playerSeatCenter(),'attack',2);s.playStatusGainText(s.enemySeatCenter(0),'heal',1);});await screenshot(page,'06-status-text');
 await click(page,'结束无尽');await screenshot(page,'07-exit-confirm');await click(page,'结束并结算');
 await page.waitForFunction(()=>qaGame.scene.getScene('BattleScene').battleEconomySettled===true);
 await screenshot(page,'08-settlement');const paid=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-more-card-progress')));
 assert.equal(paid.lastEndlessSettlement.total,96);assert.equal(paid.soulCoins,4996);assert.equal(paid.endlessSession,undefined);assert.equal(paid.endlessBestScore.defeatedCount,3);
 await click(page,'返回大厅');await ready(page,'StartScene');await click(page,'无尽模式');await screenshot(page,'09-best');report.checks.push('UI exit, atomic payout, lobby return and local best display');
 await click(page,'返回首页');await click(page,'故事模式');await ready(page,'StorySelectScene');await screenshot(page,'10-story-select');
 await click(page,'开始');await ready(page,'ChapterIntroScene');await page.keyboard.press('Escape');await ready(page);
 assert.equal(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.mode),'story');await screenshot(page,'11-story-lesson');
 await page.evaluate(()=>qaGame.scene.getScene('BattleScene').scene.start('StartScene'));await ready(page,'StartScene');await click(page,'正式赌局');await ready(page,'TableSelectScene');await screenshot(page,'12-formal-select');
 await click(page,'入座',300);await ready(page);assert.equal(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.mode),'formal');await screenshot(page,'13-formal-battle');
 await click(page,'退出');await click(page,'确认退出');await ready(page,'StartScene');await click(page,'道具商店');await ready(page,'ShopScene');await screenshot(page,'14-outside-shop');
 const outsideBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-more-card-progress')));await click(page,'购买',1050);
 const outsideAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-more-card-progress')));assert.equal(outsideAfter.soulCoins,outsideBefore.soulCoins-10);assert.equal(outsideAfter.ownedItems.heal_potion,6);
 await click(page,'特效道具');await screenshot(page,'15-cosmetic-shop');await click(page,'返回大厅');await ready(page,'StartScene');
 await click(page,'切换测试模式');await ready(page,'StartScene');await click(page,'实验模式：局域网对战');await ready(page,'PvpLobbyScene');await screenshot(page,'16-pvp-lobby');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('one-more-card-progress')).endlessBestScore.defeatedCount),3);
 report.checks.push('Real story intro/lesson, formal entry/exit, outside shop purchase, weapon catalog and PvP lobby regression');
 await page.evaluate(()=>qaGame.scene.getScene('PvpLobbyScene').scene.start('StartScene'));await ready(page,'StartScene');
 await click(page,'切换正式模式');await ready(page,'StartScene');
 const exitBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-more-card-progress')).soulCoins);
 await click(page,'无尽模式');await click(page,'支付并进入');await ready(page);assert.equal(await page.evaluate(()=>qaGame.scene.getScene('BattleScene').battle.round),0);
 await click(page,'结束无尽');await click(page,'结束并结算');await page.waitForFunction(()=>qaGame.scene.getScene('BattleScene').battleEconomySettled===true);
 const openingExit=await page.evaluate(()=>JSON.parse(localStorage.getItem('one-more-card-progress')));
 assert.equal(openingExit.lastEndlessSettlement.total,0);assert.equal(openingExit.soulCoins,exitBefore-100);assert.equal(openingExit.endlessBestScore.defeatedCount,3);
 await screenshot(page,'opening-zero-payout');report.checks.push('Ending from opening shop pays zero, retains best and never refunds entry');
 await context.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.missingAssets,[]);
 report.passed=true;
 }finally{fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
