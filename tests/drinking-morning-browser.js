// Optional real-browser smoke test. Requires Node 22+ and a separately launched,
// isolated headless Chrome with remote debugging; never connects to a user profile.
// Usage: node tests/drinking-morning-browser.js <local-site-url> <debug-http-url>
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
async function main(){
 const site=process.argv[2]||'http://127.0.0.1:8955/',debug=process.argv[3]||'http://127.0.0.1:9337';
 for(const input of [site,debug])assert.ok(['127.0.0.1','localhost'].includes(new URL(input).hostname),'Use an isolated LOCAL test environment only');
 const version=await(await fetch(debug+'/json/version')).json(),ws=new WebSocket(version.webSocketDebuggerUrl),requests=new Map(),errors=[];let seq=0;
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=requests.get(data.id);if(!p)return;requests.delete(data.id);clearTimeout(p.timer);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result)}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)});
 function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{requests.delete(id);reject(new Error('CDP timeout: '+method))},15000);requests.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))})}
 const results=[],artifactDir=fs.mkdtempSync(path.join(os.tmpdir(),'phone-morning-browser-'));
 try{
  for(const [branch,choices,reply] of [['ordinary',['pay','tease','contact'],'fine'],['happy',['glad','waited','care'],'honest'],['question',['comfortable','stay','question'],'sincere'],['different',['glad','waited','only'],'ask']]){
   const {browserContextId}=await send('Target.createBrowserContext');
   try{
    const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const cdp=(method,params)=>send(method,params,sessionId);
    await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await cdp('Emulation.setTouchEmulationEnabled',{enabled:true});
    async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
    async function waitFor(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error('Not ready: '+expression+' '+JSON.stringify(await evaluate("({url:location.href,title:document.title,body:document.body?.textContent?.slice(0,180)})"))+' exceptions='+JSON.stringify(errors))}
    async function click(selector){const point=await evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,hit:e.contains(document.elementFromPoint(x,y)),disabled:e.disabled}})()`);assert.ok(point.hit&&!point.disabled,`${selector} is not a usable touch target: ${JSON.stringify(point)}`);await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await cdp('Page.navigate',{url:site});await waitFor("typeof initializeGameOnce==='function'&&document.querySelector('#launch-new')&&!document.querySelector('#launch-new').disabled");
    await click('#launch-new');await waitFor("gameInitializationStatus==='started'");await click('#lock-home-bar');for(const digit of '0618')await click(`[data-passcode-digit="${digit}"]`);await waitFor("phoneUnlocked&&currentScreen==='home-screen'");
    assert.equal(await evaluate("document.querySelector('#morning-step-card').hidden"),true);
    await click('#home-screen [data-app="kakao"]');await click('#friends-list [data-chat="shownu"]');
    for(const option of ['join',...choices]){await click(`[data-stage-seven-option="${option}"]`);await waitFor('!drinkingNightState().pendingReply')}
    await click('#chat-room [data-home]');await waitFor("currentScreen==='home-screen'");assert.equal(await evaluate("document.querySelector('#morning-step-card').hidden"),false);
    for(const [width,height] of [[320,568],[375,667],[390,844],[430,932]]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
     const layout=await evaluate(`(async()=>{const card=document.querySelector('#morning-step-card'),content=document.querySelector('#home-content');card.scrollIntoView({block:'end'});await new Promise(requestAnimationFrame);const r=card.getBoundingClientRect(),bottom=Math.min(...['#home-search','#dock'].map(s=>document.querySelector(s).getBoundingClientRect().top));return {width:innerWidth,contentTop:content.getBoundingClientRect().top,statusBottom:document.querySelector('.statusbar').getBoundingClientRect().bottom,overflow:content.scrollWidth>content.clientWidth,cardBottom:r.bottom,reservedTop:bottom,scrollable:getComputedStyle(content).overflowY}})()`);
     assert.equal(layout.overflow,false,JSON.stringify(layout));assert.equal(layout.scrollable,'auto');assert.ok(layout.contentTop>=layout.statusBottom,JSON.stringify(layout));assert.ok(layout.cardBottom<=layout.reservedTop+1,JSON.stringify(layout));
     for(const app of ['facetime','youtube']){const accessible=await evaluate(`(async()=>{const e=document.querySelector('#home-screen [data-app="${app}"]');e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`);assert.ok(accessible,`${branch}/${width}: ${app} covered`)}
    }
    await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('#morning-step-card').scrollIntoView({block:'end'})");
    const image=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(artifactDir,branch+'-320x568.png'),Buffer.from(image.data,'base64'));
    await click('#morning-step-next');await waitFor("drinkingNightState().stage==='morning'&&!drinkingNightState().pendingReply");
    assert.equal(await evaluate('currentScreen'),'home-screen');assert.equal(await evaluate("document.querySelector('#morning-step-card').hidden"),true);
    const morning=await evaluate("({branch:drinkingNightState().morningBranch,messages:CONFIG.chats.find(c=>c.id==='shownu').messages.filter(m=>m.id?.endsWith(':prompt')&&m.id.includes(':interactive:morning:')),notices:gameEventMemory.notifications.filter(n=>n.eventId.includes(':interactive:morning:')),clock:document.querySelector('#status-time').textContent})");
    assert.equal(morning.branch,branch);assert.equal(morning.messages.length,1);assert.equal(morning.notices.length,1);assert.equal(morning.clock,'9:12');assert.equal(morning.messages[0].day,'10월 24일 토요일');
    await cdp('Page.reload');await waitFor("typeof initializeGameOnce==='function'&&document.querySelector('#launch-continue')&&!document.querySelector('#launch-continue').disabled");await click('#launch-continue');await waitFor("gameInitializationStatus==='started'");
    await click('#lock-home-bar');for(const digit of '0618')await click(`[data-passcode-digit="${digit}"]`);await waitFor("phoneUnlocked&&currentScreen==='home-screen'");
    assert.equal(await evaluate("document.querySelector('#morning-step-card').hidden"),true);
    assert.equal(await evaluate("CONFIG.chats.find(c=>c.id==='shownu').messages.filter(m=>m.id?.endsWith(':prompt')&&m.id.includes(':interactive:morning:')).length"),1);
    await click('#home-screen [data-app="kakao"]');await click('#friends-list [data-chat="shownu"]');await click(`[data-stage-seven-option="${reply}"]`);await waitFor("drinkingNightState().stage==='complete'");
    results.push({branch,viewports:4,prompt:1,notification:1,refresh:'pass',reply:'pass'});
   }finally{await send('Target.disposeBrowserContext',{browserContextId})}
  }
  assert.deepEqual(errors,[],'Uncaught browser exceptions');console.log(JSON.stringify({browser:version.Browser,results,uncaughtErrors:errors,screenshots:artifactDir},null,2));
 }finally{ws.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
