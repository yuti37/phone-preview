const test=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/simulator-harness');
function ready(snapshot){const h=game(snapshot);h.start();return h}
function send(h,chat,id,at,type='kkt-message'){h.run(`stageSevenQueueMessage('${id}','${chat}','${chat==='group'?'민혁':'형원'}','${id}','測試',0,{group:${chat==='group'},notify:false,storyTimestamp:${at}})`)}
for(const chat of ['shownu','minhyuk','kihyun','jooheon','changkyun','manager','group'])test(`${chat}: delayed older story message stays after delivered photo reply across render and reload`,()=>{
 const h=ready(),at=new Date(2026,9,28,12).getTime();
 send(h,chat,'order-test-photo',at);send(h,chat,'order-test-reply',at+60000);send(h,chat,'order-test-later',at+1000);
 h.run(`showScreen('app-kakao');openChat('${chat}');renderChatMessages();renderChatMessages()`);
 const ids=()=>JSON.parse(h.run(`JSON.stringify(CONFIG.chats.find(c=>c.id==='${chat}').messages.filter(m=>m.id?.startsWith('order-test-')).map(m=>m.id))`));
 assert.deepEqual(ids(),['order-test-photo','order-test-reply','order-test-later']);
 assert.equal(h.run(`latestKakaoMessage(CONFIG.chats.find(c=>c.id==='${chat}')).id`),'order-test-later');
 const r=ready(h.snapshot());r.run(`showScreen('app-kakao');openChat('${chat}')`);
 assert.deepEqual(JSON.parse(r.run(`JSON.stringify(CONFIG.chats.find(c=>c.id==='${chat}').messages.filter(m=>m.id?.startsWith('order-test-')).map(m=>m.id))`)),ids());
});
test('same-second deliveries retain order and payload timestamps across repeated replay',()=>{
 const h=ready(),at=new Date(2026,9,28,12).getTime();
 for(const id of ['z-first','a-second','m-third'])send(h,'minhyuk',id,at);
 const before=h.run("JSON.stringify(gameEventMemory.events.filter(e=>['z-first','a-second','m-third'].includes(e.id)).map(e=>e.payload))");
 h.run("for(const e of gameEventMemory.events.filter(e=>['z-first','a-second','m-third'].includes(e.id)))executeGameEvent(e,{replay:true});showScreen('app-kakao');openChat('minhyuk')");
 assert.equal(h.run("JSON.stringify(gameEventMemory.events.filter(e=>['z-first','a-second','m-third'].includes(e.id)).map(e=>e.payload))"),before);
 assert.deepEqual(JSON.parse(h.run("JSON.stringify(activeChat.messages.filter(m=>['z-first','a-second','m-third'].includes(m.id)).map(m=>m.id))")),['z-first','a-second','m-third']);
});
test('photo transport and delayed ordinary reply share delivery order without touching photo state',()=>{
 const h=ready();h.run("photoShareOpen('photo-9376');photoShareSelect('photo-share-v1:meal-minhyuk');photoShareUI.assetReady=true;photoShareConfirm()");h.advance(3100);
 const before=h.run('JSON.stringify(photoShareState())'),at=h.run("photoShareState().records['photo-share-v1:meal-minhyuk'].storyTimestamp");
 send(h,'minhyuk','order-test-followup',at+2000);h.run("showScreen('app-kakao');openChat('minhyuk')");
 assert.deepEqual(JSON.parse(h.run("JSON.stringify(activeChat.messages.filter(m=>m.id==='order-test-followup'||m.id?.startsWith('photo-share-v1:meal-minhyuk:')).map(m=>m.id))")),['photo-share-v1:meal-minhyuk:player','photo-share-v1:meal-minhyuk:reply','order-test-followup']);
 assert.equal(h.run('JSON.stringify(photoShareState())'),before);
});
test('a queued overdue message receives a new delivery order during startup, not an old story position',()=>{
 const h=ready(),at=new Date(2026,9,28,12).getTime();send(h,'minhyuk','order-test-first',at);
 h.run(`stageSevenQueueMessage('order-test-overdue','minhyuk','민혁','later','稍後',1000,{notify:false,storyTimestamp:${at-1000}})`);
 const snap=h.snapshot();const data=JSON.parse(snap.local.find(([key])=>key==='phone-sim-event-store-v2')[1]);data.events.find(e=>e.id==='order-test-overdue').scheduledAt=1;snap.local=snap.local.map(([key,value])=>[key,key==='phone-sim-event-store-v2'?JSON.stringify(data):value]);
 const r=ready(snap);r.run("showScreen('app-kakao');openChat('minhyuk')");
 assert.deepEqual(JSON.parse(r.run("JSON.stringify(activeChat.messages.filter(m=>m.id?.startsWith('order-test-')).map(m=>m.id))")),['order-test-first','order-test-overdue']);
});
