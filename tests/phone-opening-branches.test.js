// Regression coverage for the mutually exclusive opening-call routes and
// fixed-choice telephone flows. The harness evaluates production functions
// without booting the game or touching real browser storage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
function between(start, end) {
  const from = html.indexOf(start);
  assert.notEqual(from, -1, `missing source anchor: ${start}`);
  const to = html.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing source end anchor: ${end}`);
  return html.slice(from, to);
}
const openingRouteFn = between('function lockOpeningRoute(app){', 'function recordLostPhoneTruthFromText(');
const lostCallChoiceFn = between('function lostCallChoices(call){', 'function showLostPhoneCall(){');
const applyLostCallChoiceFn = between('function applyLostCallChoice(id){', 'function registerLostPhoneCallHandlers(){');
const igChoicesDeclaration = between('const igCallChoiceData={', 'function renderIgCallChoices(){');
const igCallKnowledgeFn = between('function igCallShownuKnowsFinder(){', 'const igCallChoiceData=');
const renderIgChoicesFn = between('function renderIgCallChoices(){', 'function addIgStoryLine(');
const applyIgChoiceFn = between('function applyInstagramStoryChoice(id){', 'function acceptCall(){');
const reconcileInstagramCallFn = between('function reconcileInstagramOpeningCall(){', '\nregisterAfterWorkHandlers();');
const igFollowupFn = between('function instagramFollowupContent(outcome,opening){', 'function queueInstagramFollowup(outcome){');

function makeRouteHarness(route = null) {
  const story = { openingRouteVersion: 1, openingRoute: route, phase: 'awaiting-reply', openingCall: null, call: { status: 'idle', records: [] } };
  const scheduled = [];
  const context = {
    lostPhoneStory: story, Date, saveLostPhoneStory() {},
    scheduleInstagramOpeningCall() { scheduled.push('ig'); },
    scheduleLostPhoneCall(reason, delay) { scheduled.push({ reason, delay }); },
    LOST_PHONE_STORY_ID: 'lost-phone-shownu-checkin-v1'
  };
  vm.runInNewContext(openingRouteFn + '\nthis.lockOpeningRoute=lockOpeningRoute;', context);
  return { story, scheduled, lock: context.lockOpeningRoute };
}
test('first app opened locks IG-first route and schedules only its original call event', () => {
  const h = makeRouteHarness(); assert.equal(h.lock('app-instagram'), 'instagram_first');
  assert.deepEqual(h.scheduled, ['ig']); assert.equal(h.story.openingRoute, 'instagram_first');
});
test('first app opened locks KKT-first route and retains the 120-second initial call delay', () => {
  const h = makeRouteHarness(); assert.equal(h.lock('app-kakao'), 'kakaotalk_first');
  assert.deepEqual(h.scheduled, [{ reason: 'first-checkin', delay: 120000 }]);
});
test('opening a second app cannot switch or schedule the mutually exclusive opening route', () => {
  const h = makeRouteHarness(); h.lock('app-instagram');
  assert.equal(h.lock('app-kakao'), 'instagram_first'); assert.deepEqual(h.scheduled, ['ig']);
});
test('source retains distinct stable event IDs and route-specific guards', () => {
  assert.match(html, /\$\{LOST_PHONE_STORY_ID\}:instagram-first-call/);
  assert.match(html, /scheduleLostPhoneCall\('first-checkin',120000\)/);
  assert.match(html, /openingRoute!=='instagram_first'/); assert.match(html, /openingRoute!=='kakaotalk_first'/);
  assert.match(html, /type:'instagram-opening-call'/); assert.match(html, /type:'lost-phone-incoming-call'/);
});
test('IG call offers only the three approved opening responses and the two voice-check responses', () => {
  const context = {}; vm.runInNewContext(`${igChoicesDeclaration}\nthis.data=igCallChoiceData;`, context);
  assert.deepEqual(Array.from(context.data.opening, item => item.id), ['home', 'outside', 'why']);
  assert.deepEqual(Array.from(context.data['voice-check'], item => item.id), ['tired', 'bad-signal']);
  assert.equal(context.data.tellFound, undefined); assert.equal(context.data.found, undefined);
  for (const choices of Object.values(context.data)) for (const choice of choices) assert.ok(choice.text && choice.translation);
});
test('KKT-first phone retains its normal fixed flow but has no phone-disclosure choices', () => {
  const context = {}; vm.runInNewContext(`${lostCallChoiceFn}\nthis.choices=lostCallChoices;`, context);
  assert.deepEqual(Array.from(context.choices({ stage: 'opening' }), item => item.id), ['as-hyung', 'hello']);
  assert.deepEqual(Array.from(context.choices({ stage: 'home-check' }), item => item.id), ['say-home', 'say-outside', 'ask-why']);
  assert.deepEqual(Array.from(context.choices({ stage: 'heard' }), item => item.id), ['heard-answer']);
  assert.deepEqual(Array.from(context.choices({ stage: 'outside-check' }), item => item.id), ['outside-nearby']);
  assert.deepEqual(Array.from(context.choices({ stage: 'why-check' }), item => item.id), ['why-just-check']);
  assert.deepEqual(Array.from(context.choices({ stage: 'found-check' }), item => item.id), []);
  assert.deepEqual(Array.from(context.choices({ stage: 'found-place' }), item => item.id), []);
  assert.deepEqual(Array.from(context.choices({ stage: 'opening', truthTold: true }), item => item.id), ['known-finder']);
});
test('KKT outside-reply callback starts in the follow-up stage instead of replaying the opening', () => {
  assert.match(html, /call\.stage=call\.reason==='outside-reply'\?'outside-check':'opening'/);
  assert.match(html, /scheduleLostPhoneCall\('outside-reply',15000\)/);
});
test('KKT outside follow-up remains answerable and closes with its existing response', () => {
  const call = { stage: 'outside-check', status: 'connected', choiceIds: [], transcript: [], reason: 'outside-reply' };
  const story = { selectedBranch: 'reply-outside', call, truthToldAt: null };
  const context = {
    callStory: () => call, lostPhoneStory: story,
    lostCallChoices: stage => { const c={}; vm.runInNewContext(`${lostCallChoiceFn}\nthis.f=lostCallChoices;`,c); return c.f(stage); },
    addLostCallLine(from,text,translation) { call.transcript.push({from,text,translation}); },
    saveLostPhoneCallStory() {}, renderLostPhoneCall() {}
  };
  vm.runInNewContext(`${applyLostCallChoiceFn}\nthis.apply=applyLostCallChoice;`, context);
  context.apply('outside-nearby'); assert.equal(call.stage,'closed');
  assert.deepEqual(call.choiceIds,['outside-nearby']); assert.match(call.transcript.at(-1).text,/도착하면 알려줘/);
});
test('KKT rejects stale phone disclosure choices at send time', () => {
  const call={stage:'opening',status:'connected',choiceIds:[],transcript:[]};
  const context={callStory:()=>call,lostPhoneStory:{call},lostCallChoices:stage=>{const c={};vm.runInNewContext(`${lostCallChoiceFn}\nthis.f=lostCallChoices;`,c);return c.f(stage)},addLostCallLine(){throw new Error('stale option was sent')},saveLostPhoneCallStory(){},renderLostPhoneCall(){}};
  vm.runInNewContext(`${applyLostCallChoiceFn}\nthis.apply=applyLostCallChoice;`,context);
  context.apply('tell-found'); assert.deepEqual(call.choiceIds,[]);
});
test('KKT call with previously disclosed identity does not reopen the removed disclosure conversation', () => {
  assert.match(html, /call\.stage=call\.truthTold\?'closed'/);
  assert.match(html, /call\.truthTold\?'아, 전화 받아 주셔서 감사합니다\. 편하실 때 연락 주세요\.'/);
});
test('call completion handlers preserve the selected route and do not re-open completed calls', () => {
  assert.match(html, /opening\.status=outcome;opening\.endReason=outcome;opening\.endedAt=Date\.now\(\)/);
  assert.match(html, /openingRoute!=='instagram_first'\|\|opening\.eventId!==event\.id\|\|opening\.status!=='scheduled'/);
  assert.match(html, /call\.records\.some\(record=>record\.id===event\.id\)/);
  assert.match(html, /function resumeLostPhoneCallPresentation\(\)[\s\S]*?call\?\.status==='ringing'/);
});
test('legacy route migration keeps a previously saved branch locked as legacy_unknown', () => {
  assert.match(html, /openingRoute='legacy_unknown';lostPhoneStory\.openingRouteVersion=1/);
  assert.match(html, /function readLostPhoneStory\(\)[\s\S]*?openingRouteVersion:0,openingRoute:null,\.\.\.saved/);
});
function makeIgCallHarness({ stage='opening', choiceIds=[], openingChoices=[], result=null }={}) {
  const opening={status:'connected',eventId:'ig-opening-fixture',transcript:[],choiceIds:[...openingChoices]};
  const story={stage,choiceIds:[...choiceIds],choiceBusy:false};
  const lostPhoneStory={openingRoute:'instagram_first',truthToldAt:null,openingCall:opening,igCall:story,characterKnowledge:{shownu:{}}};
  const root={innerHTML:'',hidden:true};
  const context={lostPhoneStory,callActive:true,instagramState:{callStatus:'in-call'},igLastMessageAt:0,igNaturalEndTimer:null,Date,
    $:selector=>selector==='#ig-call-reply-options'?root:null,escapeHtml:value=>String(value),
    addIgStoryLine(from,text,translation,branchId){opening.transcript.push({from,text,translation,branchId})},
    recordLostPhoneTruthFromText(){throw new Error('phone call must not disclose identity')},
    recordCharacterPhoneKnowledge(){throw new Error('phone call must not update identity knowledge')},
    saveLostPhoneStory(){},clearTimeout(){},setTimeout(){return 1},endCall(){}};
  vm.runInNewContext(`${igCallKnowledgeFn}\n${igChoicesDeclaration}\n${renderIgChoicesFn}\n${applyIgChoiceFn}\nthis.data=igCallChoiceData;this.render=renderIgCallChoices;this.apply=applyInstagramStoryChoice;this.knows=igCallShownuKnowsFinder;`,context);
  if(result)opening.igCallResult=result;
  return {context,opening,story,lostPhoneStory,root,apply:context.apply,render:context.render};
}
function renderedIgChoiceIds(root){return [...root.innerHTML.matchAll(/data-ig-story-choice="([^"]+)"/g)].map(match=>match[1]);}
test('IG acceptance starts with the exact check-in and offers only home, outside, or why', () => {
  assert.match(html,/addIgStoryLine\('셔누','여보세요\? 형원아\? 집에 들어갔어\?'/);
  const h=makeIgCallHarness();h.context.render();assert.deepEqual(renderedIgChoiceIds(h.root),['home','outside','why']);
});
test('IG A home branch closes naturally, keeps Shownu believing it is Hyungwon, and queues the approved DM', () => {
  const h=makeIgCallHarness();h.apply('home');assert.equal(h.story.stage,'closed');assert.equal(h.opening.igCallResult,'home');
  assert.equal(h.opening.identityOutcome,'assumed-hyungwon');assert.equal(h.context.knows(),false);
  assert.equal(h.opening.transcript.at(-1).text,'아, 그래? 알겠어. 푹 쉬어.');
  assert.equal(h.opening.transcript.at(-1).translation,'啊，是喔？知道了，好好休息。');
  const c={lostPhoneStory:h.lostPhoneStory};vm.runInNewContext(`${igFollowupFn}\nthis.content=instagramFollowupContent;`,c);
  assert.equal(c.content('completed',h.opening).text,'잘 들어갔으면 됐어. 푹 쉬어.');
});
test('IG B outside branch closes naturally without asking for location and queues only the arrival check', () => {
  const h=makeIgCallHarness();h.apply('outside');assert.equal(h.story.stage,'closed');assert.equal(h.opening.igCallResult,'outside');
  assert.equal(h.context.knows(),false);assert.equal(h.opening.transcript.at(-1).text,'아직? 늦었는데. 조심해서 들어가.');
  const c={lostPhoneStory:h.lostPhoneStory};vm.runInNewContext(`${igFollowupFn}\nthis.content=instagramFollowupContent;`,c);
  assert.equal(c.content('completed',h.opening).text,'들어가면 연락해.');
});
test('IG C route lightly notes the voice difference and offers only the two contextual answers', () => {
  const h=makeIgCallHarness();h.apply('why');assert.equal(h.story.stage,'voice-check');
  assert.equal(h.opening.identityOutcome,'mildly-suspicious-unconfirmed');assert.equal(h.context.knows(),false);
  assert.equal(h.opening.transcript.at(-1).text,'아니, 그냥. 연락이 없길래. 근데 너 목소리가 좀 다른데?');
  assert.equal(h.opening.transcript.at(-1).translation,'沒有，就只是一直沒收到你回覆。不過你聲音怎麼有點不一樣？');
  h.context.render();assert.deepEqual(renderedIgChoiceIds(h.root),['tired','bad-signal']);
});
test('IG C1 acknowledges tiredness and closes without identifying the caller', () => {
  const h=makeIgCallHarness();h.apply('why');h.apply('tired');assert.equal(h.story.stage,'closed');
  assert.equal(h.opening.transcript.at(-2).text,'좀 피곤해서 그래.');assert.equal(h.opening.transcript.at(-1).text,'아, 그래? 알겠어. 쉬어.');
  assert.equal(h.opening.transcript.at(-1).translation,'啊，是喔？知道了，休息吧。');assert.equal(h.context.knows(),false);
});
test('IG C2 acknowledges poor reception and closes without identity follow-up', () => {
  const h=makeIgCallHarness();h.apply('why');h.apply('bad-signal');assert.equal(h.story.stage,'closed');
  assert.equal(h.opening.transcript.at(-2).text,'전화가 잘 안 들리나 봐.');assert.equal(h.opening.transcript.at(-1).text,'아, 그래? 알겠어. 쉬어.');
  const c={lostPhoneStory:h.lostPhoneStory};vm.runInNewContext(`${igFollowupFn}\nthis.content=instagramFollowupContent;`,c);
  assert.equal(c.content('completed',h.opening).skip,true);
});
test('IG used choices disappear, cannot be resent, and stale legacy disclosure IDs are rejected', () => {
  const h=makeIgCallHarness();h.apply('why');h.apply('why');assert.equal(h.opening.transcript.filter(line=>line.branchId==='why').length,1);
  const n=h.opening.transcript.length;h.apply('tell-found');assert.equal(h.opening.transcript.length,n);
  h.context.render();assert.deepEqual(renderedIgChoiceIds(h.root),['tired','bad-signal']);
});
test('IG used-choice state on openingCall remains compatible with legacy saves', () => {
  const h=makeIgCallHarness({stage:'opening',openingChoices:['home']});h.context.render();
  assert.deepEqual(renderedIgChoiceIds(h.root),['outside','why']);
  h.apply('home');assert.equal(h.opening.transcript.length,0);
});
test('completed IG calls render no choices and refresh reconciliation does not reschedule their branch', () => {
  const h=makeIgCallHarness({stage:'voice-check',choiceIds:['why','tired']});h.opening.status='completed';h.context.callActive=false;h.context.render();
  assert.equal(h.root.hidden,true);assert.deepEqual(renderedIgChoiceIds(h.root),[]);
  let scheduled=0;const context={lostPhoneStory:h.lostPhoneStory,instagramState:{callStatus:'in-call',unlocked:false},saveInstagramState(){},saveLostPhoneStory(){},ensureInstagramOpeningCallLog(){},scheduleInstagramOpeningCall(){scheduled++}};
  vm.runInNewContext(`${reconcileInstagramCallFn}\nthis.reconcile=reconcileInstagramOpeningCall;`,context);context.reconcile();
  assert.equal(h.lostPhoneStory.openingRoute,'instagram_first');assert.equal(scheduled,0);
});
test('IG phone overlay has no free-text input or send handler while normal IG DM implementation remains', () => {
  const screen=between('<section class="screen app-screen instagram-call"','</section>');
  assert.doesNotMatch(screen,/ig-message-text|ig-message-send|ig-message-input/);
  assert.doesNotMatch(html,/\$\('#ig-message-send'\)|function sendIgMessage\(\)/);
  assert.match(html,/ig-dm-composer|data-ig-dm-choice/);
});
test('IG and KKT call routes retain original delays, IDs, ringing, hangup, decline, and missed-call paths', () => {
  assert.match(html,/scheduledAt:opening\.scheduledAt/);assert.match(html,/const delay=12000/);
  assert.match(html,/setTimeout\(\(\)=>\{if\(instagramState\.callStatus==='ringing'\)endCall\(\{missed:true\}\)\},25000\)/);
  assert.match(html,/\$\('#ig-decline'\)\.addEventListener/);assert.match(html,/\$\('#ig-hangup'\)\.addEventListener/);
  assert.match(html,/scheduleLostPhoneCall\('first-checkin',120000\)/);assert.match(html,/scheduleLostPhoneCall\('outside-reply',15000\)/);
  assert.doesNotMatch(html,/CONFIG\.instagram\.messages\.forEach\(m=>\{const timer=setTimeout/);
  assert.match(html,/natural=connected&&\(options\.natural\|\|igStory\?\.stage==='closed'\)/);
});
test('KKT text-message flirt and confession options remain intact', () => {
  assert.match(html,/id:'shownu-confess'/);assert.match(html,/flirt:/);assert.match(html,/confession-direct/);
  assert.match(html,/romance\.confessionStatus='awaiting-seriousness'/);
});
test('IG scheduled post-call copy has the approved Korean and Traditional Chinese pairs', () => {
  const c={lostPhoneStory:{truthToldAt:null}};vm.runInNewContext(`${igFollowupFn}\nthis.content=instagramFollowupContent;`,c);
  const a=c.content('completed',{igCallResult:'home'}),b=c.content('completed',{igCallResult:'outside'}),d=c.content('completed',{igCallResult:'voice-check'});
  assert.equal(a.translation,'有平安到家就好，好好休息。');assert.equal(b.translation,'到家了跟我說一聲。');assert.equal(d.skip,true);
});
test('route migration and call event IDs remain untouched', () => {
  assert.match(html,/\$\{LOST_PHONE_STORY_ID\}:instagram-first-call/);
  assert.match(html,/\$\{LOST_PHONE_STORY_ID\}:call:\$\{reason\}/);
  assert.match(html,/function reconcileInstagramOpeningCall\(\)/);
});