const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf(`function ${name}(`);assert.ok(start>=0,name);for(let end=html.indexOf('}',start);end>=0;end=html.indexOf('}',end+1)){const s=html.slice(start,end+1);try{new vm.Script('('+s+')');return s}catch{}}throw new Error(name)}
function harness(snapshot=null,{sync=false}={}){
 const storage=new Map(snapshot?.storage||[]),nodes=new Map(),handlers=new Map(),calls={normal:0,world:0,legacyCheckin:0,baseInit:0};
 const config=vm.runInNewContext('('+html.match(/const CONFIG = (\{[\s\S]*?\n\});\s*<\/script>/)[1]+')');
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',hidden:false,dataset:{},addEventListener(){},classList:{contains:()=>true,add(){},remove(){}},querySelectorAll:()=>[]});return nodes.get(selector)};
 const c=vm.createContext({CONFIG:config,Date,console,$,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  GAME_EVENT_STORE_KEY:'phone-sim-event-store-v2',LOST_PHONE_STORY_KEY:'phone-sim-lost-phone-story-v1',LOST_PHONE_STORY_ID:'lost-phone-shownu-checkin-v1',STAGE_ELEVEN_ID:'phone-sim-stage11',
  lostPhoneStory:null,phoneUnlocked:true,activeChat:config.chats.find(chat=>chat.id==='shownu'),currentScreen:'app-kakao',activeKakaoTab:'chats',gameEventHandlers:handlers,
  gameEventMemory: snapshot?.events?structuredClone(snapshot.events):{version:2,events:[],notifications:[]},
  KAKAO_LEGACY_STORY_YEAR:2026,stageElevenNextStoryTimestamp(){throw new Error('Drinking messages must provide story time')},
  escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  isValidTraditionalTranslation:(zh,ko)=>!!zh&&zh!==ko,canonicalTranslationForMessage:()=>null,
  clearTimeout(){},notificationBannerTimer:null,renderLockNotifications(){},renderNotificationCenter(){},showNotificationBanner(){},markEventNotificationRead(){},renderChatMessages(){},renderKakaoChats(){},updateKakaoUnreadBadge(){},notifyGameEvent(){},
  initializeLostPhoneStory(){calls.baseInit++;c.lostPhoneStory=c.readLostPhoneStory()||{id:c.LOST_PHONE_STORY_ID,stageSeven:{},characterKnowledge:{shownu:{knowsPhoneLost:false}},openingRoute:'instagram_first'};},
  stageSevenObserveKakaoEvent(){},stageSevenGroupForChat:()=>({group:{id:'ordinary'},options:[['normal']]}),stageSevenSelect(){calls.normal++;return true},
  renderAfterWorkPanel(){calls.normal++},stageElevenActiveOptions:()=>[{id:'normal'}],stageElevenCommitActiveMessage(){calls.normal++;return true},
  stageElevenScheduleDrunkCheckin(){calls.legacyCheckin++;return {id:'legacy'}},
  cancelGameEvent(id){const e=c.gameEventMemory.events.find(e=>e.id===id);if(e)e.status='cancelled'},
  scheduleGameEvents(){if(sync)flush()}
 });
 for(const name of ['getGameEvent','registerGameEventHandler','registerKakaoEventHandler','saveGameEventStore','saveLostPhoneStory','readLostPhoneStory','eventOrder','createGameEvent','executeGameEvent','ensureGameNotification','sortNotifications','formatClockTime','kakaoMessageDate','kakaoMessageDateKey','kakaoMessageTimestamp','sortShownuTimeline','stageElevenStoryLabel','stageFiveChatMessageEvent','stageSevenQueueMessage','stageSevenSourceExists'])vm.runInContext(fn(name),c);
 handlers.set('stage-seven-world-event',()=>{calls.world++;return {notify:false}});
 vm.runInContext("registerKakaoEventHandler('kkt-message');",c);
 const prior=handlers.get('kkt-message');handlers.set('kkt-message',(event,options)=>{const r=prior(event,options);c.stageSevenObserveKakaoEvent(event,options);return r});
 const begin=html.indexOf('// Drinking night uses the shared');
 vm.runInContext(html.slice(begin,html.indexOf('const GAME_LOCAL_SAVE_KEYS=',begin)),c);
 vm.runInContext('globalThis.testChoices=DRINKING_NIGHT_CHOICES;globalThis.testMornings=DRINKING_MORNING;',c);
 // Rehydrate delivered messages with the production event executor, as startup does.
 for(const event of c.gameEventMemory.events)if(event.status==='completed')c.executeGameEvent(event,{replay:true,suppressNotifications:true});
 c.initializeLostPhoneStory();
 function flush(){if(flush.busy)return;flush.busy=true;try{let guard=0;while(c.gameEventMemory.events.some(e=>e.status==='pending')&&guard++<50){for(const e of c.gameEventMemory.events.filter(e=>e.status==='pending').sort(c.eventOrder))c.executeGameEvent(e)}}finally{flush.busy=false}}
 function select(id){return c.stageSevenSelect(`${'after-work-drinks-shownu-v1'}:interactive:${state().stage}`,id)}
 function state(){return c.drinkingNightState()}
 function nightMessages(){return config.chats.find(chat=>chat.id==='shownu').messages.filter(m=>String(m.id).includes(':interactive:'))}
 return {c,config,$,calls,flush,select,state,nightMessages,snapshot:()=>({storage:Array.from(storage),events:structuredClone(c.gameEventMemory)}),join(){assert.equal(select('join'),true);flush();assert.equal(state().stage,'tipsy')}};
}

test('Fresh invitation is a player choice, and prewritten outcome lines are not inserted',()=>{
 const h=harness();assert.equal(h.state().stage,'invite');
 const messages=h.config.chats.find(c=>c.id==='shownu').messages;
 assert.ok(messages.some(m=>m.id==='after-work-drinks-shownu-v1:invite'));
 assert.ok(!messages.some(m=>m.time==='18:14'&&m.text==='좋아. 어디서 볼까?'));
 assert.ok(!messages.some(m=>m.time==='23:48'&&m.text==='오늘 재밌었어. 조심히 가~'));
 assert.equal(h.nightMessages().length,0);
 assert.equal(h.state().invitationStatus,'pending');
});

test('Accept invitation schedules only the selected player message and the original reply',()=>{
 const h=harness();h.select('join');assert.ok(h.state().pendingReply);
 assert.equal(h.nightMessages().length,0);h.flush();
 assert.deepEqual(Array.from(h.nightMessages(),m=>m.text),['좋아. 어디서 볼까?','늘 가던 데. 끝나고 연락할게']);
 assert.equal(h.state().invitationStatus,'confirmed');assert.equal(h.state().stage,'tipsy');
 assert.equal(h.state().sentMessageIds.length,1);assert.equal(h.state().replyMessageIds.length,1);
});

test('Declining ends the invitation without drinking messages; deferring leaves a real decision pending',()=>{
 const h=harness();h.select('decline');h.flush();assert.equal(h.state().stage,'complete');assert.equal(h.state().invitationStatus,'declined');
 assert.equal(h.c.drinkingNightActive(),false);
 const later=harness();later.select('later');later.flush();assert.equal(later.state().stage,'invite');assert.equal(later.state().invitationStatus,'pending');
 assert.deepEqual(Array.from(later.c.drinkingNightOptions(),o=>o[0]),['join','decline']);later.join();
});

for(const [stage,ids] of [['tipsy',['pay','glad','comfortable']],['deeper',['waited','relaxed','tease','stay']],['boundary',['contact','care','question','only']]]){
 for(const id of ids)test(`Production queue and delivery: ${stage}/${id} has its own exact reply`,()=>{
  const h=harness();h.join();if(stage!=='tipsy'){h.select('pay');h.flush()}if(stage==='boundary'){h.select('tease');h.flush()}
  const option=h.c.testChoices[stage].find(o=>o[0]===id),before=h.nightMessages().length;
  assert.equal(h.select(id),true);assert.ok(h.state().pendingReply);assert.equal(h.select(id),false);
  assert.equal(h.c.drinkingNightOptions().length,0);h.flush();
  const added=h.nightMessages().slice(before);
  assert.equal(added[0].text,option[1]);assert.equal(added[0].translation,option[2]);
  assert.equal(added[1].text,option[3]);assert.equal(added[1].translation,option[4]);
  assert.equal(h.state().stage,option[5]);assert.equal(h.state().choices[stage].replyDelivered,true);
  assert.ok(h.state().shownuReceivedChoiceIds.includes(`${stage}:${id}`));
 });
}

test('Skipping stage one does not invent a message; stopping stage two leaves morning waiting',()=>{
 const h=harness();h.join();const before=h.nightMessages().length;
 h.select('skip');assert.equal(h.state().stage,'deeper');assert.equal(h.nightMessages().length,before);
 h.select('stop');assert.equal(h.state().stage,'morning-pending');assert.equal(h.nightMessages().length,before);
 h.flush();assert.equal(h.nightMessages().length,before);assert.equal(h.state().morningBranch,'ordinary');
});

test('Stopping stage three does not add a confession or any other outgoing message',()=>{
 const h=harness();h.join();h.select('pay');h.flush();h.select('tease');h.flush();
 const before=h.nightMessages().length;h.select('stop');h.flush();assert.equal(h.nightMessages().length,before);
 assert.equal(h.state().morningStatus,'awaiting-story-time');assert.equal(h.state().stage,'morning-pending');
 assert.equal(h.c.lostPhoneStory.truthToldAt,undefined);
});

for(const [branch,first,second,third] of [['ordinary','pay','tease','contact'],['happy','glad','waited','care'],['question','comfortable','stay','question'],['different','glad','waited','only']]){
 test(`Morning ${branch} stays pending until explicit story-time activation, then offers player replies`,()=>{
  const h=harness();h.join();h.select(first);h.flush();h.select(second);h.flush();h.select(third);h.flush();
  assert.equal(h.state().morningBranch,branch);assert.equal(h.state().stage,'morning-pending');
  const before=h.nightMessages().length;h.flush();assert.equal(h.nightMessages().length,before);
  assert.equal(h.c.activateDrinkingMorning(),false);assert.equal(h.c.activateDrinkingMorning('2026-10-23'),false);
  assert.equal(h.c.activateDrinkingMorning('2026-10-24'),true);h.flush();
  assert.equal(h.nightMessages().at(-1).text,h.c.testMornings[branch].text);
  assert.equal(h.state().stage,'morning');assert.ok(h.c.drinkingNightOptions().length>=3);
  assert.equal(h.c.activateDrinkingMorning('2026-10-24'),false);
  assert.equal(h.c.lostPhoneStory.truthToldAt,undefined);
 });
}

for(const optionId of ['forget','deflect','curious','sincere'])test(`Morning question response ${optionId} preserves the selected meaning and closes naturally`,()=>{
 const h=harness();h.join();h.select('skip');h.select('tease');h.flush();h.select('question');h.flush();
 h.c.activateDrinkingMorning('2026-10-24');h.flush();const choice=h.c.testMornings.question.options.find(o=>o[0]===optionId);
 h.select(optionId);h.flush();assert.equal(h.nightMessages().at(-1).text,choice[3]);assert.equal(h.state().stage,'complete');
 assert.equal(h.c.drinkingNightActive(),false);assert.equal(h.c.stageElevenActiveOptions('shownu')[0].id,'normal');
});

for(const [branch,night,options] of [['ordinary','contact',['fine','headache','brief']],['happy','care',['honest','joke','retreat']],['different','only',['laugh','ask','quiet']]])for(const optionId of options)test(`Morning ${branch}/${optionId} sends the matching distinct reply`,()=>{
 const h=harness();h.join();h.select(branch==='happy'?'glad':'pay');h.flush();h.select('tease');h.flush();h.select(night);h.flush();
 h.c.activateDrinkingMorning('2026-10-24');h.flush();
 const option=h.c.testMornings[branch].options.find(o=>o[0]===optionId);
 assert.equal(h.select(optionId),true);h.flush();
 assert.equal(h.nightMessages().at(-1).text,option[3]);
 assert.equal(h.nightMessages().at(-1).translation,option[4]);
 assert.equal(h.state().completed,true);
});

test('A failed main-save write does not send a message or consume the choice',()=>{
 const h=harness();const before=JSON.stringify(h.state());h.c.saveLostPhoneStory=()=>false;
 assert.equal(h.select('join'),false);assert.equal(h.nightMessages().length,0);
 assert.equal(h.c.gameEventMemory.events.length,0);assert.equal(JSON.stringify(h.state()),before);
});

test('Restoring a new-format save with missing optional tracking arrays preserves stage and choices',()=>{
 const h=harness();h.join();h.select('glad');h.flush();const snapshot=h.snapshot();
 const story=JSON.parse(snapshot.storage.find(([key])=>key==='phone-sim-lost-phone-story-v1')[1]);
 delete story.stageSeven.drinkingNight.shownuReceivedChoiceIds;
 delete story.stageSeven.drinkingNight.replyMessageIds;
 snapshot.storage=snapshot.storage.map(([key,value])=>[key,key==='phone-sim-lost-phone-story-v1'?JSON.stringify(story):value]);
 const restored=harness(snapshot);assert.equal(restored.state().stage,'deeper');
 assert.equal(restored.state().choices.tipsy.optionId,'glad');
 assert.ok(Array.isArray(restored.state().replyMessageIds));
 assert.equal(restored.select('waited'),true);restored.flush();assert.equal(restored.state().stage,'boundary');
});

test('Pending state survives refresh, delivers once, and all game timestamps remain ordered',()=>{
 const h=harness();h.join();h.select('comfortable');
 const restored=harness(h.snapshot());assert.equal(restored.state().stage,'tipsy');restored.flush();
 assert.equal(restored.state().stage,'deeper');restored.select('stay');restored.flush();restored.select('question');restored.flush();
 const again=harness(restored.snapshot());again.flush();
 assert.equal(again.state().stage,'morning-pending');
 const messages=again.nightMessages();assert.equal(new Set(messages.map(m=>m.id)).size,messages.length);
 const times=messages.map(m=>m.storyTimestamp);assert.ok(times.every((time,index)=>!index||time>times[index-1]),JSON.stringify(messages.map(m=>[m.id,m.storyTimestamp])));
 assert.ok(messages.every(m=>m.day==='10월 23일 금요일'));
 assert.equal(again.c.gameEventMemory.events.filter(e=>e.status==='pending').length,0,'no overnight real-time timer');
});

test('Synchronous production queue delivery does not leave stale stage locks',()=>{
 const h=harness(null,{sync:true});h.select('join');assert.equal(h.state().stage,'tipsy');
 h.select('glad');assert.equal(h.state().stage,'deeper');assert.equal(h.state().pendingReply,null);
 h.select('stay');h.select('question');assert.equal(h.state().stage,'morning-pending');
});

test('Special focus blocks stale normal sends only for Shownu; switching apps cannot resend',()=>{
 const h=harness();h.join();
 assert.equal(h.c.stageElevenActiveOptions('shownu').length,0);
 assert.equal(h.c.stageElevenCommitActiveMessage({id:'stale'}),false);
 assert.equal(h.c.stageSevenSelect('ordinary','stale'),false);
 const before=h.nightMessages().length;h.c.activeChat=null;
 assert.equal(h.select('pay'),false);h.c.activeChat=h.config.chats.find(c=>c.id==='shownu');h.c.renderAfterWorkPanel();
 assert.equal(h.nightMessages().length,before);assert.ok(h.$('#after-work-panel').innerHTML.includes('오늘 형이 술 사는 날 맞지?'));
 h.c.activeChat={id:'kihyun'};assert.equal(h.c.stageElevenActiveOptions('kihyun')[0].id,'normal');assert.equal(h.c.stageElevenCommitActiveMessage({id:'normal'}),true);
});

test('A saved phone outcome alone never completes the unrelated drinking invitation',()=>{
 const h=harness();const snapshot=h.snapshot();const old=JSON.parse(snapshot.storage.find(([key])=>key==='phone-sim-lost-phone-story-v1')[1]);
 delete old.stageSeven.drinkingNight;old.truthToldAt=123;old.call={status:'completed',eventId:'original-phone'};
 snapshot.storage=snapshot.storage.map(([key,value])=>[key,key==='phone-sim-lost-phone-story-v1'?JSON.stringify(old):value]);
 snapshot.events={version:2,events:[],notifications:[]};
 const legacy=harness(snapshot);assert.equal(legacy.state().legacyCompleted,false);assert.equal(legacy.state().stage,'invite');
 assert.ok(!legacy.config.chats.find(c=>c.id==='shownu').messages.some(m=>m.templateRole==='preset-outcome'));
 assert.equal(legacy.c.lostPhoneStory.call.eventId,'original-phone');assert.equal(legacy.c.lostPhoneStory.truthToldAt,123);
 assert.equal(legacy.c.stageElevenActiveOptions('shownu').length,0);
});

test('Only the conflicting old check-in is suppressed; unrelated world events still run',()=>{
 const h=harness();assert.equal(h.c.stageElevenScheduleDrunkCheckin('convergence'),null);
 h.c.gameEventHandlers.get('stage-seven-world-event')({payload:{kind:'romance-checkin'}});assert.equal(h.calls.world,0);
 h.c.gameEventHandlers.get('stage-seven-world-event')({payload:{kind:'work-reminder'}});assert.equal(h.calls.world,1);
});

test('Shared notification pipeline creates one Shownu reply notification when outside chat',()=>{
 const h=harness();h.join();h.select('pay');h.c.activeChat={id:'kihyun'};h.flush();
 const notifications=h.c.gameEventMemory.notifications.filter(n=>n.eventId.includes(':tipsy:pay:shownu'));
 assert.equal(notifications.length,1);assert.equal(notifications[0].summary,'맞는데 왜 ㅋㅋㅋ');
 assert.equal(notifications[0].destination.chatId,'shownu');
 for(const event of h.c.gameEventMemory.events)h.c.executeGameEvent(event,{replay:true,suppressNotifications:true});
 assert.equal(h.c.gameEventMemory.notifications.filter(n=>n.eventId===notifications[0].eventId).length,1);
});

test('Calendar confirms drinks from the saved choice, never from a skipped or declined invitation',()=>{
 const h=harness();
 const begin=html.indexOf('const CALENDAR_CATEGORIES=');
 vm.runInContext(html.slice(begin,html.indexOf('const notesViewState=',begin)),h.c);
 const id='calendar:after-work-drinks-shownu-v1';
 assert.ok(!h.c.calendarEvents().some(e=>e.id===id));h.select('later');h.flush();h.select('join');h.flush();
 assert.ok(h.c.calendarEvents().some(e=>e.id===id));
 assert.equal(h.c.calendarEvents().filter(e=>e.id===id).length,1);
 const decline=harness();vm.runInContext(html.slice(begin,html.indexOf('const notesViewState=',begin)),decline.c);decline.select('decline');decline.flush();
 assert.ok(!decline.c.calendarEvents().some(e=>e.id===id));
});
