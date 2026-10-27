const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function harness() {
  const notes = vm.runInNewContext(html.match(/notes: (\[[\s\S]*?\]),\s*reminders:/)[1]);
  notes.push(vm.runInNewContext('(' + html.match(/CONFIG\.notes\.push\((\{id:'phone-sim-stage11-private-note'.*?\})\)/)[1] + ')'));
  const nodes = new Map();
  const $ = selector => {
    if (!nodes.has(selector)) {
      const classes = new Set();
      nodes.set(selector, {innerHTML:'', textContent:'', value:'', hidden:false, scrollTop:0,
        classList:{add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x)},
        listeners:{}, addEventListener(type, callback) { this.listeners[type] = callback; }});
    }
    return nodes.get(selector);
  };
  const context = vm.createContext({CONFIG:{notes}, $, escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
  const start = html.indexOf('const notesViewState=');
  vm.runInContext(html.slice(start, html.indexOf('function renderReminders(', start)) + '\nglobalThis.api={renderNotes,openNote,closeNoteDetail,filteredNotes,state:notesViewState};', context);
  for (const prefix of ["$('#notes-query').addEventListener", "$('#app-notes').addEventListener"]) {
    vm.runInContext(html.split(/\r?\n/).find(line=>line.startsWith(prefix)), context);
  }
  context.api.renderNotes();
  return {api:context.api, $, notes};
}

for (const [id, title] of [['note-drinks','술 약속'],['note-playlist','플레이리스트'],['phone-sim-stage11-private-note','저장하지 않을 초안']]) {
  test(`Notes opens the full original body and translation by ID: ${title}`, () => {
    const {api,$,notes} = harness();
    const note = notes.find(n=>n.id===id);
    assert.equal(api.openNote(id), true);
    const detail = $('#notes-detail-content').innerHTML;
    assert.ok(detail.includes(note.title));
    assert.ok(detail.includes(note.body));
    assert.ok(detail.includes(note.translation));
    assert.ok(!detail.includes('notes-detail-date'), 'undated notes do not invent timestamps');
    assert.equal($('#notes-detail').hidden, false);
    assert.equal(api.state.selectedId, id);
  });
}

test('Notes search covers Korean titles, bodies and Traditional Chinese translations', () => {
  const {api} = harness();
  for (const [q,id] of [['술 약속','note-drinks'],['국물','note-drinks'],['下酒菜','note-drinks'],['想你了','phone-sim-stage11-private-note'],['As You Wish','note-playlist']]) {
    api.renderNotes(q);
    assert.deepEqual(Array.from(api.filteredNotes(), n=>n.id), [id]);
  }
});

test('Notes return preserves the query, results and list scroll position', () => {
  const {api,$} = harness();
  api.renderNotes('下酒菜');
  $('#notes-body').scrollTop=63;
  const listBefore=$('#notes-body').innerHTML;
  api.openNote('note-drinks');
  $('#notes-detail-content').scrollTop=100;
  api.closeNoteDetail();
  assert.equal($('#notes-body').scrollTop,63);
  assert.equal($('#notes-query').value,'下酒菜');
  assert.equal($('#notes-body').innerHTML,listBefore);
  assert.equal($('#notes-detail').hidden,true);
  assert.equal($('#app-notes').classList.contains('notes-reading'),false);
});

test('Notes input updates results, empty state, counts and clearing restores all three', () => {
  const {api,$} = harness();
  const input=$('#notes-query').listeners.input;
  input({target:{value:'no matching note'}});
  assert.match($('#notes-body').innerHTML,/검색 결과가 없습니다\./);
  assert.equal($('#notes-count').textContent,'0개의 메모');
  input({target:{value:''}});
  assert.equal(api.filteredNotes().length,3);
  assert.equal($('#notes-visible-count').textContent,'3');
  assert.equal(($('#notes-body').innerHTML.match(/data-note-id=/g)||[]).length,3);
});

test('Notes production click handler opens the selected result and returns to list', () => {
  const {api,$} = harness();
  const click=$('#app-notes').listeners.click;
  click({target:{closest:selector=>selector==='[data-note-id]'?{dataset:{noteId:'note-playlist'}}:null}});
  assert.equal(api.state.selectedId,'note-playlist');
  click({target:{closest:selector=>selector==='[data-notes-list]'?{}:null}});
  assert.equal(api.state.selectedId,null);
});

test('Notes navigation and searching are read-only; unknown ID is safe', () => {
  const {api,notes} = harness();
  const before=JSON.stringify(notes);
  api.openNote('note-drinks');
  assert.equal(api.openNote('unknown-note'),false);
  assert.equal(api.state.selectedId,'note-drinks');
  api.closeNoteDetail();api.renderNotes('想你');
  assert.equal(JSON.stringify(notes),before);
  assert.equal(new Set(notes.map(n=>n.id)).size,3);
  const fresh=harness();
  assert.equal(fresh.notes.length,3);
  assert.equal(JSON.stringify(fresh.notes),before);
});

test('Notes private draft and original source text remain unchanged', () => {
  const {notes}=harness();
  assert.equal(notes[0].body,'조용하고 국물 안주 있는 곳. 다음에 또 가기.');
  assert.equal(notes[1].body,"이제야 알겠어\nI'll Be There\nAs You Wish");
  assert.equal(notes[2].body,'잘 지냈냐는 말은 쉽게 보내면서, 보고 싶었다는 말은 아직도 못 보내겠다. 뭐가 그렇게 어려운 건지.');
  assert.equal(notes[2].translation,'「最近過得好嗎」這種話可以輕易傳出去，「想你了」卻到現在還是傳不出去。到底有什麼好為難的。');
});

test('Notes detail reserves system bars and a separate scrollable reading area', () => {
  assert.match(html, /#app-notes \.notes-detail\{[^}]*padding-top:max\(40px,env\(safe-area-inset-top,0px\)\)/);
  assert.match(html, /#app-notes \.notes-detail-scroll\{flex:1;min-height:0;overflow-y:auto/);
  assert.match(html, /#app-notes \.notes-detail-footer\{flex:none/);
  assert.match(html, /id="notes-add"[^>]*disabled/);
  assert.match(html, /id="notes-more"[^>]*disabled/);
  assert.ok(!html.includes("prompt('메모 내용을 입력하세요')"));
  assert.ok(!html.includes('renderNotesWithTranslationBase'));
});
