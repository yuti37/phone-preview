const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('Instagram profile uses aligned stats/name layout and stable selected-tab underline', () => {
  assert.match(html, /\.instagram-app \.ig-profile-top\{display:grid;grid-template-columns:clamp\(/);
  assert.match(html, /\.instagram-app \.ig-profile-main\{display:contents\}/);
  assert.match(html, /\.instagram-app \.ig-profile-tabs button\.selected:after\{content:""/);
  assert.match(html, /const scrollTop=\$\('#ig-app-content'\)\.scrollTop;igProfileTab=profileTab\.dataset\.igProfileTab;renderInstagram\(\);\$\('#ig-app-content'\)\.scrollTop=scrollTop/);
});

test('Instagram post detail keeps source-provided interaction data and contains full-ratio photos', () => {
  assert.match(html, /function renderIgPost\(\)[\s\S]*?igPostArt\(post,post\.place\|\|''\)/);
  assert.match(html, /function igPostActions?\(/);
  assert.match(html, /function igPostActions\(post\)[\s\S]*?data-ig-like=/);
  assert.match(html, /\.instagram-app \.ig-detail-post \.ig-media-button>\.ig-art\.ig-photo-art\{background-size:contain/);
  assert.match(html, /igLikeLabel\(post\.commentCount\?\?post\.comments\.length\)/);
  assert.match(html, /data-ig-form="comment"/);
});

test('Instagram bottom profile tab reuses the signed-in account avatar and active state', () => {
  assert.match(html, /profileNav\.innerHTML=igAvatar\(igAccount\("hyungwon"\),"ig-nav-avatar"\)/);
  assert.match(html, /button\.active \.ig-account-avatar\.ig-nav-avatar\{border-color:#17171a\}/);
  assert.match(html, /function igAvatar\(account,extra=''\)\{return `<span/);
  assert.match(html, /account\.avatar\?`<img src="\$\{escapeHtml\(account\.avatar\)\}" alt="">`:escapeHtml\(account\.initial\|\|account\.name\.slice\(0,1\)\)/);
  assert.ok(fs.existsSync(path.resolve(__dirname, '../assets/hyungwon-ig-avatar.png')));
  assert.match(html, /data-ig-nav="profile" aria-label="프로필"/);
  assert.match(html, /if\(\['home','search','reels','activity','profile'\]\.includes\(target\)\)[\s\S]*?igNavigate\(target,false\)/);
});
