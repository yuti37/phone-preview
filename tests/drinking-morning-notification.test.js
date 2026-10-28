const test=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/simulator-harness');
const ID='after-work-drinks-shownu-v1:system:advance-morning';
const NOTICE='notification:'+ID;
function ready(){const h=game();h.start();h.open();for(const id of ['join','pay','tease','contact'])assert.equal(h.select(id),true);return h;}
function notice(h){return h.notifications().find(n=>n.eventId===ID)}
function event(h){return h.events().find(e=>e.id===ID)}
function visible(h){return h.run(`gameEventMemory.notifications.some(n=>n.eventId==='${ID}'&&!n.dismissedAt&&narrativeNotificationVisible(n))`)}
function prompt(h){return h.messages().filter(m=>m.id?.includes(':interactive:morning:')&&m.id.endsWith(':prompt'))}

test('Morning system event has its own stable identity and bilingual metadata',()=>{
 const h=ready(),n=notice(h);assert.equal(n.app,'system');assert.equal(n.action,'advance-drinking-morning');assert.equal(n.source,'시스템');assert.equal(n.sourceTranslation,'系統');assert.equal(n.title,'하루 마무리');assert.equal(n.titleTranslation,'結束今天');assert.equal(n.summary,'오늘은 여기까지.');assert.equal(n.summaryTranslation,'今天就到這裡。');assert.equal(n.actionLabel,'다음 날 아침');assert.equal(n.actionTranslation,'隔天早上');assert.equal(event(h).type,'system-story-action');assert.equal(prompt(h).length,0);
});
test('First transition shows one banner; repeat renders do not replay it',()=>{
 const h=ready();assert.equal(h.node('#notification-banner').classList.contains('show'),true);const first=event(h).effects.bannerPresentedAt;h.advance(4300);assert.equal(h.node('#notification-banner').classList.contains('show'),false);h.run("showScreen('home-screen');showScreen('app-notes');syncMorningAdvanceNotice()");assert.equal(h.node('#notification-banner').classList.contains('show'),false);assert.equal(event(h).effects.bannerPresentedAt,first);assert.equal(h.events().filter(e=>e.id===ID).length,1);assert.equal(h.notifications().filter(n=>n.eventId===ID).length,1);assert.equal(h.state().stage,'morning-pending');
});
test('Banner close leaves a working entry in both existing notification lists',()=>{
 const h=ready();h.node('#banner-close').click();h.run('renderLockNotifications();openNotificationCenter()');assert.equal(h.state().stage,'morning-pending');assert.equal(visible(h),true);assert.match(h.node('#lock-notice').innerHTML,/다음 날 아침/);assert.match(h.node('#notification-list').innerHTML,/隔天早上/);assert.doesNotMatch(h.node('#notification-list').innerHTML,new RegExp(`data-notification-dismiss="${NOTICE}"`));h.run(`openNotification('${NOTICE}')`);assert.equal(prompt(h).length,1);assert.equal(h.run('currentScreen'),'app-notifications');assert.equal(visible(h),false);
});
test('Dismissing the transient system notice never consumes the pending action',()=>{
 const h=ready();h.run(`dismissGameNotification('${NOTICE}')`);assert.equal(notice(h).dismissedAt,null);assert.equal(h.state().stage,'morning-pending');assert.equal(visible(h),true);
});
test('Reload restores notification quietly without advancing',()=>{
 const h=ready(),r=game(h.snapshot());r.start();r.run("showScreen('home-screen')");assert.equal(visible(r),true);assert.equal(r.node('#notification-banner').classList.contains('show'),false);assert.equal(prompt(r).length,0);assert.equal(r.notifications().filter(n=>n.eventId===ID).length,1);
});
test('Old morning-pending save without the new event gains one quiet notification',()=>{
 const h=ready();h.run(`gameEventMemory.events=gameEventMemory.events.filter(e=>e.id!=='${ID}');gameEventMemory.notifications=gameEventMemory.notifications.filter(n=>n.eventId!=='${ID}');saveGameEventStore()`);const r=game(h.snapshot());r.start();r.run("showScreen('home-screen')");assert.equal(visible(r),true);assert.equal(event(r).payload.quietRestore,true);assert.equal(r.node('#notification-banner').classList.contains('show'),false);assert.equal(prompt(r).length,0);
});
test('An action opened from another App does not navigate to KakaoTalk',()=>{
 const h=ready();h.run("showScreen('app-notes')");h.run(`openNotification('${NOTICE}')`);assert.equal(h.run('currentScreen'),'app-notes');assert.equal(prompt(h).length,1);assert.equal(h.run('narrativeClockDate().getHours()'),9);assert.equal(h.run('narrativeClockDate().getMinutes()'),12);
});
test('Locked notification waits for actual passcode then advances without opening KakaoTalk',()=>{
 const h=ready();h.run("phoneUnlocked=false;showScreen('lock-screen')");h.run(`openNotification('${NOTICE}')`);assert.equal(h.run('currentScreen'),'passcode-screen');assert.equal(h.state().stage,'morning-pending');h.run("for(const d of '0618')enterPasscodeDigit(d)");h.advance(230);assert.equal(h.run('currentScreen'),'home-screen');assert.equal(prompt(h).length,1);
});
test('Canceling unlock does not consume the system action',()=>{
 const h=ready();h.run("phoneUnlocked=false;showScreen('lock-screen')");h.run(`openNotification('${NOTICE}')`);h.node('#passcode-cancel').click();assert.equal(prompt(h).length,0);assert.equal(visible(h),true);
});
test('A ringing call suppresses and defers the first banner until safe',()=>{
 const h=ready();h.run(`gameEventMemory.events=gameEventMemory.events.filter(e=>e.id!=='${ID}');gameEventMemory.notifications=gameEventMemory.notifications.filter(n=>n.eventId!=='${ID}');$('#notification-banner').classList.remove('show','system-action');lostPhoneStory.call.status='ringing';syncMorningAdvanceNotice()`);assert.equal(h.node('#notification-banner').classList.contains('system-action'),false);assert.equal(prompt(h).length,0);assert.equal(event(h).status,'deferred');h.run("lostPhoneStory.call.status='idle';resumeNarrativeEvents()");assert.equal(visible(h),true);assert.equal(h.node('#notification-banner').classList.contains('system-action'),true);assert.equal(h.node('#notification-banner').classList.contains('show'),true);
});
test('Reload of a deferred system event does not replay its banner',()=>{
 const h=ready();h.run(`gameEventMemory.events=gameEventMemory.events.filter(e=>e.id!=='${ID}');gameEventMemory.notifications=gameEventMemory.notifications.filter(n=>n.eventId!=='${ID}');$('#notification-banner').classList.remove('show','system-action');lostPhoneStory.call.status='ringing';syncMorningAdvanceNotice()`);h.run('saveLostPhoneStory()');const r=game(h.snapshot());r.start();r.run("lostPhoneStory.call.status='idle';showScreen('home-screen');resumeNarrativeEvents()");assert.equal(visible(r),true);assert.equal(r.node('#notification-banner').classList.contains('show'),false);
});
test('Old banner click cannot hide the new KakaoTalk notification created by the action',()=>{
 const h=ready();h.run("showScreen('home-screen')");h.node('#notification-banner [data-banner-open]').click();assert.equal(prompt(h).length,1);assert.equal(h.node('#notification-banner').dataset.notificationId,'notification:'+prompt(h)[0].id);assert.equal(h.node('#notification-banner').classList.contains('show'),true);assert.equal(h.node('#notification-banner').classList.contains('system-action'),false);
});
test('Failed main save leaves persistent action available with no false success',()=>{
 const h=ready();h.run("localStorage.setItem=(key)=>{if(key==='phone-sim-lost-phone-story-v1')throw new Error('test write blocked')}");assert.equal(h.run(`openNotification('${NOTICE}')`),false);assert.equal(h.state().stage,'morning-pending');assert.equal(visible(h),true);assert.equal(prompt(h).length,0);assert.equal(event(h).effects.actionCompletedAt,undefined);
});
test('A completed action is absent from both lists after refresh and cannot be replayed',()=>{
 const h=ready();h.run(`openNotification('${NOTICE}')`);const r=game(h.snapshot());r.start();r.run('renderLockNotifications();renderNotificationCenter()');assert.equal(visible(r),false);assert.ok(notice(r).dismissedAt);assert.doesNotMatch(r.node('#lock-notice').innerHTML,/다음 날 아침/);assert.doesNotMatch(r.node('#notification-list').innerHTML,/다음 날 아침/);assert.equal(r.run(`openNotification('${NOTICE}')`),false);assert.equal(prompt(r).length,1);
});
