/*!
 * 서버 시험 (4) — 깃허브 화면에서 오는 요청 (doPost)
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * 폰에 구글 계정이 여러 개 로그인되어 있으면 웹 앱 주소가 …/u/4/… 로 바뀌며 열리지 않는다.
 * 그래서 화면을 깃허브에서 띄우고, 화면은 구글 쿠키 없이 doPost 로 api 함수를 부른다.
 * 여기서는 doPost 가 google.script.run 과 같은 결과를 돌려주는지, 목록 밖의 함수는 막는지 본다.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { describe, test, ok, eq, deepEq } from './harness.mjs';
const require = createRequire(import.meta.url);
const { freshServer, at, teacher, student, SRC, TEST_PW } = require('../tools/gas-load.js');

/** 화면이 보내는 꼴 그대로 doPost 를 부르고, 돌려받은 글을 JSON 으로 푼다 */
function post(api, body) {
  const out = api.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body), type: 'text/plain' } });
  return JSON.parse(out.getContent());
}

describe('🌐 깃허브 화면 — doPost', () => {
  test('부를 수 있는 함수 목록 = Code.gs 의 api 함수 전부, 그 밖은 없다', () => {
    const { api } = freshServer();
    const code = fs.readFileSync(path.join(SRC, 'Code.gs'), 'utf8');
    const apis = [...code.matchAll(/^function (api\w+)\(/gm)].map((m) => m[1]).sort();
    deepEq(Object.keys(api.REMOTE_API).sort(), apis);
    apis.forEach((n) => eq(api.REMOTE_API[n], api[n], n + ' 는 같은 함수를 가리켜야 합니다'));
  });

  test('교사 로그인 → 학생 넣기 → 학생 로그인 → 자리 고르기가 doPost 로 그대로 된다', () => {
    const { api } = freshServer();
    const t = post(api, { fn: 'apiTLogin', args: ['김감독', TEST_PW] });
    ok(t.ok && t.r.ok && t.r.token, JSON.stringify(t));
    const s = post(api, { fn: 'apiTSaveStudent', args: [t.r.token, { g: 1, c: 1, n: 5, name: '김하늘', d: [true, true, true, true] }] });
    ok(s.ok && s.r.ok, JSON.stringify(s));
    const p = post(api, { fn: 'apiSetPin', args: [s.r.sid, '김하늘', '3141', '3141'] });
    ok(p.ok && p.r.ok && p.r.token, JSON.stringify(p));
    const pick = post(api, { fn: 'apiPick', args: [p.r.token, 33, false] });
    ok(pick.ok && pick.r.ok, JSON.stringify(pick));
    const b = post(api, { fn: 'apiBoard', args: [p.r.token, ''] });
    eq(b.r.mine, 33);
    /* 같은 것을 google.script.run 처럼 바로 부른 것과 같다 */
    deepEq(b.r, JSON.parse(JSON.stringify(api.apiBoard(p.r.token, ''))));
  });

  test('목록 밖의 함수는 거절한다 — 시트 만들기 · 비밀번호 정하기 · include · 속성 이름', () => {
    const { api } = freshServer();
    ['setupSheets', 'setTeacherPw_', 'include', 'doGet', 'doPost', 'menuFreeOn', '__proto__', 'constructor',
      'hasOwnProperty', 'toString', ''].forEach((fn) => {
      const r = post(api, { fn: fn, args: ['x'] });
      ok(r.ok === false && /부를 수 없는 함수/.test(r.err), fn + ' → ' + JSON.stringify(r));
    });
    const r2 = post(api, { fn: ['apiLogin'], args: [] });
    ok(r2.ok === false, '이름이 글자가 아니면 거절');
    /* 거절해도 교사 비밀번호는 그대로다 */
    ok(api.apiTLogin('김감독', TEST_PW).ok);
  });

  test('잘못된 본문 · 너무 긴 본문은 ok:false 로 돌려준다 (웹 앱 오류 화면이 아니라 JSON)', () => {
    const { api } = freshServer();
    ['', '{', 'null', '[]', '"apiBoard"'].forEach((body) => {
      const r = post(api, body);
      eq(r.ok, false, JSON.stringify(body));
    });
    const big = post(api, JSON.stringify({ fn: 'apiTBulk', args: ['x', 1, 1, 'a'.repeat(api.REMOTE_MAX_BODY), false] }));
    ok(big.ok === false && /너무 깁니다/.test(big.err), JSON.stringify(big));
    const none = api.doPost(undefined);
    eq(JSON.parse(none.getContent()).ok, false);
  });

  test('api 함수 안에서 난 오류는 메시지를 담아 돌려준다 (화면은 다시 보내기로 넘어간다)', () => {
    const { api } = freshServer();
    const keep = api.REMOTE_API.apiBoard;
    api.REMOTE_API.apiBoard = function () { throw new Error('시트를 읽지 못했습니다'); };
    try {
      const r = post(api, { fn: 'apiBoard', args: ['t'] });
      ok(r.ok === false && r.err === '시트를 읽지 못했습니다', JSON.stringify(r));
    } finally { api.REMOTE_API.apiBoard = keep; }
  });

  test('args 가 없거나 배열이 아니면 빈 인자로 부른다 — 로그인 정보가 없으니 거절된다', () => {
    const { api } = freshServer();
    const r = post(api, { fn: 'apiBoard' });
    ok(r.ok === true && r.r && r.r.relogin, JSON.stringify(r));
    const r2 = post(api, { fn: 'apiBoard', args: { 0: 'x' } });
    ok(r2.ok === true && r2.r && r2.r.relogin, JSON.stringify(r2));
  });

  test('학생 화면 응답에는 여전히 학번이 없다 (doPost 를 거쳐도 가려진 이름만)', () => {
    const { api } = freshServer();
    const tk = teacher(api);
    const a = student(api, tk, { n: 1, name: '김먼저' });
    const b = student(api, tk, { n: 2, name: '이나중' });
    at(api, '2026-11-16 18:10');
    api.apiPick(a.token, 10);
    const r = post(api, { fn: 'apiBoard', args: [b.token, ''] });
    const txt = JSON.stringify(r);
    ok(txt.indexOf(a.sid) < 0 && txt.indexOf('김먼저') < 0, txt.slice(0, 300));
    ok(txt.indexOf('김*저') >= 0, '가린 이름이 보여야 합니다');
  });
});
