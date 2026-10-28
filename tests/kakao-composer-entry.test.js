const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {game}=require('./helpers/simulator-harness');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function room(){const h=game();h.start();h.run("showScreen('app-kakao');openChat('minhyuk')");return h}

test('composer field is a native dialog button, never an editable keyboard input',()=>{
 const tag=html.match(/<button[^>]*id="chat-input"[^>]*>/)?.[0];
 assert.ok(tag);assert.match(tag,/type="button"/);assert.match(tag,/aria-haspopup="dialog"/);
 assert.match(tag,/aria-controls="stage-eleven-active-sheet"/);
 assert.doesNotMatch(html,/<input[^>]*id="chat-input"/);
 assert.match(html,/메시지 입력 · 눌러서 선택<\/button>/);
});
test('plus directly opens photos without opening text choices or tools',()=>{
 const h=room();h.run('stageElevenCloseComposer()');h.node('#chat-plus').click();
 assert.equal(h.run('photoShareUI.step'),'picker');
 assert.equal(h.node('#stage-eleven-active-sheet').hidden,true);
 assert.doesNotMatch(html,/kakaoPhotoToolsOpen|data-kakao-photo-album|data-kakao-photo-message/);
});
test('text entry reuses active composer and safely replaces a photo picker',()=>{
 const h=room();h.node('#chat-plus').click();h.run('stageElevenOpenComposer()');
 assert.equal(h.run('photoShareUI'),null);assert.equal(h.node('#photo-share-sheet').hidden,true);
 assert.equal(h.node('#stage-eleven-active-sheet').hidden,false);
 assert.match(h.node('#stage-eleven-active-sheet #stage-eleven-sheet-body').innerHTML,/data-active-category/);
});
test('photo entry closes text choices without changing story or persistent storage',()=>{
 const h=room();h.run('stageElevenOpenComposer()');const before=h.snapshot(),story=h.run('JSON.stringify(lostPhoneStory)');
 h.node('#chat-plus').click();assert.equal(h.node('#stage-eleven-active-sheet').hidden,true);
 h.run('photoShareCancel()');assert.deepEqual(h.snapshot(),before);
 assert.equal(h.run('JSON.stringify(lostPhoneStory)'),story);
});
test('cancel text panel preserves messages, choices, storage and room scroll',()=>{
 const h=room(),before=h.snapshot(),story=h.run('JSON.stringify(lostPhoneStory)');
 h.node('#chat-messages').scrollTop=137;h.run('stageElevenOpenComposer();stageElevenCloseComposer()');
 assert.equal(h.node('#chat-messages').scrollTop,137);assert.deepEqual(h.snapshot(),before);
 assert.equal(h.run('JSON.stringify(lostPhoneStory)'),story);
});
test('no available text choices renders the existing Korean empty state safely',()=>{
 const h=room();h.run('stageElevenActiveOptions=()=>[];stageElevenOpenComposer()');
 assert.match(h.node('#stage-eleven-active-sheet #stage-eleven-sheet-body').innerHTML,/지금 선택할 수 있는 메시지가 없습니다/);
 assert.equal(h.run('photoShareUI'),null);
});
test('text confirmation uses existing send and dedup, never a photo send',()=>{
 const h=room();h.run('stageElevenOpenComposer();globalThis.selectedEntry=stageElevenActiveOptions(activeChat.id)[0]');
 const text=h.run('selectedEntry.text');assert.ok(text);
 assert.equal(h.run('stageElevenCommitActiveMessage(selectedEntry)'),true);
 assert.equal(h.run('stageElevenCommitActiveMessage(selectedEntry)'),false);
 assert.equal(h.run('photoShareUI'),null);
 assert.equal(h.run('CONFIG.chats.find(c=>c.id===activeChat.id).messages.filter(m=>m.from==="형원"&&m.text===selectedEntry.text).length'),1);
});
test('yellow arrow remains a submit entry to the original composer, not a photo or blank send',()=>{
 assert.match(html,/<button class="send-btn" type="submit"/);
 assert.match(html,/event\.target\?\.id==='chat-form'\)\{event\.preventDefault\(\);event\.stopImmediatePropagation\(\);stageElevenOpenComposer\(\)/);
});
