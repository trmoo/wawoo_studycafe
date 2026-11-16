/*!
 * 미리보기 만들기 — 배포하지 않고 브라우저에서 확인한다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/preview.js   →   dist/preview.html (학생) · dist/preview-teacher.html (교사)
 *
 * 가짜 시트 위에서 진짜 Code.gs 가 돌아가므로 로그인 · 자리 고르기 · 출결 · 명단 고치기를 그대로 확인할 수 있다.
 * 시계는 2026-11-16(월) 18:10 에서 출발해 흐른다 (자리 고르기가 열려 있는 시각).
 * 학생 화면과 교사 화면은 저마다 따로 가짜 시트를 깐다 — 한쪽에서 고친 것이 다른 쪽에 보이지 않는다.
 * 콘솔에서 sheetDump('기록') 으로 시트에 들어간 값을 표로 볼 수 있다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(p, 'utf8');

const fakeGas = read(path.join(ROOT, 'tools', 'fake-gas.js'));
const seed = read(path.join(ROOT, 'tools', 'seed.js'));
const codeGs = read(path.join(SRC, 'Code.gs'));
const NAMES = ['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'Utilities',
               'DriveApp', 'DocumentApp', 'ScriptApp', 'ContentService', 'HtmlService'];
const START = '2026-11-16T18:10:00+09:00';
const DEMO_PW = 'demo1234';     // 체험 · 미리보기 전용 교사 비밀번호 (실제 학교 비밀번호가 아니다)

function setup(kind) {
  return '<script>\n' + fakeGas + '\n</script>\n<script>\n' + seed + '\n</script>\n<script>\n' +
    '/* 가짜 앱스 스크립트 환경을 전역에 깔아 둔다 (Code.gs 가 이 이름들을 쓴다) */\n' +
    'var _FAKE = FAKEGAS.makeGas({ url: "https:\\/\\/script.google.com\\/macros\\/s\\/PREVIEW\\/exec" });\n' +
    NAMES.map((n) => 'var ' + n + ' = _FAKE.' + n + ';').join('\n') + '\n</script>\n' +
    '<script>\n/* ── 여기부터 진짜 서버 코드(src/Code.gs) ── */\n' + codeGs + '\n</script>\n' +
    '<script>\n' +
    'var _API = {};\n' +
    codeGs.match(/^function\s+([A-Za-z_$][\w$]*)/gm).map((m) => m.replace('function ', ''))
      .map((n) => '_API.' + n + ' = ' + n + ';').join('\n') + '\n' +
    'var _T0 = Date.now(), _FIX = Date.parse("' + START + '");\n' +
    'CLOCK.now = function () { return new Date(_FIX + (Date.now() - _T0)); };\n' +
    'setupSheets();\n' +
    'setTeacherPw_("' + DEMO_PW + '");\n' +
    'SEED.plant(_API, _FAKE);\n' +
    'var BOOT_DATA = boot_("' + (kind === 'teacher' ? 'teacher' : 'index') + '"); BOOT_DATA.preview = true;\n' +
    '/** 화면이 부르는 통로 — google.script.run 대신 이것을 쓴다 */\n' +
    'function FAKE_SERVER(fn, args) {\n' +
    '  if (!/^api[A-Z]/.test(fn) || typeof window[fn] !== "function") return { ok: false, msg: "없는 함수: " + fn };\n' +
    '  return window[fn].apply(null, args);\n' +
    '}\n' +
    'function sheetDump(name) {\n' +
    '  var sh = _FAKE.sheets[name];\n' +
    '  if (!sh) { console.log("시트 목록:", Object.keys(_FAKE.sheets)); return; }\n' +
    '  console.table(sh.dump()); return sh.dump();\n' +
    '}\n' +
    '</script>\n';
}

/** 화면마다 끼워 넣는 부품 (차례가 중요하다 — src 의 include 차례와 같다) */
const PARTS = {
  student: { file: 'index.html', includes: ['css', 'layout', 'core', 'student'] },
  teacher: { file: 'teacher.html', includes: ['css', 'layout', 'core', 'tapp'] }
};

function build(kind, opts) {
  const part = PARTS[kind];
  let html = read(path.join(SRC, part.file));
  part.includes.forEach((name) => {
    const body = read(path.join(SRC, name + '.html'));
    const rx = new RegExp("<\\?!=\\s*include\\('" + name + "'\\);?\\s*\\?>", 'g');
    if (!rx.test(html)) throw new Error(part.file + " 에 include('" + name + "') 가 없습니다.");
    html = html.replace(rx, () => body);
  });
  const bootTag = '<script>var BOOT_DATA = <?!= BOOT ?>;</script>';
  if (html.indexOf(bootTag) < 0) throw new Error(part.file + ' 에 BOOT_DATA 자리가 없습니다.');
  html = html.replace(bootTag, () => setup(kind));
  const left = html.match(/<\?!?=?[\s\S]{0,40}?\?>/g);
  if (left) throw new Error('바꾸지 못한 스크립틀릿이 있습니다: ' + left.join(' , '));
  html = html.replace('<footer>', () =>
    '<div style="background:#fff5df;border-top:2px solid #d9a12a;padding:9px 14px;font:14px/1.6 sans-serif;color:#8a5a00;text-align:center">' +
    opts.notice + '</div>\n<footer>');
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, html, 'utf8');
  return { out: opts.out, kb: Math.round(Buffer.byteLength(html, 'utf8') / 1024) };
}

module.exports = { build, DIST, DEMO_PW };

if (require.main === module) {
  const N = '<b>미리보기</b> — 배포 전 확인용입니다. 학생 이름은 모두 지어낸 것이고, 저장은 이 창 안의 가짜 시트에만 됩니다(창을 닫으면 사라짐). ' +
    '시계는 2026-11-16(월) 18:10 에서 출발합니다. ';
  const a = build('student', { out: path.join(DIST, 'preview.html'),
    notice: N + '학생 <b>10105 김하랑 / PIN 3141</b> · 처음 들어오는 학생 <b>20307 이서온</b> · <a href="preview-teacher.html">교사 화면</a>' });
  const b = build('teacher', { out: path.join(DIST, 'preview-teacher.html'),
    notice: N + '교사 이름은 아무 한글 이름 · 체험용 비밀번호 <b>' + DEMO_PW + '</b> ·<a href="preview.html">학생 화면</a>' });
  console.log('만들었습니다 → dist/preview.html (' + a.kb + 'KB) · dist/preview-teacher.html (' + b.kb + 'KB)');
}
