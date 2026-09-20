const assert=require('node:assert/strict');
const {test}=require('node:test');
const {spawn}=require('node:child_process');
const net=require('node:net');
const {WebSocket}=require('ws');
async function freePort(){const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
function client(url){const socket=new WebSocket(url),messages=[];socket.on('message',raw=>messages.push(JSON.parse(String(raw))));
 function wait(predicate){const found=messages.find(predicate);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{socket.off('message',listener);reject(new Error('Timed out: '+JSON.stringify(messages.slice(-2))));},8000);
  const listener=raw=>{const msg=JSON.parse(String(raw));if(predicate(msg)){clearTimeout(timeout);socket.off('message',listener);resolve(msg);}};socket.on('message',listener);
 });}
 return{socket,wait,send:message=>socket.send(JSON.stringify(message)),messages};}
test('actual PvP server supports two-client ready, invitation, reveal, surrender and rematch',async()=>{
 const port=await freePort();const server=spawn(process.execPath,['server/pvpServer.js'],{env:{...process.env,PVP_PORT:String(port)},stdio:['ignore','pipe','pipe']});
 let a,b;try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server boot timeout')),8000);server.once('error',reject);server.stdout.on('data',chunk=>{if(String(chunk).includes('PvP server listening')){clearTimeout(timer);resolve();}});server.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});});
 a=client('ws://127.0.0.1:'+port);b=client('ws://127.0.0.1:'+port);
 const aid=(await a.wait(m=>m.type==='connected')).clientId,bid=(await b.wait(m=>m.type==='connected')).clientId;
 a.send({type:'create-room',playerName:'QA Host'});const roomId=(await a.wait(m=>m.type==='room-created')).roomId;
 b.send({type:'join-room',roomId,playerName:'QA Guest'});await b.wait(m=>m.type==='room-joined');
 a.send({type:'ready'});b.send({type:'ready'});const initial=(await a.wait(m=>m.type==='room-state'&&m.state.phase==='playing')).state;
 assert.equal(initial.players.length,2);assert(initial.players.find(p=>p.id===bid).hand.some(c=>c.hidden&&!c.card));
 const asker=initial.askerId===aid?a:b,responder=initial.responderId===aid?a:b;
 asker.send({type:'invite-draw'});await responder.wait(m=>m.type==='room-state'&&m.state.duelPhase==='responder-response'&&m.state.pendingInvitation);
 responder.send({type:'accept-invite'});await asker.wait(m=>m.type==='room-state'&&m.state.duelPhase==='asker-final');
 asker.send({type:'confirm-reveal'});await responder.wait(m=>m.type==='room-state'&&m.state.duelPhase==='responder-final');
 responder.send({type:'confirm-reveal'});const reveal=(await a.wait(m=>m.type==='room-state'&&m.state.phase==='round-reveal')).state;
 assert(reveal.lastRoundResult);assert(reveal.players.every(p=>p.hand.every(c=>!c.hidden&&c.card)));
 a.send({type:'surrender'});const ended=(await b.wait(m=>m.type==='room-state'&&m.state.phase==='game-over')).state;assert.equal(ended.winnerId,bid);
 a.send({type:'rematch'});b.send({type:'rematch'});const rematch=(await a.wait(m=>m.type==='room-state'&&m.state.phase==='playing'&&m.state.matchId>initial.matchId)).state;
 assert.equal(rematch.round,1);assert(rematch.players.every(p=>p.hp===8));
 }finally{a?.socket.close();b?.socket.close();server.kill();await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));}
});
