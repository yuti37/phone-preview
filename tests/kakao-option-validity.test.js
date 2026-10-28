// Repeatable, isolated validity tests for the production KakaoTalk option
// predicates. Run with: node --test tests/kakao-option-validity.test.js
// No browser DOM or real localStorage is used; the harness executes the
// production catalog, Stage 12 conversation predicates, and Stage 15 filters.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function between(start, end, source = html) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing source anchor: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing source end anchor: ${end}`);
  return source.slice(from, to);
}

function exactAssignment(start, nextStart) {
  return between(start, nextStart).trim();
}

// Keep the extracted production sections deliberately narrow. This prevents
// app boot and UI rendering from running while retaining the exact option
// data and validity logic used by the app.
const stageElevenCatalog = between(
  'const stageElevenActiveCatalog=Object.freeze({',
  'const STAGE_TWELVE_REPLACED_LEGACY_OPTIONS='
);
const stageElevenFilters = between(
  'const STAGE_TWELVE_REPLACED_LEGACY_OPTIONS=',
  'function stageElevenCurrentCategories('
);
const playerIdentityPolicy = between('function retiredPlayerIdentityOption(', 'function retirePendingIdentityChoices(');
const stageSevenData = between(
  'const STAGE_SEVEN_PEOPLE=',
  'function stageSevenOptionGroup('
);
const stageSevenOptionGroup = between(
  'function stageSevenOptionGroup(',
  'function stageSevenQueue('
);
const stageSevenVisibleGroups = between(
  'function stageSevenGroupForChat(',
  'function stageSevenDisplayName('
);
const stageSevenOrdinaryReplies = between(
  'function stageSevenOrdinaryReply(chatId,optionId){',
  'function stageSevenObserveKakaoEvent('
);
const stageSevenScheduledPrompts = between(
  'function stageSevenRefreshPendingPrompt(',
  'function restoreStageSevenOptionGroups()'
);
const stageTwelveFlowData = between(
  'const STAGE_TWELVE_FLOWS={',
  'function ensureStageTwelveState()'
);
const stageTwelveStateAndBasePredicates = between(
  'function ensureStageTwelveState(){',
  'function stageTwelveBuildItem('
);
const stageTwelveBuilder = between(
  'function stageTwelveBuildItem(',
  'const stageElevenActiveOptionsBeforeTwelve='
);
const stageTwelveOptionWrapper = exactAssignment(
  'const stageElevenActiveOptionsBeforeTwelve=',
  'const stageSevenGroupForChatBeforeMeal='
);
const stageFifteenFilter = between(
  'function stageFifteenRelatedStoryGroup(',
  '// Stable semantic responses for each available follow-up'
);
const stageTwelveQueueWrapper = between(
  'let stageTwelveCommittingMeta=null;',
  'const stageElevenCommitBeforeTwelve='
);
const productionCommitLine = html.split(/\r?\n/).find(line => line.startsWith('stageElevenCommitActiveMessage=function(item){'));
const productionActiveWorldLine = html.split(/\r?\n/).find(line => line.startsWith('stageElevenActiveWorldEvent=function(event){if(event?.payload?.kind!==\'active-message-reply\''));
const productionKakaoHandlerLine = html.split(/\r?\n/).find(line => line.startsWith("if(stageElevenKakaoHandlerBeforeTwelve)gameEventHandlers.set('kkt-message'"));

function createHarness(save = {}) {
  const chats = ['shownu', 'kihyun', 'minhyuk', 'jooheon', 'changkyun', 'manager', 'group']
    .map(id => ({ id, messages: [] }));
  const sourceIds = {
    'kihyun-work': 'lost-phone-shownu-checkin-v1:world:kihyun-checkin:message',
    'kihyun-reminder': 'lost-phone-shownu-checkin-v1:world:kihyun-checkin:followup:message',
    'kihyun-later-work': 'lost-phone-shownu-checkin-v1:world:kihyun-checkin:later-followup:message',
    'minhyuk-invite': 'lost-phone-shownu-checkin-v1:stage-seven:minhyuk-invite',
    'jooheon-song': 'lost-phone-shownu-checkin-v1:stage-seven:jooheon-song',
    'changkyun-video': 'lost-phone-shownu-checkin-v1:stage-seven:changkyun-video',
    'manager-schedule': 'lost-phone-shownu-checkin-v1:world:manager-schedule',
    'manager-vehicle-count': 'lost-phone-shownu-checkin-v1:world:manager-schedule:followup:message',
    'group-meal': 'lost-phone-shownu-checkin-v1:world:group-meal:1'
  };
  for (const [groupId, sourceEventId] of Object.entries(sourceIds)) {
    const chatId = groupId.startsWith('kihyun') ? 'kihyun'
      : groupId === 'minhyuk-invite' ? 'minhyuk'
        : groupId === 'jooheon-song' ? 'jooheon'
          : groupId === 'changkyun-video' ? 'changkyun'
            : groupId.startsWith('manager-') ? 'manager' : 'group';
    chats.find(chat => chat.id === chatId).messages.push({ id: sourceEventId, storyTimestamp: 1792800000000 });
  }
  const events = new Map();
  const scheduledMessages = [];
  const state = {
    conversations: {}, usedByChat: {}, sentIds: [], memories: {},
    romance: { lastResponseKind: null, confessionStatus: 'idle', invitationStatus: 'idle', interactionIds: [], replyEventIds: {} }
  };
  if (save.stageEleven) Object.assign(state, structuredClone(save.stageEleven));
  const stageSeven = structuredClone(save.stageSeven || {});
  const topics = structuredClone(save.topics || {});
  const story = {
    selectedBranch: save.selectedBranch || null,
    stageEleven: state,
    stageSeven: { version: 1, groups: {}, disclosures: {}, eventIds: [], groupReads: {}, ...stageSeven },
    continuity: { group: { sourceEventId: sourceIds['group-meal'], status: 'awaiting-reply' }, ...(save.continuity || {}) },
    characterKnowledge: {}, repliedAsHyungwonTo: {},
    kihyunCheckin: { status: 'sent', ...(save.kihyunCheckin || {}) }
  };
  const sourceSet = new Set(Object.values(sourceIds));
  for (const chat of chats) for (const message of chat.messages) sourceSet.add(message.id);
  const sandbox = {
    console,
    Date,
    URLSearchParams,
    location: { search: '' },
    window: {},
    CONFIG: { chats },
    STAGE_SEVEN_COPY: {},
    LOST_PHONE_STORY_ID: 'lost-phone-shownu-checkin-v1',
    lostPhoneStory: story,
    activeChat: { id: 'shownu' },
    saveLostPhoneStory() { save.saves = (save.saves || 0) + 1; },
    ensureStageElevenState() { return story.stageEleven; },
    ensureStageSevenState() {
      story.stageSeven.groups ||= {};
      story.stageSeven.groupMealDecisions ||= {};
      return story.stageSeven;
    },
    ensureLostPhoneStoryExtensions() {
      story.characterKnowledge ||= {};
      for (const id of ['shownu', 'kihyun', 'minhyuk', 'jooheon', 'changkyun', 'manager', 'hyungwon']) {
        story.characterKnowledge[id] ||= { disclosure: {} };
      }
    },
    stageSevenSourceExists(chatId, eventId) {
      return !!chats.find(chat => chat.id === chatId)?.messages.some(message => String(message.id) === String(eventId));
    },
    stageSevenDisclosureKnown() { return false; },
    stageSevenDebug() {},
    $() { return { classList: { contains: () => true } }; },
    stageSixCancel() {},
    getGameEvent(id) { return events.get(id); },
    stageSevenQueueMessage() { return { id: 'test-event' }; },
    ensurePersistentTopicState() { return topics; },
    saveGameEventStore() { save.eventStoreSaves = (save.eventStoreSaves || 0) + 1; return true; },
    topicStateIsFinal(topic) { return ['completed', 'phone-disclosed'].includes(topic?.status); },
    hasValidInitialCheckinReply() { return !!story.selectedBranch && ['reply-home', 'reply-outside', 'reply-why'].includes(story.selectedBranch); },
    kakaoDialogueStyleFor() { return {}; },
    kakaoMessageTimestamp(message) { return Number(message?.storyTimestamp ?? message?.timestamp) || 0; },
    recordCharacterPhoneKnowledge() {},
    recordLostPhoneTruthFromText() {},
    renderAfterWorkPanel() {}, renderChatMessages() {}, renderKakaoChats() {},
    phoneUnlocked: true,
    stageElevenComposerBusy: false,
    stageFiveChatMessageEvent(...args) { scheduledMessages.push(args); return { id: args[0] }; }
  };
  sandbox.STAGE_ELEVEN_ID = 'stage-eleven-test';
  sandbox.gameEventHandlers = new Map([['kkt-message', () => null]]);
  sandbox.stageSevenQueue = (id, kind, scheduledAt, payload = {}) => {
    const event = { id, type: 'stage-seven-world-event', kind, scheduledAt, payload: { kind, ...payload } };
    events.set(event.id, event);
    return event;
  };
  sandbox.stageSevenQueueMessage = (id, chatId, from, text, translation, delay, options) => {
    const message = { id, chatId, from, text, translation, delay, options, storyTimestamp: 1792800000000 };
    chats.find(chat => chat.id === chatId)?.messages.push(message);
    return message;
  };
  sandbox.stageElevenActionState = chatId => {
    const active = story.stageEleven.activeMessaging;
    active.usedByChat ||= {};
    active.usedByChat[chatId] ||= {};
    return active.usedByChat[chatId];
  };
  sandbox.stageElevenCommitActiveMessage = item => {
    const chatId = sandbox.activeChat.id;
    const used = sandbox.stageElevenActionState(chatId);
    if (used[item.id] || !item.topicId) return false;
    const eventId = `stage-eleven-test:active:${chatId}:${item.id}:player`;
    used[item.id] = { status: 'sent', eventId, selectedAt: Date.now(), effect: item.effect };
    state.activeMessaging.sentIds ||= [];
    state.activeMessaging.sentIds.push(`${chatId}:${item.id}`);
    const queued = sandbox.stageSevenQueue(`${eventId}:reply`, 'active-message-reply', Date.now(), {
      chatId, text: item.reply, translation: item.replyTranslation, from: item.replyFrom || chatId
    });
    return !!queued;
  };
  sandbox.stageElevenActiveWorldEvent = () => null;
  sandbox.STAGE_SEVEN_COPY['group-meal'] = {
    chatId: 'group', sourceEventId: sourceIds['group-meal'], options: []
  };
  vm.createContext(sandbox);
  // Real game localStorage must never be consulted by this test harness.
  vm.runInContext(`
    const localStorage = { getItem(){ throw new Error('real localStorage access attempted'); }, setItem(){ throw new Error('real localStorage access attempted'); } };
    const activeChat = globalThis.activeChat;
    const CONFIG = globalThis.CONFIG;
    const lostPhoneStory = globalThis.lostPhoneStory;
    const LOST_PHONE_STORY_ID = globalThis.LOST_PHONE_STORY_ID;
  `, sandbox);
  const source = [playerIdentityPolicy, stageSevenData, stageSevenOptionGroup, stageSevenVisibleGroups, stageSevenOrdinaryReplies, stageSevenScheduledPrompts, stageElevenCatalog, stageElevenFilters, stageTwelveFlowData, stageTwelveStateAndBasePredicates, stageTwelveBuilder, stageTwelveOptionWrapper, stageFifteenFilter, stageTwelveQueueWrapper,
    `const stageElevenCommitBeforeTwelve=stageElevenCommitActiveMessage;`,
    productionCommitLine,
    `const stageElevenActiveWorldBeforeTwelve=stageElevenActiveWorldEvent;`, productionActiveWorldLine,
    `const stageElevenKakaoHandlerBeforeTwelve=gameEventHandlers.get('kkt-message');`, productionKakaoHandlerLine,
    `ensureStageTwelveState();`
  ].join('\n');
  vm.runInContext(`${source}\nglobalThis.__optionTest = { STAGE_SEVEN_COPY, stageElevenActiveCatalog, STAGE_TWELVE_FLOWS, stageTwelveConversationOptions, stageTwelveChoiceIsValid, stageFifteenConfessionIsUnlocked, stageSevenOrdinaryReply, stageSevenRefreshPendingPrompt, scheduleStageSevenEvents };`, sandbox, { filename: 'index.html:KakaoTalk-option-validity' });
  return { sandbox, story, state: story.stageEleven, chats, events, sourceIds, topics, scheduledMessages, save };
}

function optionIds(harness, chatId) {
  harness.sandbox.activeChat.id = chatId;
  return Array.from(harness.sandbox.stageElevenActiveOptions(chatId), item => item.id);
}

test('production data covers all seven KakaoTalk rooms with stable, translated option definitions', () => {
  const { sandbox } = createHarness();
  const catalog = sandbox.__optionTest.stageElevenActiveCatalog;
  const flows = sandbox.__optionTest.STAGE_TWELVE_FLOWS;
  const expected = ['shownu', 'kihyun', 'minhyuk', 'jooheon', 'changkyun', 'manager', 'group'];
  assert.deepEqual(Object.keys(catalog).sort(), expected.slice().sort());
  assert.deepEqual(Object.keys(flows).sort(), expected.slice().sort());
  for (const chatId of expected) {
    assert.ok(catalog[chatId].length > 0, `${chatId}: missing Stage Eleven choices`);
    assert.ok(Object.keys(flows[chatId]).length > 0, `${chatId}: missing Stage Twelve flows`);
    for (const item of catalog[chatId]) {
      assert.ok(item.id && item.text && item.translation, `${chatId}: malformed option ${item.id}`);
      assert.notEqual(item.text, item.translation, `${chatId}/${item.id}: translation duplicates Korean source`);
    }
  }
  for (const [chatId, topics] of Object.entries(flows)) {
    for (const [topicId, flow] of Object.entries(topics)) {
      for (const [stage, choices] of Object.entries(flow.stages)) {
        for (const choice of choices) {
          assert.ok(choice.id && choice.text && choice.translation, `${chatId}/${topicId}/${stage}: malformed flow choice`);
          assert.notEqual(choice.text, choice.translation);
        }
      }
    }
  }
});

test('Stage Seven story-reply groups cover all seven rooms with stable, translated choices and delivered-source gates', () => {
  const h = createHarness();
  const definitions = h.sandbox.__optionTest.STAGE_SEVEN_COPY;
  const rooms = new Set(Object.values(definitions).map(definition => definition.chatId));
  assert.deepEqual(Array.from(rooms).sort(), ['kihyun', 'minhyuk', 'jooheon', 'changkyun', 'manager', 'group'].sort());
  assert.ok(h.sandbox.__optionTest.stageElevenActiveCatalog.shownu.some(item => item.id === 'reply-home'));
  for (const [groupId, definition] of Object.entries(definitions)) {
    assert.ok(definition.sourceEventId, `${groupId}: missing source event ID`);
    assert.ok(definition.options.length, `${groupId}: missing reply options`);
    assert.equal(new Set(definition.options.map(option => option[0])).size, definition.options.length, `${groupId}: duplicate option ID`);
    for (const option of definition.options) assert.ok(option[1] && option[2], `${groupId}/${option[0]}: missing Korean or Traditional Chinese content`);
  }
  for (const chatId of ['shownu', 'kihyun', 'minhyuk', 'jooheon', 'changkyun', 'manager', 'group']) {
    h.sandbox.activeChat.id = chatId;
    const group = h.sandbox.stageSevenGroupForChat(chatId);
    if (chatId === 'shownu') assert.equal(group, null);
    else assert.ok(group?.options?.length, `${chatId}: delivered story reply group not available`);
  }
});

test('selected story replies disappear; phone disclosure knowledge stays character-specific', () => {
  const h = createHarness();
  h.sandbox.activeChat.id = 'kihyun';
  const group = h.sandbox.stageSevenGroupForChat('kihyun');
  assert.ok(group?.options?.length);
  group.group.selectedOptionId = 'seen';
  group.group.status = 'completed';
  const next = h.sandbox.stageSevenGroupForChat('kihyun');
  assert.ok(next?.group?.id);
  assert.notEqual(next.group.id, group.group.id);
  h.story.characterKnowledge.kihyun = { disclosure: { knowsCurrentUserNotHyungwon: true } };
  h.sandbox.activeChat.id = 'minhyuk';
  assert.ok(h.sandbox.stageSevenGroupForChat('minhyuk')?.options?.length);
});

test('answered arrival facts invalidate the mutually exclusive answer and stay invalid after state restore', () => {
  const h = createHarness({ selectedBranch: 'reply-home' });
  const conversation = h.sandbox.ensureStageTwelveState().conversations.shownu;
  const ids = optionIds(h, 'shownu');
  assert.equal(ids.includes('reply-home'), false);
  assert.equal(ids.includes('reply-outside'), false);
  assert.equal(conversation.facts.arrivalStatus.playerValue, 'home');
  const restored = createHarness({ stageEleven: structuredClone(h.story.stageEleven), selectedBranch: 'reply-home' });
  const restoredIds = optionIds(restored, 'shownu');
  assert.equal(restoredIds.includes('reply-outside'), false);
});

test('a pending recipient reply suppresses conflicting same-room options until delivery', () => {
  const h = createHarness();
  const conversation = h.sandbox.ensureStageTwelveState().conversations.shownu;
  conversation.status = 'active';
  conversation.activeTopicId = 'daily';
  conversation.stage = 'start';
  conversation.pendingReply = 'shownu:reply-pending';
  assert.deepEqual(optionIds(h, 'shownu'), []);
});

test('completed topic does not restart its initial answer, while ordinary choices remain available', () => {
  const h = createHarness();
  const conversation = h.sandbox.ensureStageTwelveState().conversations.shownu;
  conversation.status = 'completed';
  conversation.pausedTopics.daily = { status: 'completed', completedAt: 123 };
  const ids = optionIds(h, 'shownu');
  assert.equal(ids.includes('conversation:shownu:daily:start:daily-checkin'), false);
  assert.ok(ids.some(id => id.startsWith('conversation:shownu:')) || ids.includes('shownu-home-checkin-goodnight') || ids.includes('shownu-home-checkin-thanks'));
});

test('normal daily options survive filtering in all six personal rooms', () => {
  const h = createHarness();
  for (const chatId of ['shownu', 'kihyun', 'minhyuk', 'jooheon', 'changkyun', 'manager']) {
    const ids = optionIds(h, chatId);
    assert.ok(ids.length > 0, `${chatId} was over-filtered`);
    assert.equal(ids.some(id => id.includes('confess')), false, `${chatId} unexpectedly exposes confession`);
  }
});

test('confession topic requires its explicit active milestone; generic check-ins do not unlock it', () => {
  const h = createHarness();
  const conversation = h.sandbox.ensureStageTwelveState().conversations.shownu;
  conversation.status = 'active';
  conversation.activeTopicId = 'daily';
  conversation.stage = 'start';
  assert.equal(h.sandbox.__optionTest.stageFifteenConfessionIsUnlocked(h.state, conversation), false);
  conversation.status = 'active';
  conversation.activeTopicId = 'confession';
  conversation.turns = [{ optionId: 'conversation:shownu:confession:start:confession-direct' }];
  assert.equal(h.sandbox.__optionTest.stageFifteenConfessionIsUnlocked(h.state, conversation), true);
  conversation.activeTopicId = 'daily';
  h.state.romance = { confessionMilestoneUnlocked: true, confessionMilestoneUnlockedAt: 10, confessionMilestoneEventId: 'explicit-milestone' };
  assert.equal(h.sandbox.__optionTest.stageFifteenConfessionIsUnlocked(h.state, conversation), true);
});

test('same option use is isolated by chat and stable option IDs are filtered', () => {
  const h = createHarness();
  h.sandbox.ensureStageTwelveState();
  const usedId = 'conversation:shownu:daily:start:daily-checkin';
  h.state.activeMessaging.usedByChat = { shownu: { [usedId]: { status: 'sent' } } };
  assert.equal(optionIds(h, 'shownu').includes(usedId), false);
  assert.ok(optionIds(h, 'kihyun').some(id => id.includes('kihyun')));
});

test('legacy saves missing Stage Seven/Twelve subfields recover without losing valid choices', () => {
  const h = createHarness({ stageEleven: { activeMessaging: { usedByChat: { shownu: {} } } }, stageSeven: {} });
  assert.doesNotThrow(() => h.sandbox.ensureStageTwelveState());
  assert.ok(h.sandbox.ensureStageTwelveState().conversations.shownu);
  assert.ok(optionIds(h, 'shownu').length > 0);
});

test('malformed/missing one event reference is isolated and does not block other rooms', () => {
  const h = createHarness();
  h.chats.find(chat => chat.id === 'kihyun').messages = [];
  h.story.stageSeven.groups['kihyun-work'] = { id: 'kihyun-work', chatId: 'kihyun', sourceEventId: h.sourceIds['kihyun-work'], status: 'pending' };
  assert.doesNotThrow(() => optionIds(h, 'kihyun'));
  assert.ok(optionIds(h, 'shownu').length > 0);
  assert.ok(optionIds(h, 'manager').length > 0);
});

test('meal state is event-scoped and asking about the menu does not mean attending', () => {
  const h = createHarness();
  const context = h.sandbox.stageFourteenGroupMealContext();
  assert.equal(context.eventId, 'lost-phone-shownu-checkin-v1:world:group-meal');
  const decision = h.sandbox.stageFourteenRecordGroupMealChoice(context.eventId, { id: 'dinner-menu' }, { source: 'test' });
  assert.equal(decision, true);
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId).status, 'asking');
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision('another-meal-event').status, 'undecided');
  assert.equal(h.story.stageSeven.groupMealDecisions[context.eventId].status, 'asking');
});

test('mutually exclusive dinner decisions are filtered, and viewing history alone is not a decision', () => {
  const h = createHarness();
  const context = h.sandbox.stageFourteenGroupMealContext();
  let ids = optionIds(h, 'group');
  assert.ok(ids.includes('conversation:group:dinner:start:dinner-join'));
  // Reading static history is not connected to this state and leaves the decision undecided.
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId).status, 'undecided');
  h.sandbox.stageFourteenRecordGroupMealChoice(context.eventId, { id: 'dinner-join' }, { source: 'test' });
  ids = optionIds(h, 'group');
  assert.equal(ids.includes('conversation:group:dinner:start:dinner-join'), false);
  assert.equal(ids.includes('conversation:group:dinner:start:dinner-pass'), false);
});

test('asking about dinner does not imply attendance, and pass then join requires the explicit change wording', () => {
  const h = createHarness();
  const context = h.sandbox.stageFourteenGroupMealContext();
  h.sandbox.stageFourteenRecordGroupMealChoice(context.eventId, { id: 'dinner-menu' }, { source: 'test' });
  let ids = optionIds(h, 'group');
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId).status, 'asking');
  assert.ok(ids.includes('conversation:group:dinner:start:dinner-join'));
  h.sandbox.stageFourteenRecordGroupMealChoice(context.eventId, { id: 'dinner-pass' }, { source: 'test' });
  ids = optionIds(h, 'group');
  assert.equal(ids.includes('conversation:group:dinner:start:dinner-join'), false);
  assert.ok(ids.includes('conversation:group:dinner:start:dinner-change-join'));
});

test('event-source absence is safe and the seven-room data/branch coverage stays intact', () => {
  const h = createHarness();
  assert.doesNotThrow(() => h.sandbox.stageFourteenGroupMealContext());
  h.chats.find(chat => chat.id === 'group').messages = [];
  assert.equal(h.sandbox.stageFourteenGroupMealContext(), null);
  assert.ok(optionIds(h, 'shownu').length > 0);
});

test('all inline JavaScript blocks in index.html pass syntax parsing', () => {
  const scripts = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));
  const executable = scripts.filter(([, attrs]) => !/\bsrc\s*=/.test(attrs) && !/application\/json|application\/ld\+json/i.test(attrs));
  assert.ok(executable.length > 0, 'no inline JavaScript blocks found');
  for (let i = 0; i < executable.length; i++) {
    assert.doesNotThrow(() => new vm.Script(executable[i][2], { filename: `index.html:inline-script-${i + 1}` }));
  }
});

test('source script and extracted production predicates parse without executing app boot', () => {
  assert.doesNotThrow(() => new vm.Script([stageSevenData, stageSevenOptionGroup, stageSevenVisibleGroups, stageElevenCatalog, stageElevenFilters, stageTwelveFlowData, stageTwelveStateAndBasePredicates, stageTwelveBuilder, stageTwelveOptionWrapper, stageFifteenFilter].join('\n')));
});

function beginProductionTurn(harness, chatId, topicId, choiceId) {
  const { sandbox, state } = harness;
  sandbox.activeChat.id = chatId;
  const conversation = sandbox.ensureStageTwelveState().conversations[chatId];
  const options = sandbox.__optionTest.stageTwelveConversationOptions(chatId);
  const option = options.find(item => item.topicId === topicId && item.id.endsWith(`:${choiceId}`));
  assert.ok(option, `${chatId}/${topicId}/${choiceId} should be available`);
  assert.equal(sandbox.stageElevenCommitActiveMessage(option), true, 'production commit wrapper accepts the current option');
  assert.ok(conversation.pendingReply, 'choice waits for recipient reply');
  assert.equal(sandbox.__optionTest.stageTwelveConversationOptions(chatId).length, 0, 'pending reply hides conflicting choices');
  const event = harness.events.get(conversation.pendingReply);
  assert.ok(event, 'reply event is queued');
  sandbox.stageElevenActiveWorldEvent(event);
  const used = sandbox.stageElevenActionState(chatId)[option.id];
  assert.ok(used.conversationReplyMessageId, 'reply message is queued once');
  const message = sandbox.CONFIG.chats.find(chat => chat.id === chatId).messages.find(item => item.id === used.conversationReplyMessageId);
  assert.ok(message, 'role reply exists in the isolated chat');
  sandbox.gameEventHandlers.get('kkt-message')({ payload: { chatId, message } });
  return { conversation, option, used, message, state };
}

for (const scenario of [
  { chat: 'shownu', topic: 'wind-down', start: 'wind-down-rest', response: 'meal-check', next: 'wind-down-ate', replyKorean: '다행이네. 너도 오늘은 일찍 쉬어.' },
  { chat: 'kihyun', topic: 'meal-check', start: 'practice-meal-ask', response: 'meal-answer', next: 'practice-meal-yes', replyKorean: '응, 간단히 먹었어. 너는 아직이면 뭐라도 챙겨.' },
  { chat: 'minhyuk', topic: 'daily', start: 'food', response: 'food-follow', next: 'food-share', replyKorean: '아직 대충 먹었지 ㅋㅋ 너는?' }
]) {
  test(`${scenario.chat}/${scenario.topic}: initial choices are stable and translated`, () => {
    const h = createHarness();
    h.sandbox.activeChat.id = scenario.chat;
    const items = h.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat).filter(item => item.topicId === scenario.topic && item.topicStage === 'start');
    assert.ok(items.length >= 1);
    assert.ok(items.every(item => item.id.startsWith(`conversation:${scenario.chat}:${scenario.topic}:start:`) && item.text && item.translation && item.reply && item.replyTranslation));
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
  });

  test(`${scenario.chat}/${scenario.topic}: production send, role reply, and next turn remain coherent`, () => {
    const h = createHarness();
    const first = beginProductionTurn(h, scenario.chat, scenario.topic, scenario.start);
    assert.equal(first.message.text, first.option.reply);
    assert.equal(first.message.translation, first.option.replyTranslation);
    assert.equal(first.conversation.pendingReply, null);
    assert.equal(first.conversation.stage, scenario.response);
    h.sandbox.activeChat.id = scenario.chat;
    const nextOptions = h.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat);
    assert.ok(nextOptions.some(item => item.topicStage === scenario.response && item.id.endsWith(`:${scenario.next}`)));
    assert.equal(h.sandbox.stageElevenActionState(scenario.chat)[first.option.id].replyDelivered, true);
  });

  test(`${scenario.chat}/${scenario.topic}: used choices cannot resend, pending replies gate the room, and restore preserves stage`, () => {
    const h = createHarness();
    const first = beginProductionTurn(h, scenario.chat, scenario.topic, scenario.start);
    const sentBefore = h.chats.find(chat => chat.id === scenario.chat).messages.filter(message => message.from === '형원').length;
    assert.equal(h.sandbox.stageElevenCommitActiveMessage(first.option), false);
    assert.equal(h.chats.find(chat => chat.id === scenario.chat).messages.filter(message => message.from === '형원').length, sentBefore);
    const restored = createHarness({ stageEleven: structuredClone(h.story.stageEleven), selectedBranch: h.story.selectedBranch });
    restored.sandbox.activeChat.id = scenario.chat;
    const restoredConversation = restored.sandbox.ensureStageTwelveState().conversations[scenario.chat];
    assert.equal(restoredConversation.stage, scenario.response);
    assert.equal(restoredConversation.pendingReply, null);
    assert.equal(restored.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat).some(item => item.id === first.option.id), false);
  });
}

test('Minhyuk food recommendation has a genuine third turn with distinct response choices', () => {
  const h = createHarness();
  beginProductionTurn(h, 'minhyuk', 'daily', 'food');
  beginProductionTurn(h, 'minhyuk', 'daily', 'food-share');
  const conversation = h.sandbox.ensureStageTwelveState().conversations.minhyuk;
  conversation.status = 'active'; conversation.activeTopicId = 'daily'; conversation.stage = 'food-pick';
  const picks = h.sandbox.__optionTest.stageTwelveConversationOptions('minhyuk').filter(item => item.topicStage === 'food-pick');
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map(item => item.reply)).size, 3);
  const chosen = beginProductionTurn(h, 'minhyuk', 'daily', 'food-pick-joke');
  assert.match(chosen.message.text, /맛없으면 다음에 내가 책임질게/);
  assert.equal(conversation.stage, 'food-after');
  const ending = h.sandbox.__optionTest.stageTwelveConversationOptions('minhyuk').filter(item => item.topicStage === 'food-after');
  assert.equal(ending.length, 3);
  assert.equal(new Set(ending.map(item => item.reply)).size, 3);
});

test('Shownu and Kihyun alternate branches keep their own context through close', () => {
  const shownu = createHarness();
  beginProductionTurn(shownu, 'shownu', 'wind-down', 'wind-down-care');
  const dinner = beginProductionTurn(shownu, 'shownu', 'wind-down', 'wind-down-not-yet');
  assert.equal(shownu.state.activeMessaging.conversations.shownu.facts.dinnerEaten.playerValue, false);
  assert.match(dinner.message.text, /빈속으로 자지 말고/);
  const close = shownu.sandbox.__optionTest.stageTwelveConversationOptions('shownu').filter(item => item.topicStage === 'rest-food');
  assert.equal(close.length, 2);
  beginProductionTurn(shownu, 'shownu', 'wind-down', 'wind-down-food-ok');
  assert.equal(shownu.state.activeMessaging.conversations.shownu.status, 'completed');

  const kihyun = createHarness();
  beginProductionTurn(kihyun, 'kihyun', 'meal-check', 'practice-menu-ask');
  const menuReply = beginProductionTurn(kihyun, 'kihyun', 'meal-check', 'practice-menu-light');
  assert.match(menuReply.message.text, /먹고 푹 쉬어/);
  assert.equal(kihyun.state.activeMessaging.conversations.kihyun.stage, 'menu-close');
  beginProductionTurn(kihyun, 'kihyun', 'meal-check', 'practice-menu-end');
  assert.equal(kihyun.state.activeMessaging.conversations.kihyun.status, 'completed');
});

test('new topics stay isolated by recipient and topic; an active turn in one room does not block another', () => {
  const h = createHarness();
  beginProductionTurn(h, 'shownu', 'wind-down', 'wind-down-rest');
  h.sandbox.activeChat.id = 'kihyun';
  assert.ok(h.sandbox.__optionTest.stageTwelveConversationOptions('kihyun').some(item => item.topicId === 'meal-check'));
  const shownuItems = h.sandbox.__optionTest.stageTwelveConversationOptions('shownu');
  assert.ok(shownuItems.some(item => item.topicId === 'wind-down' && item.topicStage === 'meal-check'));
  assert.equal(shownuItems.some(item => ['meal-check', 'daily'].includes(item.topicId) && item.topicId !== 'wind-down' && item.text.includes('練習')), false);
  assert.ok(h.sandbox.__optionTest.STAGE_TWELVE_FLOWS.shownu.daily);
  assert.ok(h.sandbox.__optionTest.STAGE_TWELVE_FLOWS.kihyun.work);
  assert.ok(h.sandbox.__optionTest.STAGE_TWELVE_FLOWS.minhyuk.daily);
});

const secondBatchScenarios = [
  { chat: 'jooheon', topic: 'music-process', start: 'music-process-record', response: 'capture-method', next: 'capture-phone', replyKorean: '응, 허밍이라도 남겨 둬. 나중엔 기억이 안 나더라. 형은 보통 어떻게 해?' },
  { chat: 'changkyun', topic: 'listening-habit', start: 'listening-order', response: 'album-order-answer', next: 'album-order-yes', replyKorean: '응. 순서대로 들으면 앨범 흐름이 잘 느껴져. 형은?' },
  { chat: 'manager', topic: 'schedule-handoff', start: 'handoff-channel', response: 'handoff-follow', next: 'handoff-ack', replyKorean: '네. 변경되는 내용이 있으면 단체방에도 공유하겠습니다.' },
  { chat: 'group', topic: 'break-chat', start: 'break-chat-music', response: 'break-music-follow', next: 'break-music-ask-changkyun', replyKorean: '난 쉴 때는 작업할 때 듣던 거랑 다른 분위기를 찾게 돼 ㅋㅋ' }
];

for (const scenario of secondBatchScenarios) {
  test(`${scenario.chat}/${scenario.topic}: initial choices are stable, translated, and separate from other topics`, () => {
    const h = createHarness();
    h.sandbox.activeChat.id = scenario.chat;
    const items = h.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat)
      .filter(item => item.topicId === scenario.topic && item.topicStage === 'start');
    assert.ok(items.length >= 1);
    assert.ok(items.some(item => item.id.endsWith(`:${scenario.start}`)));
    assert.ok(items.every(item => item.id.startsWith(`conversation:${scenario.chat}:${scenario.topic}:start:`) && item.text && item.translation && item.reply && item.replyTranslation));
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    if (scenario.chat === 'group') {
      assert.ok(items.every(item => !item.mealChoiceId));
      assert.ok(items.some(item => item.topicId === 'break-chat'));
    }
  });

  test(`${scenario.chat}/${scenario.topic}: production reply is delivered and the next round matches the topic`, () => {
    const h = createHarness();
    const first = beginProductionTurn(h, scenario.chat, scenario.topic, scenario.start);
    assert.equal(first.conversation.pendingReply, null);
    assert.equal(first.conversation.stage, scenario.response);
    assert.ok(first.message.text.includes(scenario.replyKorean));
    assert.ok(first.message.translation);
    assert.ok(first.used.replyDelivered);
    const next = h.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat)
      .filter(item => item.topicId === scenario.topic && item.topicStage === scenario.response);
    assert.ok(next.some(item => item.id.endsWith(`:${scenario.next}`)));
    assert.ok(next.every(item => item.text && item.translation && item.reply && item.replyTranslation));
    if (scenario.chat === 'group') {
      const turns = h.chats.find(chat => chat.id === 'group').messages.filter(message => String(message.id).startsWith(`${first.used.eventId}:reply:message`));
      assert.deepEqual(turns.map(message => message.from), ['창균', '주헌']);
      assert.ok(turns[0].delay <= turns[1].delay);
    }
  });

  test(`${scenario.chat}/${scenario.topic}: used option, pending gate, and restored progress are preserved`, () => {
    const h = createHarness();
    h.sandbox.activeChat.id = scenario.chat;
    const option = h.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat)
      .find(item => item.topicId === scenario.topic && item.id.endsWith(`:${scenario.start}`));
    assert.ok(option);
    assert.equal(h.sandbox.stageElevenCommitActiveMessage(option), true);
    assert.equal(h.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat).length, 0);
    const event = h.events.get(h.sandbox.ensureStageTwelveState().conversations[scenario.chat].pendingReply);
    assert.ok(event);
    h.sandbox.stageElevenActiveWorldEvent(event);
    const restored = createHarness({ stageEleven: structuredClone(h.story.stageEleven), selectedBranch: h.story.selectedBranch });
    restored.sandbox.activeChat.id = scenario.chat;
    const conversation = restored.sandbox.ensureStageTwelveState().conversations[scenario.chat];
    assert.equal(conversation.pendingReply, h.sandbox.ensureStageTwelveState().conversations[scenario.chat].pendingReply);
    assert.equal(restored.sandbox.__optionTest.stageTwelveConversationOptions(scenario.chat).length, 0);
    const sent = h.chats.find(chat => chat.id === scenario.chat).messages.filter(message => message.from === '형원').length;
    assert.equal(h.sandbox.stageElevenCommitActiveMessage(option), false);
    assert.equal(h.chats.find(chat => chat.id === scenario.chat).messages.filter(message => message.from === '형원').length, sent);
  });
}

test('group break conversation does not change the event-scoped dinner decision', () => {
  const h = createHarness();
  h.sandbox.activeChat.id = 'group';
  const context = h.sandbox.stageFourteenGroupMealContext();
  assert.ok(context);
  const decision = h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId);
  assert.equal(decision.status, 'undecided');
  beginProductionTurn(h, 'group', 'break-chat', 'break-chat-music');
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId).status, 'undecided');
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId).menuAsked, undefined);
  assert.equal(h.story.stageSeven.groupMealDecisions[context.eventId].status, 'undecided');
});

test('Jooheon music-process alternate branch responds to the player and closes without replay', () => {
  const h = createHarness();
  const first = beginProductionTurn(h, 'jooheon', 'music-process', 'music-process-break');
  assert.equal(first.conversation.stage, 'work-rhythm');
  assert.equal(first.message.text, '응, 잠깐 딴 거 하다가 다시 해. 계속 붙잡고 있으면 더 막히더라.');
  const follow = beginProductionTurn(h, 'jooheon', 'music-process', 'work-rhythm-joke');
  assert.match(follow.message.text, /알람 맞춰 둬/);
  assert.equal(follow.conversation.status, 'completed');
  assert.equal(h.sandbox.__optionTest.stageTwelveConversationOptions('jooheon').some(item => item.id.includes('music-process')), false);
});

test('Changkyun night-music branch offers contextual alternatives and remembers completion', () => {
  const h = createHarness();
  const first = beginProductionTurn(h, 'changkyun', 'listening-habit', 'listening-night');
  assert.equal(first.conversation.stage, 'night-listening-answer');
  assert.equal(first.message.text, '요즘은 편하게 들을 수 있는 걸 찾게 돼. 가사보다 분위기가 먼저 느껴지는 곡들.');
  const follow = beginProductionTurn(h, 'changkyun', 'listening-habit', 'night-listening-ask');
  assert.match(follow.message.text, /제목 적어 둘게/);
  assert.equal(follow.conversation.status, 'completed');
  assert.equal(h.sandbox.__optionTest.stageTwelveConversationOptions('changkyun').some(item => item.id.includes('listening-habit')), false);
});

test('manager work-handoff alternate response stays professional and finishes the topic', () => {
  const h = createHarness();
  beginProductionTurn(h, 'manager', 'schedule-handoff', 'handoff-channel');
  const follow = beginProductionTurn(h, 'manager', 'schedule-handoff', 'handoff-prepare');
  assert.match(follow.message.text, /변동 사항이 생기면 다시 안내드리겠습니다/);
  assert.equal(follow.conversation.status, 'completed');
  assert.ok(follow.message.translation);
});

test('group rest branch has staggered member replies and leaves dinner undecided', () => {
  const h = createHarness();
  const context = h.sandbox.stageFourteenGroupMealContext();
  const first = beginProductionTurn(h, 'group', 'break-chat', 'break-chat-rest');
  assert.equal(first.conversation.stage, 'break-rest-follow');
  const firstReplies = h.chats.find(chat => chat.id === 'group').messages
    .filter(message => String(message.id).startsWith(`${first.used.eventId}:reply:message`));
  assert.deepEqual(firstReplies.map(message => message.from), ['민혁', '셔누']);
  assert.ok(firstReplies[0].delay < firstReplies[1].delay);
  const follow = beginProductionTurn(h, 'group', 'break-chat', 'break-rest-joke');
  assert.match(follow.message.text, /의자가 나를 따라와야지/);
  assert.equal(follow.conversation.status, 'completed');
  assert.equal(h.sandbox.ensureStageFourteenGroupMealDecision(context.eventId).status, 'undecided');
});

test('every second-batch option and queued group reply has a unique ID and Traditional Chinese translation', () => {
  const h = createHarness();
  const flows = h.sandbox.__optionTest.STAGE_TWELVE_FLOWS;
  const targets = [
    ['jooheon', 'music-process'],
    ['changkyun', 'listening-habit'],
    ['manager', 'schedule-handoff'],
    ['group', 'break-chat']
  ];
  for (const [chatId, topicId] of targets) {
    const flow = flows[chatId]?.[topicId];
    assert.ok(flow, `${chatId}/${topicId} should exist`);
    const ids = [];
    for (const [stage, choices] of Object.entries(flow.stages)) {
      for (const choice of choices) {
        ids.push(choice.id);
        assert.ok(choice.text && choice.translation, `${chatId}/${topicId}/${stage}/${choice.id} needs message translation`);
        assert.ok(choice.reply && choice.replyTranslation, `${chatId}/${topicId}/${stage}/${choice.id} needs reply translation`);
        for (const message of choice.replyMessages || []) {
          assert.ok(message.from && message.text && message.translation, `${chatId}/${topicId}/${choice.id} has an incomplete group reply`);
        }
      }
    }
    assert.equal(new Set(ids).size, ids.length, `${chatId}/${topicId} option IDs must be unique`);
  }
});

function privateHistory(chatId) {
  const marker = `{ id: "${chatId}", title:`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `missing production chat data: ${chatId}`);
  const next = html.indexOf('\n    { id:', start + marker.length);
  const section = html.slice(start, next < 0 ? html.length : next);
  const row = /\{ day: "([^"]+)", from: "([^"]+)", time: "([^"]+)", text: "([^"]+)", translation: "([^"]+)" \}/g;
  return Array.from(section.matchAll(row), match => ({ day: match[1], from: match[2], time: match[3], text: match[4], translation: match[5] }));
}

test('Jooheon and Changkyun private history preserves familiar banmal and matching translations', () => {
  const jooheon = privateHistory('jooheon');
  const changkyun = privateHistory('changkyun');
  assert.deepEqual(jooheon.map(({ from, text, translation }) => [from, text, translation]), [
    ['주헌', '형, 저번에 추천해 준 노래 들어봤어!!', '哥，我聽了你之前推薦的歌！！'],
    ['형원', '어때 괜찮지 ㅋㅋ', '怎麼樣，不錯吧ㅋㅋ'],
    ['주헌', '완전 좋아. 플레이리스트에 넣었어 ㅠㅠ', '超喜歡，我加進播放清單了ㅠㅠ'],
    ['형원', 'ㅋㅋㅋ 그렇게까지 좋아?', 'ㅋㅋㅋ有那麼喜歡喔？'],
    ['주헌', '응, 진짜 좋은데!! 다음엔 다른 곡도 추천해 줘', '真的很好聽！！下次也推薦別首給我吧。']
  ]);
  assert.deepEqual(changkyun.map(({ from, text, translation }) => [from, text, translation]), [
    ['창균이', '형 지금 뭐 해?', '哥，現在在做什麼？'],
    ['형원', '그냥 쉬고 있어 왜', '在休息啊，怎麼了？'],
    ['창균이', '아, 별건 아니고 노래 하나 물어보려고 ㅋㅋ', '啊，沒什麼，只是想問一首歌ㅋㅋ'],
    ['형원', '뭔데 보내봐', '哪首？傳來看看。']
  ]);
});

test('Stage Seven scheduled Jooheon and Changkyun prompts use private-chat banmal with aligned Traditional Chinese', () => {
  const h = createHarness();
  h.story.worldEvents = { scheduledAt: 1792800000000 };
  h.sandbox.__optionTest.scheduleStageSevenEvents();
  const byId = new Map(h.scheduledMessages.map(([id, chatId, from, text, translation]) => [id, { chatId, from, text, translation }]));
  assert.deepEqual(byId.get('lost-phone-shownu-checkin-v1:stage-seven:jooheon-song'), {
    chatId: 'jooheon', from: '주헌', text: '형, 전에 추천해 준 곡 제목 뭐였지? 다시 알려 줘 ㅋㅋ', translation: '哥，你之前推薦的那首歌叫什麼來著？再告訴我一下ㅋㅋ'
  });
  assert.deepEqual(byId.get('lost-phone-shownu-checkin-v1:stage-seven:changkyun-video'), {
    chatId: 'changkyun', from: '창균', text: '형, 마지막 컷 한 번만 봐 줄래?', translation: '哥，可以幫我看一下最後一個鏡頭嗎？'
  });
  assert.equal(h.scheduledMessages.find(([id]) => id.endsWith(':jooheon-song'))[5], 1792800330000);
  assert.equal(h.scheduledMessages.find(([id]) => id.endsWith(':changkyun-video'))[5], 1792800390000);
});

test('only unsent pending Stage Seven prompts are refreshed in old saves; sent history and event IDs stay intact', () => {
  const h = createHarness();
  const pending = {
    id: 'legacy:queued-jooheon-prompt', status: 'pending', scheduledAt: 1792800330000,
    payload: { preview: 'old preview', message: { id: 'legacy:queued-jooheon-prompt', text: 'old text', translation: 'old translation' } }
  };
  assert.equal(h.sandbox.stageSevenRefreshPendingPrompt(pending, 'jooheon', '형, 전에 추천해 준 곡 제목 뭐였지? 다시 알려 줘 ㅋㅋ', '哥，你之前推薦的那首歌叫什麼來著？再告訴我一下ㅋㅋ'), true);
  assert.equal(pending.id, 'legacy:queued-jooheon-prompt');
  assert.equal(pending.scheduledAt, 1792800330000);
  assert.equal(pending.payload.message.text, '형, 전에 추천해 준 곡 제목 뭐였지? 다시 알려 줘 ㅋㅋ');
  assert.equal(pending.payload.message.translation, '哥，你之前推薦的那首歌叫什麼來著？再告訴我一下ㅋㅋ');
  assert.equal(h.save.eventStoreSaves, 1);
  const completed = structuredClone(pending);
  completed.status = 'completed';
  completed.payload.message.text = 'already sent';
  assert.equal(h.sandbox.stageSevenRefreshPendingPrompt(completed, 'jooheon', 'new text', '新文字'), false);
  assert.equal(completed.payload.message.text, 'already sent');
  h.chats.find(chat => chat.id === 'jooheon').messages.push({ id: 'legacy:queued-jooheon-prompt' });
  assert.equal(h.sandbox.stageSevenRefreshPendingPrompt(pending, 'jooheon', 'new text', '新文字'), false, 'existing delivered source prevents migration');
});

test('Stage Seven replies and Stage Eleven active messages keep the two members conversational in context', () => {
  const h = createHarness();
  const replies = h.sandbox.__optionTest.stageSevenOrdinaryReply;
  assert.deepEqual(JSON.parse(JSON.stringify(replies('jooheon', 'send-song'))), { from: '주헌', text: '고마워! 찾으면 보내 줘.', translation: '謝謝！找到後再傳給我。' });
  assert.deepEqual(JSON.parse(JSON.stringify(replies('jooheon', 'later-song'))), { from: '주헌', text: '응, 형 편할 때 보내 줘!', translation: '好，方便時再傳給我！' });
  assert.deepEqual(JSON.parse(JSON.stringify(replies('changkyun', 'checked-cut'))), { from: '창균', text: '오케이. 그럼 그 버전으로 정리할게.', translation: '好，那我就照那個版本整理。' });
  assert.deepEqual(JSON.parse(JSON.stringify(replies('changkyun', 'later-cut'))), { from: '창균', text: '응. 시간 될 때 확인해 줘.', translation: '好，有空時再麻煩你確認。' });
  for (const [chatId, expected] of Object.entries({
    jooheon: ['오늘 녹음 괜찮았어?', '응! 생각보다 잘 끝났어 ㅎㅎ', '전에 말한 곡 제목 찾아봤어. 이따 보내줄게.'],
    changkyun: ['요즘 듣는 앨범 있어?', '요즘 예전 앨범 다시 듣고 있어. 생각보다 새롭더라.', '마지막 컷 확인했어. 이 버전 괜찮아.']
  })) {
    const items = h.sandbox.__optionTest.stageElevenActiveCatalog[chatId];
    for (const phrase of expected) assert.ok(items.some(item => item.text === phrase || item.reply === phrase), `${chatId}: missing contextual line ${phrase}`);
    assert.ok(items.every(item => item.translation && item.translation !== item.text));
  }
});

test('Stage Twelve Jooheon and Changkyun multi-turn dialogue uses casual phrasing and faithful translations', () => {
  const flows = createHarness().sandbox.__optionTest.STAGE_TWELVE_FLOWS;
  const jooheon = flows.jooheon['music-process'].stages;
  const changkyun = flows.changkyun['listening-habit'].stages;
  assert.equal(jooheon.start.find(item => item.id === 'music-process-break').text, '작업이 잘 안 풀릴 때 잠깐 쉬어?');
  assert.equal(jooheon.start.find(item => item.id === 'music-process-break').reply, '응, 잠깐 딴 거 하다가 다시 해. 계속 붙잡고 있으면 더 막히더라.');
  assert.equal(jooheon.start.find(item => item.id === 'music-process-break').replyTranslation, '會啊，先做點別的再回來。一直卡著反而更容易想不出來。');
  assert.equal(jooheon['capture-method'].find(item => item.id === 'capture-ask').reply, '한 번 듣고, 좀 있다가 다시 들어봐.');
  assert.equal(changkyun.start.find(item => item.id === 'listening-order').reply, '응. 순서대로 들으면 앨범 흐름이 잘 느껴져. 형은?');
  assert.equal(changkyun.start.find(item => item.id === 'listening-order').replyTranslation, '嗯。照順序聽比較能感覺到整張專輯的脈絡。哥呢？');
  assert.equal(changkyun.start.find(item => item.id === 'listening-night').reply, '요즘은 편하게 들을 수 있는 걸 찾게 돼. 가사보다 분위기가 먼저 느껴지는 곡들.');
  assert.equal(changkyun['night-listening-answer'].find(item => item.id === 'night-listening-quiet').reply, '응. 집중해서 듣기보단 그냥 편하게 틀어 놓기 좋은 곡들.');
  for (const stages of [jooheon, changkyun]) {
    for (const choices of Object.values(stages)) for (const item of choices) {
      assert.ok(item.text && item.translation && item.reply && item.replyTranslation, `${item.id} needs Korean and Traditional Chinese`);
      assert.notEqual(item.text, item.translation, `${item.id}: player translation must not duplicate Korean`);
      assert.notEqual(item.reply, item.replyTranslation, `${item.id}: character translation must not duplicate Korean`);
    }
  }
});
