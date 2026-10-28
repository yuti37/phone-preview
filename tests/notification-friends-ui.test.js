const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {game}=require('./helpers/simulator-harness');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function notices(h){h.run(`gameEventMemory.notifications=[
 {id:'ui-kakao',eventId:'ui-kakao-event',app:'kakao',source:'카카오톡',sender:'유기현',summary:'영상 확인했어?',createdAt:Date.now(),destination:{screen:'app-kakao',chatId:'kihyun'},readAt:null,dismissedAt:null},
 {id:'ui-ig',eventId:'ui-ig-event',app:'instagram',source:'Instagram',sender:'민혁',summary:'내일 그 카페 갈래?',createdAt:Date.now()-60000,destination:{screen:'app-instagram',view:'thread',conversationId:'dm-minhyuk'},readAt:null,dismissedAt:null},
 {id:'ui-phone',eventId:'ui-phone-event',app:'phone',source:'전화',sender:'셔누형',summary:'부재중 전화',createdAt:Date.now()-120000,destination:{screen:'app-phone'},readAt:null,dismissedAt:null}];
 gameEventMemory.events.push({id:'ui-kakao-event',type:'kkt-message',status:'completed',payload:{message:{text:'영상 확인했어?',translation:'確認影片了嗎？'}}});saveGameEventStore();renderNotificationCenter()`)}
function ready(){const h=game();h.start();notices(h);return h}

test('Notification render preserves order and all stored data while using real app icon shapes',()=>{
 const h=ready(),before=JSON.stringify(h.snapshot());h.run('renderNotificationCenter()');const markup=h.node('#notification-list').innerHTML;
 assert.ok(markup.indexOf('ui-kakao')<markup.indexOf('ui-ig'));assert.ok(markup.indexOf('ui-ig')<markup.indexOf('ui-phone'));
 assert.match(markup,/ico-kakao/);assert.match(markup,/TALK/);assert.match(markup,/ico-instagram/);assert.match(markup,/ico-phone/);assert.doesNotMatch(markup,/>T<|notification-dismiss[^>]*>×/);assert.match(markup,/카카오톡/);assert.match(markup,/유기현/);assert.match(markup,/영상 확인했어/);assert.match(markup,/지금/);assert.equal(JSON.stringify(h.snapshot()),before);
});
test('Available bilingual preview is shown without changing or inventing message data',()=>{
 const h=ready();assert.match(h.node('#notification-list').innerHTML,/確認影片了嗎？/);assert.equal(h.run("notificationTranslation(gameEventMemory.notifications[1])"),'');h.run("gameEventMemory.notifications[1].summaryTranslation='明天要不要去那間咖啡廳？';renderNotificationCenter()");assert.match(h.node('#notification-list').innerHTML,/明天要不要去那間咖啡廳？/);
});
test('Management is temporary view state and never changes the save',()=>{
 const h=ready(),before=JSON.stringify(h.snapshot());h.node('#notifications-manage').click();assert.equal(h.run('notificationCenterUI.managing'),true);assert.match(h.node('#notification-list').innerHTML,/actions-open/);assert.equal(h.node('#notifications-manage').textContent,'완료');assert.equal(JSON.stringify(h.snapshot()),before);h.node('#notifications-manage').click();assert.doesNotMatch(h.node('#notification-list').innerHTML,/actions-open/);
});
test('Clearing one notification uses the existing persisted dismiss flow and preserves others',()=>{
 const h=ready();h.run("dismissGameNotification('ui-ig')");assert.ok(h.notifications().find(n=>n.id==='ui-ig').dismissedAt);assert.equal(h.notifications().find(n=>n.id==='ui-kakao').dismissedAt,null);assert.doesNotMatch(h.node('#notification-list').innerHTML,/data-notification-id="ui-ig"/);const r=game(h.snapshot());r.start();assert.ok(r.notifications().find(n=>n.id==='ui-ig').dismissedAt);assert.match(r.node('#notification-list').innerHTML,/ui-kakao/);
});
test('KakaoTalk and Instagram notification destinations still open their original content',()=>{
 const h=ready();h.run("openNotification('ui-kakao')");assert.equal(h.run('currentScreen'),'app-kakao');assert.equal(h.run('activeChat.id'),'kihyun');h.run("openNotification('ui-ig')");assert.equal(h.run('currentScreen'),'app-instagram');assert.equal(h.run('igActiveConversation'),'dm-minhyuk');assert.equal(h.run('igView'),'thread');
});
test('Rerender preserves the notification scroll position and current management state',()=>{
 const h=ready();h.node('#notification-list').scrollTop=165;h.node('#notifications-manage').click();h.run('renderNotificationCenter()');assert.equal(h.node('#notification-list').scrollTop,165);assert.equal(h.run('notificationCenterUI.managing'),true);
});
test('Swipe reveals a clear action without dismissing or opening the message; tap after swipe is suppressed',()=>{
 const h=ready(),before=JSON.stringify(h.snapshot());h.run(`const card={dataset:{notificationCard:'ui-ig'},classList:{contains:()=>false}};const target={closest:s=>s==='[data-notification-card]'?card:null};notificationCenterPointerDown({target,isPrimary:true,button:0,pointerId:1,clientX:230,clientY:200});notificationCenterPointerMove({pointerId:1,clientX:170,clientY:203,cancelable:true,preventDefault(){}});notificationCenterPointerEnd({type:'pointerup',pointerId:1,clientX:140,clientY:203})`);
 assert.equal(h.run('notificationCenterUI.revealedId'),'ui-ig');assert.match(h.node('#notification-list').innerHTML,/actions-open/);assert.equal(JSON.stringify(h.snapshot()),before);assert.equal(h.run('notificationCenterClickIsSuppressed({preventDefault(){},stopPropagation(){}})'),true);
});
test('Vertical scrolling and canceled gestures never reveal or clear a card',()=>{
 const h=ready();h.run(`const card={dataset:{notificationCard:'ui-ig'},classList:{contains:()=>false}};const target={closest:s=>s==='[data-notification-card]'?card:null};notificationCenterPointerDown({target,pointerId:2,clientX:180,clientY:100});notificationCenterPointerMove({pointerId:2,clientX:182,clientY:170});notificationCenterPointerEnd({type:'pointerup',pointerId:2,clientX:182,clientY:230})`);assert.equal(h.run('notificationCenterUI.revealedId'),null);assert.equal(h.notifications().filter(n=>n.dismissedAt).length,0);
});
test('System morning action is protected from clear and retains the original action route',()=>{
 const h=game();h.start();h.open();for(const id of ['join','pay','tease','contact'])h.select(id);h.run("showScreen('home-screen');openNotificationCenter()");h.node('#notifications-manage').click();const markup=h.node('#notification-list').innerHTML;
 const id=h.notifications().find(n=>n.action==='advance-drinking-morning').id;assert.match(markup,/隔天早上/);assert.doesNotMatch(markup,new RegExp('data-notification-dismiss="'+id+'"'));h.run(`openNotification(${JSON.stringify(id)})`);assert.equal(h.state().stage,'morning');assert.equal(h.run('currentScreen'),'app-notifications');
});
test('Friends layout selectors are scoped away from chat-list and message avatars',()=>{
 assert.match(html,/#app-kakao #friends-list > \.friend-row\{[^}]*grid-template-columns:var\(--friend-avatar-size\) minmax\(0,1fr\) auto/);assert.match(html,/#app-kakao #friends-list > \.friend-row > \.avatar\{[^}]*min-width:var\(--friend-avatar-size\)/);assert.match(html,/#app-kakao #friends-list > \.friend-row \.preview\{[^}]*text-overflow:ellipsis/);assert.match(html,/#app-notifications \.notification-body\{[^}]*min-height:0[^}]*overflow-y:auto[^}]*safe-area-inset-bottom/);
});
test('Same-App adjacency adds visual grouping without hiding or reordering notices',()=>{
 const h=ready();h.run("gameEventMemory.notifications[1].app='kakao';renderNotificationCenter()");assert.match(h.node('#notification-list').innerHTML,/same-app/);assert.equal((h.node('#notification-list').innerHTML.match(/data-notification-card=/g)||[]).length,3);
});

test('App icon colors and avatar placeholder hiding are explicitly scoped against older generic styles',()=>{
 assert.match(html,/#app-notifications \.notification-app-icon\.ico-instagram\{[^}]*background:radial-gradient/);assert.match(html,/#app-notifications \.notification-app-icon svg\{[^}]*padding:0/);assert.match(html,/#app-kakao #friends-list > \.friend-row > \.avatar\{[^}]*font-size:0;color:transparent/);
});
