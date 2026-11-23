/*!
 * 깃허브 Pages 체험 페이지 만들기 — 배포 없이 누구나 눌러 볼 수 있는 학생 · 교사 체험판
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/site.js   →   dist/site/index.html (실제 앱 바로가기 — site/index.html 을 그대로 옮긴다)
 *                            · app/index.html · app/teacher.html (깃허브에서 띄우는 실제 앱 — 웹 앱 doPost 를 부른다)
 *                            · demo.html (체험 안내) · student.html (학생 체험) · teacher.html (교사 체험)
 *
 * 체험판은 미리보기와 같다 — 브라우저 안의 가짜 시트 위에서 진짜 Code.gs 가 돈다.
 * 아무 데도 보내거나 저장하지 않고, 학생 이름은 모두 지어낸 것이다.
 * 교사 체험 비밀번호(DEMO_PW)는 체험판 전용이다. 실제 학교의 교사 비밀번호는 코드 어디에도 없다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { build, DIST, DEMO_PW } = require('./preview.js');

const OUT = path.join(DIST, 'site');
const REPO = 'https://github.com/trmoo/wawoo_studycafe';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const N = '<b>체험판</b> — 이 페이지는 브라우저 안의 가짜 시트에서 돌아갑니다. 아무 데도 보내거나 저장하지 않고, 창을 닫으면 사라집니다. ' +
  '학생 이름은 모두 지어낸 것입니다. 시계는 2026-11-16(월) 18:10 에서 출발해 자리 고르기가 열려 있습니다. ';
const a = build('student', { out: path.join(OUT, 'student.html'),
  notice: N + '학생 <b>10105 김하랑 / PIN 3141</b> · 처음 들어오는 학생 <b>20307 이서온</b>(PIN 을 새로 정함) · ' +
    '월요일을 신청하지 않은 학생 <b>10336 박도담 / PIN 2718</b>(학부모 동의 체크) · 📌 지정석 학생 <b>10237 최다온 / PIN 1618</b> · ' +
    '야자 명단에 없는 학생 <b>10238</b> + 아무 이름 · ' +
    '<a href="teacher.html">교사 체험</a> · <a href="demo.html">체험 안내</a>' });
const b = build('teacher', { out: path.join(OUT, 'teacher.html'),
  notice: N + '교사 이름은 아무 한글 이름(예: 김감독) · 체험용 비밀번호 <b>' + DEMO_PW + '</b> · ' +
    '<a href="student.html">학생 체험</a> · <a href="demo.html">체험 안내</a>' });

const demo = `<!DOCTYPE html>
<!--
  1·2학년 자습실 좌석배치도 — 체험 안내
  © 2026 티쳐무 · 모든 권리 보유 (오픈소스 라이선스 없음)
-->
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>1·2학년 자습실 좌석배치도 — 체험</title>
<style>
  :root { --bg:#eef1f8; --ink:#1f2937; --muted:#6b7280; --brand:#2b5ad9; --line:#dfe4ee; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.65 'Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 22px 14px 40px; }
  h1 { text-align:center; font-size: 30px; margin: 10px 0 4px; }
  .lead { text-align:center; color: var(--muted); margin: 0 0 22px; }
  .cards { display:grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .card { background:#fff; border-radius: 18px; padding: 18px 20px; box-shadow: 0 2px 10px rgba(30,50,90,.06); }
  .card h2 { margin: 0 0 6px; font-size: 22px; }
  .go { display:block; text-align:center; background: var(--brand); color:#fff; text-decoration:none; font-weight:800; font-size: 19px;
        border-radius: 12px; padding: 14px; margin: 12px 0 8px; }
  .go:hover { background:#1d3f9e; }
  .acc { background:#f5f7fb; border-radius: 10px; padding: 8px 12px; font-size: 15px; }
  ul { padding-left: 20px; margin: 6px 0; }
  .card.full { margin-top: 14px; }
  .note { color: var(--muted); font-size: 14px; }
  code { background:#f1f3f8; padding: 1px 6px; border-radius: 6px; }
  footer { text-align:center; color: var(--muted); font-size: 13px; margin-top: 26px; }
  @media (max-width: 680px) { .cards { grid-template-columns: 1fr; } h1 { font-size: 23px; } .wrap { padding: 14px 10px 30px; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>★ 1·2학년 자습실 좌석배치도 ★</h1>
  <p class="lead">야간 자율학습 — 학생은 휴대폰으로 오늘 자리를 고르고, 선생님은 그 배치도로 1·2교시 출결과 출석부를 관리합니다.</p>

  <div class="cards">
    <div class="card">
      <h2>🧑‍🎓 학생 화면 체험</h2>
      <a class="go" href="student.html">학생으로 들어가 보기 →</a>
      <div class="acc">학번 <b>10105</b> · 이름 <b>김하랑</b> · PIN <b>3141</b><br>
        처음 들어오는 학생: <b>20307</b> · <b>이서온</b> (PIN 칸을 비우고 들어가면 PIN 을 새로 정합니다)<br>
        월요일을 신청하지 않은 학생: <b>10336</b> · <b>박도담</b> · PIN <b>2718</b><br>
        📌 지정석(40번)이 있는 학생: <b>10237</b> · <b>최다온</b> · PIN <b>1618</b><br>
        야자 명단에 없는 학생: <b>10238</b> · 아무 한글 이름 (처음 등록 → PIN 정하기)</div>
      <ul>
        <li>빈자리를 누르면 오늘 자리로 정합니다. 하루 한 번만 바꿀 수 있습니다.</li>
        <li>신청하지 않은 날이나 야자를 신청하지 않은 학생도 <b>「학부모 동의」 를 체크</b>하면 자리를 고를 수 있습니다 — 신청한 학생보다 늦은 <b>17:30부터</b>.</li>
        <li>지정석이 있는 학생은 신청한 날 자기 자리(📌)를 눌러 「앉았어요」 를 알립니다.</li>
        <li>다른 학생은 <b>홍*동</b> 처럼 가린 이름만 보이고, 학번 · 학년은 보이지 않습니다.</li>
        <li>휴대폰에서는 <b>🔍 크게 보기</b>(옆으로 밀기) · <b>🗺 한눈에 보기</b> 를 고를 수 있습니다.</li>
      </ul>
    </div>
    <div class="card">
      <h2>🧑‍🏫 교사 화면 체험</h2>
      <a class="go" href="teacher.html">교사로 들어가 보기 →</a>
      <div class="acc">이름 <b>아무 한글 이름</b>(예: 김감독) · 체험용 비밀번호 <b>${DEMO_PW}</b></div>
      <ul>
        <li><b>🪑 야자감독</b> — 학번 · 이름이 보이는 배치도. 1학년 파란 · 2학년 빨간 테두리. 1·2교시 출결 · 메모 · PIN 초기화.</li>
        <li><b>📋 출석부</b> — 종이 출석부와 같은 꼴로 한 주씩 보고 인쇄. 「◀ 지난주」 에 지어낸 기록이 있습니다.</li>
        <li><b>🙋 미신청 참여</b> — 신청하지 않은 날 학부모 동의를 체크하고 자리를 고른 학생은 배치도에 「미신청」, 출석부에 ◎ 로 보입니다.</li>
        <li><b>🧑‍🏫 담임교사</b> — 반을 골라 야자 명단 추가 · 수정 · 삭제 (월 화 목 금 가운데 이틀 이상) · 우리 반 출석 기록(한 달).</li>
        <li><b>📌 지정석</b> — 배치도에서 자리를 눌러 학생에게 고정 자리를 주거나 풉니다. 그 학생이 신청한 요일에는 다른 학생이 앉을 수 없고, 야자감독 화면에 점선(아직 안 앉음)으로 보입니다.</li>
      </ul>
    </div>
  </div>

  <div class="card full">
    <h2>체험판에 대하여</h2>
    <ul>
      <li>체험판은 <b>브라우저 안의 가짜 시트</b>에서 진짜 서버 코드가 돌아갑니다. 아무 데도 저장되지 않고 창을 닫으면 처음으로 돌아갑니다.</li>
      <li>학생 체험과 교사 체험은 <b>서로 다른 가짜 시트</b>를 씁니다 — 학생 체험에서 고른 자리가 교사 체험에 보이지 않습니다.</li>
      <li>학생 이름은 모두 지어낸 것입니다. 시계는 2026-11-16(월) 18:10 에서 출발합니다(자리 고르기 시간 16:50~21:30 안).</li>
      <li>체험용 비밀번호는 체험판에서만 듣습니다. 실제로 쓰는 앱은 학교마다 선생님이 비밀번호를 정합니다.</li>
    </ul>
    <h2>우리 학교에서 쓰려면</h2>
    <p>구글 스프레드시트 → 확장 프로그램 → Apps Script 에 코드를 붙여 넣고 웹 앱으로 배포합니다.
      순서는 <a href="${REPO}#설치">저장소 README 「설치」</a> 를 보세요. 학생 정보는 배포한 선생님의 스프레드시트에만 쌓입니다.</p>
    <p class="note">저장소: <a href="${REPO}">${REPO.replace('https:' + '//', '')}</a></p>
  </div>

  <p class="note" style="text-align:center"><a href="./">← 첫 화면(실제 앱 바로가기)</a></p>
  <footer>1·2학년 자습실 좌석배치도 · 체험판</footer>
</div>
</body>
</html>
`;
/* 체험판 안내 화면도 푸터에 저작권 표시를 두지 않는다 (2026-11-23 사용자 지시). 머리 주석 · LICENSE · README 에는 남긴다. */
const demoFoot = (demo.match(/<footer>[\s\S]*?<\/footer>/) || [''])[0];
if (!demoFoot || /티쳐무|모든 권리 보유/.test(demoFoot)) {
  console.error('✖ demo.html — 화면 푸터가 없거나 저작권 표시가 있습니다.');
  process.exit(1);
}
fs.writeFileSync(path.join(OUT, 'demo.html'), demo, 'utf8');

/* 첫 화면 = 실제 앱 바로가기 + 깃허브에서 띄우는 실제 앱 화면(app/).
   배포 주소는 site/index.html 맨 아래의 rawStudent 링크 한 곳에서 읽는다. 주소 꼴이나 시각이 어긋나면 만들지 않는다. */
const launch = fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.gs'), 'utf8');
const EXEC = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/;
function fail(msg) { console.error('✖ site/index.html — ' + msg); process.exit(1); }
const href = (id) => (launch.match(new RegExp('id="' + id + '" href="([^"]+)"')) || [])[1];
const raw = href('rawStudent');
if (!raw || !EXEC.test(raw)) fail('rawStudent 링크가 앱스 스크립트 배포 주소(…/exec) 꼴이 아닙니다: ' + raw);
if (href('rawTeacher') !== raw + '?page=teacher') fail('rawTeacher 링크는 학생 주소 + ?page=teacher 여야 합니다: ' + href('rawTeacher'));
if (href('goStudent') !== 'app/') fail('학생 단추(goStudent)는 app/ 으로 가야 합니다: ' + href('goStudent'));
if (href('goTeacher') !== 'app/teacher.html') fail('교사 단추(goTeacher)는 app/teacher.html 로 가야 합니다: ' + href('goTeacher'));
['OPEN_FROM', 'OPEN_FROM_EXTRA', 'OPEN_TO'].forEach((k) => {
  const v = (code.match(new RegExp('var ' + k + " = '([0-9:]+)'")) || [])[1];
  if (!v) fail('Code.gs 에서 ' + k + ' 를 찾지 못했습니다.');
  if (launch.indexOf(v) < 0) fail('Code.gs 의 ' + k + ' (' + v + ') 가 안내 글에 없습니다 — 시각을 맞춰 주세요.');
});
/* 자리 바꾸기 횟수도 안내 글과 맞아야 한다 (2026-11-20 3번 → 한 번으로 바꾸며 더했다) */
const maxCh = Number((code.match(/var MAX_CHANGES = (\d+);/) || [])[1]);
if (!maxCh) fail('Code.gs 에서 MAX_CHANGES 를 찾지 못했습니다.');
const chText = '하루 ' + (maxCh === 1 ? '한 번' : maxCh + '번');
if (launch.replace(/<[^>]+>/g, '').indexOf(chText) < 0) fail('안내 글에 「' + chText + '」 이 없습니다 — Code.gs 의 MAX_CHANGES (' + maxCh + ') 와 맞춰 주세요.');
if (demo.replace(/<[^>]+>/g, '').indexOf(chText) < 0) fail('체험판 안내 글에 「' + chText + '」 이 없습니다 — Code.gs 의 MAX_CHANGES (' + maxCh + ') 와 맞춰 주세요.');
/* 첫 화면도 교내에서 함께 쓰는 곳이라 푸터에 저작권 표시를 두지 않는다 (2026-11-17 사용자 지시) */
const launchFoot = (launch.match(/<footer>[\s\S]*?<\/footer>/) || [''])[0];
if (!launchFoot) fail('화면 푸터(<footer>)가 없습니다.');
if (/티쳐무|모든 권리 보유/.test(launchFoot)) fail('첫 화면 푸터에 저작권 표시가 있습니다 — 교내 공용이라 빼기로 했습니다.');
fs.writeFileSync(path.join(OUT, 'index.html'), launch, 'utf8');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

/* 실제 앱 화면 — 화면 코드는 앱스 스크립트와 똑같고, 서버를 부르는 길만 fetch(doPost) 로 바뀐다 (core.html 의 REMOTE) */
const c = build('student', { out: path.join(OUT, 'app', 'index.html'), remote: raw });
const d = build('teacher', { out: path.join(OUT, 'app', 'teacher.html'), remote: raw });
console.log('만들었습니다 → dist/site/  (index 바로가기 · app 학생 ' + c.kb + 'KB · 교사 ' + d.kb + 'KB · demo 안내 · student ' +
  a.kb + 'KB · teacher ' + b.kb + 'KB)');
