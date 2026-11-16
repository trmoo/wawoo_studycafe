/*!
 * 좌석 배치 시험 — 114석이 빠짐없이, 겹치지 않고, 3학년 화면과 같은 묶음으로 놓였는가
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { createRequire } from 'module';
import { describe, test, ok, eq, deepEq } from './harness.mjs';
const require = createRequire(import.meta.url);
const { loadLayout } = require('../tools/gas-load.js');
const L = loadLayout();
const by = {};
L.seats.forEach((s) => { by[s.no] = s; });

describe('좌석 배치', () => {
  test('1~114번이 한 번씩 있다', () => {
    eq(L.seats.length, 114);
    for (let i = 1; i <= 114; i++) ok(by[i], i + '번이 없습니다');
  });
  test('모든 좌석 · 시설이 그림 안에 있다', () => {
    L.seats.concat(L.fixtures).forEach((s) => {
      ok(s.x >= 0 && s.y >= 0 && s.x + s.w <= L.W && s.y + s.h <= L.H, JSON.stringify(s));
    });
  });
  test('좌석끼리 · 좌석과 시설이 겹치지 않는다', () => {
    const all = L.seats.concat(L.fixtures);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const over = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        ok(!over, (a.no || a.kind) + ' 와 ' + (b.no || b.kind) + ' 가 겹칩니다');
      }
    }
  });
  test('구역 색이 3학년 화면과 같다', () => {
    const zone = (a, b) => { const z = new Set(); for (let i = a; i <= b; i++) z.add(by[i].zone); return [...z]; };
    deepEq(zone(1, 18), ['yellow']);
    deepEq(zone(19, 42), ['orange']);
    deepEq(zone(43, 78), ['pink']);
    deepEq(zone(79, 90), ['blue']);
    deepEq(zone(91, 114), ['green']);
  });
  test('자리 차례가 화면과 같다 (19 옆 30, 78 옆 67, 42 옆 31, 109 옆 112)', () => {
    [[19, 30], [78, 67], [66, 55], [54, 43], [42, 31], [109, 112], [91, 96], [97, 102], [103, 108]].forEach(([a, b]) => {
      eq(by[a].y, by[b].y, a + '·' + b + ' 같은 줄');
      ok(by[a].x < by[b].x, a + ' 가 왼쪽');
    });
    ok(by[19].y < by[24].y && by[1].y < by[9].y && by[79].x < by[90].x);
  });
  test('교사 책상 하나, 출입문 둘', () => {
    eq(L.fixtures.filter((f) => f.kind === 'desk').length, 1);
    eq(L.fixtures.filter((f) => f.kind === 'door').length, 2);
  });
});
