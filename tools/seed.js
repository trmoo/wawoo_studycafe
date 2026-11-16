/*!
 * 미리보기 씨앗 — 지어낸 학생 명단과 지난주 · 오늘 기록을 가짜 시트에 깐다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 실제 출석부의 학생 이름을 여기에 넣지 말 것. 이름은 성 + 이름 조각을 무작위로 이은 것이다.
 * ⚠ node 와 브라우저 양쪽에서 돌아야 하므로 ES5 문법으로만 쓴다.
 */
(function (root) {
  'use strict';
  var SUR = '김이박최정강조윤장임한오서신권황안송류홍'.split('');
  var GIV = ['하랑', '서온', '도담', '라온', '이솔', '다올', '해솔', '가람', '나래', '시온', '여울', '보람', '새봄', '단비',
             '한결', '푸름', '은솔', '초롱', '별하', '윤슬', '아름', '소담', '하늬', '마루', '온유', '나린', '다온', '로아'];

  function rng(seed) {
    var s = seed;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }
  function hex(r, n) { var o = ''; for (var i = 0; i < n; i++) o += '0123456789abcdef'.charAt(Math.floor(r() * 16)); return o; }

  /** 보여 줄 계정 두 개 — 하나는 PIN 을 정해 두었고, 하나는 처음 들어오는 학생 */
  var DEMO = [
    { g: 1, c: 1, n: 5, name: '김하랑', d: [true, true, true, true], pin: '3141' },
    { g: 2, c: 3, n: 7, name: '이서온', d: [true, true, false, false], pin: '' }
  ];

  function plant(api, fake) {
    var r = rng(20261116);
    var ss = fake.SpreadsheetApp.getActiveSpreadsheet();
    var shR = ss.getSheetByName('명단'), shC = ss.getSheetByName('기록'), shS = ss.getSheetByName('감독');
    var list = [], used = {};
    DEMO.forEach(function (d) { used[api.sidOf_(d.g, d.c, d.n)] = 1; list.push(d); });
    [[1, 44], [2, 48]].forEach(function (gc) {
      var made = 0, guard = 0;
      while (made < gc[1] && guard++ < 999) {
        var c = 1 + Math.floor(r() * 12), n = 1 + Math.floor(r() * 33);
        var sid = api.sidOf_(gc[0], c, n);
        if (used[sid]) continue;
        used[sid] = 1;
        var d;
        do { d = [r() < 0.62, r() < 0.62, r() < 0.62, r() < 0.62]; } while (d.filter(Boolean).length < 2);
        list.push({ g: gc[0], c: c, n: n, name: SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)], d: d, pin: r() < 0.8 ? '2580' : '' });
        made++;
      }
    });
    list.forEach(function (s) {
      s.id = 'S' + hex(r, 10);
      s.sid = api.sidOf_(s.g, s.c, s.n);
      var salt = 'seed' + hex(r, 6) + ':';
      shR.appendRow([s.id, s.g, s.c, s.n, s.sid, s.name].concat(s.d.map(function (b) { return b ? 'O' : ''; }))
        .concat([s.pin ? api.sha_(salt + s.pin) : '', s.pin ? salt : '', '2026-09-01 09:00:00', '씨앗']));
    });

    /* 지난주(월 화 목 금)는 거의 다 출석, 몇몇은 결석 · 사유 · 미입실 */
    var today = api.today_();
    var w = '일월화수목금토'.indexOf(api.dayName_(today));
    var monday = api.addDays_(today, w === 0 ? -6 : 1 - w);
    var lastMon = api.addDays_(monday, -7);
    var past = [lastMon, api.addDays_(lastMon, 1), api.addDays_(lastMon, 3), api.addDays_(lastMon, 4)];
    var SUPS = ['박정진', '최감독', '정바름', '한마음'];
    past.forEach(function (date, di) {
      var free = []; for (var i = 1; i <= 114; i++) free.push(i);
      list.forEach(function (s) {
        if (!s.d[di]) return;
        var x = r();
        if (x < 0.05) return;                                   // 미입실 — 아무 기록도 없음
        if (x < 0.1) { shC.appendRow([date, s.id, s.sid, s.name, s.g, '', '결석', '결석', '', '', 0, date + ' 19:00:00', SUPS[di]]); return; }
        if (x < 0.14) { shC.appendRow([date, s.id, s.sid, s.name, s.g, '', '사유', '사유', x < 0.12 ? '병원(사전 연락)' : '학교 행사', '', 0, date + ' 17:00:00', SUPS[di]]); return; }
        var seat = free.splice(Math.floor(r() * free.length), 1)[0];
        /* 2교시만 사유(조기 귀가) · 1교시만 결석(자리에 없음) 이 드문드문 */
        var p2 = x > 0.97 ? '사유' : '', p1 = x > 0.94 && x <= 0.97 ? '결석' : '';
        var memo = p2 ? '보호자 연락 후 조기 귀가' : (p1 ? '출석 표시했으나 자리에 없음' : '');
        shC.appendRow([date, s.id, s.sid, s.name, s.g, seat, p1, p2, memo, date + ' 16:5' + Math.floor(r() * 9) + ':00', 0, date + ' 19:30:00', p1 || p2 ? SUPS[di] : '학생']);
      });
      shS.appendRow([date, SUPS[di], date + ' 18:00:00', date + ' 21:20:00']);
    });

    /* 오늘 — 신청한 학생의 70% 쯤이 자리를 골랐다. 보여 줄 두 계정은 아직 고르지 않았다 */
    var ti = ['월', '화', '목', '금'].indexOf(api.dayName_(today));
    if (ti >= 0) {
      var free2 = []; for (var k = 1; k <= 114; k++) free2.push(k);
      list.forEach(function (s, i) {
        if (i < DEMO.length || !s.d[ti] || r() < 0.3) return;
        var seat = free2.splice(Math.floor(r() * free2.length), 1)[0];
        var y = r();
        var p1 = y < 0.04 ? '결석' : (y < 0.06 ? '사유' : '');
        var memo = p1 === '결석' ? '출석 표시했으나 자리에 없음' : (p1 ? '학교 행사' : '');
        shC.appendRow([today, s.id, s.sid, s.name, s.g, seat, p1, '', memo, today + ' 16:5' + Math.floor(r() * 9) + ':00', 0, today + ' 17:30:00', p1 ? '박정진' : '학생']);
      });
      shS.appendRow([today, '박정진', today + ' 17:30:00', today + ' 17:30:00']);
    }
    api.clearCaches_();
    return { count: list.length };
  }

  var SEED = { plant: plant, DEMO: DEMO };
  if (typeof module !== 'undefined' && module.exports) module.exports = SEED;
  root.SEED = SEED;
})(typeof globalThis !== 'undefined' ? globalThis : this);
