const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

test('Instagram profile uses aligned stats/name layout and stable selected-tab underline', () => {
  assert.match(html, /\.instagram-app \.ig-profile-top\{display:grid;grid-template-columns:clamp\(/);
  assert.match(html, /\.instagram-app \.ig-profile-main\{min-width:0;grid-column:2;grid-row:1\}/);
  assert.match(html, /<div class="ig-profile-top">\$\{igAvatar\(account\)\}<div class="ig-profile-main"><div class="ig-profile-stats">[\s\S]*?<\/div><\/div><\/div><div class="ig-profile-display">\$\{escapeHtml\(title\)\}<\/div>/);
  assert.match(html, /account\.note\?`<div class="ig-profile-bio">/);
  assert.match(html, /account\.bioLink\?`<button class="ig-profile-link"/);
  assert.match(html, /\.instagram-app \.ig-profile-display\{display:block;max-width:100%;margin:12px 0 0;[^}]*overflow-wrap:anywhere/);
  assert.match(html, /\.instagram-app \.ig-profile-link\{display:flex;max-width:100%;[^}]*overflow-wrap:anywhere/);
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
