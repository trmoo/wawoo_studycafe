/*!
 * 서버 시험 — 가짜 시트 위에서 진짜 Code.gs 를 돌린다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { createRequire } from 'module';
import { describe, test, ok, eq, deepEq } from './harness.mjs';
const require = createRequire(import.meta.url);
const { loadServer, freshServer, at, teacher, student, TEST_PW } = require('../tools/gas-load.js');

function rows(gas, name) { return gas.sheets[name].dump(); }
function dropCaches(gas) { Object.keys(gas.cache).forEach((k) => { if (k !== 'ss:' && !k.startsWith('ss:')) delete gas.cache[k]; }); }

describe('시트 준비', () => {
  test('시트 네 장과 머리글을 만든다', () => {
    const { api, gas } = freshServer();
    ['명단', '기록', '감독', '변경 기록'].forEach((n) => ok(gas.sheets[n], n + ' 시트가 있어야 합니다'));
    deepEq(rows(gas, '명단')[0], api.HEAD_ROSTER);
    deepEq(rows(gas, '기록')[0], api.HEAD_REC);
  });
  test('두 번 실행해도 머리글이 겹치지 않는다', () => {
    const { api, gas } = freshServer();
    api.setupSheets();
    eq(rows(gas, '명단').length, 1);
  });
  test('편집기에서 include 를 값 없이 부르면 한국어로 알려 준다', () => {
    const { api } = freshServer();
    let msg = '';
    try { api.include(); } catch (e) { msg = e.message; }
    ok(msg.indexOf('setupSheets') >= 0, msg);
  });
});

describe('시간 · 날짜 도구', () => {
  test('2026-11-16 은 월요일, 11-18 은 수요일', () => {
    const { api } = freshServer();
    eq(api.dayName_('2026-11-16'), '월');
    eq(api.dayName_('2026-11-18'), '수');
    eq(api.addDays_('2026-11-30', 1), '2026-12-01');
  });
  test('시트가 날짜 값으로 바꿔 놓아도 글자 날짜로 되돌린다', () => {
    const { api } = freshServer();
    eq(api.dateStr_(new Date(Date.parse('2026-11-16T00:00:00+09:00'))), '2026-11-16');
    eq(api.dateStr_("'2026-11-16"), '2026-11-16');
  });
  test('서버 시계는 컴퓨터 시간대와 상관없이 한국 시각', () => {
    const { api } = freshServer();
    at(api, '2026-11-16 23:59');
    eq(api.today_(), '2026-11-16');
    eq(api.hm_(), '23:59');
  });
  test('없는 날짜는 거른다', () => {
    const { api } = freshServer();
    ok(api.isDate_('2026-02-28'));
    ok(!api.isDate_('2026-02-30'));
    ok(!api.isDate_('2026-1-5'));
  });
});

describe('가린 이름 · 수식 막기', () => {
  test('홍길동 → 홍*동, 김수 → 김*, 남궁민수 → 남**수', () => {
    const { api } = freshServer();
    eq(api.mask_('홍길동'), '홍*동');
    eq(api.mask_('김수'), '김*');
    eq(api.mask_('남궁민수'), '남**수');
  });
  test('= + - @ 로 시작하는 글은 수식이 되지 않게 막는다', () => {
    const { api } = freshServer();
    eq(api.safeCell_('=IMPORTXML("x")', 100), "'=IMPORTXML(\"x\")");
    eq(api.safeCell_('-1+1', 100), "'-1+1");
    eq(api.unsafeCell_("'=1+1"), '=1+1');
  });
  test('제어 문자를 걷어 내고 길이를 자른다', () => {
    const { api } = freshServer();
    eq(api.safeCell_('a\u0000b\nc', 100), 'a b c');
    eq(api.safeCell_('가'.repeat(150), 100).length, 100);
  });
});

describe('교사 로그인', () => {
  test('정해 둔 비밀번호로 들어간다', () => {
    const { api } = freshServer();
    ok(api.apiTLogin('김감독', TEST_PW).ok);
  });
  test('코드에는 비밀번호 원문도 해시도 없다 (공개 저장소에 올리므로)', () => {
    const fs = require('fs');
    const code = fs.readFileSync(new URL('../src/Code.gs', import.meta.url), 'utf8');
    ok(!/[0-9a-f]{64}/.test(code), '64자리 해시가 코드에 박혀 있습니다');
    ok(code.indexOf('PW_DEFAULT') < 0);
  });
  test('비밀번호를 아직 정하지 않았으면 아무도 못 들어가고 메뉴를 알려 준다', () => {
    const { api } = loadServer();
    at(api, '2026-11-16 18:10');
    api.setupSheets();                                 // 비밀번호 창에 아무것도 넣지 않음
    const r = api.apiTLogin('김감독', 'anything');
    ok(!r.ok && r.msg.indexOf('비밀번호 정하기') >= 0, r.msg);
  });
  test('틀린 비밀번호 · 이상한 이름은 막는다', () => {
    const { api } = freshServer();
    ok(!api.apiTLogin('김감독', 'test-pass').ok);
    ok(!api.apiTLogin('<script>', TEST_PW).ok);
    ok(!api.apiTLogin('가나다라마바사', TEST_PW).ok, '7자 이름');
  });
  test('5번 틀리면 맞는 비밀번호도 10분 동안 막힌다', () => {
    const { api } = freshServer();
    for (let i = 0; i < 5; i++) api.apiTLogin('박감독', 'x' + i);
    const r = api.apiTLogin('박감독', TEST_PW);
    ok(!r.ok && r.msg.indexOf('잠겼') >= 0, r.msg);
  });
  test('시트 준비 때 정한 비밀번호 → 메뉴로 바꾼 비밀번호', () => {
    const { api, gas } = loadServer({ promptAnswers: ['first-pass', 'first-pass', 'newpass99', 'newpass99'] });
    at(api, '2026-11-16 18:10');
    api.setupSheets();
    ok(api.apiTLogin('김감독', 'first-pass').ok);
    api.menuChangePw();
    ok(!api.apiTLogin('김감독', 'first-pass').ok);
    ok(api.apiTLogin('김감독', 'newpass99').ok);
    ok(JSON.stringify(gas.props).indexOf('newpass99') < 0, '원문은 속성에도 남지 않는다');
  });
  test('6자보다 짧은 비밀번호는 정하지 않는다', () => {
    const { api } = freshServer();
    ok(!api.setTeacherPw_('12345'));
  });
  test('접속표 없이 · 엉터리 접속표로는 교사 api 를 못 쓴다', () => {
    const { api } = freshServer();
    ok(api.apiTBoard('', '2026-11-16').relogin);
    ok(api.apiTRoster('a'.repeat(64)).relogin);
    ok(api.apiTRoster({ toString: () => 'x' }).relogin);
  });
});

describe('담임교사 — 명단', () => {
  test('학생을 넣으면 학번이 학년 · 반 · 번호로 정해진다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const r = api.apiTSaveStudent(tk, { g: 1, c: 2, n: 5, name: '박수연', d: [false, true, true, false] });
    ok(r.ok, r.msg);
    eq(r.sid, '10205');
    const row = rows(gas, '명단')[1];
    eq(row[4], '10205'); eq(row[5], '박수연');
    deepEq(row.slice(6, 10), ['', 'O', 'O', '']);
  });
  test('신청 요일이 하루뿐이면 저장하지 않는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const r = api.apiTSaveStudent(tk, { g: 1, c: 2, n: 5, name: '박수연', d: [true, false, false, false] });
    ok(!r.ok && r.msg.indexOf('이틀 이상') >= 0, r.msg);
  });
  test('같은 학번은 두 번 넣지 못한다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    api.apiTSaveStudent(tk, { g: 2, c: 12, n: 3, name: '김주호', d: [true, true, false, false] });
    const r = api.apiTSaveStudent(tk, { g: 2, c: 12, n: 3, name: '최지후', d: [true, true, false, false] });
    ok(!r.ok && r.msg.indexOf('김주호') >= 0, r.msg);
  });
  test('반은 1~12, 번호는 1~40, 이름은 한글 2~5자', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const d = [true, true, false, false];
    ok(!api.apiTSaveStudent(tk, { g: 3, c: 1, n: 1, name: '김하늘', d }).ok, '3학년');
    ok(!api.apiTSaveStudent(tk, { g: 1, c: 13, n: 1, name: '김하늘', d }).ok, '13반');
    ok(!api.apiTSaveStudent(tk, { g: 1, c: 1, n: 41, name: '김하늘', d }).ok, '41번');
    ok(!api.apiTSaveStudent(tk, { g: 1, c: 1, n: 1, name: 'Kim', d }).ok, '영문 이름');
    ok(!api.apiTSaveStudent(tk, { g: 1, c: 1, n: 1, name: '김하늘김하늘', d }).ok, '6자 이름');
    ok(!api.apiTSaveStudent(tk, { g: 1, c: 1, n: 1, name: '=1+1', d }).ok, '수식');
  });
  test('고치면 같은 줄이 바뀌고, 지우면 줄이 사라진다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const a = api.apiTSaveStudent(tk, { g: 1, c: 4, n: 8, name: '김범기', d: [true, true, false, false] });
    ok(api.apiTSaveStudent(tk, { id: a.id, g: 1, c: 4, n: 9, name: '김범기', d: [true, true, true, false] }).ok);
    eq(rows(gas, '명단').length, 2);
    eq(rows(gas, '명단')[1][4], '10409');
    ok(api.apiTDeleteStudent(tk, a.id).ok);
    eq(rows(gas, '명단').length, 1);
  });
  test('시트에 손으로 붙여 넣은 줄도 아이디 · 학번을 채워 쓴다', () => {
    const { api, gas } = freshServer();
    gas.sheets['명단'].appendRow(['', 1, 7, 7, '', '김예서', 1, '', 1, '']);
    const tk = teacher(api);
    const r = api.apiTRoster(tk);
    eq(r.list.length, 1);
    eq(r.list[0].sid, '10707');
    deepEq(r.list[0].d, [true, false, true, false]);
    ok(/^S[0-9a-f]{10}$/.test(rows(gas, '명단')[1][0]));
  });
});

describe('담임교사 — 여러 명 붙여넣기', () => {
  const HWP = ['3\t2\t12\t박수연\t\t\t1\t1\t1\t1\t\t', '4\t2\t14\t성규범\t1\t1\t1\t1\t1\t1\t1\t1', '9\t4\t16\t박건\t1\t1\t\t\t\t\t1\t1'].join('\n');
  test('출석부 표 줄(1·2교시 두 칸씩)에서 신청 요일을 읽는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const r = api.apiTBulk(tk, 1, 2, HWP, false);
    ok(r.ok, r.msg);
    eq(r.rows[0].name, '박수연'); deepEq(r.rows[0].d, [false, true, true, false]); eq(r.rows[0].sid, '10212');
    deepEq(r.rows[1].d, [true, true, true, true]);
    ok(r.rows[2].err.indexOf('4반') >= 0, '다른 반은 넣지 않는다: ' + r.rows[2].err);
    eq(r.good, 2);
  });
  test('「번호 이름 요일」 꼴도 읽고, 넣으면 명단에 들어간다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const r = api.apiTBulk(tk, 2, 3, '7 이바다 월 화\n8 한강 목\n9 김바람 월,목,금', true);
    ok(r.ok, r.msg);
    eq(r.added, 2, '요일이 하루뿐인 한강은 빠진다');
    const list = api.apiTRoster(tk).list;
    deepEq(list.map((s) => s.sid).sort(), ['20307', '20309']);
  });
  test('미리보기에서는 아무것도 넣지 않는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    api.apiTBulk(tk, 1, 2, HWP, false);
    eq(api.apiTRoster(tk).list.length, 0);
  });
  test('너무 긴 붙여넣기는 막는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    ok(!api.apiTBulk(tk, 1, 2, 'x'.repeat(7000), false).ok);
    ok(!api.apiTBulk(tk, 1, 2, Array(70).fill('1 김하늘 월 화').join('\n'), false).ok);
  });
});

describe('학생 로그인 · PIN', () => {
  test('처음이면 PIN 을 정하라고 하고, 정하면 들어간다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    api.apiTSaveStudent(tk, { g: 1, c: 1, n: 5, name: '김하늘', d: [true, true, true, true] });
    const r = api.apiLogin('10105', '김하늘', '');
    ok(!r.ok && r.setup, JSON.stringify(r));
    ok(!api.apiSetPin('10105', '김하늘', '1234', '1234').ok, '쉬운 PIN');
    ok(!api.apiSetPin('10105', '김하늘', '0000', '0000').ok, '같은 숫자');
    ok(!api.apiSetPin('10105', '김하늘', '3141', '3142').ok, '두 번이 다름');
    ok(api.apiSetPin('10105', '김하늘', '3141', '3141').ok);
    ok(!api.apiSetPin('10105', '김하늘', '2718', '2718').ok, '이미 정한 PIN 을 남이 덮어쓰지 못한다');
    ok(api.apiLogin('10105', '김하늘', '3141').ok);
    ok(!api.apiLogin('10105', '김하늘', '3140').ok);
  });
  test('PIN 은 해시로만 남는다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    student(api, tk);
    const row = rows(gas, '명단')[1];
    ok(row[10] && row[10].indexOf('3141') < 0 && row[10].length === 64);
  });
  test('학번 · 이름 · PIN 의 모양과 길이를 서버가 검사한다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    student(api, tk);
    ok(api.apiLogin('101055', '김하늘', '3141').msg.indexOf('5자리') >= 0);
    ok(api.apiLogin('30105', '김하늘', '3141').msg.indexOf('5자리') >= 0, '3학년 학번');
    ok(api.apiLogin('10105', '김하늘김하늘', '3141').msg.indexOf('한글') >= 0);
    ok(api.apiLogin('10105', "' OR 1=1", '3141').msg.indexOf('한글') >= 0);
    ok(api.apiLogin('10105', '김하늘', '31415').msg.indexOf('4자리') >= 0);
    ok(!api.apiLogin(null, undefined, {}).ok);
  });
  test('이름이 틀리면 들어가지 못한다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    student(api, tk);
    ok(!api.apiLogin('10105', '김하눌', '3141').ok);
  });
  test('5번 틀리면 10분 동안 막힌다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    student(api, tk);
    for (let i = 0; i < 5; i++) api.apiLogin('10105', '김하늘', '9' + i + '99');
    const r = api.apiLogin('10105', '김하늘', '3141');
    ok(!r.ok && r.msg.indexOf('10분') >= 0, r.msg);
  });
  test('선생님이 PIN 을 초기화하면 들어와 있던 화면도 끊긴다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    ok(api.apiBoard(s.token).ok);
    ok(api.apiTResetPin(tk, s.id).ok);
    ok(api.apiBoard(s.token).relogin);
    ok(api.apiLogin('10105', '김하늘', '').setup, '다시 PIN 을 정한다');
  });
  test('명단에서 지운 학생의 접속표도 끊긴다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    api.apiTDeleteStudent(tk, s.id);
    ok(api.apiBoard(s.token).relogin);
  });
});

describe('학생 — 자리 고르기', () => {
  test('16:50 전 · 21:30 뒤에는 고르지 못한다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    at(api, '2026-11-16 16:49');
    ok(!api.apiPick(s.token, 10).ok);
    at(api, '2026-11-16 16:50');
    ok(api.apiPick(s.token, 10).ok);
    at(api, '2026-11-16 21:31');
    ok(!api.apiPick(s.token, 11).ok);
  });
  test('수요일 · 신청하지 않은 요일에는 고르지 못한다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk, { d: [false, true, true, false] });     // 화 · 목만
    const r = api.apiPick(s.token, 10);                                   // 월요일
    ok(!r.ok && r.msg.indexOf('신청한 요일') >= 0, r.msg);
    at(api, '2026-11-18 18:00');
    ok(api.apiPick(s.token, 10).msg.indexOf('없는 날') >= 0);
    at(api, '2026-11-17 18:00');
    ok(api.apiPick(s.token, 10).ok, '화요일은 된다');
  });
  test('날짜는 언제나 서버가 정한다 — 화면이 날짜를 보낼 길이 없다', () => {
    const { api } = freshServer();
    eq(api.apiPick.length, 2);
    eq(api.apiBoard.length, 2);
  });
  test('남이 앉은 자리는 고르지 못한다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk);
    const b = student(api, tk, { n: 6, name: '이바다' });
    ok(api.apiPick(a.token, 42).ok);
    const r = api.apiPick(b.token, 42);
    ok(!r.ok && r.refresh, r.msg);
  });
  test('자리 바꾸기는 하루 3번까지', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    ok(api.apiPick(s.token, 1).ok);
    let t = 0;
    for (const seat of [2, 3, 4]) { at(api, '2026-11-16 18:1' + (++t)); ok(api.apiPick(s.token, seat).ok, seat + '번'); }
    at(api, '2026-11-16 18:20');
    const r = api.apiPick(s.token, 5);
    ok(!r.ok && r.msg.indexOf('3번') >= 0, r.msg);
  });
  test('너무 빠르게 누르면 막는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    let blocked = false;
    for (let i = 1; i <= 8; i++) { const r = api.apiPick(s.token, i); if (!r.ok && r.msg.indexOf('빨리') >= 0) blocked = true; }
    ok(blocked);
  });
  test('없는 좌석 번호는 막는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    [0, 115, 1.5, 'abc', -3, null].forEach((n) => ok(!api.apiPick(s.token, n).ok, String(n)));
  });
  test('기록은 학생 한 명 = 한 줄 (바꿔도 줄이 늘지 않는다)', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    api.apiPick(s.token, 1);
    at(api, '2026-11-16 18:20');
    api.apiPick(s.token, 2);
    eq(rows(gas, '기록').length, 2);
    eq(rows(gas, '기록')[1][5], 2);
  });
  test('다른 사람이 쓰는 중(자물쇠)이면 busy 를 돌려준다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    api.apiBoard(s.token);                       // 캐시를 미리 만들어 둔다
    gas.LockService.getScriptLock().tryLock();
    const r = api.apiPick(s.token, 7);
    ok(!r.ok && r.busy, JSON.stringify(r));
    gas.LockService.getScriptLock().releaseLock();
    ok(api.apiPick(s.token, 7).ok);
  });
});

describe('학생 화면에는 남의 정보가 가려져 간다', () => {
  test('학번 · 학년 · 실명이 응답에 없다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk);
    const b = student(api, tk, { g: 2, c: 3, n: 7, name: '이바다' });
    api.apiPick(b.token, 50);
    const r = api.apiBoard(a.token);
    const text = JSON.stringify(r);
    ok(text.indexOf('이바다') < 0, '실명');
    ok(text.indexOf('20307') < 0, '학번');
    ok(text.indexOf('"g"') < 0 && text.indexOf('2학년') < 0, '학년');
    eq(r.seats[50].n, '이*다');
  });
  test('내 자리는 내 이름과 함께 보인다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk);
    api.apiPick(a.token, 3);
    const r = api.apiBoard(a.token);
    eq(r.mine, 3);
    eq(r.seats[3].me, 1);
  });
  test('바뀐 것이 없으면 좌석 목록을 다시 보내지 않는다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk);
    const r1 = api.apiBoard(a.token);
    const r2 = api.apiBoard(a.token, r1.ver);
    ok(r2.same && !r2.seats);
  });
});

describe('야자감독 — 출결 · 메모', () => {
  function setup() {
    const env = freshServer();
    const tk = teacher(env.api);
    const s = student(env.api, tk);
    env.api.apiPick(s.token, 19);
    return Object.assign(env, { tk, s });
  }
  test('교사 화면에는 학번 · 이름 · 학년이 다 보인다', () => {
    const { api, tk } = setup();
    const r = api.apiTBoard(tk, '2026-11-16');
    eq(r.list.length, 1);
    eq(r.list[0].sid, '10105'); eq(r.list[0].name, '김하늘'); eq(r.list[0].g, 1); eq(r.list[0].seat, 19);
    ok(JSON.stringify(r).indexOf('ph') < 0 || r.list[0].ph === undefined, 'PIN 해시는 보내지 않는다');
  });
  test('1교시 · 2교시를 따로 기록하고 감독 교사로 남는다', () => {
    const { api, gas, tk, s } = setup();
    ok(api.apiTUpdate(tk, '2026-11-16', s.id, { p1: '결석' }).ok);
    ok(api.apiTUpdate(tk, '2026-11-16', s.id, { p2: '사유', memo: '보호자 연락 후 조기 귀가' }).ok);
    const r = api.apiTBoard(tk, '2026-11-16').list[0];
    eq(r.p1, '결석'); eq(r.p2, '사유'); eq(r.memo, '보호자 연락 후 조기 귀가');
    deepEq(api.apiTBoard(tk, '2026-11-16').sups, ['김감독']);
    eq(rows(gas, '감독').length, 2);
    ok(rows(gas, '변경 기록').some((x) => String(x[3]).indexOf('1교시 -→결석') >= 0));
  });
  test('출결은 출석 · 결석 · 사유 셋뿐이다', () => {
    const { api, gas, tk, s } = setup();
    deepEq(api.boot_('teacher').statuses, ['출석', '결석', '사유']);
    ['지각', '조퇴', '자리비움'].forEach((st) => ok(!api.apiTUpdate(tk, '2026-11-16', s.id, { p1: st }).ok, st + ' 는 없는 상태'));
    ok(api.apiTUpdate(tk, '2026-11-16', s.id, { p1: '출석' }).ok);
    /* 시트에 예전 상태 글자가 남아 있어도 화면에는 빈칸(= 자리를 골랐으면 출석)으로 보인다 */
    const row = rows(gas, '기록').findIndex((x) => x[1] === s.id);
    gas.sheets['기록'].getRange(row + 1, 8).setValue('지각');
    dropCaches(gas);
    eq(api.apiTBoard(tk, '2026-11-16').list[0].p2, '');
  });
  test('없는 상태 · 너무 긴 메모 · 수요일 기록은 막는다', () => {
    const { api, tk, s } = setup();
    ok(!api.apiTUpdate(tk, '2026-11-16', s.id, { p1: '탈출' }).ok);
    ok(!api.apiTUpdate(tk, '2026-11-16', s.id, { memo: '가'.repeat(101) }).ok);
    ok(!api.apiTUpdate(tk, '2026-11-18', s.id, { p1: '결석' }).ok);
    ok(!api.apiTUpdate(tk, '2026-02-30', s.id, { p1: '결석' }).ok);
  });
  test('메모가 수식이면 시트에는 막아서 넣고 화면에는 그대로 보인다', () => {
    const { api, gas, tk, s } = setup();
    api.apiTUpdate(tk, '2026-11-16', s.id, { memo: '=HYPERLINK("x")' });
    eq(rows(gas, '기록')[1][8], "'=HYPERLINK(\"x\")");
    dropCaches(gas);
    eq(api.apiTBoard(tk, '2026-11-16').list[0].memo, '=HYPERLINK("x")');
  });
  test('미리 빠지는 학생(병원 · 행사)은 자리 없이도 「사유」 로 남긴다', () => {
    const { api, tk } = setup();
    const b = api.apiTSaveStudent(tk, { g: 2, c: 1, n: 1, name: '강민호', d: [true, true, true, false] });
    ok(api.apiTUpdate(tk, '2026-11-19', b.id, { p1: '사유', p2: '사유', memo: '병원(사전 연락)' }).ok, '목요일 미리 기록');
    const w = api.apiTWeek(tk, 2, '2026-11-16');
    eq(w.recs['2026-11-19'][b.id].p1, '사유');
    deepEq(api.apiTBoard(tk, '2026-11-19').sups, [], '미리 적은 담임은 그날 감독 교사가 아니다');
  });
  test('감독 교사는 그날 16:50 뒤에 기록한 교사만 — 미리 · 나중에 적은 기록은 세지 않는다', () => {
    const { api, tk, s } = setup();
    at(api, '2026-11-17 09:00');
    ok(api.apiTUpdate(tk, '2026-11-16', s.id, { p1: '사유', memo: '진료확인서 제출' }).ok, '다음 날 아침 사후 처리');
    deepEq(api.apiTBoard(tk, '2026-11-16').sups, []);
    at(api, '2026-11-17 16:00');
    ok(api.apiTUpdate(tk, '2026-11-17', s.id, { p1: '사유' }).ok);
    deepEq(api.apiTBoard(tk, '2026-11-17').sups, [], '그날이라도 16:50 전');
    at(api, '2026-11-17 19:00');
    ok(api.apiTUpdate(tk, '2026-11-17', s.id, { p2: '결석' }).ok);
    deepEq(api.apiTBoard(tk, '2026-11-17').sups, ['김감독']);
  });
  test('자리 빼기를 하면 학생이 다시 고를 수 있다', () => {
    const { api, tk, s } = setup();
    ok(api.apiTUpdate(tk, '2026-11-16', s.id, { clearSeat: true }).ok);
    eq(api.apiBoard(s.token).mine, 0);
    at(api, '2026-11-16 18:30');
    ok(api.apiPick(s.token, 20).ok);
  });
  test('신청한 학생은 자리가 없어도 감독 화면 목록에 나온다', () => {
    const { api, tk } = setup();
    api.apiTSaveStudent(tk, { g: 2, c: 1, n: 1, name: '강민호', d: [true, true, false, false] });
    api.apiTSaveStudent(tk, { g: 2, c: 1, n: 2, name: '권희원', d: [false, true, true, false] });
    const list = api.apiTBoard(tk, '2026-11-16').list;
    ok(list.some((x) => x.name === '강민호' && x.applied && !x.seat));
    ok(!list.some((x) => x.name === '권희원'), '월요일에 신청하지 않은 학생');
  });
});

describe('출석부 — 한 주', () => {
  test('어느 날을 골라도 그 주 월 · 화 · 목 · 금 을 돌려준다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    deepEq(api.apiTWeek(tk, 1, '2026-11-18').dates, ['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20']);
    deepEq(api.apiTWeek(tk, 1, '2026-11-22').dates, ['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20'], '일요일');
  });
  test('학년 · 반 · 번호 차례로, 다른 학년은 빼고', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const d = [true, true, false, false];
    api.apiTSaveStudent(tk, { g: 1, c: 2, n: 6, name: '김원규', d });
    api.apiTSaveStudent(tk, { g: 1, c: 1, n: 34, name: '한석규', d });
    api.apiTSaveStudent(tk, { g: 2, c: 1, n: 1, name: '강민호', d });
    deepEq(api.apiTWeek(tk, 1, '2026-11-16').students.map((s) => s.name), ['한석규', '김원규']);
  });
});

describe('캐시가 사라져도 시트에서 그대로 되살린다', () => {
  test('자리 · 출결이 그대로, 줄이 겹치지 않는다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk);
    const b = student(api, tk, { n: 6, name: '이바다' });
    api.apiPick(a.token, 30);
    api.apiPick(b.token, 31);
    api.apiTUpdate(tk, '2026-11-16', a.id, { p2: '사유' });
    dropCaches(gas);
    const r = api.apiTBoard(tk, '2026-11-16');
    eq(r.list.find((x) => x.name === '김하늘').seat, 30);
    eq(r.list.find((x) => x.name === '김하늘').p2, '사유');
    dropCaches(gas);
    ok(!api.apiPick(a.token, 31).ok, '31번은 여전히 이바다 자리');
    at(api, '2026-11-16 18:40');
    ok(api.apiPick(a.token, 32).ok);
    eq(rows(gas, '기록').length, 3, '학생 둘 = 두 줄 + 머리글');
  });
  test('누가 시트에서 줄을 지워 줄 번호가 밀려도 맞는 줄을 고친다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk);
    const b = student(api, tk, { n: 6, name: '이바다' });
    api.apiPick(a.token, 30);
    api.apiPick(b.token, 31);
    gas.sheets['기록'].deleteRow(2);              // 김하늘 줄을 손으로 지움 — 캐시는 모른다
    api.apiTUpdate(tk, '2026-11-16', b.id, { p1: '결석' });
    const r = rows(gas, '기록');
    eq(r.length, 2);
    eq(r[1][3], '이바다'); eq(r[1][6], '결석');
  });
});
