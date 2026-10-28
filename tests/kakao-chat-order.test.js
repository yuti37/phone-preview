const test=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/simulator-harness');
function ready(){const h=game();h.start();h.run("showScreen('app-kakao');setKakaoTab('chats')");return h}
function order(h){h.run('renderKakaoChats()');return [...h.node('#friends-list').innerHTML.matchAll(/data-chat="([^"]+)"/g)].map(m=>m[1])}
function replace(h,chats){h.run('CONFIG.chats='+JSON.stringify(chats))}
function msg(id,day,time,extra={}){return {id,day,time,text:id,from:'형원',...extra}}
function chat(id,message,unread=0){return {id,title:id,type:id==='group'?'group':'private',messages:[message],unread}}
function stamp(h,m){return h.run('kakaoChatMessageTimestamp('+JSON.stringify(m)+')')}
function deliver(h,chatId,id,day,time,from){return h.run(`executeGameEvent(createGameEvent(${JSON.stringify({id,type:'kkt-message',source:'kakao',shouldNotify:false,payload:{chatId,message:msg(id,day,time,{from})}})}))`)}

test('Actual seven-room fixture: Changkyun Oct 22 21:10 correctly follows Kihyun Oct 23 09:55',()=>{
 const h=ready();assert.deepEqual(order(h),['group','shownu','manager','minhyuk','kihyun','changkyun','jooheon']);
 assert.equal(h.run("latestKakaoMessage(CONFIG.chats.find(c=>c.id==='changkyun')).day"),'10월 22일 목요일');
 assert.equal(h.run("latestKakaoMessage(CONFIG.chats.find(c=>c.id==='kihyun')).day"),'10월 23일 금요일');
 assert.equal(h.run('CONFIG.chats.some(c=>c.pinned||c.isPinned)'),false);
});
test('Private/group mix sorts full date before time, regardless of unread',()=>{
 const h=ready();replace(h,[chat('old',msg('old','10월 23일','23:00'),100),chat('group',msg('group','10월 24일','09:00')),chat('new',msg('new','10월 24일','21:10'))]);assert.deepEqual(order(h),['new','group','old']);
});
test('Authoritative storyTimestamp wins over real delivery timestamps and stale display labels',()=>{
 const h=ready(),story=new Date(2026,9,23,10).getTime(),wall=new Date(2035,0,1).getTime();
 assert.equal(stamp(h,msg('a','10월 23일','09:00',{storyTimestamp:story,timestamp:wall})),story);
 replace(h,[chat('older',msg('a','10월 23일','09:00',{storyTimestamp:story,timestamp:wall})),chat('newer',msg('b','10월 24일','09:00'))]);assert.deepEqual(order(h),['newer','older']);
});
test('Legacy dated labels take precedence over wall delivery metadata without mutating messages',()=>{
 const h=ready(),m=msg('legacy','10월 22일 목요일','21:10',{timestamp:new Date(2030,1,2).getTime()});
 assert.equal(stamp(h,m),new Date(2026,9,22,21,10).getTime());replace(h,[chat('legacy',m)]);const before=h.run('JSON.stringify(CONFIG.chats)');order(h);assert.equal(h.run('JSON.stringify(CONFIG.chats)'),before);
});
test('Undated old messages recover only exact event IDs, never today or unrelated events',()=>{
 const h=ready();h.run("gameEventMemory.events.push({id:'exact',payload:{message:{id:'exact',day:'10월 21일',time:'15:00'}}})");
 assert.equal(stamp(h,{id:'exact',text:'saved',time:'15:00'}),new Date(2026,9,21,15).getTime());assert.equal(stamp(h,{id:'unknown',text:'saved',time:'23:59'}),null);
});
test('Invalid dates/times stay unknown; explicit years, AM/PM, numeric and ISO stamps are supported',()=>{
 const h=ready();for(const m of [msg('bad','2026-02-30','12:00'),msg('bad','10월 24일','25:00'),msg('bad','10월 24일','오후 13:00')])assert.equal(stamp(h,m),null);
 assert.equal(stamp(h,msg('year','2027-01-01','오전 12:01')),new Date(2027,0,1,0,1).getTime());
 assert.equal(stamp(h,msg('pm','2026년 10월 24일','오후 9:10')),new Date(2026,9,24,21,10).getTime());
 assert.equal(stamp(h,{timestamp:'2026-10-24T09:00:00+09:00'}),Date.parse('2026-10-24T09:00:00+09:00'));
});
test('Device calendar changes cannot move yearless history between years',()=>{
 const h=ready(),m=msg('stable','10월 23일 금요일','09:55'),before=stamp(h,m);h.jump(10*366*86400000);assert.equal(stamp(h,m),before);
});
test('Latest valid message and preview use the same source despite unsorted history or date dividers',()=>{
 const h=ready();replace(h,[{id:'a',title:'a',messages:[msg('latest','10월 24일','09:00'),msg('older','10월 23일','23:00'),{type:'date-divider',text:'future',storyTimestamp:9e12},msg('','10월 25일','10:00')]}]);order(h);assert.match(h.node('#friends-list').innerHTML,/latest/);assert.doesNotMatch(h.node('#friends-list').innerHTML,/future|23:00/);
});
test('Equal timestamps sort by stable room ID even when source array order changes',()=>{
 const h=ready(),a=chat('a',msg('a','10월 24일','09:00')),b=chat('b',msg('b','10월 24일','09:00'));replace(h,[b,a]);assert.deepEqual(order(h),['a','b']);replace(h,[a,b]);assert.deepEqual(order(h),['a','b']);
});
test('Explicit pin flags retain pin order; normal rooms are not implicitly pinned',()=>{
 const h=ready();replace(h,[chat('new',msg('new','10월 24일','09:00')),{...chat('pin',msg('pin','10월 20일','09:00')),pinned:true}]);assert.deepEqual(order(h),['pin','new']);
});
for(const [name,from] of [['player send','형원'],['incoming reply','창균이']])test(name+' updates visible list immediately via real event handler',()=>{
 const h=ready();assert.notEqual(order(h)[0],'changkyun');deliver(h,'changkyun','sort-'+name,'10월 24일','21:10',from);
 assert.equal([...h.node('#friends-list').innerHTML.matchAll(/data-chat="([^"]+)"/g)][0][1],'changkyun');assert.equal(order(h)[0],'changkyun');assert.match(h.node('#friends-list').innerHTML,/21:10/);
});
test('Reading and clearing unread counts never changes order, preview or friend statuses',()=>{
 const h=ready(),before=order(h),statuses=h.run('JSON.stringify(CONFIG.contacts.map(c=>c.note))');const previews=h.run('JSON.stringify(CONFIG.chats.map(c=>latestKakaoMessage(c)?.text))');h.run("openChat('kihyun');CONFIG.chats.forEach(c=>c.unread=0);setKakaoTab('chats')");assert.deepEqual(order(h),before);assert.equal(h.run('JSON.stringify(CONFIG.chats.map(c=>latestKakaoMessage(c)?.text))'),previews);assert.equal(h.run('JSON.stringify(CONFIG.contacts.map(c=>c.note))'),statuses);assert.doesNotMatch(h.node('#friends-list').innerHTML,/kakao-unread/);
});
test('Real event-store reload retains dynamic latest message, preview and stable ordering',()=>{
 const h=ready();deliver(h,'changkyun','sort-reload','10월 24일','21:10','창균이');const before=order(h),r=game(h.snapshot());r.start();assert.deepEqual(order(r),before);assert.equal(r.run("latestKakaoMessage(CONFIG.chats.find(c=>c.id==='changkyun')).id"),'sort-reload');
});
test('Legacy completed event missing storyTimestamp restores date-first ordering without changing storage schema',()=>{
 const h=game({local:[['phone-sim-event-store-v2',JSON.stringify({version:2,events:[{id:'legacy-sort',type:'kkt-message',source:'kakao',status:'completed',createdAt:Date.now(),effects:{},payload:{chatId:'changkyun',message:msg('legacy-sort','10월 24일 토요일','21:10',{timestamp:new Date(2030,0,1).getTime(),from:'창균이'})}}],notifications:[]})]]});h.start();assert.equal(order(h)[0],'changkyun');assert.equal(h.run("latestKakaoMessage(CONFIG.chats.find(c=>c.id==='changkyun')).id"),'legacy-sort');
});
test('Unread badge and preview content are preserved while the row order changes',()=>{
 const h=ready();replace(h,[chat('old',msg('older preview','10월 23일','23:00'),12),chat('new',msg('newer preview','10월 24일','09:00'),0)]);assert.deepEqual(order(h),['new','old']);assert.match(h.node('#friends-list').innerHTML,/<span class="kakao-unread">12<\/span>/);assert.match(h.node('#friends-list').innerHTML,/older preview/);assert.match(h.node('#friends-list').innerHTML,/newer preview/);
});
