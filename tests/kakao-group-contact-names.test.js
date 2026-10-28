const test=require('node:test');const assert=require('node:assert/strict');const {game}=require('./helpers/simulator-harness');
test('group names resolve existing contact IDs and legacy aliases to private contact names',()=>{const h=game();h.start();for(const [id,alias,name] of [['shownu','셔누','셔누형'],['minhyuk','민혁','미녀기'],['kihyun','기현','유기현'],['jooheon','주헌','ㅈㅏ기야'],['changkyun','창균','짱균이'],['manager','매니저','매니저']])for(const sender of [id,alias])assert.equal(h.run(`kakaoMessageDisplayName({type:'group'},'${sender}')`),name)});
test('contact rename is shared by old group sender aliases, member header and restored notifications',()=>{
 const h=game();h.start();h.run("showScreen('app-kakao');openChat('group')");
 const before=h.run('JSON.stringify(activeChat.messages)'),unread=h.run('activeChat.unread');
 h.run("CONFIG.contacts.find(c=>c.id==='minhyuk').name='테스트 이름';renderChatMessages()");
 assert.equal(h.run("kakaoMessageDisplayName(activeChat,'민혁')"),'테스트 이름');
 assert.match(h.run('kakaoGroupMembersDisplay(activeChat)'),/테스트 이름/);
 h.run("gameEventMemory.events.push({id:'name-test',payload:{chatId:'group',message:{from:'minhyuk'}}})");
 assert.equal(h.run("kakaoNotificationSender({eventId:'name-test',sender:'민혁',destination:{chatId:'group'}})"),'테스트 이름');
 assert.equal(h.run('JSON.stringify(activeChat.messages)'),before);assert.equal(h.run('activeChat.unread'),unread);
});
test('unknown members remain safe and private names are untouched',()=>{const h=game();h.start();assert.equal(h.run("kakaoMessageDisplayName({type:'group'},'unknown')"),'멤버');assert.equal(h.run("kakaoMessageDisplayName({type:'direct'},'민혁')"),'민혁')});
