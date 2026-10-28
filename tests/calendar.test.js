const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function productionFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  for (let end = html.indexOf('}', start); end >= 0; end = html.indexOf('}', end + 1)) {
    const source = html.slice(start, end + 1);
    try { new vm.Script('(' + source + ')'); return source; } catch {}
  }
  throw new Error(`Unable to parse ${name}`);
}

function harness(saved = null) {
  const configSource = html.match(/const CONFIG = (\{[\s\S]*?\n\});\s*<\/script>/)[1];
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'', textContent:'', scrollTop:0, listeners:{}, addEventListener(type,fn){this.listeners[type]=fn;}});
    return nodes.get(selector);
  };
  let home = null;
  const noWrites = {setItem(){throw new Error('Calendar must not write storage');},removeItem(){throw new Error('Calendar must not reset storage');}};
  class StoryOnlyDate extends Date {
    constructor(...args) { if (!args.length) throw new Error('Calendar must not use real date'); super(...args); }
    static now() { throw new Error('Calendar must not use real time'); }
  }
  const c = vm.createContext({$, Date, localStorage:noWrites, sessionStorage:noWrites,
    escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    showScreen:id=>{home=id;}, lostPhoneStory:saved, KAKAO_LEGACY_STORY_YEAR:2026,
    KAKAO_WEEKDAY_NAMES:['일요일','월요일','화요일','수요일','목요일','금요일','토요일']});
  vm.runInContext('const CONFIG=' + configSource + ';globalThis.config=CONFIG;', c);
  for (const fn of ['kakaoDeliverySequence','kakaoSortDeliveredMessages','kakaoMessageDate','kakaoMessageDateKey','kakaoMessageTimestamp','formatKakaoMessageDate','ensureStableKakaoHistoryIds','ensureStageTenTourHistory']) vm.runInContext(productionFunction(fn),c);
  vm.runInContext('ensureStableKakaoHistoryIds();ensureStageTenTourHistory();',c);
  const stage14Start=html.indexOf('const STAGE14_MEAL_EVENT_ID=');
  assert.ok(stage14Start>=0);
  vm.runInContext(html.slice(stage14Start,html.indexOf('function ensureStage14MealHistory()',stage14Start))+productionFunction('ensureStage14MealHistory')+';ensureStage14MealHistory();',c);
  c.Date=StoryOnlyDate;
  const start=html.indexOf('const CALENDAR_CATEGORIES=');
  vm.runInContext(html.slice(start,html.indexOf('const notesViewState=',start))+'\nglobalThis.api={calendarDaysInMonth,calendarDateParts,calendarMonthCells,calendarEvents,calendarStoryToday,calendarSelectDate,calendarShiftMonth,calendarOpenEvent,calendarReturn,renderCalendar,state:calendarViewState};',c);
  return {api:c.api,config:c.config,$,context:c,home:()=>home};
}

function fixtureDecision(status='attending') {
  const sourceId='current-meal-source:1';
  const state={stageSeven:{groupMealDecisions:{'current-meal-source':{eventId:'current-meal-source',sourceEventId:sourceId,status}}}};
  return {state,sourceId};
}
function addCurrentSource(h) {
  h.config.chats.find(chat=>chat.id==='group').messages.push({id:'current-meal-source:1',day:'10월 25일 일요일',time:'18:30',from:'민혁',text:'오늘 저녁 먹을 사람?',translation:'今晚有人要一起吃飯嗎？'});
}

test('Calendar calculates month lengths, leap years and first weekday correctly',()=>{
  const {api}=harness();
  assert.equal(api.calendarDaysInMonth(2028,2),29);
  assert.equal(api.calendarDaysInMonth(2026,2),28);
  assert.equal(api.calendarDaysInMonth(2100,2),28);
  assert.equal(api.calendarDaysInMonth(2000,2),29);
  const cells=Array.from(api.calendarMonthCells('2026-10'));
  assert.equal(cells.findIndex(Boolean),4);
  assert.equal(cells.filter(Boolean).length,31);
  assert.equal(cells.length%7,0);
  assert.equal(api.calendarDateParts('2026-02-29'),null);
});

test('Calendar month navigation crosses years and clamps selected day',()=>{
  const {api}=harness();
  api.calendarSelectDate('2026-01-31');api.calendarShiftMonth(1);
  assert.equal(api.state.selectedDate,'2026-02-28');
  api.calendarSelectDate('2026-12-20');api.calendarShiftMonth(1);
  assert.equal(api.state.month,'2027-01');api.calendarShiftMonth(-1);
  assert.equal(api.state.month,'2026-12');
});

test('Calendar story today is based on delivered story messages, never the device clock',()=>{
  const h=harness();const before=h.api.calendarStoryToday();
  assert.match(before,/^2026-10-/);
  addCurrentSource(h);assert.equal(h.api.calendarStoryToday(),'2026-10-25');
  h.api.calendarSelectDate('2028-02-29');
  assert.equal(h.api.calendarStoryToday(),'2026-10-25');
});

test('Calendar references real historical sources and retains unknown event times',()=>{
  const {api}=harness();const events=Array.from(api.calendarEvents());
  assert.equal(events.length,5);
  assert.ok(events.every(e=>e.id&&e.translation&&!e.start&&!e.end));
  assert.equal(events.find(e=>e.id==='calendar:meal:20261021').date,'2026-10-21');
  assert.equal(events.find(e=>e.id==='calendar:interview:20261021').location,'3층 라운지');
  api.calendarSelectDate('2026-10-21');
});

test('Original drinking invitation is visible only with its actual historical acceptance',()=>{
  const h=harness(),id='calendar:after-work-drinks-shownu-v1';
  assert.ok(h.api.calendarEvents().some(e=>e.id===id));
  const chat=h.config.chats.find(c=>c.id==='shownu');
  chat.messages=chat.messages.filter(m=>!(m.time==='18:14'&&m.text==='좋아. 어디서 볼까?'));
  assert.ok(!h.api.calendarEvents().some(e=>e.id===id));
  h.context.lostPhoneStory={stageEleven:{romance:{invitationStatus:'agreed'}}};
  assert.ok(!h.api.calendarEvents().some(e=>e.id===id),'an unrelated undated invitation cannot unlock historical drinks');
});

test('Calendar empty day, selection, event detail and return retain the selected date',()=>{
  const h=harness();h.api.calendarSelectDate('2026-11-01');
  assert.match(h.$('#calendar-content').innerHTML,/일정이 없습니다\./);
  h.api.calendarSelectDate('2026-10-21');
  h.$('#calendar-content').scrollTop=120;
  assert.equal(h.api.calendarOpenEvent('calendar:interview:20261021'),true);
  const detail=h.$('#calendar-content').innerHTML;
  for(const text of ['인터뷰','訪問','2026년 10월 21일','시간 미정','3층 라운지','三樓休息區']) assert.ok(detail.includes(text),text);
  h.api.calendarReturn();
  assert.equal(h.api.state.selectedDate,'2026-10-21');
  assert.equal(h.$('#calendar-content').scrollTop,120);
  assert.equal(h.api.calendarOpenEvent('no-such-event'),false);
  h.api.calendarReturn();assert.equal(h.home(),'home-screen');
});

test('Unknown venue and notes are omitted rather than invented',()=>{
  const h=harness();h.api.calendarOpenEvent('calendar:meal:20261021');
  assert.ok(!h.$('#calendar-content').innerHTML.includes('<dt>장소</dt>'));
  assert.ok(!h.$('#calendar-content').innerHTML.includes('20:41'),'photo time is not appointment time');
});

test('Five historical appointments render owner-written Korean and Chinese notes without changing source chat',()=>{
  const h=harness();
  const before=JSON.stringify(h.config.chats);
  const expected=[
    ['calendar:rehearsal:20261020','동선 체크 / 무대 위치 확인','確認走位／舞台位置'],
    ['calendar:interview:20261021','3층 라운지 / 인터뷰 전 대기','三樓休息區／訪問前待命'],
    ['calendar:meal:20261021','멤버들이랑 저녁 / 사진 정리','跟成員吃晚餐／整理照片'],
    ['calendar:venue:20261022','출입 동선 확인 / 리허설 준비','確認進出動線／準備彩排'],
    ['calendar:after-work-drinks-shownu-v1','퇴근하고 현우 형이랑 한잔','下班後跟賢佑哥喝一杯']
  ];
  for(const [id,ko,zh] of expected){
    const event=h.api.calendarEvents().find(e=>e.id===id);
    assert.equal(event.note,ko);
    assert.equal(event.noteTranslation,zh);
    assert.equal(h.api.calendarOpenEvent(id),true);
    assert.ok(h.$('#calendar-content').innerHTML.includes(ko));
    assert.ok(h.$('#calendar-content').innerHTML.includes(zh));
  }
  assert.equal(JSON.stringify(h.config.chats),before);
  // Editing a source's notification wording must not replace the owner's note.
  h.config.chats.find(c=>c.id==='manager').messages.find(m=>m.id==='phone-sim-stage10-history:manager:20-a').text='수정된 업무 안내';
  assert.equal(h.api.calendarEvents().find(e=>e.id==='calendar:rehearsal:20261020').note,expected[0][1]);
});

test('Unlocked current meal has an owner reminder, preserving source link and attendance conditions',()=>{
  const {state}=fixtureDecision(),h=harness(state);addCurrentSource(h);
  const event=h.api.calendarEvents().find(e=>e.id==='calendar:group-meal:current-meal-source');
  assert.equal(event.note,'멤버들이랑 저녁');
  assert.equal(event.noteTranslation,'跟成員吃晚餐');
  assert.equal(event.sourceId,'current-meal-source:1');
  const source=h.config.chats.find(c=>c.id==='group').messages.find(m=>m.id===event.sourceId);
  assert.equal(source.text,'오늘 저녁 먹을 사람?');
  state.stageSeven.groupMealDecisions['current-meal-source'].status='asking';
  assert.ok(!h.api.calendarEvents().some(e=>e.id===event.id));
});

for(const status of ['undecided','asking','declining']) test(`Current meal ${status} does not create a committed calendar entry`,()=>{
  const {state}=fixtureDecision(status),h=harness(state);addCurrentSource(h);
  assert.ok(!h.api.calendarEvents().some(e=>e.id==='calendar:group-meal:current-meal-source'));
});

test('Confirmed current meal appears once; changing decision removes it without altering historical meal',()=>{
  const {state}=fixtureDecision(),h=harness(state);addCurrentSource(h);
  const id='calendar:group-meal:current-meal-source';
  for(let i=0;i<4;i++) assert.equal(h.api.calendarEvents().filter(e=>e.id===id).length,1);
  state.stageSeven.groupMealDecisions['current-meal-source'].status='declining';
  assert.ok(!h.api.calendarEvents().some(e=>e.id===id));
  assert.ok(h.api.calendarEvents().some(e=>e.id==='calendar:meal:20261021'));
});

test('Rescheduling is reflected from the source event date, without storing a second schedule',()=>{
  const {state}=fixtureDecision(),h=harness(state);addCurrentSource(h);
  const source=h.config.chats.find(c=>c.id==='group').messages.find(m=>m.id==='current-meal-source:1');
  assert.equal(h.api.calendarEvents().find(e=>e.id==='calendar:group-meal:current-meal-source').date,'2026-10-25');
  source.day='10월 26일 월요일';
  assert.equal(h.api.calendarEvents().find(e=>e.id==='calendar:group-meal:current-meal-source').date,'2026-10-26');
});

test('Refresh reconstructs confirmed entries from saved story state without storage writes',()=>{
  const {state}=fixtureDecision(),h=harness(state);addCurrentSource(h);
  const before=JSON.stringify({chats:h.config.chats,state});
  const expected=JSON.stringify(h.api.calendarEvents());
  h.api.calendarSelectDate('2026-10-25');h.api.calendarOpenEvent('calendar:group-meal:current-meal-source');h.api.calendarReturn();
  assert.equal(JSON.stringify({chats:h.config.chats,state}),before);
  const fresh=harness(JSON.parse(JSON.stringify(state)));addCurrentSource(fresh);
  assert.equal(JSON.stringify(fresh.api.calendarEvents()),expected);
});

test('Missing or malformed event reference does not prevent other calendar entries or app rendering',()=>{
  const h=harness({stageSeven:{groupMealDecisions:{bad:null,missing:{eventId:'missing',status:'attending'}}}});
  h.config.chats.find(c=>c.id==='manager').messages=h.config.chats.find(c=>c.id==='manager').messages.filter(m=>m.id!=='phone-sim-stage10-history:manager:21-a');
  assert.equal(h.api.calendarEvents().length,4);
  assert.doesNotThrow(()=>h.api.renderCalendar());
  assert.ok(h.$('#calendar-content').innerHTML.includes('calendar-grid'));
});

test('Production calendar click handler supports date, detail, month, today and back actions',()=>{
  const h=harness();h.api.renderCalendar();const click=h.$('#app-calendar').listeners.click;
  const dispatch=(selector,dataset)=>click({target:{closest:s=>s===selector?{dataset}:null}});
  dispatch('[data-calendar-date]',{calendarDate:'2026-10-21'});
  dispatch('[data-calendar-event]',{calendarEvent:'calendar:meal:20261021'});
  assert.equal(h.api.state.eventId,'calendar:meal:20261021');
  dispatch('[data-calendar-action]',{calendarAction:'back'});
  assert.equal(h.api.state.selectedDate,'2026-10-21');
  dispatch('[data-calendar-action]',{calendarAction:'next'});assert.equal(h.api.state.month,'2026-11');
  dispatch('[data-calendar-action]',{calendarAction:'today'});assert.equal(h.api.state.selectedDate,h.api.calendarStoryToday());
});

test('Calendar UI has scoped safe areas and a flexible scroll region, and is wired into app navigation',()=>{
  assert.match(html,/calendar:'app-calendar'/);
  assert.match(html,/if\(id==='app-calendar'\)renderCalendar\(\)/);
  assert.match(html,/#app-calendar \.calendar-shell\{[^}]*padding-top:max\(40px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(html,/#app-calendar \.calendar-scroll\{flex:1;min-height:0;overflow-y:auto/);
  assert.match(html,/#app-calendar \.calendar-grid\{display:grid;grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
});
