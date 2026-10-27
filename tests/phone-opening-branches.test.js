// Regression coverage for the two original mutually exclusive opening-call
// routes. The harness evaluates production branch functions without booting
// the game or touching real localStorage.
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
const applyIgChoiceFn = between('function applyInstagramStoryChoice(id){', 'function acceptCall(){');

function makeRouteHarness(route = null) {
  const story = { openingRouteVersion: 1, openingRoute: route, phase: 'awaiting-reply', openingCall: null, call: { status: 'idle', records: [] } };
  const scheduled = [];
  const context = {
    lostPhoneStory: story,
    Date,
    saveLostPhoneStory() {},
    scheduleInstagramOpeningCall() { scheduled.push('ig'); },
    scheduleLostPhoneCall(reason, delay) { scheduled.push({ reason, delay }); },
    LOST_PHONE_STORY_ID: 'lost-phone-shownu-checkin-v1'
  };
  vm.runInNewContext(openingRouteFn + '\nthis.lockOpeningRoute=lockOpeningRoute;', context);
  return { story, scheduled, lock: context.lockOpeningRoute };
}

test('first app opened locks IG-first route and schedules only its original call event', () => {
  const h = makeRouteHarness();
  assert.equal(h.lock('app-instagram'), 'instagram_first');
  assert.deepEqual(h.scheduled, ['ig']);
  assert.equal(h.story.openingRoute, 'instagram_first');
});

test('first app opened locks KKT-first route and retains the 120-second initial call delay', () => {
  const h = makeRouteHarness();
  assert.equal(h.lock('app-kakao'), 'kakaotalk_first');
  assert.deepEqual(h.scheduled, [{ reason: 'first-checkin', delay: 120000 }]);
});

test('opening a second app cannot switch or schedule the mutually exclusive opening route', () => {
  const h = makeRouteHarness();
  h.lock('app-instagram');
  assert.equal(h.lock('app-kakao'), 'instagram_first');
  assert.deepEqual(h.scheduled, ['ig']);
});

test('source retains distinct stable event IDs and route-specific guards', () => {
  assert.match(html, /\$\{LOST_PHONE_STORY_ID\}:instagram-first-call/);
  assert.match(html, /scheduleLostPhoneCall\('first-checkin',120000\)/);
  assert.match(html, /openingRoute!=='instagram_first'/);
  assert.match(html, /openingRoute!=='kakaotalk_first'/);
  assert.match(html, /type:'instagram-opening-call'/);
  assert.match(html, /type:'lost-phone-incoming-call'/);
});

test('IG call options are attached to their current conversation stage and retain stable IDs', () => {
  const context = {};
  vm.runInNewContext(`${igChoicesDeclaration}\nthis.data=igCallChoiceData;`, context);
  assert.deepEqual(Array.from(context.data.opening, item => item.id), ['as-hyung', 'tell-found', 'hello']);
  assert.deepEqual(Array.from(context.data.home, item => item.id), ['home', 'outside', 'why', 'tell-found']);
  assert.deepEqual(Array.from(context.data.found, item => item.id), ['have-phone', 'check-place']);
  for (const stage of Object.values(context.data)) for (const option of stage) {
    assert.ok(option.text && option.translation, `missing bilingual copy for ${option.id}`);
  }
});

test('KKT-first call options match opening, home-check, outside-check and disclosure contexts', () => {
  const context = {};
  vm.runInNewContext(`${lostCallChoiceFn}\nthis.choices=lostCallChoices;`, context);
  assert.deepEqual(Array.from(context.choices({ stage: 'opening' }), item => item.id), ['as-hyung', 'tell-found', 'hello']);
  assert.deepEqual(Array.from(context.choices({ stage: 'home-check' }), item => item.id), ['say-home', 'say-outside', 'ask-why']);
  const outside = Array.from(context.choices({ stage: 'outside-check' }));
  assert.deepEqual(outside.map(item => item.id), ['outside-nearby', 'tell-found']);
  assert.match(outside[0].text, /혼자/);
  assert.match(outside[0].translation, /一個人/);
  assert.deepEqual(Array.from(context.choices({ stage: 'found-check' }), item => item.id), ['keep-phone', 'check-location']);
  const why = Array.from(context.choices({ stage: 'why-check' }));
  assert.equal(why[0].text, '그냥 확인하려고 전화한 거야?');
  assert.equal(why[0].translation, '只是想確認才打來的嗎？');
});

test('KKT outside-reply callback starts in the follow-up stage instead of replaying the opening', () => {
  assert.match(html, /call\.stage=call\.reason==='outside-reply'\?'outside-check':'opening'/);
  assert.match(html, /call\.stage=call\.reason==='outside-reply'\?'outside-check':'opening';[\s\S]*?call\.reason==='outside-reply'\?'아직 밖이야\?/);
  assert.match(html, /scheduleLostPhoneCall\('outside-reply',15000\)/);
});

test('KKT outside follow-up choice answers Shownu and closes that call branch', () => {
  const call = { stage: 'outside-check', status: 'connected', choiceIds: [], transcript: [], reason: 'outside-reply' };
  const story = { selectedBranch: 'reply-outside', call, truthToldAt: null };
  const context = {
    callStory: () => call,
    lostPhoneStory: story,
    lostCallChoices: stage => {
      const choiceContext = {};
      vm.runInNewContext(`${lostCallChoiceFn}\nthis.f=lostCallChoices;`, choiceContext);
      return choiceContext.f(stage);
    },
    addLostCallLine(from, text, translation) { call.transcript.push({ from, text, translation }); },
    saveLostPhoneCallStory() {},
    renderLostPhoneCall() {}
  };
  vm.runInNewContext(`${applyLostCallChoiceFn}\nthis.apply=applyLostCallChoice;`, context);
  context.apply('outside-nearby');
  assert.equal(call.stage, 'closed');
  assert.deepEqual(call.choiceIds, ['outside-nearby']);
  assert.match(call.transcript.at(-1).text, /도착하면 알려줘/);
});

test('IG why-stage option responds to the concern instead of asking why again', () => {
  const dataContext = {};
  vm.runInNewContext(`${igChoicesDeclaration}\nthis.data=igCallChoiceData;`, dataContext);
  const why = dataContext.data.why.find(item => item.id === 'why-answer');
  assert.equal(why.text, '걱정해 줘서 고마워. 이제 괜찮아.');
  assert.equal(why.translation, '謝謝你關心，我現在沒事了。');

  const story = { stage: 'why', choiceIds: [], choiceBusy: false };
  const opening = { status: 'connected', transcript: [] };
  const lostPhoneStory = { openingCall: opening, igCall: story, characterKnowledge: { shownu: {} } };
  const context = {
    lostPhoneStory,
    callActive: true,
    instagramState: { callStatus: 'in-call' },
    igCallChoiceData: dataContext.data,
    addIgStoryLine(from, text, translation, branchId) { opening.transcript.push({ from, text, translation, branchId }); },
    recordLostPhoneTruthFromText() {},
    saveLostPhoneStory() {},
    renderIgCallChoices() {},
    igNaturalEndTimer: 0,
    clearTimeout() {},
    setTimeout() { return 1; },
    endCall() {}
  };
  vm.runInNewContext(`${applyIgChoiceFn}\nthis.apply=applyInstagramStoryChoice;`, context);
  context.apply('why-answer');
  assert.equal(story.stage, 'closed');
  assert.equal(story.choiceIds[0], 'why-answer');
  assert.match(opening.transcript.at(-1).text, /괜찮으면 됐어/);
});

test('call completion handlers preserve the selected route and do not re-open completed calls', () => {
  assert.match(html, /opening\.status=outcome;opening\.endReason=outcome;opening\.endedAt=Date\.now\(\)/);
  assert.match(html, /if\(!opening\|\|lostPhoneStory\.openingRoute!=='instagram_first'\|\|opening\.eventId!==event\.id\|\|opening\.status!=='scheduled'\)/);
  assert.match(html, /call\.records\.some\(record=>record\.id===event\.id\)/);
  assert.match(html, /function resumeLostPhoneCallPresentation\(\)[\s\S]*?call\?\.status==='ringing'/);
});

test('legacy route migration keeps a previously saved branch locked as legacy_unknown', () => {
  assert.match(html, /openingRoute='legacy_unknown';lostPhoneStory\.openingRouteVersion=1/);
  assert.match(html, /function readLostPhoneStory\(\)[\s\S]*?openingRouteVersion:0,openingRoute:null,\.\.\.saved/);
});

test('IG why-stage reply naturally closes without altering call trigger conditions', () => {
  const whyContext = {};
  vm.runInNewContext(`${igChoicesDeclaration}\nthis.data=igCallChoiceData;`, whyContext);
  assert.ok(whyContext.data.why.some(item => item.id === 'truth'));
  assert.match(applyIgChoiceFn, /story\.stage='closed';reply='그래\. 괜찮으면 됐어\. 늦었으니까 얼른 쉬어\.'/);
  assert.match(html, /scheduleInstagramOpeningCall\(\)[\s\S]*?scheduledAt:opening\.scheduledAt/);
});

test('telephone line Korean and Traditional Chinese revisions remain paired', () => {
  assert.match(html, /걱정해 줘서 고마워\. 이제 괜찮아\.',translation:'謝謝你關心，我現在沒事了。'/);
  assert.match(html, /근처야\. 혼자니까 걱정 마\.',translation:'我在附近，一個人，不用擔心。'/);
  assert.match(html, /그냥 확인하려고 전화한 거야\?',translation:'只是想確認才打來的嗎？'/);
  assert.match(html, /아직 밖이야\? 어디쯤이야\? 혼자야\?/);
});
