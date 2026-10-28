const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {game}=require('./helpers/simulator-harness');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const NIGHT='after-work-drinks-shownu-v1';
function night(branch='ordinary'){
 const h=game();h.start();h.open();h.select('join');
 const choices={ordinary:['pay','tease','contact'],happy:['glad','waited','care'],question:['comfortable','stay','question'],different:['glad','waited','only']}[branch];
 for(const id of choices)assert.equal(h.select(id),true);
 assert.equal(h.state().stage,'morning-pending');return h;
}
function home(h){h.run("showScreen('home-screen')")}
function click(h){return h.run('advanceFromMorningNotice(`notification:${MORNING_ADVANCE_EVENT_ID}`)')}
function prompt(h){return h.messages().filter(m=>String(m.id).startsWith(NIGHT+':interactive:morning:')&&String(m.id).endsWith(':prompt'))}
function visible(h){return h.run('gameEventMemory.notifications.some(n=>isMorningAdvanceNotice(n)&&!n.dismissedAt&&narrativeNotificationVisible(n))')}

test('Fresh/unfinished invitation and each intermediate stage hide the morning notification',()=>{
 const h=game();h.start();home(h);assert.equal(visible(h),false);h.open();h.select('join');home(h);assert.equal(visible(h),false);
 h.open();h.select('pay');home(h);assert.equal(visible(h),false);h.open();h.select('tease');home(h);assert.equal(visible(h),false);
 assert.equal(prompt(h).length,0);
});
for(const answer of ['decline','later'])test(`${answer}: neither morning notification nor prompt is unlocked`,()=>{
 const h=game();h.start();h.open();h.select(answer);home(h);assert.equal(visible(h),false);assert.equal(h.run('advanceFromMorningNotice(`notification:${MORNING_ADVANCE_EVENT_ID}`)'),false);assert.equal(prompt(h).length,0);
});
test('Completing all rounds exposes one persistent system notification',()=>{
 const h=night();home(h);assert.equal(visible(h),true);assert.equal(h.notifications().filter(n=>n.action==='advance-drinking-morning').length,1);
 assert.equal(h.run('narrativeDisplayDate().getDate()'),23);assert.equal(prompt(h).length,0);
});
test('Explicit early stop finishes the evening without inventing the skipped messages',()=>{
 const h=game();h.start();h.open();h.select('join');h.select('skip');h.select('stop');home(h);assert.equal(visible(h),true);click(h);
 assert.equal(prompt(h).length,1);assert.equal(h.state().morningBranch,'ordinary');assert.ok(!h.messages().some(m=>String(m.id).includes(':boundary:')));
});
test('Changing Apps never advances time, and the notification remains usable on return',()=>{
 const h=night();h.run("showScreen('app-instagram');showScreen('app-notes');showScreen('app-gallery')");assert.equal(h.state().stage,'morning-pending');assert.equal(prompt(h).length,0);
 home(h);assert.equal(visible(h),true);click(h);assert.equal(prompt(h).length,1);assert.equal(h.run('currentScreen'),'home-screen');
});
test('Refresh restores the pending notification without advancing or creating a notification',()=>{
 const h=night(),r=game(h.snapshot());r.start();home(r);assert.equal(visible(r),true);assert.equal(prompt(r).length,0);assert.ok(!r.notifications().some(n=>n.eventId.includes(':interactive:morning:')));
});
for(const [branch,text,reply] of [
 ['ordinary','어제 잘 들어갔어? 머리는 안 아프고?','fine'],
 ['happy','어제 나랑 있는 게 그렇게 좋았냐 ㅋㅋ','honest'],
 ['question','근데 어제 그 질문은 무슨 뜻이었어?','sincere'],
 ['different','어제 너 평소랑 좀 다르더라 ㅋㅋ 많이 취했었나 봐.','ask']
])test(`System action reuses the ${branch} prompt, notification and player replies`,()=>{
 const h=night(branch);home(h);click(h);
 assert.equal(h.run('currentScreen'),'home-screen');assert.equal(h.state().stage,'morning');assert.equal(visible(h),false);
 const messages=prompt(h);assert.equal(messages.length,1);assert.equal(messages[0].text,text);assert.ok(messages[0].translation);assert.equal(messages[0].day,'10월 24일 토요일');assert.equal(messages[0].time,'9:12');
 const notice=h.notifications().filter(n=>n.eventId===messages[0].id);assert.equal(notice.length,1);assert.equal(notice[0].storyTimestamp,messages[0].storyTimestamp);assert.equal(notice[0].destination.chatId,'shownu');
 h.open();assert.ok(h.run('drinkingNightOptions().length')>=3);assert.equal(h.select(reply),true);assert.equal(h.state().stage,'complete');assert.equal(h.state().completed,true);
});
test('Rapid double-clicks and a stale API call cannot send a second prompt',()=>{
 const h=night();home(h);click(h);click(h);assert.equal(h.run("activateDrinkingMorning('2026-10-24')"),false);assert.equal(prompt(h).length,1);assert.equal(h.notifications().filter(n=>n.eventId===prompt(h)[0].id).length,1);
});
test('Refresh preserves the morning time, branch, next choices and unique notification',()=>{
 const h=night('question');home(h);click(h);const id=prompt(h)[0].id;
 const r=game(h.snapshot());r.start();home(r);assert.equal(visible(r),false);assert.equal(r.state().stage,'morning');assert.equal(r.state().morningBranch,'question');assert.equal(prompt(r).length,1);assert.equal(r.notifications().filter(n=>n.eventId===id).length,1);
 assert.equal(r.run('narrativeDisplayDate().getDate()'),24);assert.equal(r.run('narrativeClockDate().getHours()'),9);r.open();assert.equal(r.select('curious'),true);
});
test('Home calendar date, lock date and clock use the saved story morning rather than wall date',()=>{
 const h=night();home(h);click(h);assert.equal(h.node('#home-screen .calendar-weekday').textContent,'토요일');assert.equal(h.node('#home-screen .calendar-date').textContent,'24');assert.equal(h.node('#home-screen [data-app="calendar"] text').textContent,'24');
 assert.equal(h.node('#lock-date').textContent,'10월 24일 토요일');assert.equal(h.node('#status-time').textContent,'9:12');assert.equal(h.run('calendarStoryToday()'),'2026-10-24');
 h.jump(3*86400000);h.run('updateTime()');assert.equal(h.node('#status-time').textContent,'9:12');assert.equal(h.state().stage,'morning');
});
test('Pending delivery survives reload after the player clicked, without replaying completed content',()=>{
 const h=night();home(h);h.run('processingGameEvents=true');click(h);assert.equal(h.state().pendingReply.stage,'morning-prompt');assert.equal(prompt(h).length,0);
 const r=game(h.snapshot());r.start();home(r);assert.equal(prompt(r).length,1);assert.equal(r.state().pendingReply,null);assert.equal(r.state().stage,'morning');assert.equal(visible(r),false);
});
test('A main-save failure rolls back the transition before any morning message or notice',()=>{
 const h=night();home(h);const before=JSON.stringify(h.snapshot()),state=JSON.stringify(h.state());h.run("const originalSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='phone-sim-lost-phone-story-v1')throw new Error('isolated save failure');originalSet(key,value)}");
 click(h);assert.equal(JSON.stringify(h.state()),state);assert.equal(JSON.stringify(h.snapshot()),before);assert.equal(prompt(h).length,0);assert.equal(visible(h),true);assert.match(h.node('#toast').textContent,/저장|儲存/);
});
test('An inconsistent branch, missing delivery or wrong morning date is not guessed or reset',()=>{
 for(const corruption of ["drinkingNightState().morningBranch='different'","drinkingNightState().morningDate='2026-10-25'","delete drinkingNightState().choices.invite", "drinkingNightState().choices.boundary.replyId='missing-reply'"]){
  const h=night('question');h.run(corruption);const before=JSON.stringify(h.state());home(h);assert.equal(visible(h),false);assert.equal(h.run('advanceFromMorningNotice(`notification:${MORNING_ADVANCE_EVENT_ID}`)'),false);assert.equal(JSON.stringify(h.state()),before);assert.equal(prompt(h).length,0);
 }
});
test('A locked device cannot execute the notification action before unlocking',()=>{
 const h=night();home(h);h.run('phoneUnlocked=false');assert.equal(h.run('advanceFromMorningNotice(`notification:${MORNING_ADVANCE_EVENT_ID}`)'),false);assert.equal(prompt(h).length,0);
});
test('A currently ringing original call blocks time advance until the player finishes it',()=>{
 const h=night();h.advance(120000);assert.equal(h.story().call.status,'ringing');home(h);assert.equal(visible(h),true);assert.equal(h.run('advanceFromMorningNotice(`notification:${MORNING_ADVANCE_EVENT_ID}`)'),false);
 h.run("finishLostPhoneCall('declined')");click(h);assert.equal(prompt(h).length,1);
});
test('Advancing morning does not restart original calls or release old midnight questions',()=>{
 const h=night();const original=h.events().filter(e=>e.type==='lost-phone-incoming-call').map(e=>e.id);home(h);click(h);h.advance(300000);
 assert.equal(h.story().call.status,'idle');assert.deepEqual(h.events().filter(e=>e.type==='lost-phone-incoming-call').map(e=>e.id),original);assert.ok(!h.messages().some(m=>String(m.id).startsWith('missing-phone-checkin')));assert.equal(prompt(h).length,1);
});
test('Existing messages, choices, route and unrelated App storage remain intact',()=>{
 const h=night();h.run("localStorage.setItem('unrelated-key','keep');localStorage.setItem('phone-sim.photos-favorites.v1','[\"photo-9366\"]')");const prior=h.messages().map(m=>[m.id,m.text]),route=h.story().openingRoute;home(h);click(h);
 assert.deepEqual(h.messages().filter(m=>!String(m.id).includes(':interactive:morning:')).map(m=>[m.id,m.text]),prior);assert.equal(h.story().openingRoute,route);assert.equal(h.run("localStorage.getItem('unrelated-key')"),'keep');assert.equal(h.run("localStorage.getItem('phone-sim.photos-favorites.v1')"),'["photo-9366"]');
});
test('Home card is removed; notification actions retain touch targets and safe areas',()=>{
 assert.doesNotMatch(html,/id="morning-step-(?:card|next)"|#home-content|has-morning-step/);
 assert.match(html,/system-notice-action[^}]*min-height:44px/);
 assert.match(html,/notification-banner\.system-action[^}]*safe-area-inset-top/);
 assert.match(html,/lang="zh-Hant"/);
});

test('Unavailable event storage stops before the morning marker or pending delivery is created',()=>{
 const h=night();home(h);const before=JSON.stringify(h.state());h.run("const originalEventSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key==='phone-sim-event-store-v2')throw new Error('isolated event-store failure');originalEventSet(key,value)}");click(h);
 assert.equal(JSON.stringify(h.state()),before);assert.equal(prompt(h).length,0);assert.equal(visible(h),true);
});
