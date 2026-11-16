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
  test('구역 색이 3학년 화면과 같다 (번호만 새 차례)', () => {
    const zone = (a, b) => { const z = new Set(); for (let i = a; i <= b; i++) z.add(by[i].zone); return [...z]; };
    deepEq(zone(1, 12), ['blue']);
    deepEq(zone(13, 21), ['yellow']);
    deepEq(zone(22, 33), ['orange']);
    deepEq(zone(34, 69), ['pink']);
    deepEq(zone(70, 81), ['orange']);
    deepEq(zone(82, 90), ['yellow']);
    deepEq(zone(91, 114), ['green']);
  });

  /* 2026-11-16 선생님이 그려 준 번호 차례 */
  const sameRow = (a, b) => { eq(by[a].y, by[b].y, a + '·' + b + ' 같은 줄'); ok(by[a].x < by[b].x, a + ' 가 ' + b + ' 왼쪽'); };
  const sameCol = (a, b) => { eq(by[a].x, by[b].x, a + '·' + b + ' 같은 세로 줄'); ok(by[a].y < by[b].y, a + ' 가 ' + b + ' 위'); };
  test('맨 위 한 줄은 왼쪽부터 1~12', () => {
    for (let n = 1; n < 12; n++) sameRow(n, n + 1);
    ok(by[1].y < by[13].y, '맨 위 줄이 양옆 줄보다 위');
  });
  test('양옆 줄은 위에서 아래로 — 왼쪽 13~21, 오른쪽 82~90', () => {
    for (let n = 13; n < 21; n++) sameCol(n, n + 1);
    for (let n = 82; n < 90; n++) sameCol(n, n + 1);
    sameRow(13, 82);
    ok(by[13].x < by[22].x && by[81].x < by[82].x, '왼쪽 줄 · 가운데 · 오른쪽 줄 차례');
  });
  test('가운데 묶음은 왼쪽 줄 위→아래, 이어서 오른쪽 줄 위→아래 (22~81)', () => {
    [22, 34, 46, 58, 70].forEach((first, k) => {
      for (let r = 0; r < 5; r++) { sameCol(first + r, first + r + 1); sameCol(first + 6 + r, first + 7 + r); }
      for (let r = 0; r < 6; r++) sameRow(first + r, first + 6 + r);
      if (k < 4) ok(by[first + 11].x < by[first + 12].x, '묶음 ' + (k + 1) + ' 다음 묶음은 오른쪽');
    });
    /* 그림에 적힌 모서리 번호 */
    [[22, 28], [27, 33], [34, 40], [39, 45], [46, 52], [51, 57], [58, 64], [63, 69], [70, 76], [75, 81]].forEach(([a, b]) => sameRow(a, b));
    sameRow(22, 76); sameRow(27, 81);
  });
  test('아래쪽 초록 91~114 는 예전 자리 그대로', () => {
    [[109, 112], [110, 111], [91, 96], [97, 102], [103, 108]].forEach(([a, b]) => sameRow(a, b));
    sameCol(109, 110); sameCol(113, 114); sameCol(91, 93);
  });
  test('교사 책상 하나, 출입문 둘', () => {
    eq(L.fixtures.filter((f) => f.kind === 'desk').length, 1);
    eq(L.fixtures.filter((f) => f.kind === 'door').length, 2);
  });
});
