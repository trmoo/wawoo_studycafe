/*!
 * Code.gs 와 화면 자료(layout)를 node 안에서 그대로 돌리는 도우미
 * — 시험이 진짜 서버 코드와 진짜 좌석 배치를 검사하게 한다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { makeGas, GAS_NAMES } = require('./fake-gas.js');

const SRC = path.join(__dirname, '..', 'src');

/** src 안의 html 파일에서 <script> 안쪽만 꺼낸다 */
function readScript(name) {
  const raw = fs.readFileSync(path.join(SRC, name), 'utf8');
  const m = raw.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error(name + ' 안에 <script> 가 없습니다.');
  return m[1];
}

/** layout.html 의 LAYOUT */
function loadLayout() {
  return new Function(readScript('layout.html') + '\n; return LAYOUT;')();
}

/**
 * Code.gs 를 가짜 앱스 스크립트 환경 위에서 돌린다.
 * 돌려주는 값: { api: 함수·상수 모음, gas: 가짜 환경 }
 */
function loadServer(opts) {
  const code = fs.readFileSync(path.join(SRC, 'Code.gs'), 'utf8');
  const gas = makeGas(opts);
  const names = [];
  const re = /^(?:function\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const n = m[1] || m[2];
    if (names.indexOf(n) < 0) names.push(n);
  }
  const ret = 'return {' + names.map((n) => n + ': ' + n).join(', ') + '};';
  const fn = new Function(...GAS_NAMES, code + '\n' + ret);
  const api = fn(...GAS_NAMES.map((n) => gas[n]));
  return { api, gas };
}

/** 서버의 시계를 한국 시각으로 맞춘다 — at('2026-11-16 18:10') */
function at(api, kst) {
  const t = Date.parse(kst.replace(' ', 'T') + ':00+09:00');
  if (isNaN(t)) throw new Error('시각이 잘못되었습니다: ' + kst);
  api.CLOCK.now = () => new Date(t);
}

/** 시험용 교사 비밀번호 — 실제 학교에서 쓰는 비밀번호를 여기에 적지 말 것 */
const TEST_PW = 'test-pass-1';

/** 시트를 만들어 둔 상태로 시작한다 (시각은 2026-11-16 월요일 18:10, 교사 비밀번호는 TEST_PW) */
function freshServer(opts) {
  const { api, gas } = loadServer(opts);
  at(api, '2026-11-16 18:10');
  api.setupSheets();
  api.setTeacherPw_(TEST_PW);
  return { api, gas };
}

/** 교사로 들어가 접속표를 돌려준다 */
function teacher(api, name) {
  const r = api.apiTLogin(name || '김감독', TEST_PW);
  if (!r.ok) throw new Error('교사 로그인 실패: ' + r.msg);
  return r.token;
}

/** 학생을 명단에 넣고(교사 화면으로) PIN 을 정해 접속표를 돌려준다 */
function student(api, tk, s, pin) {
  const r = api.apiTSaveStudent(tk, Object.assign({ g: 1, c: 1, n: 5, name: '김하늘', d: [true, true, true, true] }, s || {}));
  if (!r.ok) throw new Error('명단 넣기 실패: ' + r.msg);
  const st = Object.assign({ g: 1, c: 1, n: 5, name: '김하늘' }, s || {});
  const p = pin || '3141';
  const a = api.apiSetPin(r.sid, st.name, p, p);
  if (!a.ok) throw new Error('PIN 정하기 실패: ' + a.msg);
  return { token: a.token, id: r.id, sid: r.sid };
}

module.exports = { readScript, loadLayout, loadServer, freshServer, at, teacher, student, SRC, TEST_PW };
