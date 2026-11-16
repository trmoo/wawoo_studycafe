/*!
 * 서버 시험 (2) — 신청하지 않은 날 · 신청하지 않은 학생의 참여, 우리 반 출석 기록
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { createRequire } from 'module';
import { describe, test, ok, eq, deepEq } from './harness.mjs';
const require = createRequire(import.meta.url);
const { freshServer, at, teacher, student } = require('../tools/gas-load.js');

function rows(gas, name) { return gas.sheets[name].dump(); }
function dropCaches(gas) { Object.keys(gas.cache).forEach((k) => { if (!k.startsWith('ss:')) delete gas.cache[k]; }); }

describe('신청하지 않은 날 · 신청하지 않은 학생 — 학부모 동의를 체크하고 참여', () => {
  test('다른 요일을 신청한 학생 — 동의를 체크하면 고르고, 기록에 「미신청」 · 동의 시각이 남는다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk, { d: [false, true, true, false] });
    const b0 = api.apiBoard(s.token);
    ok(b0.open && !b0.applied && !b0.consented, JSON.stringify(b0));
    eq(b0.myDays, '화·목');
    ok(b0.why.indexOf('신청한 요일이 아닙니다') >= 0, b0.why);
    ok(api.apiPick(s.token, 12, true).ok);
    const row = rows(gas, '기록')[1];
    eq(row[13], '미신청');
    eq(row[14], '2026-11-16 18:10:00');
    ok(api.apiBoard(s.token).consented);
    at(api, '2026-11-16 18:20');
    ok(api.apiPick(s.token, 13).ok, '한 번 체크했으면 자리를 바꿀 때 다시 묻지 않는다');
    eq(rows(gas, '기록')[1][14], '2026-11-16 18:10:00', '동의 시각은 처음 그대로');
    ok(rows(gas, '변경 기록').some((x) => String(x[2]).indexOf('학부모 동의') >= 0), '변경 기록에도 남는다');
  });
  test('신청한 날 고른 기록은 「신청」 으로 남는다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk);
    api.apiPick(s.token, 5);
    eq(rows(gas, '기록')[1][13], '신청');
    eq(rows(gas, '기록')[1][14], '');
  });
  test('명단에 없는 학번 — 처음 등록(PIN 정하기)으로 넘기고, 요일 없는 학생으로 명단에 들어간다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const r = api.apiLogin('20412', '정새봄', '');
    ok(!r.ok && r.setup && r.fresh, JSON.stringify(r));
    ok(api.apiLogin('20412', '정새봄', '1357').fresh, 'PIN 을 넣어도 명단에 없으면 처음 등록');
    const a = api.apiSetPin('20412', '정새봄', '3579', '3579');
    ok(a.ok && a.fresh, a.msg);
    const row = rows(gas, '명단')[1];
    deepEq(row.slice(1, 10), [2, 4, 12, '20412', '정새봄', '', '', '', '']);
    ok(String(row[13]).indexOf('처음 등록') >= 0);
    ok(api.apiLogin('20412', '정새봄', '3579').ok, '다음부터는 PIN 으로');
    ok(!api.apiLogin('20412', '정봄새', '3579').ok, '이름이 다르면 못 들어온다');
    ok(!api.apiSetPin('20412', '정봄새', '2468', '2468').ok, '같은 학번으로 다른 이름이 또 등록하지 못한다');
    const p = api.apiPick(a.token, 30);
    ok(!p.ok && p.needConsent, '동의 체크가 있어야 한다');
    ok(api.apiPick(a.token, 30, true).ok);
    const it = api.apiTBoard(tk, '2026-11-16').list.find((x) => x.sid === '20412');
    ok(it && it.ex && !it.applied && it.seat === 30 && it.pc === '2026-11-16 18:10:00', JSON.stringify(it));
    deepEq(it.d, [false, false, false, false]);
  });
  test('명단에 있는 학번에 다른 이름 · 엉터리 학번은 여전히 막는다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    student(api, tk);
    const r = api.apiLogin('10105', '김하눌', '');
    ok(!r.ok && !r.setup, '명단 학생의 학번으로 처음 등록할 수 없다');
    ok(!api.apiSetPin('10105', '김하눌', '2468', '2468').ok);
    ok(!api.apiLogin('30105', '김하늘', '').setup, '3학년 학번');
    ok(!api.apiLogin('11305', '김하늘', '').setup, '13반');
    ok(!api.apiSetPin('10141', '김하늘', '2468', '2468').ok, '41번');
    eq(rows(gas, '명단').length, 2, '명단이 늘지 않았다');
  });
  test('처음 등록이 1분에 너무 많으면 잠시 막는다', () => {
    const { api } = freshServer();
    let busy = false;
    for (let i = 1; i <= 41; i++) {
      const sid = '1' + String(1 + (i % 12)).padStart(2, '0') + String(31 + Math.floor(i / 12)).padStart(2, '0');
      const r = api.apiSetPin(sid, '김하늘', '2468', '2468');
      if (!r.ok && r.busy) busy = true;
    }
    ok(busy);
  });
  test('감독 교사가 미신청 학생을 출석 표시하면 그 기록도 「미신청」 으로 남는다', () => {
    const { api, gas } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk, { d: [false, true, true, false] });
    ok(api.apiTUpdate(tk, '2026-11-16', s.id, { p1: '출석' }).ok);
    eq(rows(gas, '기록')[1][13], '미신청');
    eq(rows(gas, '기록')[1][14], '', '학생이 체크하지 않았으므로 동의 시각은 비어 있다');
    const it = api.apiTBoard(tk, '2026-11-16').list[0];
    ok(it.ex && !it.pc);
  });
  test('나중에 담임이 그 요일을 신청으로 바꿔도 그날 「미신청 참여」 는 그대로', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const s = student(api, tk, { d: [false, true, true, false] });
    api.apiPick(s.token, 8, true);
    ok(api.apiTSaveStudent(tk, { id: s.id, g: 1, c: 1, n: 5, name: '김하늘', d: [true, true, true, false] }).ok);
    const it = api.apiTBoard(tk, '2026-11-16').list[0];
    ok(it.applied && it.ex, '지금은 신청 요일이지만 그날은 신청하지 않고 참여했다');
  });
  test('예전 시트(머리글 13칸)도 첫 기록 때 새 머리글을 채운다', () => {
    const { api, gas } = freshServer();
    const sh = gas.sheets['기록'];
    sh.getRange(1, 14).setValue('');
    sh.getRange(1, 15).setValue('');
    dropCaches(gas);
    const tk = teacher(api);
    const s = student(api, tk);
    api.apiPick(s.token, 4);
    deepEq(rows(gas, '기록')[0], api.HEAD_REC);
    sh.getRange(1, 15).setValue('');
    api.setupSheets();
    deepEq(rows(gas, '기록')[0], api.HEAD_REC, '「시트 준비하기」 를 다시 해도 채운다');
  });
  test('예전 기록(그날 신청 칸이 빈칸)은 지금 명단으로 가린다', () => {
    const { api } = freshServer();
    eq(api.extra_({ ap: null }, true), false);
    eq(api.extra_({ ap: null }, false), true);
    eq(api.extra_({ ap: false }, true), true);
    eq(api.extra_({ ap: true }, false), false);
    eq(api.extra_(null, false), false);
  });
});

describe('담임교사 — 스스로 등록한 학생 · 이름 바꾸기', () => {
  test('스스로 등록한 학생을 담임이 신청 학생으로 바꾸면 PIN 은 그대로', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = api.apiSetPin('10234', '오나래', '3579', '3579');
    const st = api.apiTRoster(tk).list.find((x) => x.sid === '10234');
    const r = api.apiTSaveStudent(tk, { g: 1, c: 2, n: 34, name: '오나래', d: [true, true, false, false] });
    ok(!r.ok && r.msg.indexOf('신청하지 않고 참여한 학생') >= 0, '새 줄로 넣으면 아래 목록을 알려 준다: ' + r.msg);
    const u = api.apiTSaveStudent(tk, { id: st.id, g: 1, c: 2, n: 34, name: '오나래', d: [true, true, false, false] });
    ok(u.ok && !u.pinCleared);
    const b = api.apiBoard(a.token);
    ok(b.ok && b.applied, '들어와 있던 화면도 그대로 · 월요일이 이제 신청한 날');
  });
  test('담임이 이름을 바꾸면 PIN 을 지워 새로 정하게 한다 (학번을 잘못 적고 등록한 경우)', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = api.apiSetPin('10234', '오나래', '3579', '3579');
    const st = api.apiTRoster(tk).list.find((x) => x.sid === '10234');
    const u = api.apiTSaveStudent(tk, { id: st.id, g: 1, c: 2, n: 34, name: '오가람', d: [true, true, false, false] });
    ok(u.ok && u.pinCleared);
    ok(api.apiBoard(a.token).relogin, '잘못 등록한 학생의 화면은 끊긴다');
    ok(api.apiLogin('10234', '오가람', '').setup, '진짜 학생이 PIN 을 새로 정한다');
  });
  test('붙여넣기로 이름이 바뀌어도 PIN 을 지운다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    api.apiSetPin('10234', '오나래', '3579', '3579');
    const p = api.apiTBulk(tk, 1, 2, '34 오가람 월 화', false);
    ok(p.rows[0].action.indexOf('PIN') >= 0, p.rows[0].action);
    ok(api.apiTBulk(tk, 1, 2, '34 오가람 월 화', true).ok);
    ok(api.apiLogin('10234', '오가람', '').setup);
  });
  test('붙여넣기 미리보기는 스스로 등록한 학생을 「미신청 학생 → 신청」 으로 알려 준다', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    api.apiSetPin('10234', '오나래', '3579', '3579');
    eq(api.apiTBulk(tk, 1, 2, '34 오나래 월 화', false).rows[0].action, '갱신 (미신청 학생 → 신청)');
  });
});

describe('출석부 · 우리 반 출석 기록 — 미신청 참여', () => {
  function setup() {
    const env = freshServer();
    const { api } = env;
    const tk = teacher(api);
    const a = student(api, tk);                                                                  // 1-1-5 김하늘 월~금 신청
    const b = student(api, tk, { n: 6, name: '이바다', d: [false, true, true, false] }, '2468');   // 1-1-6 화·목
    const c = api.apiSetPin('10134', '오나래', '3579', '3579');                                 // 1-1-34 스스로 등록
    api.apiSetPin('10135', '한결희', '3579', '3579');                                           // 1-1-35 등록만 하고 기록 없음
    api.apiPick(a.token, 1);
    api.apiPick(b.token, 2, true);
    api.apiPick(c.token, 3, true);
    const cid = api.apiTRoster(tk).list.find((x) => x.sid === '10134').id;
    return Object.assign(env, { tk, a, b, cid });
  }
  test('출석부 — 미신청 참여 기록에 표시가 있고, 기록 없는 미신청 학생은 빠진다', () => {
    const { api, tk, a, b, cid } = setup();
    const w = api.apiTWeek(tk, 1, '2026-11-16');
    deepEq(w.students.map((s) => s.name), ['김하늘', '이바다', '오나래']);
    const m = w.recs['2026-11-16'];
    eq(m[a.id].ex, false);
    eq(m[b.id].ex, true);
    eq(m[cid].ex, true);
    ok(m[b.id].pc, '동의 시각');
  });
  test('우리 반 출석 기록 — 한 달의 월 · 화 · 목 · 금, 반 학생 모두(스스로 등록 · 명단에서 빠진 학생까지)', () => {
    const { api, tk, a, b } = setup();
    at(api, '2026-11-17 18:00');
    api.apiPick(b.token, 2);
    api.apiTSaveStudent(tk, { g: 1, c: 2, n: 1, name: '강다른', d: [true, true, true, true] });
    ok(api.apiTDeleteStudent(tk, a.id).ok, '김하늘을 명단에서 지운다');
    const r = api.apiTClassLog(tk, 1, 1, '2026-11');
    ok(r.ok, r.msg);
    eq(r.dates.length, 17, '2026년 11월의 월 · 화 · 목 · 금');
    ok(r.dates.every((d) => '월화목금'.indexOf(api.dayName_(d)) >= 0));
    deepEq(r.students.map((s) => s.n + s.name + (s.gone ? '(빠짐)' : '')), ['5김하늘(빠짐)', '6이바다', '34오나래', '35한결희']);
    eq(r.recs[a.id]['2026-11-16'].seat, 1, '빠진 학생의 기록도 남는다');
    eq(r.recs[b.id]['2026-11-16'].ex, true, '월요일은 미신청 참여');
    eq(r.recs[b.id]['2026-11-17'].ex, false, '화요일은 신청한 날');
    ok(!r.students.some((s) => s.name === '강다른'), '다른 반은 빼고');
  });
  test('달 · 반 모양을 검사한다', () => {
    const { api, tk } = setup();
    ok(!api.apiTClassLog(tk, 1, 1, '2026-13').ok);
    ok(!api.apiTClassLog(tk, 1, 13, '2026-11').ok);
    ok(!api.apiTClassLog(tk, 3, 1, '2026-11').ok);
    ok(api.apiTClassLog('', 1, 1, '2026-11').relogin);
  });
  test('기록이 없는 달은 빈 기록과 반 명단만 돌려준다', () => {
    const { api, tk } = setup();
    const r = api.apiTClassLog(tk, 1, 1, '2026-10');
    ok(r.ok);
    deepEq(r.recs, {});
    eq(r.students.length, 4);
  });
});
