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
const igCallKnowledgeFn = between('function igCallShownuKnowsFinder(){', 'const igCallChoiceData=');
const renderIgChoicesFn = between('function renderIgCallChoices(){', 'function addIgStoryLine(');
const applyIgChoiceFn = between('function applyInstagramStoryChoice(id){', 'function acceptCall(){');
const reconcileInstagramCallFn = between('function reconcileInstagramOpeningCall(){', '\nregisterAfterWorkHandlers();');

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
  const lostPhoneStory = { openingRoute: 'instagram_first', openingCall: opening, igCall: story, characterKnowledge: { shownu: {} } };
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
  vm.runInNewContext(`${igCallKnowledgeFn}\n${applyIgChoiceFn}\nthis.apply=applyInstagramStoryChoice;`, context);
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
  assert.match(applyIgChoiceFn, /id==='why-answer'\)\{story\.stage='closed';reply=knownStranger\?/);
  assert.match(applyIgChoiceFn, /translation=knownStranger\?'這樣啊。您沒事就好。時間很晚了，請好好休息。':'好，沒事就好。很晚了，快休息吧。'/);
  assert.match(html, /scheduleInstagramOpeningCall\(\)[\s\S]*?scheduledAt:opening\.scheduledAt/);
});

function makeIgCallHarness({ stage = 'opening', choiceIds = [], known = false } = {}) {
  const opening = { status: 'connected', eventId: 'ig-opening-fixture', transcript: [], choiceIds: [] };
  const story = { stage, choiceIds: [...choiceIds], choiceBusy: false, toldTruth: known };
  const lostPhoneStory = { openingRoute: 'instagram_first', truthToldAt: known ? 1 : null, openingCall: opening, igCall: story, characterKnowledge: { shownu: {} } };
  const root = { innerHTML: '', hidden: true };
  const context = {
    lostPhoneStory, callActive: true, instagramState: { callStatus: 'in-call' }, igLastMessageAt: 0, igNaturalEndTimer: null,
    igCallChoiceData: null, Date,
    $: selector => selector === '#ig-call-reply-options' ? root : null,
    escapeHtml: value => String(value),
    addIgStoryLine(from, text, translation, branchId) { opening.transcript.push({ from, text, translation, branchId }); },
    recordLostPhoneTruthFromText(text) { lostPhoneStory.truthToldAt = Date.now(); opening.truthTold = true; return true; },
    recordCharacterPhoneKnowledge(id, facts) { Object.assign(lostPhoneStory.characterKnowledge[id], facts, { knowsPhoneLost: true, knowsPossibleStranger: true, knowsPlayerIsFinder: true }); },
    saveLostPhoneStory() {}, renderIgCallChoices: null,
    clearTimeout() {}, setTimeout() { return 1; }, endCall() {}
  };
  vm.runInNewContext(`${igCallKnowledgeFn}\n${igChoicesDeclaration}\n${renderIgChoicesFn}\n${applyIgChoiceFn}\nthis.data=igCallChoiceData;this.render=renderIgCallChoices;this.apply=applyInstagramStoryChoice;this.knows=igCallShownuKnowsFinder;`, context);
  return { ...context, context, opening, story, lostPhoneStory, root };
}
function renderedIgChoiceIds(root) { return [...root.innerHTML.matchAll(/data-ig-story-choice="([^"]+)"/g)].map(match => match[1]); }

test('IG unclear answer advances coherently and the selected option disappears from the next round', () => {
  const h = makeIgCallHarness();
  h.render();
  assert.deepEqual(renderedIgChoiceIds(h.root), ['as-hyung', 'tell-found', 'hello']);
  h.apply('hello');
  assert.equal(h.story.stage, 'heard');
  assert.match(h.opening.transcript.at(-1).text, /내 목소리 들려/);
  h.apply('unclear');
  assert.equal(h.story.stage, 'heard');
  assert.match(h.opening.transcript.at(-1).text, /어디가 안 들려/);
  assert.deepEqual(renderedIgChoiceIds(h.root), ['heard', 'tell-found']);
  assert.equal(h.story.choiceIds.filter(id => id === 'unclear').length, 1);
});

test('IG nearby answer closes the location check naturally while Shownu still believes it is Hyungwon', () => {
  const h = makeIgCallHarness({ stage: 'outside' });
  h.apply('nearby');
  assert.equal(h.story.stage, 'closed');
  assert.equal(h.lostPhoneStory.characterKnowledge.shownu.knowsPhoneLost, undefined);
  assert.equal(h.opening.transcript.at(-1).text, '그래. 늦었으니까 조심해서 들어가.');
  assert.equal(h.opening.transcript.at(-1).translation, '好。很晚了，回去路上小心。');
});

test('IG truth disclosure updates only Shownu knowledge and all remaining call turns address a stranger', () => {
  const h = makeIgCallHarness({ stage: 'outside' });
  h.apply('truth');
  assert.equal(h.story.stage, 'found');
  assert.equal(h.opening.truthTold, true);
  assert.equal(h.lostPhoneStory.characterKnowledge.shownu.knowsPhoneLost, true);
  assert.equal(h.lostPhoneStory.characterKnowledge.shownu.knowsPossibleStranger, true);
  assert.match(h.opening.transcript.at(-1).text, /아… 형원이가 아니시군요/);
  assert.equal(h.opening.transcript.at(-1).translation, '啊……原來您不是亨源。您撿到這支手機嗎？現在還在您那裡嗎？');
  assert.deepEqual(renderedIgChoiceIds(h.root), ['have-phone', 'check-place']);
  h.apply('have-phone');
  assert.equal(h.story.stage, 'place');
  assert.match(h.opening.transcript.at(-1).text, /여쭤봐도 될까요/);
  h.apply('later-place');
  assert.equal(h.story.stage, 'closed');
  assert.match(h.opening.transcript.at(-1).text, /감사합니다/);
  assert.match(h.opening.transcript.at(-1).text, /연락 기다리고 있겠습니다/);
});

test('truth told to another character does not make Shownu recognize the finder on the IG call', () => {
  const h = makeIgCallHarness({ stage: 'home', known: false });
  h.lostPhoneStory.truthToldAt = 1234;
  assert.equal(h.context.knows(), false);
  h.apply('outside');
  assert.match(h.opening.transcript.at(-1).text, /혼자야\?/);
  assert.match(h.opening.transcript.at(-1).text, /어디쯤인데/);
  assert.match(html, /addIgStoryLine\('셔누',igCallShownuKnowsFinder\(\)\?/);
});

test('IG undisclosed nearby branch keeps familiar speech and does not claim the finder disclosed identity', () => {
  const h = makeIgCallHarness({ stage: 'home', known: false });
  h.apply('outside');
  assert.equal(h.story.stage, 'outside');
  assert.match(h.opening.transcript.at(-1).text, /혼자야\?/);
  assert.match(h.opening.transcript.at(-1).text, /어디쯤인데/);
  h.apply('nearby');
  assert.equal(h.opening.transcript.at(-1).text, '그래. 늦었으니까 조심해서 들어가.');
  assert.equal(h.lostPhoneStory.truthToldAt, null);
});

test('IG call choice stage and one-time selections survive restore; a completed call renders no stale options', () => {
  const saved = { stage: 'heard', choiceIds: ['hello', 'unclear'], choiceBusy: false };
  const restored = makeIgCallHarness({ ...saved });
  restored.render();
  assert.deepEqual(renderedIgChoiceIds(restored.root), ['heard', 'tell-found']);
  assert.equal(restored.story.stage, 'heard');
  restored.apply('unclear');
  assert.equal(restored.story.choiceIds.filter(id => id === 'unclear').length, 1);
  restored.opening.status = 'completed';
  restored.context.callActive = false;
  restored.render();
  assert.equal(restored.root.hidden, true);
  assert.deepEqual(renderedIgChoiceIds(restored.root), []);
});

test('legacy IG saves with used choices only on openingCall still suppress and reject resends', () => {
  const legacy = makeIgCallHarness({ stage: 'heard' });
  legacy.story.choiceIds = undefined;
  legacy.opening.choiceIds = ['hello', 'unclear'];
  legacy.render();
  assert.deepEqual(renderedIgChoiceIds(legacy.root), ['heard', 'tell-found']);
  const transcriptLength = legacy.opening.transcript.length;
  legacy.apply('unclear');
  assert.equal(legacy.opening.transcript.length, transcriptLength);
  assert.deepEqual(Array.from(legacy.story.choiceIds), ['hello', 'unclear']);
});

test('refresh reconciliation preserves the IG call branch and consumed choices without reopening it', () => {
  const h = makeIgCallHarness({ stage: 'heard', choiceIds: ['hello', 'unclear'] });
  h.opening.status = 'connected';
  let scheduled = 0;
  const context = {
    lostPhoneStory: h.lostPhoneStory,
    instagramState: { callStatus: 'in-call', unlocked: false },
    saveInstagramState() {}, saveLostPhoneStory() {}, ensureInstagramOpeningCallLog() {},
    scheduleInstagramOpeningCall() { scheduled++; }
  };
  vm.runInNewContext(`${reconcileInstagramCallFn}\nthis.reconcile=reconcileInstagramOpeningCall;`, context);
  context.reconcile();
  assert.equal(h.opening.status, 'interrupted');
  assert.equal(h.lostPhoneStory.openingRoute, 'instagram_first');
  assert.equal(h.story.stage, 'heard');
  assert.deepEqual(Array.from(h.story.choiceIds), ['hello', 'unclear']);
  assert.equal(context.instagramState.callStatus, 'hung-up');
  assert.equal(scheduled, 0);
});

test('IG first-call truth option uses natural spacing and translation without changing KKT-first copy', () => {
  const context = {};
  vm.runInNewContext(`${igChoicesDeclaration}\nthis.data=igCallChoiceData;`, context);
  const truth = context.data.outside.find(option => option.id === 'truth');
  assert.equal(truth.text, '미안, 난 형원이가 아니야. 휴대폰을 주웠어.');
  assert.equal(truth.translation, '抱歉，我不是亨源。我撿到了這支手機。');
  assert.match(lostCallChoiceFn, /미안, 사실 내가 형원이는 아니야\. 핸드폰을 주웠어\./);
});

test('telephone line Korean and Traditional Chinese revisions remain paired', () => {
  assert.match(html, /걱정해 줘서 고마워\. 이제 괜찮아\.',translation:'謝謝你關心，我現在沒事了。'/);
  assert.match(html, /근처야\. 혼자니까 걱정 마\.',translation:'我在附近，一個人，不用擔心。'/);
  assert.match(html, /그냥 확인하려고 전화한 거야\?',translation:'只是想確認才打來的嗎？'/);
  assert.match(html, /아직 밖이야\? 어디쯤이야\? 혼자야\?/);
});
