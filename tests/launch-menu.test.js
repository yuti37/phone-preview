// Isolated launch-menu and single-save tests. Storage is mocked; no browser
// profile or real player save is accessed by this suite.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const helperStart = html.indexOf('const GAME_LOCAL_SAVE_KEYS=Object.freeze([');
const helperEnd = html.indexOf('let gameInitializationStatus=', helperStart);
assert.notEqual(helperStart, -1, 'launch save helpers are present');
assert.notEqual(helperEnd, -1, 'launch initialization state is present');
const saveHelpers = html.slice(helperStart, helperEnd);

function makeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    snapshot() { return Object.fromEntries(data); },
    data
  };
}

function helpers(local = makeStorage(), session = makeStorage()) {
  const context = { localStorage: local, sessionStorage: session, CONFIG: { chats: ['shownu', 'minhyuk', 'kihyun', 'jooheon', 'changkyun', 'manager', 'group'].map(id => ({ id })) } };
  vm.runInNewContext(`${saveHelpers}\nthis.GAME_LOCAL_SAVE_KEYS=GAME_LOCAL_SAVE_KEYS;this.GAME_SESSION_SAVE_KEYS=GAME_SESSION_SAVE_KEYS;this.inspectLaunchSave=inspectLaunchSave;this.resetLaunchSave=resetLaunchSave;`, context);
  return { ...context, local, session };
}

const story = { id: 'lost-phone-shownu-checkin-v1', openingRoute: 'instagram_first', stageSeven: { groups: { a: { selectedOptionId: 'choice' } } } };

test('no save disables continue while allowing a fresh game', () => {
  const h = helpers();
  const result = h.inspectLaunchSave();
  assert.equal(result.canContinue, false);
  assert.equal(result.hasGameData, false);
  assert.equal(result.storageError, null);
});

test('valid current save and legacy-shaped story remain continuable', () => {
  for (const saved of [story, { id: story.id, openingRoute: 'kakaotalk_first' }]) {
    const h = helpers(makeStorage({ 'phone-sim-lost-phone-story-v1': JSON.stringify(saved) }));
    assert.equal(h.inspectLaunchSave().canContinue, true);
  }
});

test('a recoverable event-store message and delivered legacy phone event can continue', () => {
  const eventStore = { version: 2, events: [{ id: 'lost-phone-shownu-checkin-v1:legacy-message', type: 'kkt-message', source: 'kakao', status: 'completed', payload: { chatId: 'shownu', message: { id: 'legacy-message', text: '형원아 바빠?' } } }], storyData: null };
  const event = { id: 'ig-shownu-hangup-message-v1', status: 'delivered', message: { id: 'ig-shownu-hangup-message-v1', text: '형원아 바빠?' } };
  for (const [key, value] of [
    ['phone-sim-event-store-v2', eventStore],
    ['phone-sim-events-v1', event]
  ]) {
    const h = helpers(makeStorage({ [key]: JSON.stringify(value) }));
    assert.equal(h.inspectLaunchSave().canContinue, true, key);
  }
});

test('empty event stores, X-only state, and favorites-only state are not resumable stories', () => {
  const fixtures = [
    ['phone-sim-event-store-v2', { version: 2, events: [] }],
    ['phone-sim-x-interactions-v1', { likedIds: ['post-1'] }],
    ['phone-sim-x-interactions-v1', { likedIds: [], repostedIds: [] }],
    ['phone-sim.photos-favorites.v1', ['photo-1']],
    ['phone-sim.photos-favorites.v1', []],
    ['phone-sim.photos-favorites.v1', ['unknown-old-id', 4]]
  ];
  for (const [key, value] of fixtures) {
    const h = helpers(makeStorage({ [key]: JSON.stringify(value) }));
    const result = h.inspectLaunchSave();
    assert.equal(result.canContinue, false, key);
    assert.equal(result.hasGameData, true, key);
  }
});

test('session-only Instagram state is not resumable but remains marked for overwrite confirmation', () => {
  const session = makeStorage({ 'phone-sim-ig-v1': JSON.stringify({ callStatus: 'hung-up' }) });
  const result = helpers(makeStorage(), session).inspectLaunchSave();
  assert.equal(result.canContinue, false);
  assert.equal(result.hasGameData, true);
});

test('partial app-only data opens restart confirmation without mutating storage', () => {
  const local = makeStorage({ 'phone-sim.photos-favorites.v1': JSON.stringify(['photo-1']), unrelated: 'keep' });
  const session = makeStorage();
  const beforeLocal = local.snapshot(), beforeSession = session.snapshot();
  const confirm = { hidden: true }, copy = { textContent: '' }, cancel = { focus() {} }, button = { disabled: false, addEventListener(_type, handler) { this.handler = handler; } };
  const launch = helpers(local, session);
  const startHandler = html.slice(html.indexOf("$('#launch-new').addEventListener('click',()=>{"), html.indexOf("$('#launch-cancel').addEventListener", html.indexOf("$('#launch-new').addEventListener('click',()=>{")));
  const context = { refreshLaunchMenu: () => launch.inspectLaunchSave(), resetGameRuntimeForFreshStart(){ throw new Error('must not start before confirmation'); }, initializeGameOnce(){ throw new Error('must not initialize before confirmation'); }, launchConfirm: confirm, $: selector => selector === '#launch-new' ? button : selector === '#launch-confirm-copy' ? copy : selector === '#launch-cancel' ? cancel : confirm };
  vm.runInNewContext(startHandler, context);
  button.handler();
  assert.equal(confirm.hidden, false);
  assert.match(copy.textContent, /기존 진행 상황이 삭제/);
  assert.deepEqual(local.snapshot(), beforeLocal);
  assert.deepEqual(session.snapshot(), beforeSession);
});

test('no stored game data starts immediately without a reset confirmation', () => {
  const h = helpers();
  let starts = 0;
  const confirm = { hidden: true }, button = { addEventListener(_type, handler) { this.handler = handler; } };
  const startHandler = html.slice(html.indexOf("$('#launch-new').addEventListener('click',()=>{"), html.indexOf("$('#launch-cancel').addEventListener", html.indexOf("$('#launch-new').addEventListener('click',()=>{")));
  const context = { refreshLaunchMenu: () => h.inspectLaunchSave(), resetGameRuntimeForFreshStart(){ starts++; }, initializeGameOnce(){ starts++; }, launchConfirm: confirm, $: selector => selector === '#launch-new' ? button : confirm };
  vm.runInNewContext(startHandler, context);
  button.handler();
  assert.equal(starts, 2);
  assert.equal(confirm.hidden, true);
});

test('malformed story-like records and non-delivered legacy events are not resumable', () => {
  const fixtures = [
    ['phone-sim-lost-phone-story-v1', { id: story.id }],
    ['phone-sim-events-v1', { id: 'ig-shownu-hangup-message-v1', status: 'pending' }],
    ['phone-sim-event-store-v2', { version: 2, events: [{ id: 'event-1', type: 'unknown', source: 'system', status: 'completed', payload: {} }] }]
  ];
  for (const [key, value] of fixtures) {
    const h = helpers(makeStorage({ [key]: JSON.stringify(value) }));
    assert.equal(h.inspectLaunchSave().canContinue, false, key);
    assert.equal(h.inspectLaunchSave().hasGameData, true, key);
  }
});

test('unparseable owned save disables continue without overwriting or deleting it', () => {
  const local = makeStorage({ 'phone-sim-lost-phone-story-v1': '{broken', keep: 'untouched' });
  const h = helpers(local);
  const before = local.snapshot();
  const result = h.inspectLaunchSave();
  assert.equal(result.canContinue, false);
  assert.deepEqual(Array.from(result.corruptKeys), ['phone-sim-lost-phone-story-v1']);
  assert.deepEqual(local.snapshot(), before);
});

test('cancel action only closes confirmation and leaves all storage untouched', () => {
  assert.match(html, /\$\('#launch-cancel'\)\.addEventListener\('click',\(\)=>\{launchConfirm\.hidden=true;\$\('#launch-new'\)\.focus\(\)\}\)/);
  assert.doesNotMatch(html.slice(html.indexOf("$('#launch-cancel').addEventListener"), html.indexOf("$('#launch-confirm-new').addEventListener")), /resetLaunchSave|removeItem|initializeGameOnce/);
});

test('confirmed reset removes only the five local and one session allowlisted keys', () => {
  const local = makeStorage({
    'phone-sim-lost-phone-story-v1': JSON.stringify(story),
    'phone-sim-event-store-v2': JSON.stringify({ version: 2, events: [], notifications: [] }),
    'phone-sim-x-interactions-v1': JSON.stringify({ likedIds: [], repostedIds: [] }),
    'phone-sim.photos-favorites.v1': JSON.stringify(['photo-1']),
    'phone-sim-events-v1': JSON.stringify({ id: 'ig-shownu-hangup-message-v1' }),
    unrelated: 'keep-local'
  });
  const session = makeStorage({ 'phone-sim-ig-v1': JSON.stringify({ callStatus: 'hung-up' }), unrelatedSession: 'keep-session' });
  const h = helpers(local, session);
  const result = h.resetLaunchSave();
  assert.equal(result.ok, true);
  assert.deepEqual(local.snapshot(), { unrelated: 'keep-local' });
  assert.deepEqual(session.snapshot(), { unrelatedSession: 'keep-session' });
  assert.deepEqual(Array.from(h.GAME_LOCAL_SAVE_KEYS), [
    'phone-sim-lost-phone-story-v1', 'phone-sim-event-store-v2',
    'phone-sim-x-interactions-v1', 'phone-sim.photos-favorites.v1', 'phone-sim-events-v1'
  ]);
  assert.deepEqual(Array.from(h.GAME_SESSION_SAVE_KEYS), ['phone-sim-ig-v1']);
});

test('reset snapshots first and rolls back partial removal failure', () => {
  const local = makeStorage({ 'phone-sim-lost-phone-story-v1': JSON.stringify(story), unrelated: 'safe' });
  const originalRemove = local.removeItem.bind(local);
  let calls = 0;
  local.removeItem = key => { calls++; if (calls === 2) throw new Error('storage denied'); originalRemove(key); };
  const h = helpers(local);
  const before = local.snapshot();
  const result = h.resetLaunchSave();
  assert.equal(result.ok, false);
  assert.equal(result.error, 'storage denied');
  assert.deepEqual(local.snapshot(), before);
});

test('storage access failure prevents continuing or starting from an assumed empty slot', () => {
  const local = makeStorage();
  local.getItem = () => { throw new Error('blocked'); };
  const h = helpers(local);
  const result = h.inspectLaunchSave();
  assert.equal(result.canContinue, false);
  assert.match(result.storageError, /blocked/);
  assert.match(html, /if\(save\.storageError\)return/);
});

test('launch menu is outside the phone and is shown by default on every page load', () => {
  assert.match(html, /<div class="phone" id="phone">[\s\S]*?<\/div>\s*<section id="game-launch-menu"/);
  assert.match(html, /id="game-launch-menu" aria-label="게임 시작 메뉴" aria-modal="true" role="dialog">/);
  assert.match(html, /id="launch-continue"[^>]*>이어하기<\/button>/);
  assert.match(html, /id="launch-new"[^>]*>처음부터<\/button>/);
  assert.match(html, /padding:calc\(24px \+ env\(safe-area-inset-top\)\) 22px calc\(24px \+ env\(safe-area-inset-bottom\)\)/);
});

test('game restoration and legacy migration have no eager top-level invocation', () => {
  const bootAt = html.indexOf('function initializeGameOnce(){');
  assert.ok(bootAt > 0);
  assert.doesNotMatch(html, /^lostPhoneStory=readLostPhoneStory\(\);/m);
  for (const call of ['initializePhoneEvents();', 'initializeLostPhoneStory();', 'restoreStageElevenSharedSource();', 'ensureStageElevenPrivateClues();', 'migratePersistedDrunkCheckinStoryTime();', 'ensureStageTwelveState();', 'ensureStage14MealHistory();', 'stage13LoadPhotoFavorites();', 'startLostPhoneCallDisplayTimer();']) {
    assert.equal(html.split(call).length - 1, 1, `${call} should have a single call site`);
    assert.ok(html.indexOf(call) > bootAt, `${call} should be inside deferred boot`);
  }
});

test('game initialization guard runs the production restore sequence once', () => {
  const start = html.indexOf('function initializeGameOnce(){');
  const end = html.indexOf('function resetGameRuntimeForFreshStart(){', start);
  const source = html.slice(start, end);
  const calls = [];
  const launch = { hidden: false }, confirm = { hidden: false }, status = { textContent: '' };
  const context = {
    gameInitializationStatus: 'idle', lostPhoneStory: null, phone: { inert: true },
    Object, String, Date,
    $: selector => selector === '#game-launch-menu' ? launch : selector === '#launch-confirm' ? confirm : status,
    initializePhoneEvents(){ calls.push('events'); }, initializeLostPhoneStory(){ calls.push('story'); context.lostPhoneStory = { openingRoute: null, stageEleven: { manualDisclosureGroups: {} } }; }, startLostPhoneCallDisplayTimer(){ calls.push('call-display'); },
    ensureLostPhoneStoryExtensions(){ calls.push('extensions'); }, backfillStoredMessageTranslations(){}, ensureStageEightNarrativeState(){}, ensureStageFiveKnowledgeSources(){}, ensureStageSixContinuity(){}, ensureStageSevenState(){}, ensureKihyunHistory(){}, ensureStageFiveHistoricMessages(){}, ensureStableKakaoHistoryIds(){}, ensureStageTenTourHistory(){}, restoreStageSixWorldEvents(){}, restoreStageSevenOptionGroups(){}, reconcileInstagramOpeningCall(){}, restoreIgDmPostCall(){}, restoreLostPhoneCallTimeout(){}, restoreLostPhonePostCallMessage(){}, restoreStageElevenSharedSource(){}, ensureStageElevenPrivateClues(){}, ensureStageElevenState(){}, saveLostPhoneStory(){}, migratePersistedDrunkCheckinStoryTime(){}, ensureStageTwelveState(){}, ensureStage14MealHistory(){}, stage13LoadPhotoFavorites(){}
  };
  vm.runInNewContext(`${source}\nthis.run=initializeGameOnce;`, context);
  assert.equal(context.run(), true);
  assert.equal(context.run(), true);
  assert.deepEqual(calls, ['events', 'story', 'extensions', 'call-display']);
  assert.equal(context.gameInitializationStatus, 'started');
  assert.equal(launch.hidden, true);
  assert.equal(confirm.hidden, true);
  assert.equal(context.phone.inert, false);
});

test('the original mutually exclusive IG/KKT route mechanism remains unchanged', () => {
  assert.match(html, /function lockOpeningRoute\(app\)\{/);
  assert.match(html, /openingRoute=app==='app-instagram'\?'instagram_first':'kakaotalk_first'/);
  assert.match(html, /scheduleInstagramOpeningCall\(\);else if\(lostPhoneStory\.openingRoute==='kakaotalk_first'[^;]+scheduleLostPhoneCall\('first-checkin',120000\)/);
  assert.match(html, /const LOST_PHONE_STORY_KEY='phone-sim-lost-phone-story-v1'/);
});

test('no broad storage clear is used; reset requires the explicit confirmation handler', () => {
  assert.doesNotMatch(html, /(?:localStorage|sessionStorage)\.clear\s*\(/);
  const handler = html.slice(html.indexOf("$('#launch-confirm-new').addEventListener"), html.indexOf("launchConfirm.addEventListener('keydown'"));
  assert.match(handler, /resetLaunchSave\(\)/);
  assert.match(handler, /if\(!reset\.ok\)[\s\S]*?return/);
  assert.match(handler, /resetGameRuntimeForFreshStart\(\);gameInitializationStatus='idle';refreshLaunchMenu\(\);initializeGameOnce\(\)/);
});

test('call display timer starts only after launch and is stopped by fresh-start cleanup', () => {
  assert.match(html, /function startLostPhoneCallDisplayTimer\(\)\{if\(lostPhoneCallDisplayTimer!==null\)return;/);
  assert.match(html, /restoreLostPhonePostCallMessage\(\);startLostPhoneCallDisplayTimer\(\)/);
  assert.match(html, /clearInterval\(lostPhoneCallDisplayTimer\);lostPhoneCallDisplayTimer=null/);
});
