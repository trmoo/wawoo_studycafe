/*!
 * 서버 시험 (3) — 📌 지정석 · 신청하지 않은 학생은 17:30부터
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { createRequire } from 'module';
import { describe, test, ok, eq, deepEq } from './harness.mjs';
const require = createRequire(import.meta.url);
const { freshServer, at, teacher, student } = require('../tools/gas-load.js');

function rows(gas, name) { return gas.sheets[name].dump(); }
function rosterRow(gas, sid) { return rows(gas, '명단').find((r) => r[4] === sid); }

/** 2026-11-16 은 월요일 · 17 화요일 · 18 수요일 */
function setup() {
  const { api, gas } = freshServer();
  const tk = teacher(api);
  return { api, gas, tk };
}

describe('신청하지 않은 학생은 17:30부터 — 신청한 학생이 16:50부터 먼저 고른다', () => {
  test('16:55 — 신청한 학생은 고르고, 다른 요일을 신청한 학생은 17:30까지 기다린다', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김먼저' });
    const b = student(api, tk, { n: 2, name: '이나중', d: [false, true, true, false] });
    at(api, '2026-11-16 16:55');
    const ba = api.apiBoard(a.token);
    ok(ba.open && ba.from === '16:50', JSON.stringify(ba));
    ok(api.apiPick(a.token, 10).ok);
    const bb = api.apiBoard(b.token);
    ok(!bb.open && bb.from === '17:30', JSON.stringify(bb));
    ok(bb.why.indexOf('17:30') >= 0 && bb.why.indexOf('신청한 요일이 아닙니다') >= 0, bb.why);
    const p = api.apiPick(b.token, 11, true);
    ok(!p.ok && p.msg.indexOf('17:30') >= 0, '동의를 체크해도 17:30 전에는 못 고른다: ' + p.msg);
    at(api, '2026-11-16 17:29');
    ok(!api.apiPick(b.token, 11, true).ok, '17:29 도 아직');
    at(api, '2026-11-16 17:30');
    ok(api.apiBoard(b.token).open);
    ok(api.apiPick(b.token, 11, true).ok, '17:30 부터 고른다');
  });
  test('야자를 신청하지 않은 학생(스스로 등록)도 17:30부터', () => {
    const { api } = setup();
    at(api, '2026-11-16 17:00');
    const a = api.apiSetPin('20412', '정새봄', '3579', '3579');
    ok(a.ok && a.fresh);
    const b = api.apiBoard(a.token);
    ok(!b.open && b.from === '17:30' && b.why.indexOf('야자를 신청하지 않은 학생') >= 0, b.why);
    ok(!api.apiPick(a.token, 30, true).ok);
    at(api, '2026-11-16 17:31');
    ok(api.apiPick(a.token, 30, true).ok);
  });
  test('16:50 전에는 신청한 학생도 못 고르고, 안내는 저마다의 시각을 말한다', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김먼저' });
    const b = student(api, tk, { n: 2, name: '이나중', d: [false, true, true, false] });
    at(api, '2026-11-16 16:40');
    ok(api.apiBoard(a.token).why.indexOf('16:50') >= 0);
    ok(api.apiBoard(b.token).why.indexOf('17:30') >= 0);
    ok(!api.apiPick(a.token, 3).ok);
  });
  test('시트 메뉴로 시간 제한을 풀면 17:30 제한도 함께 풀린다 (학부모 동의는 그대로)', () => {
    const { api, tk } = setup();
    const b = student(api, tk, { n: 2, name: '이나중', d: [false, true, true, false] });
    at(api, '2026-11-16 16:55');
    api.setFree_(1);
    ok(api.apiBoard(b.token).open);
    ok(api.apiPick(b.token, 11).needConsent, '동의는 여전히 필요');
    ok(api.apiPick(b.token, 11, true).ok);
  });
  test('화면에 넘기는 설정에 17:30 이 들어 있다', () => {
    const { api } = setup();
    eq(api.boot_('index').fromExtra, '17:30');
    eq(api.boot_('index').from, '16:50');
  });
});

describe('📌 지정석 — 교사가 고정 자리를 준다', () => {
  test('지정하면 명단 시트 「지정석」 칸에 남고, 교사 명단에도 보인다', () => {
    const { api, gas, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    const r = api.apiTSetFixed(tk, a.id, 40);
    ok(r.ok && r.seat === 40 && !r.before, JSON.stringify(r));
    eq(rows(gas, '명단')[0][14], '지정석');
    eq(rosterRow(gas, a.sid)[14], 40);
    eq(api.apiTRoster(tk).list.find((x) => x.id === a.id).fx, 40);
    ok(rows(gas, '변경 기록').some((x) => x[2] === '지정석 주기' && String(x[3]).indexOf('40번') >= 0));
    ok(api.apiTSetFixed(tk, a.id, 40).same, '같은 자리를 다시 주면 바뀌는 것이 없다');
  });
  test('신청한 날 — 다른 학생에게는 지정석(가린 이름)으로 보이고 앉을 수 없다', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    const b = student(api, tk, { n: 2, name: '이보통' });
    api.apiTSetFixed(tk, a.id, 40);
    const bb = api.apiBoard(b.token);
    deepEq(bb.seats[40], { n: '김*정', fx: 1, held: 1 });
    ok(!bb.fixedOnly && !bb.fixed, '지정석이 없는 학생');
    const p = api.apiPick(b.token, 40);
    ok(!p.ok && p.msg.indexOf('지정석') >= 0, p.msg);
    const c = api.apiSetPin('20412', '정새봄', '3579', '3579');
    ok(!api.apiPick(c.token, 40, true).ok, '신청하지 않은 학생도 못 앉는다');
  });
  test('지정석 학생은 신청한 날 지정석에만 앉고, 자기 자리를 눌러 「앉았어요」 를 알린다', () => {
    const { api, gas, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    api.apiTSetFixed(tk, a.id, 40);
    const b0 = api.apiBoard(a.token);
    ok(b0.fixed === 40 && b0.fixedOnly && b0.mine === 0, JSON.stringify(b0));
    deepEq(b0.seats[40], { me: 1, n: '김지정', fx: 1, held: 1 });
    const t0 = api.apiTBoard(tk, '2026-11-16').list.find((x) => x.id === a.id);
    ok(t0.held && t0.seat === 40 && t0.fx === 40, '교사 화면에는 맡아 둔 자리로 보인다');
    const p = api.apiPick(a.token, 12);
    ok(!p.ok && p.msg.indexOf('40번에만') >= 0, p.msg);
    ok(api.apiPick(a.token, 40).ok);
    const b1 = api.apiBoard(a.token);
    ok(b1.mine === 40 && b1.fixedOnly && !b1.seats[40].held, JSON.stringify(b1.seats[40]));
    eq(rows(gas, '기록')[1][5], 40);
    const t1 = api.apiTBoard(tk, '2026-11-16').list.find((x) => x.id === a.id);
    ok(!t1.held && t1.seat === 40, '앉은 뒤에는 보통 자리처럼');
    ok(!api.apiPick(a.token, 12).ok, '앉은 뒤에도 다른 자리로 바꿀 수 없다');
    ok(rows(gas, '변경 기록').some((x) => String(x[3]).indexOf('(지정석)') >= 0));
  });
  test('신청하지 않은 요일에는 맡아 두지 않는다 — 다른 학생도 앉고, 지정석 학생도 아무 자리나', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정', d: [true, false, true, false] });
    const b = student(api, tk, { n: 2, name: '이보통' });
    api.apiTSetFixed(tk, a.id, 40);
    at(api, '2026-11-17 18:10');
    ok(!api.apiBoard(b.token).seats[40], '화요일에는 빈자리');
    ok(!api.apiTBoard(tk, '2026-11-17').list.some((x) => x.id === a.id), '교사 화면에도 나오지 않는다');
    const ba = api.apiBoard(a.token);
    ok(!ba.fixedOnly && !ba.fixed);
    ok(api.apiPick(b.token, 40).ok, '화요일에는 다른 학생이 앉을 수 있다');
    ok(api.apiPick(a.token, 41, true).ok, '지정석 학생도 신청하지 않은 날은 다른 학생처럼 고른다');
    at(api, '2026-11-19 18:10');
    ok(!api.apiPick(b.token, 40).ok, '목요일에는 다시 맡아 둔다');
  });
  test('수요일(야자 없는 날)에는 아무 일도 없다', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    api.apiTSetFixed(tk, a.id, 40);
    at(api, '2026-11-18 18:10');
    const b = api.apiBoard(a.token);
    ok(!b.open && !b.fixed, JSON.stringify(b));
  });
  test('이미 다른 학생의 지정석이면 막고, 「바꾸기」 로 넘기면 앞 학생의 지정이 풀린다', () => {
    const { api, gas, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    const b = student(api, tk, { n: 2, name: '이보통' });
    api.apiTSetFixed(tk, a.id, 40);
    const r = api.apiTSetFixed(tk, b.id, 40);
    ok(!r.ok && r.taken && r.taken.id === a.id && r.msg.indexOf('김지정') >= 0, JSON.stringify(r));
    const r2 = api.apiTSetFixed(tk, b.id, 40, true);
    ok(r2.ok && r2.freed === '김지정', JSON.stringify(r2));
    eq(rosterRow(gas, a.sid)[14], '');
    eq(rosterRow(gas, b.sid)[14], 40);
  });
  test('다른 자리로 옮기기 · 풀기', () => {
    const { api, gas, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    const b = student(api, tk, { n: 2, name: '이보통' });
    api.apiTSetFixed(tk, a.id, 40);
    const r = api.apiTSetFixed(tk, a.id, 41);
    ok(r.ok && r.before === 40);
    ok(api.apiPick(b.token, 40).ok, '옮기면 예전 자리는 빈다');
    ok(api.apiTSetFixed(tk, a.id, 0).ok);
    eq(rosterRow(gas, a.sid)[14], '');
    ok(api.apiPick(b.token, 41).ok, '풀면 그 자리도 빈다');
    const ba = api.apiBoard(a.token);
    ok(!ba.fixedOnly, '풀린 학생은 보통 학생처럼');
    ok(api.apiPick(a.token, 7).ok);
    ok(rows(gas, '변경 기록').some((x) => x[2] === '지정석 풀기'));
  });
  test('지정석을 주기 전에 다른 학생이 오늘 그 자리를 골랐으면 오늘은 그 학생 자리로 둔다', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    const b = student(api, tk, { n: 2, name: '이보통' });
    ok(api.apiPick(b.token, 40).ok);
    const r = api.apiTSetFixed(tk, a.id, 40);
    ok(r.ok && r.note.indexOf('이보통') >= 0, JSON.stringify(r));
    const ba = api.apiBoard(a.token);
    ok(!ba.fixedOnly && ba.seats[40] && !ba.seats[40].me, '오늘은 이보통 학생 자리');
    ok(api.apiPick(a.token, 12).ok, '지정석이 막혀 있으면 오늘은 다른 자리에 앉는다');
    at(api, '2026-11-17 18:10');
    ok(!api.apiPick(b.token, 40).ok, '다음 신청일부터는 맡아 둔다');
    ok(api.apiBoard(a.token).fixed === 40);
  });
  test('지정석을 받기 전에 오늘 다른 자리를 골랐으면 오늘은 그 자리, 바꾸려면 지정석으로만', () => {
    const { api, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    ok(api.apiPick(a.token, 12).ok);
    api.apiTSetFixed(tk, a.id, 40);
    const b = api.apiBoard(a.token);
    ok(b.mine === 12 && b.fixedOnly && b.fixed === 40, JSON.stringify(b));
    ok(!b.seats[40], '오늘은 12번에 앉았으니 40번을 따로 맡아 두지 않는다');
    ok(!api.apiPick(a.token, 13).ok);
    ok(api.apiPick(a.token, 40).ok, '지정석으로는 옮길 수 있다');
  });
  test('야자를 신청하지 않은 학생 · 엉터리 값은 막는다', () => {
    const { api, tk } = setup();
    const c = api.apiSetPin('20412', '정새봄', '3579', '3579');
    const id = api.apiTRoster(tk).list.find((x) => x.sid === '20412').id;
    ok(c.ok);
    const r = api.apiTSetFixed(tk, id, 40);
    ok(!r.ok && r.msg.indexOf('신청한 학생에게만') >= 0, r.msg);
    const a = student(api, tk, { n: 1, name: '김지정' });
    [115, -1, 1.5, 'x', null].forEach((v) => ok(!api.apiTSetFixed(tk, a.id, v).ok || v === null, String(v)));
    ok(!api.apiTSetFixed(tk, 'S0000000000', 4).ok, '없는 학생');
    ok(!api.apiTSetFixed('', a.id, 4).ok, '교사가 아니면');
    ok(!api.apiTSetFixed(c.token, a.id, 4).ok, '학생 접속표로는 못 한다');
  });
  test('예전 판 명단 시트(「지정석」 머리글 없음)도 처음 지정할 때 머리글을 채운다', () => {
    const { api, gas, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    gas.sheets['명단'].getRange(1, 15).setValue('');
    delete gas.cache['hd:ro'];
    ok(api.apiTSetFixed(tk, a.id, 40).ok);
    eq(rows(gas, '명단')[0][14], '지정석');
  });
  test('담임이 요일 · 이름을 고치거나 PIN 을 초기화해도 지정석은 그대로', () => {
    const { api, gas, tk } = setup();
    const a = student(api, tk, { n: 1, name: '김지정' });
    api.apiTSetFixed(tk, a.id, 40);
    ok(api.apiTSaveStudent(tk, { id: a.id, g: 1, c: 1, n: 1, name: '김지정', d: [true, true, false, false] }).ok);
    ok(api.apiTResetPin(tk, a.id).ok);
    ok(api.apiTBulk(tk, 1, 1, '1 김지정 월 화 목', true).ok);
    eq(rosterRow(gas, a.sid)[14], 40);
  });
});
