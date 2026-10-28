const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {game}=require('./helpers/simulator-harness');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const PHONE='lost-phone-shownu-checkin-v1';
const STORE='phone-sim-event-store-v2',STORY='phone-sim-lost-phone-story-v1';
const forbidden=/주웠|주운|습득|분실폰|반환|돌려드|형원\s*씨?가?\s*(?:아니|아닙)|(?:휴대폰|폰)\s*주인|撿到|不是(?:蔡)?亨源|歸還|手機主人|冒充|陌生人|偶然看到/;
function clean(copy){const ko=Array.isArray(copy)?copy[1]:copy.text,zh=Array.isArray(copy)?copy[2]:copy.translation;if(ko||zh){assert.ok(ko&&zh,'Bilingual option');assert.doesNotMatch(ko+' '+zh,forbidden);}}
function seed(story={},events=[]){return {local:[[STORY,JSON.stringify({id:PHONE,openingRouteVersion:1,openingRoute:null,phase:'awaiting-reply',createdMessageIds:[],...story})],[STORE,JSON.stringify({version:2,events,notifications:[]})]]}}
function message(id,from='셔누',status='pending',extra={}){return {id,type:'kkt-message',source:'kakao',status,scheduledAt:1,shouldNotify:true,effects:{},payload:{chatId:'shownu',message:{id,from,text:from==='형원'?'저는 형원 씨가 아닙니다. 이 휴대폰을 주웠어요.':'휴대폰은 안전하게 보관하고 계신가요?',translation:from==='형원'?'我不是亨源，我撿到了這支手機。':'手機目前有安全保管著嗎？',storyTimestamp:new Date(2026,9,23,20).getTime()},...extra}}}
function json(h,code){return JSON.parse(h.run('JSON.stringify('+code+')'))}

test('All seven Stage Seven catalogs and conditional Stage Eleven catalogs are role-appropriate',()=>{
 const h=game();h.start();const groups=json(h,'STAGE_SEVEN_COPY'),catalog=json(h,'stageElevenActiveCatalog');
 assert.equal(Object.keys(catalog).length,7);let count=0;
 for(const definition of Object.values(groups))for(const option of definition.options){clean(option);assert.equal(h.run(`retiredPlayerIdentityOption(${JSON.stringify(option)})`),false);count++}
 for(const options of Object.values(catalog))for(const option of options){clean(option);assert.equal(h.run(`retiredPlayerIdentityOption(${JSON.stringify(option)})`),false);count++}
 assert.ok(count>50);
});
test('Every multi-turn stage, drinking branch and opening phone choice has matching bilingual roleplay copy',()=>{
 const h=game();h.start();let count=0;
 for(const flows of Object.values(json(h,'STAGE_TWELVE_FLOWS')))for(const flow of Object.values(flows))for(const options of Object.values(flow.stages))for(const option of options){clean(option);if(option.reply||option.replyTranslation)clean({text:option.reply,translation:option.replyTranslation});count++}
 for(const options of Object.values(json(h,'DRINKING_NIGHT_CHOICES')))for(const option of options){if(option[1])clean(option)}
 for(const branch of Object.values(json(h,'DRINKING_MORNING')))for(const option of branch.options)clean(option);
 for(const options of Object.values(json(h,'igCallChoiceData')))for(const option of options)clean(option);
 for(const stage of ['opening','home-check','heard','outside-check','why-check','found-check','found-place','closed'])for(const truthTold of [false,true])for(const option of json(h,`lostCallChoices({stage:'${stage}',truthTold:${truthTold}})`))clean(option);
 assert.ok(count>100);
});
for(const chat of ['shownu','minhyuk','kihyun','jooheon','changkyun','manager','group'])test(`${chat}: active options stay natural, including after loading a legacy identity ledger`,()=>{
 const h=game();h.start();h.run(`showScreen('app-kakao');openChat('${chat}')`);let options=json(h,`stageElevenActiveOptions('${chat}')`);for(const option of options)clean(option);
 h.run(`lostPhoneStory.characterKnowledge['${chat}']={disclosure:{knowsCurrentUserNotHyungwon:true,knowsFinderHasPhone:true},knowsPhoneLost:true};saveLostPhoneStory()`);
 const r=game(h.snapshot());r.start();r.run(`showScreen('app-kakao');openChat('${chat}')`);options=json(r,`stageElevenActiveOptions('${chat}')`);for(const option of options)clean(option);
 if(chat!=='shownu')assert.ok(options.length>0,'Ordinary interaction remains accessible');
 assert.equal(r.story().characterKnowledge[chat].disclosure.knowsCurrentUserNotHyungwon,true,'Preserve historical ledger');
 assert.ok(!options.some(o=>['disclose','phone-followup'].includes(o.effect)));
});
for(const outcome of ['completed','missed','declined','interrupted'])test(`IG ${outcome}: fixed DM choices can be sent, get coherent replies and cannot disclose identity`,()=>{
 const h=game();h.start();h.run(`showScreen('app-instagram');igView='thread';igActiveConversation='dm-shownu';lostPhoneStory.igDmReplyGroups={sample:{id:'sample',chatId:'dm-shownu',status:'pending',outcome:'${outcome}',usedOptionIds:[]}}`);
 const options=json(h,'igDmReplyOptions(currentIgDmReplyGroup())');assert.equal(options.length,2);for(const o of options)clean(o);
 h.run("handleIgDmChoice('tell-found')");assert.equal(h.story().igDmReplyGroups.sample.status,'pending');
 h.run(`handleIgDmChoice('${options[0].id}')`);h.advance(1500);
 assert.equal(h.story().igDmReplyGroups.sample.status,'used');assert.equal(h.run('igDmReplyOptions(lostPhoneStory.igDmReplyGroups.sample).length'),0);
 const messages=h.story().igMessages.filter(m=>m.id.startsWith('sample:'));assert.equal(messages.length,2);assert.equal(messages[0].text,options[0].text);assert.doesNotMatch(messages[1].text+' '+messages[1].translation,forbidden);assert.equal(h.story().truthToldAt,undefined);
});
for(const [kind,text,reply] of [['home','응, 형도 푹 쉬어.','응. 잘 자.'],['outside','응, 들어가면 연락할게.','그래. 조심해서 들어가.']])test(`IG ${kind}: reply acknowledges actual phone outcome`,()=>{
 const h=game();h.start();h.run(`showScreen('app-instagram');igView='thread';igActiveConversation='dm-shownu';lostPhoneStory.igDmReplyGroups={sample:{id:'sample',chatId:'dm-shownu',status:'pending',kind:'${kind}',outcome:'completed',usedOptionIds:[]}};handleIgDmChoice('natural')`);h.advance(1500);const messages=h.story().igMessages.filter(m=>m.id.startsWith('sample:'));assert.equal(messages[0].text,text);assert.equal(messages[1].text,reply);
});
test('Stale KKT composer and manual-disclosure submissions cannot write or alter state',()=>{
 const h=game();h.start();h.open();const before=h.messages().length;
 for(const item of [{id:'disclose-phone',effect:'disclose'},{id:'phone-followup',effect:'phone-followup'},{id:'new-id',category:'disclose'}])assert.equal(h.run(`stageElevenCommitActiveMessage(${JSON.stringify(item)})`),false);
 assert.equal(h.run("stageSevenSelect('phone-sim-stage11:manual-disclosure:shownu','say-it')"),false);assert.equal(h.run('stageElevenManualDefinition("shownu")'),null);assert.equal(h.messages().length,before);assert.equal(h.story().truthToldAt,undefined);
});
test('Pending legacy holder groups retire; already delivered messages, choices and flags stay exact',()=>{
 const e=message('legacy:old-player','형원','completed'),prior=structuredClone(e.payload.message);e.completedAt=123;
 const h=game(seed({truthToldAt:9,stageSeven:{groups:{'found-followup:shownu':{id:'found-followup:shownu',chatId:'shownu',status:'pending'}}},igDmReplyGroups:{old:{id:'old',chatId:'dm-shownu',status:'pending',kind:'truth-followup',usedOptionIds:['tell-found']} }},[e]));h.start();
 assert.equal(h.story().stageSeven.groups['found-followup:shownu'].status,'retired');assert.equal(h.story().igDmReplyGroups.old.status,'retired');assert.equal(h.story().igDmReplyGroups.old.usedOptionIds[0],'tell-found');assert.equal(h.story().truthToldAt,9);
 const delivered=h.messages().find(m=>m.id===e.id);assert.equal(delivered.text,prior.text);assert.equal(delivered.translation,prior.translation);assert.equal(delivered.storyTimestamp,prior.storyTimestamp);assert.equal(h.events().find(x=>x.id===e.id).completedAt,123);
 const r=game(h.snapshot());r.start();assert.equal(r.messages().filter(m=>m.id===e.id).length,1);assert.equal(r.story().stageSeven.groups['found-followup:shownu'].status,'retired');
});
test('Pending disclosure events and notifications cannot deliver after reload; completed historical events survive',()=>{
 const ids=[PHONE+':truth-ack','phone-sim-stage11:active:shownu:disclose-phone:player','found-followup:shownu:ack'];
 const events=ids.map(id=>message(id));events.push({id:'identity-reaction',type:'stage-seven-world-event',source:'story',status:'pending',scheduledAt:1,payload:{kind:'direct-disclosure-reaction',chatId:'shownu'},effects:{}});
 const h=game(seed({},events));h.start();h.advance(6000);for(const id of [...ids,'identity-reaction']){assert.equal(h.events().find(e=>e.id===id).status,'inapplicable');assert.ok(!h.messages().some(m=>m.id===id));assert.ok(!h.notifications().some(n=>n.eventId===id))}
 const r=game(h.snapshot());r.start();assert.ok(!r.messages().some(m=>ids.includes(m.id)));
});
test('Legacy composer reply locks are released without rewriting its selected history',()=>{
 const id='phone-sim-stage11:active:kihyun:disclose-phone:player',h=game(seed({stageEleven:{conversations:{kihyun:{pendingReply:id+':reply',status:'paused',activeTopicId:null}},activeMessaging:{usedByChat:{kihyun:{'disclose-phone':{eventId:id,effect:'disclose',status:'sent'}}}}}}));h.start();
 assert.equal(h.story().stageEleven.conversations.kihyun.pendingReply,null);assert.equal(h.story().stageEleven.activeMessaging.usedByChat.kihyun['disclose-phone'].status,'sent');
});
test('The removed word-detection API cannot create a truth acknowledgement or cancel normal calls',()=>{
 const h=game();h.start();h.run("showScreen('app-kakao')");const events=h.events().length;assert.equal(h.run("recordLostPhoneTruthFromText('휴대폰을 주웠어요.')"),false);assert.equal(h.events().length,events);assert.equal(h.story().truthToldAt,undefined);
});
test('Removed manual UI copy and identity-only option tuples no longer exist in the shipped source',()=>{
 assert.doesNotMatch(html,/휴대폰을 주운 사람이라고 말하기|휴대폰 출처 설명|data-stage-eleven-disclosure-open|\['tell-found','[^']*','[^']*','(?:disclose|group-disclose)'|id:'disclose-phone',category:/);
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(script[1]));
});

test('Full KKT original call still completes with its own options and one preserved call record',()=>{
 const h=game();h.start();h.run("showScreen('app-kakao')");h.advance(120000);assert.equal(h.story().call.status,'ringing');h.run("answerLostPhoneCall();applyLostCallChoice('as-hyung');applyLostCallChoice('say-home')");h.advance(1800);assert.equal(h.story().call.status,'completed');assert.equal(h.story().call.records.length,1);assert.deepEqual(Array.from(h.story().call.choiceIds),['as-hyung','say-home']);assert.equal(h.story().truthToldAt,undefined);const r=game(h.snapshot());r.start();r.advance(120000);assert.equal(r.story().call.records.length,1);assert.equal(r.story().openingRoute,'kakaotalk_first');
});
test('Required outside callback remains playable through completion with no identity branch',()=>{
 const h=game();h.start();h.run("lockOpeningRoute('app-kakao');lostPhoneStory.selectedBranch='reply-outside';lostPhoneStory.phase='replied';cancelScheduledLostPhoneCall();scheduleLostPhoneCall('outside-reply',15000)");h.advance(15000);assert.equal(h.story().call.reason,'outside-reply');h.run("answerLostPhoneCall();applyLostCallChoice('outside-nearby')");h.advance(1800);assert.equal(h.story().call.status,'completed');assert.equal(h.story().call.records.length,1);assert.deepEqual(Array.from(h.story().call.choiceIds),['outside-nearby']);assert.match(h.story().call.transcript.at(-1).text,/도착하면 알려줘/);
});
test('IG-first call, outcome DM, KKT drinking invitation and route exclusivity remain intact',()=>{
 const h=game();h.start();h.run("showScreen('app-instagram')");h.advance(12000);h.run("acceptCall();applyInstagramStoryChoice('home')");h.advance(14300);assert.equal(h.story().openingCall.status,'completed');h.open();assert.equal(h.story().openingRoute,'instagram_first');assert.equal(h.select('join'),true);assert.equal(h.state().stage,'tipsy');for(const id of ['pay','tease','contact'])h.select(id);h.advance(12000);assert.equal(h.story().igMessages.filter(m=>m.text==='잘 들어갔으면 됐어. 푹 쉬어.').length,1);assert.ok(!h.events().some(e=>e.type==='lost-phone-incoming-call'));
});
test('Missing legacy identity fields and null optional group records do not break bootstrap',()=>{
 const h=game(seed({stageSeven:{groups:{unknown:null}},igDmReplyGroups:{unknown:null},stageEleven:{conversations:{unknown:null}}}));assert.doesNotThrow(()=>h.start());assert.equal(h.run("retiredIdentityEvent({id:'ordinary',payload:{}})"),false);h.run("igActiveConversation='dm-shownu'");assert.equal(h.run('currentIgDmReplyGroup()'),null);assert.equal(h.run('gameInitializationStatus'),'started');
});
