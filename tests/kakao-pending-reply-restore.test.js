const test=require('node:test');
const assert=require('node:assert/strict');
const {game}=require('./helpers/simulator-harness');
const cases=[
 {chatId:'shownu',topic:'flirt',before:[['start','flirt-special']],stage:'flirt-special-answer',choice:'special-joke'},
 {chatId:'minhyuk',topic:'daily',before:[['start','food']],stage:'food-follow',choice:'food-share'},
 {chatId:'kihyun',topic:'work',before:[['start','work-update']],stage:'work-follow',choice:'work-ok'},
 {chatId:'jooheon',topic:'music-process',before:[['start','music-process-record']],stage:'capture-method',choice:'capture-phone'},
 {chatId:'changkyun',topic:'listening-habit',before:[['start','listening-order']],stage:'album-order-answer',choice:'album-order-yes'},
 {chatId:'manager',topic:'schedule',before:[['start','schedule-check']],stage:'schedule-follow',choice:'schedule-ack'}
];
function select(h,c,stage,choice){const id=`conversation:${c.chatId}:${c.topic}:${stage}:${choice}`;assert.ok(h.run(`stageElevenActiveOptions('${c.chatId}').some(i=>i.id===${JSON.stringify(id)})`),id);assert.equal(h.run(`stageElevenCommitActiveMessage(stageElevenActiveOptions('${c.chatId}').find(i=>i.id===${JSON.stringify(id)}))`),true);return id}
function focus(h,c){return h.run(`ensureStageTwelveState().conversations['${c.chatId}']`)}
function record(h,c){return h.run(`stageElevenActionState('${c.chatId}')[${JSON.stringify(c.optionId)}]`)}
function messages(h,c){return h.run(`CONFIG.chats.find(c=>c.id==='${c.chatId}').messages`)}
function pendingFixture(input=cases[0]){
 const c={...input},h=game();h.start();if(c.chatId==='shownu'){h.open();h.select('decline');h.advance(4000)}h.run(`showScreen('app-kakao');openChat('${c.chatId}')`);
 for(const [stage,choice] of c.before){select(h,c,stage,choice);h.advance(3000)}
 c.optionId=select(h,c,c.stage,c.choice);c.replyEventId=record(h,c).eventId+':reply';c.messageId=c.replyEventId+':message';
 return {h,c};
}
function due(h,c){return h.events().find(e=>e.id===c.replyEventId).scheduledAt}
function restoreWaiting(h,c){const r=game(h.snapshot());const delta=due(h,c)-500-r.run('Date.now()');if(delta>0)r.jump(delta);r.start();return r}
function assertOne(h,c){assert.equal(messages(h,c).filter(m=>m.id===c.messageId).length,1);assert.equal(h.events().filter(e=>e.id===c.replyEventId).length,1);assert.equal(h.events().filter(e=>e.id===c.messageId).length,1)}
for(const scenario of cases)test('Shared Stage Twelve second-turn pending reply survives history replay: '+scenario.chatId,()=>{
 const {h,c}=pendingFixture(scenario),pending=focus(h,c).pendingReply,choice=focus(h,c).stage,scheduledAt=due(h,c),copy=record(h,c).reply;
 const r=restoreWaiting(h,c);assert.equal(focus(r,c).pendingReply,pending);assert.equal(focus(r,c).stage,choice);assert.equal(due(r,c),scheduledAt);assert.equal(messages(r,c).some(m=>m.id===c.messageId),false);
 r.advance(499);assert.equal(messages(r,c).some(m=>m.id===c.messageId),false);r.advance(1);assertOne(r,c);assert.equal(messages(r,c).find(m=>m.id===c.messageId).text,copy);assert.equal(focus(r,c).pendingReply,null);
});
test('Overdue special-joke is delivered during normal startup without resetting the scheduled time',()=>{
 const {h,c}=pendingFixture(),r=game(h.snapshot()),scheduledAt=due(h,c);r.jump(Math.max(0,scheduledAt-r.run('Date.now()'))+60000);r.start();assertOne(r,c);assert.equal(due(r,c),scheduledAt);assert.equal(focus(r,c).status,'completed');
});
test('Delivered special-joke survives repeated initialization without duplicate messages or notifications',()=>{
 const {h,c}=pendingFixture();h.advance(3000);assertOne(h,c);const m=JSON.stringify(messages(h,c).find(m=>m.id===c.messageId)),r=game(h.snapshot());r.start();
 const count=r.notifications().filter(n=>n.eventId===c.messageId).length;
 r.run('initializePhoneEvents();initializePhoneEvents()');r.advance(20000);assertOne(r,c);assert.equal(JSON.stringify(messages(r,c).find(m=>m.id===c.messageId)),m);assert.equal(r.notifications().filter(n=>n.eventId===c.messageId).length,count);assert.equal(focus(r,c).status,'completed');
});
test('Repeated restore preserves the pending focus and does not append the same player turn repeatedly',()=>{
 const {h,c}=pendingFixture(),r=restoreWaiting(h,c),pending=focus(r,c).pendingReply;r.run('initializePhoneEvents()');const turns=JSON.stringify(focus(r,c).turns);r.run('initializePhoneEvents();initializePhoneEvents()');assert.equal(JSON.stringify(focus(r,c).turns),turns);assert.equal(focus(r,c).pendingReply,pending);
 r.advance(500);assertOne(r,c);r.run('initializePhoneEvents()');assertOne(r,c);
});
test('Old wording and translations remain byte-for-byte in the saved pending payload',()=>{
 const {h,c}=pendingFixture();h.run(`(()=>{const r=stageElevenActionState('shownu')[${JSON.stringify(c.optionId)}],e=getGameEvent(r.eventId+':reply');r.reply='그건 맞지. 편한 사이는 오래 가는 게 좋더라.';r.replyTranslation='這倒是。相處自在的關係能長久維持很好。';e.payload.text=r.reply;e.payload.translation=r.replyTranslation;e.payload.conversation.reply=r.reply;e.payload.conversation.replyTranslation=r.replyTranslation;saveLostPhoneStory();saveGameEventStore()})()`);
 const before=JSON.stringify(h.events().find(e=>e.id===c.replyEventId).payload),r=restoreWaiting(h,c);assert.equal(JSON.stringify(r.events().find(e=>e.id===c.replyEventId).payload),before);r.advance(500);assertOne(r,c);const m=messages(r,c).find(m=>m.id===c.messageId);assert.equal(m.text,'그건 맞지. 편한 사이는 오래 가는 게 좋더라.');assert.equal(m.translation,'這倒是。相處自在的關係能長久維持很好。');
});
test('Missing optional legacy conversation fields or previous delivery flags do not erase a newer pending reply',()=>{
 const {h,c}=pendingFixture();h.run(`(()=>{const convo=ensureStageTwelveState().conversations.shownu;for(const k of ['turns','answeredQuestionIds','facts','exclusiveChoices','pausedTopics'])delete convo[k];for(const r of Object.values(stageElevenActionState('shownu'))){delete r.replyDelivered;delete r.replyDeliveredAt}saveLostPhoneStory()})()`);
 const r=restoreWaiting(h,c);assert.equal(focus(r,c).pendingReply,c.replyEventId);r.advance(500);assertOne(r,c);assert.equal(focus(r,c).status,'completed');
});
test('Cancelled pending replies are not revived or replaced on restore',()=>{
 const {h,c}=pendingFixture();h.run(`cancelGameEvent(${JSON.stringify(c.replyEventId)})`);const r=restoreWaiting(h,c);r.advance(20000);assert.equal(r.events().find(e=>e.id===c.replyEventId).status,'cancelled');assert.equal(messages(r,c).some(m=>m.id===c.messageId),false);assert.equal(record(r,c).replyScheduled,undefined);
});
test('Replaying an older response cannot regress to a different selected branch or overwrite lastQuestionId',()=>{
 const {h,c}=pendingFixture({...cases[0],choice:'special-say'}),r=restoreWaiting(h,c);assert.equal(focus(r,c).lastQuestionId,'meaning-of-special');assert.equal(focus(r,c).pendingReply,c.replyEventId);r.advance(500);assertOne(r,c);assert.equal(focus(r,c).stage,'special-meaning');assert.equal(messages(r,c).some(m=>m.id.includes(':special-joke:')),false);
});
test('Restoring old completed replies does not alter their delivered metadata or the story clock',()=>{
 const {h,c}=pendingFixture(),key='conversation:shownu:flirt:start:flirt-special',before=h.run(`JSON.stringify({record:stageElevenActionState('shownu')['${key}'],clock:narrativeStoryTimestamp()})`),r=restoreWaiting(h,c);
 assert.equal(r.run(`JSON.stringify({record:stageElevenActionState('shownu')['${key}'],clock:narrativeStoryTimestamp()})`),before);assert.equal(focus(r,c).pendingReply,c.replyEventId);
});

test('Interrupted save after message delivery reconciles only the matching pending turn',()=>{
 const {h,c}=pendingFixture(),before=h.snapshot(),storyKey='phone-sim-lost-phone-story-v1';h.advance(3000);const delivered=messages(h,c).find(m=>m.id===c.messageId),after=h.snapshot();
 // Simulate event-store write succeeding just before the main story save.
 after.local=after.local.map(([key,value])=>[key,key===storyKey?before.local.find(([k])=>k===storyKey)[1]:value]);
 const r=game(after);r.start();assertOne(r,c);assert.equal(focus(r,c).pendingReply,null);assert.equal(focus(r,c).status,'completed');assert.equal(JSON.stringify(messages(r,c).find(m=>m.id===c.messageId)),JSON.stringify(delivered));r.advance(10000);assertOne(r,c);
});
test('History-only restore keeps chat order, unread counts, existing notifications and story timestamps stable',()=>{
 const {h,c}=pendingFixture();const view=x=>x.run(`JSON.stringify({chats:CONFIG.chats.map(c=>({id:c.id,unread:c.unread,latest:latestKakaoMessage(c)?.id})),notifications:gameEventMemory.notifications,clock:narrativeStoryTimestamp()})`);const before=view(h),r=restoreWaiting(h,c);assert.equal(view(r),before);assert.equal(focus(r,c).pendingReply,c.replyEventId);
});
