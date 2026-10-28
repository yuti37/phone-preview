const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {game}=require('./helpers/simulator-harness');
// Exact reviewed lines, not a blanket polite-suffix replacement.
const revised=[
 {
  "id": "phone-sim-stage10-history:jooheon:17-a",
  "chatId": "jooheon",
  "old": "형! 오늘 리허설 때 모니터 잘 들렸어요?",
  "oldTranslation": "哥！今天彩排時監聽聽得清楚嗎？",
  "text": "형! 오늘 리허설 때 모니터 잘 들렸어?",
  "translation": "哥！今天彩排時監聽聽得清楚嗎？"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:17-c",
  "chatId": "jooheon",
  "old": "네! 그 부분 다시 체크해볼게요",
  "oldTranslation": "好！我會再確認那一段。",
  "text": "응! 그 부분 다시 체크해 볼게",
  "translation": "好！我會再確認那一段。"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:18-a",
  "chatId": "jooheon",
  "old": "아까 간식 남은 거 냉장고에 넣어뒀어요",
  "oldTranslation": "剛才剩下的點心我放冰箱了。",
  "text": "아까 남은 간식 냉장고에 넣어 뒀어",
  "translation": "剛才剩下的點心我放冰箱了。"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:19-a",
  "chatId": "jooheon",
  "old": "오늘 이동 버스에서 들을 노래 추천해 주세요!",
  "oldTranslation": "推薦一首今天在車上可以聽的歌吧！",
  "text": "형, 오늘 버스에서 들을 노래 추천해 줘!",
  "translation": "哥，推薦一首今天在車上可以聽的歌吧！"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:19-c",
  "chatId": "jooheon",
  "old": "감사합니다. 이동할 때 바로 들어볼게요",
  "oldTranslation": "謝謝哥，我上車就聽。",
  "text": "고마워 형. 이동할 때 바로 들어볼게",
  "translation": "謝謝哥，我上車就聽。"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:20-a",
  "chatId": "jooheon",
  "old": "오늘은 무대 전에 긴장 하나도 안 했어요",
  "oldTranslation": "今天上台前我完全沒有緊張。",
  "text": "오늘은 무대 전에 긴장 하나도 안 했어",
  "translation": "今天上台前我完全沒有緊張。"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:20-c",
  "chatId": "jooheon",
  "old": "그건 자신 있어요!!",
  "oldTranslation": "那我很有自信！！",
  "text": "그건 자신 있지!!",
  "translation": "那我很有自信！！"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:21-a",
  "chatId": "jooheon",
  "old": "형 아까 인터뷰에서 말한 영화 제목 뭐였어요?",
  "oldTranslation": "哥，你剛才訪問提到的電影叫什麼？",
  "text": "형, 아까 인터뷰에서 말한 영화 제목 뭐였어?",
  "translation": "哥，你剛才訪問提到的電影叫什麼？"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:21-c",
  "chatId": "jooheon",
  "old": "찾았어요! 다음 휴식 때 볼게요 ㅎㅎ",
  "oldTranslation": "找到了！下次休息時要看ㅎㅎ",
  "text": "찾았어! 다음에 쉴 때 볼게 ㅎㅎ",
  "translation": "找到了！下次休息時再看ㅎㅎ"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:22-a",
  "chatId": "jooheon",
  "old": "오늘 무대 끝나고 다리 스트레칭 꼭 해야겠어요",
  "oldTranslation": "今天演出結束後一定要伸展腿。",
  "text": "오늘 무대 끝나면 다리 스트레칭 꼭 해야겠다",
  "translation": "今天演出結束後一定要伸展腿。"
 },
 {
  "id": "phone-sim-stage10-history:jooheon:22-c",
  "chatId": "jooheon",
  "old": "네! 형도 꼭 쉬세요",
  "oldTranslation": "好！哥也一定要休息。",
  "text": "응! 형도 꼭 쉬어",
  "translation": "好！哥也一定要休息。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:17-a",
  "chatId": "changkyun",
  "old": "형, 복도 쪽 와이파이가 더 잘 잡혀요",
  "oldTranslation": "哥，走廊那邊的 Wi-Fi 訊號比較好。",
  "text": "형, 복도 쪽 와이파이가 더 잘 잡혀",
  "translation": "哥，走廊那邊的 Wi-Fi 訊號比較好。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:17-c",
  "chatId": "changkyun",
  "old": "사람 없을 때가 제일 빨라요 ㅋㅋ",
  "oldTranslation": "沒人的時候最快ㅋㅋ",
  "text": "사람 없을 때가 제일 빨라 ㅋㅋ",
  "translation": "沒人的時候最快ㅋㅋ"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:18-a",
  "chatId": "changkyun",
  "old": "아까 보내려던 사진 여기 있어요",
  "oldTranslation": "剛才要傳的照片在這裡。",
  "text": "아까 보내려던 사진 여기 있어",
  "translation": "剛才要傳的照片在這裡。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:18-c",
  "chatId": "changkyun",
  "old": "조명 덕분이에요. 제가 한 건 별로 없고요",
  "oldTranslation": "多虧燈光，我也沒做什麼。",
  "text": "조명 덕이지. 난 별로 한 거 없어",
  "translation": "多虧燈光，我也沒做什麼。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:19-b",
  "chatId": "changkyun",
  "old": "잠시만요. 링크 저장해 둔 거 찾아볼게요",
  "oldTranslation": "等一下，我找找存下來的連結。",
  "text": "잠깐만. 저장해 둔 링크 찾아볼게",
  "translation": "等一下，我找找存下來的連結。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:19-c",
  "chatId": "changkyun",
  "old": "찾았어요. 여기요",
  "oldTranslation": "找到了，在這裡。",
  "text": "찾았어. 여기",
  "translation": "找到了，在這裡。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:20-a",
  "chatId": "changkyun",
  "old": "대기실에 보조 배터리 두고 갈게요. 필요한 사람 쓰세요",
  "oldTranslation": "我把行動電源放在休息室，需要的人可以用。",
  "text": "대기실에 보조 배터리 두고 갈게. 필요한 사람 쓰면 돼",
  "translation": "我把行動電源放在休息室，需要的人可以用。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:20-c",
  "chatId": "changkyun",
  "old": "충전 끝나면 원래 자리에만 놓아 주세요",
  "oldTranslation": "充完電放回原位就好。",
  "text": "충전 끝나면 제자리에만 놔 줘",
  "translation": "充完電放回原位就好。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:21-a",
  "chatId": "changkyun",
  "old": "형, 인터뷰 끝나고 물병 하나 남았어요",
  "oldTranslation": "哥，訪問結束後還剩一瓶水。",
  "text": "형, 인터뷰 끝나고 물병 하나 남았어",
  "translation": "哥，訪問結束後還剩一瓶水。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:21-c",
  "chatId": "changkyun",
  "old": "네. 바로 가져다줄게요",
  "oldTranslation": "好，我馬上拿給他。",
  "text": "응. 바로 갖다줄게",
  "translation": "好，我馬上拿給他。"
 },
 {
  "id": "phone-sim-stage10-history:changkyun:22-b",
  "chatId": "changkyun",
  "old": "필터 거의 안 썼어요. 조명이 좋았어요",
  "oldTranslation": "幾乎沒用濾鏡，是燈光很棒。",
  "text": "필터 거의 안 썼어. 조명이 좋았어",
  "translation": "幾乎沒用濾鏡，是燈光很棒。"
 },
 {
  "id": "phone-sim-stage10-history:group:17-b",
  "chatId": "group",
  "old": "확인했어요! 길 안 헷갈리게 조심할게요",
  "oldTranslation": "知道了！我會注意不要走錯。",
  "text": "확인! 길 안 헷갈리게 잘 보고 갈게",
  "translation": "收到！我會看清楚路再過去，免得走錯。"
 },
 {
  "id": "phone-sim-stage10-history:group:19-a",
  "chatId": "group",
  "old": "차 안에 목캔디 두고 왔는데 누가 봤어요?",
  "oldTranslation": "我把喉糖放車上了，有人看到嗎？",
  "text": "차 안에 목캔디 두고 왔는데 누가 봤어?",
  "translation": "我把喉糖放車上了，有人看到嗎？"
 },
 {
  "id": "phone-sim-stage10-history:group:19-b",
  "chatId": "group",
  "old": "좌석 앞 주머니에 있어요",
  "oldTranslation": "在座位前方的置物袋。",
  "text": "좌석 앞 주머니에 있어",
  "translation": "在座位前方的置物袋。"
 },
 {
  "id": "phone-sim-stage10-history:group:19-c",
  "chatId": "group",
  "old": "찾았어요! 감사합니다 ㅎㅎ",
  "oldTranslation": "找到了！謝謝ㅎㅎ",
  "text": "찾았어! 고마워 ㅎㅎ",
  "translation": "找到了！謝啦ㅎㅎ"
 },
 {
  "id": "phone-sim-stage5-history:group:2",
  "chatId": "group",
  "old": "오 이 사진 좋네요. 다들 표정 괜찮아요!",
  "oldTranslation": "哦，這張照片不錯。大家表情都很好！",
  "text": "오 이 사진 좋다. 다들 표정 괜찮네!",
  "translation": "哦，這張照片不錯。大家表情都很好！"
 },
 {
  "id": "phone-sim:kkt-history:legacy:group:0017",
  "chatId": "group",
  "old": "오 거기 이름이 뭐예요?",
  "oldTranslation": "哦，那家店叫甚麼？",
  "text": "오 거기 이름이 뭐야?",
  "translation": "哦，那家店叫甚麼？"
 }
];
const unchangedHash="40d4acc5389c6340a2ed427ee911149c66f9beacdebd23bf1d007a8048b18f73";
function ready(){const h=game();h.start();return h}
function messages(h){return h.run('CONFIG.chats.flatMap(c=>c.messages)')}
function byId(h,id){return messages(h).find(m=>m.id===id)}
for(const fixture of revised)test('Fresh history bilingual tone: '+fixture.id,()=>{
 const h=ready(),m=byId(h,fixture.id);assert.ok(m);assert.equal(m.text,fixture.text);assert.equal(m.translation,fixture.translation);assert.notEqual(m.text,fixture.old);
});

test('Group speech respects actual recipients: six work/polite contexts are preserved verbatim',()=>{
 const h=ready();for(const [id,text,translation] of [
 ['phone-sim:kkt-history:legacy:group:0012','확인했습니다!','收到！'],
 ['phone-sim:kkt-history:legacy:group:0022','오늘 다들 수고하셨어요! 먼저 들어갈게요','今天大家辛苦了！我先回去了。'],
 ['phone-sim:kkt-history:legacy:group:0059','점심 먹고 바로 이동이에요?','吃完午餐就直接移動嗎？'],
 ['phone-sim:kkt-history:legacy:group:0105','확인했습니다!','收到！'],
 ['phone-sim-stage10-history:group:22-b','제가 목록 정리해 둘게요','我來整理清單。'],
 ['phone-sim:kkt-history:legacy:group:0148','지하 1층 맞죠? 도착하면 연락드릴게요.','是地下 1 樓沒錯吧？到的時候我會聯絡。']
 ]){const m=byId(h,id);assert.equal(m.text,text);assert.equal(m.translation,translation)}
 // In context this is a playful formal warning about stealing the leftover snack.
 assert.equal(byId(h,'phone-sim-stage10-history:jooheon:18-c').text,'너무 오래 두면 제가 먹습니다 ㅋㅋ');
 assert.equal(byId(h,'phone-sim-stage10-history:jooheon:18-c').translation,'放太久我就吃掉囉ㅋㅋ');
});
test('IDs, dates, message order, senders, timestamps, titles and unread counts retain the prior baseline',()=>{
 const h=ready(),signature=h.run(`JSON.stringify(CONFIG.chats.map(c=>({id:c.id,title:c.title,unread:c.unread,messages:c.messages.map(m=>({id:m.id,day:m.day,time:m.time,from:m.from,timestamp:m.timestamp,storyTimestamp:m.storyTimestamp}))})))`);
 assert.equal(crypto.createHash('sha256').update(signature).digest('hex'),'0016ef42b73b3c4518672e95c2a5b5321dfc65ca790ff830b6bbaac7797b8963');
 const others=messages(h).filter(m=>!revised.some(f=>f.id===m.id)).map(m=>[m.id,m.text,m.translation]);assert.equal(crypto.createHash('sha256').update(JSON.stringify(others)).digest('hex'),unchangedHash);
});
test('Latest corrected Jooheon preview equals the actual message and room sorting stays unchanged',()=>{
 const h=ready();h.run('renderKakaoChats()');const html=h.node('#friends-list').innerHTML;
 assert.match(html,/응! 형도 꼭 쉬어/);assert.doesNotMatch(html,/네! 형도 꼭 쉬세요/);
 assert.deepEqual([...html.matchAll(/data-chat="([^"]+)"/g)].map(m=>m[1]),['group','shownu','manager','minhyuk','kihyun','changkyun','jooheon']);
});
test('Repeated history initialization and reloading never duplicates corrected IDs',()=>{
 const h=ready();h.run('ensureStageFiveHistoricMessages();ensureStageTenTourHistory();ensureStageTenTourHistory()');for(const f of revised)assert.equal(messages(h).filter(m=>m.id===f.id).length,1,f.id);
 const r=game(h.snapshot());r.start();for(const f of revised){assert.equal(byId(r,f.id).text,f.text);assert.equal(byId(r,f.id).translation,f.translation)}
});
test('Old delivered history and player event records survive restore without text migration',()=>{
 const f=revised.find(f=>f.id==='phone-sim-stage10-history:jooheon:22-c'),time=new Date(2026,9,22,19,21).getTime();
 const event={id:'tone-legacy-delivered',type:'kkt-message',source:'kakao',status:'completed',createdAt:time,scheduledAt:time,completedAt:time,effects:{chatRead:true},payload:{chatId:'jooheon',message:{id:f.id,day:'10월 22일 목요일',time:'19:21',from:'주헌',text:f.old,translation:f.oldTranslation,storyTimestamp:time}}};
 const player={...event,id:'tone-legacy-player',payload:{chatId:'jooheon',message:{id:'tone-legacy-player',day:'10월 22일 목요일',time:'19:22',from:'형원',text:'응, 내일 보자.',translation:'嗯，明天見。',storyTimestamp:time+60000}}};
 const h=game({local:[['unrelated-key','untouched'],['phone-sim-event-store-v2',JSON.stringify({version:2,events:[event,player],notifications:[]})]]});h.start();
 assert.equal(byId(h,f.id).text,f.old);assert.equal(byId(h,'tone-legacy-player').text,player.payload.message.text);
 for(const expected of [event,player]){const saved=h.events().find(e=>e.id===expected.id);assert.equal(JSON.stringify(saved.payload),JSON.stringify(expected.payload));assert.equal(saved.status,'completed');assert.equal(saved.scheduledAt,time)}
 assert.ok(h.snapshot().local.some(([key,value])=>key==='unrelated-key'&&value==='untouched'));
});
for(const [chatId,optionId,text,translation] of [
 ['jooheon','send-song','고마워! 찾으면 보내 줘.','謝謝！找到後再傳給我。'],
 ['changkyun','checked-cut','오케이. 그럼 그 버전으로 정리할게.','好，那我就照那個版本整理。']
])test('Stage Seven contextual reply unchanged: '+chatId,()=>{
 const h=ready(),reply=h.run(`stageSevenOrdinaryReply('${chatId}','${optionId}')`);assert.equal(reply.text,text);assert.equal(reply.translation,translation);
 h.run(`executeGameEvent(createGameEvent(${JSON.stringify({id:'tone-seven-'+chatId,type:'kkt-message',source:'kakao',shouldNotify:false,payload:{chatId,message:{id:'tone-seven-'+chatId,...reply,day:'10월 23일 금요일',time:'21:11'}}})}))`);
 const delivered=byId(h,'tone-seven-'+chatId);assert.equal(delivered.text,text);assert.equal(delivered.translation,translation);
});
for(const [chatId,topic,choice,text,translation] of [
 ['jooheon','music-process','music-process-break','응, 잠깐 딴 거 하다가 다시 해. 계속 붙잡고 있으면 더 막히더라.','會啊，先做點別的再回來。一直卡著反而更容易想不出來。'],
 ['changkyun','listening-habit','listening-order','응. 순서대로 들으면 앨범 흐름이 잘 느껴져. 형은?','嗯。照順序聽比較能感覺到整張專輯的脈絡。哥呢？']
])test('Stage Twelve actual player selection and delayed delivery preserve contextual speech: '+chatId,()=>{
 const h=ready();h.run(`showScreen('app-kakao');openChat('${chatId}')`);
 const item=h.run(`stageElevenActiveOptions('${chatId}').find(i=>i.id==='conversation:${chatId}:${topic}:start:${choice}')`);assert.ok(item);assert.equal(item.reply,text);assert.equal(item.replyTranslation,translation);
 assert.equal(h.run(`stageElevenCommitActiveMessage(stageElevenActiveOptions('${chatId}').find(i=>i.id===${JSON.stringify(item.id)}))`),true);
 h.advance(4000);assert.ok(messages(h).some(m=>m.text===text&&m.translation===translation));
 const r=game(h.snapshot());r.start();assert.ok(messages(r).some(m=>m.text===text&&m.translation===translation));
});

// The two explicitly approved Stage Twelve copy edits. Existing snapshots retain
// their saved copy; only newly constructed choices read the revised templates.
const approvedTwelveCopies=[
 {chatId:'minhyuk',topic:'daily',stage:'start',choice:'food',old:'아직 대충 먹었지 ㅋㅋ 너는?',oldTranslation:'還是隨便吃了點ㅋㅋ你呢？',text:'대충 먹긴 했지 ㅋㅋ 너는?',translation:'吃是吃了，不過就隨便吃了點ㅋㅋ你呢？'},
 {chatId:'shownu',topic:'flirt',stage:'flirt-special-answer',choice:'special-joke',old:'그건 맞지. 편한 사이는 오래 가는 게 좋더라.',oldTranslation:'這倒是。相處自在的關係能長久維持很好。',text:'그치 ㅋㅋ 편한 사이는 오래 가는 게 좋지.',translation:'對啊ㅋㅋ相處自在的關係，能長久維持就很好。'}
];
function chooseTwelve(h,chatId,topic,stage,choice){
 const id=`conversation:${chatId}:${topic}:${stage}:${choice}`;
 assert.ok(h.run(`stageElevenActiveOptions('${chatId}').some(i=>i.id===${JSON.stringify(id)})`),id);
 assert.equal(h.run(`stageElevenCommitActiveMessage(stageElevenActiveOptions('${chatId}').find(i=>i.id===${JSON.stringify(id)}))`),true);
 return id;
}
function prepareApprovedCopy(f){
 const h=ready();if(f.chatId==='shownu'){h.open();h.select('decline');h.advance(4000)}
 h.run(`showScreen('app-kakao');openChat('${f.chatId}')`);
 if(f.chatId==='shownu'){chooseTwelve(h,'shownu','flirt','start','flirt-special');h.advance(4000)}
 return h;
}
function replyRecord(h,f,id){return h.run(`stageElevenActionState('${f.chatId}')[${JSON.stringify(id)}]`)}
function conversation(h,f){return h.run(`ensureStageTwelveState().conversations['${f.chatId}']`)}
function simulateOldPendingCopy(h,f,id){
 h.run(`(()=>{const record=stageElevenActionState('${f.chatId}')[${JSON.stringify(id)}];record.reply=${JSON.stringify(f.old)};record.replyTranslation=${JSON.stringify(f.oldTranslation)};const event=getGameEvent(record.eventId+':reply');event.payload.text=record.reply;event.payload.translation=record.replyTranslation;if(event.payload.conversation){event.payload.conversation.reply=record.reply;event.payload.conversation.replyTranslation=record.replyTranslation}saveLostPhoneStory();saveGameEventStore()})()`);
}
for(const f of approvedTwelveCopies){
 test('Approved Stage Twelve bilingual copy, actual delivery and preview: '+f.chatId,()=>{
  const h=prepareApprovedCopy(f),choice=h.run(`STAGE_TWELVE_FLOWS.${f.chatId}.${f.topic}.stages[${JSON.stringify(f.stage)}].find(i=>i.id==='${f.choice}')`);
  assert.equal(choice.reply,f.text);assert.equal(choice.replyTranslation,f.translation);
  const id=chooseTwelve(h,f.chatId,f.topic,f.stage,f.choice);h.advance(4000);
  const record=replyRecord(h,f,id),m=byId(h,record.conversationReplyMessageId);assert.equal(m.text,f.text);assert.equal(m.translation,f.translation);
  h.run('renderKakaoChats()');const row=h.node('#friends-list').innerHTML.match(new RegExp('data-chat="'+f.chatId+'">([\\s\\S]*?)</button>'))[1];assert.ok(row.includes(f.text));assert.ok(!row.includes(f.old));
  if(f.chatId==='minhyuk'){
   assert.equal(conversation(h,f).stage,'food-follow');chooseTwelve(h,'minhyuk','daily','food-follow','food-share');h.advance(4000);assert.equal(conversation(h,f).stage,'food-pick');
   assert.ok(messages(h).some(m=>m.text==='그럼 국밥 어때? 실패가 없잖아 ㅋㅋ'&&m.translation==='那湯飯怎麼樣？不太會踩雷ㅋㅋ'));
  }else{
   assert.equal(conversation(h,f).status,'completed');assert.equal(conversation(h,f).activeTopicId,null);assert.equal(conversation(h,f).pausedTopics.flirt.status,'completed');
   assert.ok(!h.run("stageElevenActiveOptions('shownu').some(i=>i.id.includes(':flirt-special-answer:'))"));
  }
 });
 test('Pending legacy reply snapshot restores unchanged and delivers only once: '+f.chatId,()=>{
  const h=prepareApprovedCopy(f),id=chooseTwelve(h,f.chatId,f.topic,f.stage,f.choice);simulateOldPendingCopy(h,f,id);
  const record=replyRecord(h,f,id),eventId=record.eventId+':reply',before=h.events().find(e=>e.id===eventId),payload=JSON.stringify(before.payload),due=before.scheduledAt;
  const r=game(h.snapshot());r.start();const restored=r.events().find(e=>e.id===eventId);assert.equal(restored.id,eventId);assert.equal(restored.scheduledAt,due);assert.equal(restored.status,'pending');assert.equal(JSON.stringify(restored.payload),payload);
  r.advance(10000);const delivered=replyRecord(r,f,id),m=byId(r,delivered.conversationReplyMessageId);assert.equal(m.text,f.old);assert.equal(m.translation,f.oldTranslation);assert.equal(messages(r).filter(m=>m.id===delivered.conversationReplyMessageId).length,1);
  const again=game(r.snapshot());again.start();again.advance(10000);assert.equal(messages(again).filter(m=>m.id===delivered.conversationReplyMessageId).length,1);assert.equal(again.events().find(e=>e.id===eventId).status,'completed');
 });
 test('Already delivered old wording is never rewritten or replayed on reload: '+f.chatId,()=>{
  const h=prepareApprovedCopy(f),id=chooseTwelve(h,f.chatId,f.topic,f.stage,f.choice);simulateOldPendingCopy(h,f,id);h.advance(4000);
  const record=replyRecord(h,f,id),m=byId(h,record.conversationReplyMessageId),before=JSON.stringify(m);assert.equal(m.text,f.old);
  const r=game(h.snapshot());r.start();r.advance(10000);assert.equal(JSON.stringify(byId(r,m.id)),before);assert.equal(messages(r).filter(x=>x.id===m.id).length,1);
 });
}
test('Only the two approved reply/translation pairs change; all surrounding flow fields and options retain their baseline',()=>{
 const h=ready(),copy=JSON.parse(h.run('JSON.stringify({minhyuk:STAGE_TWELVE_FLOWS.minhyuk.daily,shownu:STAGE_TWELVE_FLOWS.shownu.flirt})'));
 for(const f of approvedTwelveCopies){const choice=copy[f.chatId].stages[f.stage].find(i=>i.id===f.choice);choice.reply=f.old;choice.replyTranslation=f.oldTranslation}
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex'),'f17f9e7fe56a4e74af792b42b8cb5ea75fbcfd41460307aee293e15cfebe81f8');
 const specialSay=copy.shownu.stages['flirt-special-answer'].find(i=>i.id==='special-say');assert.equal(specialSay.text,'형은 나한테 좀 특별해.');assert.equal(specialSay.reply,'특별하다고? 어떤 의미로? ㅋㅋ');assert.equal(specialSay.next,'special-meaning');
});
