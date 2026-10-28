// Optional real Chromium interaction checks. No production profile or save is used.
// Requires Playwright in the development environment, not in the static website.
// Run: node tests/photo-kakao-sharing.browser.cjs
// Optional: CHROME_EXECUTABLE and PHOTO_SHARE_SCREENSHOTS environment variables.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const executablePath=process.env.CHROME_EXECUTABLE;
const server=http.createServer((request,response)=>{
 const relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));
 if(!file.startsWith(root+path.sep)||!(file.endsWith('index.html')||file.startsWith(path.join(root,'assets')+path.sep))){response.writeHead(404).end();return}
 fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return}const ext=path.extname(file);response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg'})[ext]||'application/octet-stream');response.end(data)});
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
 const results=[];
 try{
 for(const width of [320,390,430]){
  const context=await browser.newContext({viewport:{width,height:width===320?568:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url);await page.locator('#launch-new').click();
  await page.evaluate(()=>{showPasscodeScreen();for(const digit of IPHONE_PASSCODE)enterPasscodeDigit(digit)});
  await page.locator('#home-screen.active').waitFor();
  await page.locator('[data-app="gallery"]').click();
  await page.locator('[data-photo-open="photo-9376"]').click();
  await page.locator('#photos-full-image').waitFor({state:'visible'});
  await page.locator('#photos-share').click();
  await page.locator('[data-photo-share-recipient="photo-share-v1:meal-minhyuk"]').click();
  await page.waitForFunction(()=>!document.querySelector('#photo-share-confirm').disabled);
  const bounds=await page.locator('.photo-share-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);assert.ok(bounds.y>=40);
  // Cancel is a real click, and must leave persistent stores unchanged.
  const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})),before);
  assert.ok(await page.locator('#photos-viewer').isVisible());
  await page.locator('#photos-share').click();await page.locator('#photo-share-cancel').click();
  await page.locator('#photos-share').click();await page.locator('[data-photo-share-recipient="photo-share-v1:meal-minhyuk"]').click();
  await page.waitForFunction(()=>!document.querySelector('#photo-share-confirm').disabled);
  if(process.env.PHOTO_SHARE_SCREENSHOTS){fs.mkdirSync(process.env.PHOTO_SHARE_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PHOTO_SHARE_SCREENSHOTS,`share-${width}.png`)})}
  await page.locator('#photo-share-confirm').click();
  assert.equal(await page.evaluate(()=>kakaoMessagePreview(latestKakaoMessage(CONFIG.chats.find(c=>c.id==='minhyuk')))),'사진');
  await page.locator('[data-photo-share-open-chat]').click();
  const photo=page.locator('[data-chat-photo="photo-share-v1:meal-minhyuk:player"]');await photo.waitFor();
  await page.waitForFunction(()=>document.querySelector('.kakao-photo-bubble img')?.naturalWidth>0);
  assert.equal(await page.locator('.kakao-photo-bubble').count(),1);
  const scroll=await page.locator('#chat-messages').evaluate(el=>el.scrollTop);
  await photo.click();await page.locator('#chat-photo-image').waitFor({state:'visible'});
  assert.ok(await page.locator('#chat-photo-error').isHidden());
  assert.ok(await page.evaluate(()=>Number(getComputedStyle(document.querySelector('.statusbar')).zIndex)>Number(getComputedStyle(document.querySelector('#chat-photo-viewer')).zIndex)));
  const full=await page.locator('#chat-photo-image').boundingBox();assert.ok(full.x>=0&&full.x+full.width<=width+1);
  const footer=await page.locator('#chat-photo-in-album').boundingBox();assert.ok(footer.y+footer.height<=(width===320?568:844));
  if(process.env.PHOTO_SHARE_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PHOTO_SHARE_SCREENSHOTS,`viewer-${width}.png`)});
  await page.locator('#chat-photo-in-album').click();await page.locator('#photos-full-image').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>stage13PhotoViewerId),'photo-9376');
  await page.locator('#photos-viewer-back').click();await photo.waitFor();
  await page.waitForFunction(expected=>Math.abs(document.querySelector('#chat-messages').scrollTop-expected)<2,scroll);
  await page.evaluate(()=>setKakaoTab('chats'));await page.locator('#room-back').click();
  await page.waitForFunction(()=>getGameEvent('photo-share-v1:meal-minhyuk:reply')?.status==='completed');
  const row=page.locator('[data-chat="minhyuk"]');assert.equal(await row.locator('.kakao-chat-preview').innerText(),'이거 보니까 또 배고프네 ㅋㅋ 맛있었어?');
  await page.reload();await page.locator('#launch-continue').click();
  await page.evaluate(()=>{showPasscodeScreen();for(const digit of IPHONE_PASSCODE)enterPasscodeDigit(digit)});
  await page.locator('#home-screen.active').waitFor();
  // Reload verification uses the public navigation functions, not save injection.
  await page.evaluate(()=>{showScreen('app-kakao');openChat('minhyuk')});
  assert.equal(await page.locator('.kakao-photo-bubble').count(),1);
  assert.equal(await page.evaluate(()=>CONFIG.chats.find(c=>c.id==='minhyuk').messages.filter(m=>m.id==='photo-share-v1:meal-minhyuk:reply').length),1);
  assert.equal(await page.evaluate(()=>photoShareEligibility('photo-share-v1:meal-minhyuk').allowed),false);
  assert.deepEqual(errors,[]);
  results.push({width,height:width===320?568:844,result:'pass',checks:['decoded asset','cancel no writes','confirmed share','photo bubble','full viewer','album round trip','scroll restored','photo preview','approved reply delivered','reply preview','reload dedup','no page errors']});
  await context.close();
 }
 console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
