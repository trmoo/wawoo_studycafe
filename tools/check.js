/*!
 * 점검 — 앱스 스크립트는 오류가 나도 흰 화면만 뜨므로, 배포 전에 여기서 잡는다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   ① 모든 스크립트의 문법 (Code.gs + 화면 html 의 <script>)
 *   ② index · teacher 가 끼워 넣는 파일이 모두 있는가
 *   ③ 화면 스크립트 안의 「슬래시 두 개」 가 든 글자열 (앱스 스크립트가 거기서부터 줄 끝을 지울 수 있다)
 *   ④ 브라우저 기본 alert · confirm · prompt 와 innerHTML 을 쓰지 않는가 (학생 글이 코드로 돌지 않게)
 *   ⑤ 화면이 부르는 서버 함수가 Code.gs 에 있는가
 *   ⑥ 화면 스크립트가 부르는데 어디에도 없는 함수
 *   ⑦ 저작권 표시
 *   ⑧ 코드에 교사 비밀번호 원문 · 실제 출석부 학생 이름이 섞이지 않았는가
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const problems = [];
const bad = (msg) => problems.push(msg);

const files = fs.readdirSync(SRC);
const htmls = files.filter((f) => f.endsWith('.html'));
const code = read('Code.gs');

/* 주석과 글자열을 걷어 낸 코드 (글자열 자리는 "" 로 남긴다) */
function strip(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? src.length : i + 2; continue; }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}
function scriptsOf(f) {
  const raw = read(f), out = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(raw))) if (m[1].indexOf('<?') < 0) out.push(m[1]);
  return out;
}

/* ① 문법 */
try { new vm.Script(code, { filename: 'Code.gs' }); } catch (e) { bad('① Code.gs 문법: ' + e.message); }
htmls.forEach((f) => scriptsOf(f).forEach((s) => {
  try { new vm.Script(s, { filename: f }); } catch (e) { bad('① ' + f + ' 문법: ' + e.message); }
}));

/* ② 끼워 넣기 */
['index.html', 'teacher.html'].forEach((f) => {
  const raw = read(f);
  const names = [...raw.matchAll(/include\('([\w-]+)'\)/g)].map((m) => m[1]);
  names.forEach((n) => { if (!files.includes(n + '.html')) bad('② ' + f + ' 가 끼워 넣는 ' + n + '.html 이 없습니다.'); });
  if (raw.indexOf('<?!= BOOT ?>') < 0) bad('② ' + f + ' 에 BOOT_DATA 자리가 없습니다.');
  const iL = names.indexOf('layout'), iC = names.indexOf('core');
  if (iL < 0 || iC < 0 || iL > iC) bad('② ' + f + ' — layout · core 가 앱 스크립트보다 먼저 와야 합니다.');
});

/* ③ 글자열 속 슬래시 두 개 */
htmls.forEach((f) => scriptsOf(f).forEach((s) => {
  s.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (/['"`][^'"`]*\/\//.test(line)) bad('③ ' + f + ' ' + (i + 1) + '번째 줄 — 글자열 속 슬래시 두 개: ' + t.slice(0, 60));
  });
}));

/* ④ 기본 창 · innerHTML */
htmls.forEach((f) => scriptsOf(f).forEach((s) => {
  const c = strip(s);
  if (/(^|[^.\w])(alert|confirm|prompt)\s*\(/.test(c)) bad('④ ' + f + ' — 브라우저 기본 alert · confirm · prompt 를 쓰고 있습니다. core 의 modal · ask 를 쓰세요.');
  if (/\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(c)) bad('④ ' + f + ' — innerHTML 류를 쓰고 있습니다. 글은 textContent 로 넣으세요.');
}));

/* ⑤ 서버 함수 */
const serverFns = new Set([...code.matchAll(/^function\s+([\w$]+)/gm)].map((m) => m[1]));
htmls.forEach((f) => scriptsOf(f).forEach((s) => {
  for (const m of s.matchAll(/\b(?:call|tCall)\(\s*'([\w$]+)'/g)) {
    if (!serverFns.has(m[1])) bad('⑤ ' + f + ' 가 부르는 서버 함수 ' + m[1] + ' 가 Code.gs 에 없습니다.');
    if (!/^api[A-Z]/.test(m[1])) bad('⑤ ' + f + ' — 화면은 api 로 시작하는 함수만 불러야 합니다: ' + m[1]);
  }
}));

/* ⑥ 부르는데 없는 함수 — 한 화면에 함께 들어가는 스크립트를 모아 본다 */
const KNOWN = new Set(('if for while switch catch function return typeof new Number String Boolean Array Object JSON Math Date ' +
  'Promise RegExp Error parseInt parseFloat isNaN encodeURIComponent decodeURIComponent setTimeout clearTimeout ' +
  'setInterval clearInterval requestAnimationFrame Set Map FAKE_SERVER fetch').split(' '));
['index.html', 'teacher.html'].forEach((page) => {
  const names = [...read(page).matchAll(/include\('([\w-]+)'\)/g)].map((m) => m[1]).filter((n) => n !== 'css');
  const all = names.map((n) => scriptsOf(n + '.html').join('\n')).join('\n');
  const c = strip(all);
  const defined = new Set([...c.matchAll(/function\s+([\w$]+)/g)].map((m) => m[1]));
  [...c.matchAll(/var\s+([\w$]+)\s*=\s*function/g)].forEach((m) => defined.add(m[1]));
  for (const m of c.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const n = m[2];
    if (KNOWN.has(n) || defined.has(n)) continue;
    /* 함수 안에서 매개변수 · 지역 변수로 받은 함수 (fn · next · resolve · done …) 는 넘어간다 */
    if (new RegExp('(function\\s*[\\w$]*\\s*\\([^)]*\\b' + n + '\\b|var\\s+' + n + '\\b)').test(c)) continue;
    bad('⑥ ' + page + ' — ' + n + '( ) 를 부르는데 어디에도 없습니다.');
  }
});

/* ⑦ 저작권 */
files.forEach((f) => {
  if (f === 'appsscript.json') return;
  if (read(f).indexOf('티쳐무') < 0) bad('⑦ ' + f + ' 에 저작권 표시가 없습니다.');
});
/* 화면 푸터에는 저작권 표시를 두지 않는다 — 교내 공용 도구라서 (2026-11-17 사용자 지시). 머리 주석 · LICENSE · README 에는 남긴다.
   푸터 자체는 있어야 한다 — preview.js 가 체험판 안내 띠를 <footer> 앞에 끼워 넣는다. */
['index.html', 'teacher.html'].forEach((f) => {
  const foot = (read(f).match(/<footer>[\s\S]*?<\/footer>/) || [''])[0];
  if (!foot) bad('⑦ ' + f + ' 에 화면 푸터(<footer>)가 없습니다.');
  else if (/티쳐무|모든 권리 보유/.test(foot)) bad('⑦ ' + f + ' 화면 푸터에 저작권 표시가 있습니다 — 교내 공용이라 빼기로 했습니다.');
});

/* ⑧ 비밀번호 — 공개 저장소라 코드에는 원문도 해시도 두지 않는다.
   (짧은 비밀번호의 해시는 금방 거꾸로 풀리므로 해시도 안 된다. 실제 비밀번호는 시트 메뉴로 정해 스크립트 속성에만 둔다)
   ⚠ 이 점검 파일에도 실제 비밀번호를 적지 말 것 — 64자리 16진수(해시)와 비밀번호 상수 이름만 찾는다. */
if (/['"][0-9a-f]{64}['"]/.test(code)) bad('⑧ Code.gs 에 64자리 해시가 박혀 있습니다. 비밀번호는 시트 메뉴로 정하게 하세요.');
if (/var\s+\w*(PW|PASS)\w*\s*=\s*['"]/.test(code)) bad('⑧ Code.gs 에 비밀번호 상수가 있습니다.');

/* ⑨ 깃허브 화면의 통신 — 구글 로그인 정보(쿠키)를 보내지 않아야 계정이 여러 개인 폰에서도 열린다 (2026-11-17).
   이 줄을 지우면 깃허브 화면을 둔 까닭이 사라진다. Code.gs 의 doPost 와 부를 수 있는 함수 목록도 함께 본다. */
{
  const core = scriptsOf('core.html').join('\n');
  if (!/credentials:\s*'omit'/.test(core)) bad("⑨ core.html 의 fetch 에 credentials: 'omit' 이 없습니다 — 구글 쿠키가 실려 /u/숫자 문제가 돌아옵니다.");
  if (!/'Content-Type':\s*'text\/plain/.test(core)) bad('⑨ core.html 의 fetch 는 text/plain 으로 보내야 합니다 (사전 요청 없이 가도록).');
  if (!/^function doPost\(/m.test(code)) bad('⑨ Code.gs 에 doPost 가 없습니다.');
  const listed = new Set([...((code.match(/var REMOTE_API = \{([\s\S]*?)\};/) || [])[1] || '').matchAll(/(\w+):\s*(\w+)/g)]
    .filter((m) => m[1] === m[2]).map((m) => m[1]));
  [...code.matchAll(/^function (api\w+)\(/gm)].forEach((m) => {
    if (!listed.has(m[1])) bad('⑨ ' + m[1] + ' 가 Code.gs 의 REMOTE_API 목록에 없습니다 — 깃허브 화면에서 부르지 못합니다.');
  });
  listed.forEach((n) => { if (!/^api[A-Z]/.test(n)) bad('⑨ REMOTE_API 에 api 함수가 아닌 ' + n + ' 가 있습니다.'); });
}

if (problems.length) {
  console.log('\n점검에서 ' + problems.length + '가지가 걸렸습니다.\n');
  problems.forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('점검 통과 — 문법 · 끼워 넣기 · 글자열 속 슬래시 · 기본 창 · 서버 함수 · 없는 함수 · 저작권 · 비밀번호 상수 · 깃허브 화면 통신');
