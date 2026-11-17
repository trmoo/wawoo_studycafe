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

  /** 보여 줄 계정 넷 — PIN 을 정해 둔 학생 · 처음 들어오는 학생 · 월요일을 신청하지 않은 학생(학부모 동의 체크 체험) · 지정석 학생
      (명단에 없는 학생 체험은 10238 처럼 명단에 없는 학번 — 무작위 학생은 번호를 1~33 에서만 뽑으므로 34~40번은 비어 있다) */
  var DEMO = [
    { g: 1, c: 1, n: 5, name: '김하랑', d: [true, true, true, true], pin: '3141' },
    { g: 2, c: 3, n: 7, name: '이서온', d: [true, true, false, false], pin: '' },
    { g: 1, c: 3, n: 36, name: '박도담', d: [false, true, true, false], pin: '2718' },
    /* 📌 지정석(40번)이 있는 학생 — 오늘 아직 앉았다고 알리지 않았다 */
    { g: 1, c: 2, n: 37, name: '최다온', d: [true, true, true, true], pin: '1618', fx: 40 }
  ];
  /** 무작위 학생 몇 명에게 줄 지정석 (보여 줄 계정의 40번과 함께 다른 학생은 이 자리를 고르지 않는다) */
  var FIX = [1, 2, 3, 4, 5, 6, 13, 14];
  /** 야자를 신청하지 않았지만 학부모 동의를 체크하고 참여하려고 스스로 등록한 학생 (요일 없음) */
  var SELF = [{ g: 1, c: 1, n: 34 }, { g: 1, c: 4, n: 35 }, { g: 2, c: 2, n: 36 }, { g: 2, c: 9, n: 34 }];
  var SELF_BY = '학생(처음 등록 · 신청 안 함)';

  function plant(api, fake) {
    var r = rng(20261116);
    var ss = fake.SpreadsheetApp.getActiveSpreadsheet();
    var shR = ss.getSheetByName('명단'), shC = ss.getSheetByName('기록'), shS = ss.getSheetByName('감독');
    var list = [], used = {};
    DEMO.forEach(function (d) { used[api.sidOf_(d.g, d.c, d.n)] = 1; list.push(d); });
    SELF.forEach(function (x) {
      used[api.sidOf_(x.g, x.c, x.n)] = 1;
      list.push({ g: x.g, c: x.c, n: x.n, name: SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)],
        d: [false, false, false, false], pin: '2580', self: true });
    });
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
    var cand = list.filter(function (s) { return !s.self && DEMO.indexOf(s) < 0; });
    FIX.forEach(function (no, i) { cand[i * 5].fx = no; });
    var fixed = {};
    list.forEach(function (s) { if (s.fx) fixed[s.fx] = 1; });
    function freeSeats() { var f = []; for (var i = 1; i <= 114; i++) if (!fixed[i]) f.push(i); return f; }
    list.forEach(function (s) {
      s.id = 'S' + hex(r, 10);
      s.sid = api.sidOf_(s.g, s.c, s.n);
      var salt = 'seed' + hex(r, 6) + ':';
      shR.appendRow([s.id, s.g, s.c, s.n, s.sid, s.name].concat(s.d.map(function (b) { return b ? 'O' : ''; }))
        .concat([s.pin ? api.sha_(salt + s.pin) : '', s.pin ? salt : '', '2026-09-01 09:00:00', s.self ? SELF_BY : '씨앗', s.fx || '']));
    });

    /* 신청하지 않은 날 학부모 동의를 체크하고 참여한 기록 (스스로 등록한 학생은 자주, 다른 요일 신청 학생은 가끔) */
    function extraPick(date, s, free, at) {
      var seat = free.splice(Math.floor(r() * free.length), 1)[0];
      var t = date + ' 16:5' + Math.floor(r() * 9) + ':00';
      shC.appendRow([date, s.id, s.sid, s.name, s.g, seat, '', '', '', t, 0, at, '학생', '미신청', t]);
    }

    /* 지난 두 주(월 화 목 금)는 거의 다 출석, 몇몇은 결석 · 사유 · 미입실 */
    var today = api.today_();
    var w = '일월화수목금토'.indexOf(api.dayName_(today));
    var monday = api.addDays_(today, w === 0 ? -6 : 1 - w);
    var SUPS = ['박정진', '최감독', '정바름', '한마음', '윤슬기', '강바다', '조은결', '임하람'];
    [-14, -7].forEach(function (back, wk) {
      var mon = api.addDays_(monday, back);
      [mon, api.addDays_(mon, 1), api.addDays_(mon, 3), api.addDays_(mon, 4)].forEach(function (date, di) {
        var sup = SUPS[wk * 4 + di];
        var free = freeSeats();
        list.forEach(function (s) {
          if (!s.d[di]) {
            if (r() < (s.self ? 0.35 : 0.04)) extraPick(date, s, free, date + ' 17:00:00');
            return;
          }
          var x = r();
          if (x < 0.05) return;                                   // 미입실 — 아무 기록도 없음
          if (x < 0.1) { shC.appendRow([date, s.id, s.sid, s.name, s.g, '', '결석', '결석', '', '', 0, date + ' 19:00:00', sup, '신청', '']); return; }
          if (x < 0.14) { shC.appendRow([date, s.id, s.sid, s.name, s.g, '', '사유', '사유', x < 0.12 ? '병원(사전 연락)' : '학교 행사', '', 0, date + ' 17:00:00', sup, '신청', '']); return; }
          var seat = s.fx || free.splice(Math.floor(r() * free.length), 1)[0];   // 지정석 학생은 언제나 지정석
          /* 2교시만 사유(조기 귀가) · 1교시만 결석(자리에 없음) 이 드문드문 */
          var p2 = x > 0.97 ? '사유' : '', p1 = x > 0.94 && x <= 0.97 ? '결석' : '';
          var memo = p2 ? '보호자 연락 후 조기 귀가' : (p1 ? '출석 표시했으나 자리에 없음' : '');
          shC.appendRow([date, s.id, s.sid, s.name, s.g, seat, p1, p2, memo, date + ' 16:5' + Math.floor(r() * 9) + ':00', 0, date + ' 19:30:00',
            p1 || p2 ? sup : '학생', '신청', '']);
        });
        shS.appendRow([date, sup, date + ' 18:00:00', date + ' 21:20:00']);
      });
    });

    /* 오늘 — 신청한 학생의 70% 쯤이 자리를 골랐다. 보여 줄 계정 셋은 아직 고르지 않았다.
       신청하지 않은 학생 몇몇은 학부모 동의를 체크하고 자리를 골랐다 */
    var ti = ['월', '화', '목', '금'].indexOf(api.dayName_(today));
    if (ti >= 0) {
      var free2 = freeSeats();
      list.forEach(function (s, i) {
        if (i < DEMO.length) return;
        if (!s.d[ti]) { if (r() < (s.self ? 0.5 : 0.05)) extraPick(today, s, free2, today + ' 17:30:00'); return; }
        if (r() < 0.3) return;                                   // 지정석 학생이면 맡아 둔 채 아직 안 앉음(점선)
        var seat = s.fx || free2.splice(Math.floor(r() * free2.length), 1)[0];
        var y = r();
        var p1 = y < 0.04 ? '결석' : (y < 0.06 ? '사유' : '');
        var memo = p1 === '결석' ? '출석 표시했으나 자리에 없음' : (p1 ? '학교 행사' : '');
        shC.appendRow([today, s.id, s.sid, s.name, s.g, seat, p1, '', memo, today + ' 16:5' + Math.floor(r() * 9) + ':00', 0, today + ' 17:30:00',
          p1 ? '박정진' : '학생', '신청', '']);
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
