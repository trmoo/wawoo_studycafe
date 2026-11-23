/*!
 * 붙여넣기 꾸러미 만들기 — 앱스 스크립트 편집기에 옮길 파일을 모은다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/pack.js   →   dist/appsscript/ (파일 10개 + 붙여넣는 순서.md)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist', 'appsscript');

const FILES = [
  { file: 'appsscript.json', kind: '설정',    note: '편집기 ⚙️ 프로젝트 설정에서 「appsscript.json 매니페스트 파일 표시」를 켜야 보입니다' },
  { file: 'Code.gs',         kind: '스크립트', note: '서버 — 시트 · 로그인 · 자리 고르기 · 출결 · 출석부 · 명단 · 시트 메뉴' },
  { file: 'index.html',      kind: 'HTML',    note: '학생 화면의 뼈대' },
  { file: 'teacher.html',    kind: 'HTML',    note: '교사 화면의 뼈대 (주소 끝에 ?page=teacher)' },
  { file: 'css.html',        kind: 'HTML',    note: '화면 모양' },
  { file: 'layout.html',     kind: 'HTML',    note: '좌석 114석의 자리' },
  { file: 'core.html',       kind: 'HTML',    note: '서버 부르기 · 기다림 안내 · 창 · 좌석배치도 그리기' },
  { file: 'student.html',    kind: 'HTML',    note: '학생 화면 — 로그인 · PIN · 자리 고르기' },
  { file: 'tapp.html',       kind: 'HTML',    note: '교사 화면 — 야자감독 · 출석부 · 담임교사' }
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let total = 0;
const rows = FILES.map((f) => {
  const raw = fs.readFileSync(path.join(SRC, f.file), 'utf8');
  fs.writeFileSync(path.join(OUT, f.file), raw, 'utf8');
  const kb = Buffer.byteLength(raw, 'utf8') / 1024;
  total += kb;
  return '| `' + f.file + '` | ' + f.kind + ' | ' + kb.toFixed(1) + 'KB | ' + f.note + ' |';
});

const guide = `# 앱스 스크립트에 옮기는 순서

© 2026 티쳐무 · 모든 권리 보유

1. 구글 드라이브에서 **스프레드시트를 새로 만든다.** 이름 예: 「2026 2학기 1·2학년 야자」.
2. 그 시트에서 **확장 프로그램 → Apps Script** 를 누른다.
3. 편집기 왼쪽 ⚙️ **프로젝트 설정** → 「\`appsscript.json\` 매니페스트 파일을 편집기에서 표시」를 **켠다.**
4. 아래 파일을 하나씩 만들고 내용을 **그대로 붙여넣는다.**
   - \`.gs\` 는 [＋] → 스크립트, \`.html\` 은 [＋] → HTML 로 만든다.
   - 파일 이름을 적을 때 **확장자는 빼고** 적는다 (\`index\`, \`css\`, \`tapp\` …). 편집기가 붙여 준다.
   - 처음 있는 \`Code.gs\` 는 내용만 바꿔 붙여넣으면 된다.
5. 저장(Ctrl+S)하고 **스프레드시트로 돌아가 새로 고침**한다. 위쪽에 **[자습실]** 메뉴가 생긴다.
6. 메뉴 → **① 시트 준비하기** 를 한 번 실행한다. (권한 승인 창이 뜨면 허용)
7. 이어서 뜨는 창에 **교사용 비밀번호**(6~30자)를 두 번 넣는다. 코드에는 남지 않고 해시로만 저장된다.
   건너뛰었거나 바꾸려면 메뉴 → **② 교사 비밀번호 정하기 · 바꾸기**. 정하기 전에는 교사 화면에 아무도 들어가지 못한다.
8. 편집기에서 **배포 → 새 배포 → 유형 「웹 앱」**
   - 실행 대상: **나**
   - 액세스 권한: **모든 사용자** (학생이 구글 로그인 없이 들어올 수 있게)
   - 나온 주소를 학생에게 알려 준다. 교사 화면은 그 주소 끝에 \`?page=teacher\`.
   - 메뉴 **웹앱 주소 보기** 로 언제든 다시 볼 수 있다.
9. 나중에 코드를 고쳤으면 **배포 → 배포 관리 → 연필(수정) → 버전 「새 버전」 → 배포**.
   새 배포를 만들면 **주소가 바뀌니** 반드시 「수정」으로 할 것.

⚠ 편집기의 ▶(실행) 단추로 실행할 것은 **setupSheets** 하나뿐이다. 첫 함수(include)가 골라진 채로 누르면
「include 는 화면을 만들 때 쓰는 함수입니다…」 라는 안내가 뜬다 — 앱의 결함이 아니다.

## 명단 넣는 세 가지 방법

- 담임 선생님이 교사 화면 **🧑‍🏫 담임교사** 탭에서 한 명씩 넣거나 **📋 여러 명 한꺼번에 붙여넣기** (출석부 한글 표의 줄을 그대로 복사해도 된다).
- 시트 **「명단」** 에 학년 · 반 · 번호 · 이름 · 월 · 화 · 목 · 금(신청한 요일에 O 또는 1) 을 직접 붙여 넣고
  메뉴 **③ 시트에 붙여 넣은 명단 정리하기** — 아이디 · 학번이 저절로 채워진다.

| 파일 | 종류 | 크기 | 하는 일 |
|---|---|---|---|
${rows.join('\n')}

합계 약 ${total.toFixed(0)}KB.

## 학생에게 알려 줄 것 (3줄)

1. 주소를 열고 **학번 · 이름** 을 넣습니다. 처음이면 PIN 칸을 비우고 들어가 **PIN 4자리**를 정합니다.
2. 야자를 신청한 날 **${'16:50~21:30'}** 에 빈자리를 눌러 오늘 앉을 자리를 고릅니다. 자리는 하루 한 번만 바꿀 수 있습니다.
3. 화면이 느려도 **새로고침하지 말고** 기다립니다. PIN 을 잊으면 감독 · 담임 선생님께 초기화를 부탁합니다.
`;
fs.writeFileSync(path.join(OUT, '붙여넣는 순서.md'), guide, 'utf8');
console.log('만들었습니다 → dist/appsscript/  (파일 ' + FILES.length + '개, 약 ' + total.toFixed(0) + 'KB)');
