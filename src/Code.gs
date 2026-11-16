/*!
 * 1·2학년 자습실 좌석배치도 — 서버 (Google Apps Script)
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * 시트 네 장
 *   명단      — 야자 신청 학생 (담임교사 탭에서 고친다. 시트에 바로 붙여 넣어도 된다)
 *   기록      — 날짜마다 학생 한 명 = 한 줄 (좌석 · 1교시 · 2교시 · 메모)
 *   감독      — 날짜마다 그날 출결을 기록한 교사
 *   변경 기록 — 누가 언제 무엇을 바꿨는지
 *
 * 빠르기 — 30명이 동시에 열어도 버티도록
 *   · 「그날 기록」 과 「명단」 을 CacheService 에 두고 읽는다. 시트는 쓸 때만 한 줄씩 고친다.
 *   · 쓰기는 LockService 로 한 번에 하나씩. 자물쇠를 8초 안에 못 잡으면 busy 를 돌려주고
 *     화면이 「잠시 기다려 주세요」 를 띄운 채 저절로 다시 보낸다.
 *   · 캐시를 다시 만드는 일은 자물쇠 안에서만 한다(읽는 쪽이 낡은 값을 덮어쓰지 못하게).
 *
 * 보안
 *   · 화면이 보낸 학번·날짜를 믿지 않는다. 학생은 접속표로 누구인지 가리고, 날짜는 서버 시계로 정한다.
 *   · 학번(숫자 5자리) · 이름(한글 2~5자) · PIN(숫자 4자리) · 메모(100자) 모양을 서버가 검사한다.
 *   · PIN · 교사 비밀번호는 솔트 + SHA-256 해시로만 둔다. 여러 번 틀리면 10분 동안 잠근다.
 *   · 학생 화면에는 다른 학생의 학번 · 학년 · 실명을 보내지 않는다 (홍*동 처럼 가린 이름만).
 */

/* ── 설정 ─────────────────────────────────────────────── */
var APP_NAME = '1·2학년 자습실 좌석배치도';
var TZ = 'Asia/Seoul';
var DAYS = ['월', '화', '목', '금'];       // 야간 자율학습 요일
var SEAT_MAX = 114;
var OPEN_FROM = '16:50';                   // 학생이 자리를 고를 수 있는 시간
var OPEN_TO = '21:30';
var MAX_CHANGES = 3;                       // 하루에 자리를 바꿀 수 있는 횟수 (처음 고르기는 세지 않는다)
var MIN_DAYS = 2;                          // 신청 요일은 이틀 이상
var STATUSES = ['출석', '지각', '조퇴', '자리비움', '결석', '사유'];
var CLASS_MAX = 12;
var NUM_MAX = 40;
var MEMO_MAX = 100;
var SESSION_SEC = 21600;                   // 접속표 6시간 (CacheService 의 최대)
var CACHE_SEC = 600;                       // 그날 기록 · 명단 캐시 10분 (지나면 시트에서 다시 만든다)
var LOCK_MS = 8000;

var SID_RE = /^[12](0[1-9]|1[0-2])(0[1-9]|[1-3][0-9]|40)$/;   // 학년 1자리 + 반 2자리 + 번호 2자리
var NAME_RE = /^[가-힣]{2,5}$/;
var TNAME_RE = /^[가-힣]{2,6}$/;
var PIN_RE = /^[0-9]{4}$/;
var DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
var TOKEN_RE = /^[0-9a-f]{64}$/;
var ID_RE = /^S[0-9a-f]{10}$/;

var SH_ROSTER = '명단';
var SH_REC = '기록';
var SH_SUP = '감독';
var SH_LOG = '변경 기록';
var HEAD_ROSTER = ['아이디', '학년', '반', '번호', '학번', '이름', '월', '화', '목', '금', 'PIN 해시', 'PIN 솔트', '고친 때', '고친 사람'];
var HEAD_REC = ['날짜', '아이디', '학번', '이름', '학년', '좌석', '1교시', '2교시', '메모', '자리 고른 때', '자리 바꾼 횟수', '고친 때', '고친 사람'];
var HEAD_SUP = ['날짜', '교사', '처음 기록', '마지막 기록'];
var HEAD_LOG = ['시각', '누가', '무엇을', '내용'];

/* 교사 비밀번호 — 코드에는 원문도 해시도 두지 않는다 (공개 저장소에 올리므로).
   「① 시트 준비하기」 나 「② 교사 비밀번호 정하기 · 바꾸기」 에서 선생님이 정하면 스크립트 속성 TPW 에 솔트 + 해시만 남는다. */

/* 시계 — 시험 · 미리보기가 시각을 바꿔 끼울 수 있게 한곳에 둔다 */
var CLOCK = { now: function () { return new Date(); } };

/* ── 화면 ─────────────────────────────────────────────── */
function include(name) {
  if (!name) {
    throw new Error('include 는 화면을 만들 때 쓰는 함수입니다. 편집기에서 실행할 함수는 setupSheets 입니다 ' +
      '(위쪽 「실행할 함수」 고르기에서 setupSheets 로 바꾼 뒤 ▶ 를 누르세요).');
  }
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function doGet(e) {
  var page = e && e.parameter && e.parameter.page === 'teacher' ? 'teacher' : 'index';
  var t = HtmlService.createTemplateFromFile(page);
  t.BOOT = bootJson_(page);
  return t.evaluate()
    .setTitle(page === 'teacher' ? APP_NAME + ' (교사용)' : APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function boot_(page) {
  return {
    page: page, app: APP_NAME, days: DAYS, from: OPEN_FROM, to: OPEN_TO, statuses: STATUSES,
    maxChanges: MAX_CHANGES, minDays: MIN_DAYS, seatMax: SEAT_MAX, classMax: CLASS_MAX,
    numMax: NUM_MAX, memoMax: MEMO_MAX, preview: false
  };
}
function bootJson_(page) { return JSON.stringify(boot_(page)).replace(/</g, '\\u003c'); }

/* ── 시트 메뉴 ────────────────────────────────────────── */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('자습실')
    .addItem('① 시트 준비하기', 'setupSheets')
    .addItem('② 교사 비밀번호 정하기 · 바꾸기', 'menuChangePw')
    .addItem('③ 시트에 붙여 넣은 명단 정리하기', 'menuNormalize')
    .addSeparator()
    .addItem('화면이 시트와 다를 때 — 캐시 비우기', 'menuClearCache')
    .addItem('웹앱 주소 보기', 'menuUrl')
    .addToUi();
}

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  [[SH_ROSTER, HEAD_ROSTER], [SH_REC, HEAD_REC], [SH_SUP, HEAD_SUP], [SH_LOG, HEAD_LOG]].forEach(function (p) {
    var sh = ss.getSheetByName(p[0]) || ss.insertSheet(p[0]);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, p[1].length).setValues([p[1]]).setFontWeight('bold').setBackground('#eef2f8');
      sh.setFrozenRows(1);
    }
  });
  /* 날짜 칸이 날짜 값으로 바뀌지 않게 글자 서식으로 둔다 (읽을 때도 dateStr_ 로 한 번 더 다듬는다) */
  ss.getSheetByName(SH_REC).getRange('A:A').setNumberFormat('@');
  ss.getSheetByName(SH_SUP).getRange('A:A').setNumberFormat('@');
  clearCaches_();
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* 편집기에서 ▶ 로 실행하면 창을 띄울 수 없다 — 괜찮다 */ }
  if (ui) {
    if (!teacherPw_()) askPw_(ui, '교사용 비밀번호 정하기');
    ui.alert('시트를 준비했습니다. 이제 편집기에서 배포 → 새 배포 → 웹 앱 으로 배포하세요.' +
      (teacherPw_() ? '' : ' ⚠ 아직 교사용 비밀번호가 없습니다. 메뉴 「② 교사 비밀번호 정하기 · 바꾸기」 로 정해야 교사 화면에 들어갈 수 있습니다.'));
  }
  return true;
}

/** 교사 비밀번호를 솔트 + 해시로 남긴다 (원문은 어디에도 남지 않는다) */
function setTeacherPw_(pw) {
  pw = String(pw || '');
  if (pw.length < 6 || pw.length > 30) return false;
  var salt = token_().slice(0, 16) + ':';
  PropertiesService.getScriptProperties().setProperty('TPW', JSON.stringify({ salt: salt, hash: sha_(salt + pw) }));
  return true;
}

function askPw_(ui, title) {
  var a = ui.prompt(title, '교사 화면에 들어갈 때 쓸 비밀번호 (6~30자). 학생에게 알려 주지 마세요.', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return false;
  var pw = String(a.getResponseText() || '');
  if (pw.length < 6 || pw.length > 30) { ui.alert('6~30자로 정해 주세요. 정하지 않았습니다.'); return false; }
  var b = ui.prompt(title, '한 번 더 넣어 주세요', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return false;
  if (String(b.getResponseText() || '') !== pw) { ui.alert('두 번 넣은 비밀번호가 다릅니다. 정하지 않았습니다.'); return false; }
  setTeacherPw_(pw);
  log_('시트 메뉴', title, '');
  return true;
}

function menuChangePw() {
  var ui = SpreadsheetApp.getUi();
  if (askPw_(ui, '교사 비밀번호 정하기 · 바꾸기')) {
    ui.alert('정했습니다. 이미 들어와 있는 선생님은 그대로 쓰고, 새로 들어올 때부터 새 비밀번호를 씁니다.');
  }
}

function menuNormalize() {
  var r = withLock_(function () { return normalizeRoster_('시트 메뉴'); });
  var msg = r.busy ? r.msg : '명단을 정리했습니다. 아이디 ' + r.newIds + '명 · 학번 ' + r.fixed + '명을 채웠고, 잘못된 줄은 ' + r.bad.length + '개입니다.' +
    (r.bad.length ? '\n\n' + r.bad.slice(0, 15).join('\n') : '');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* 편집기 실행 */ }
  return r;
}

function menuClearCache() {
  clearCaches_();
  try { SpreadsheetApp.getUi().alert('캐시를 비웠습니다. 화면이 다음 갱신 때 시트에서 다시 읽습니다.'); } catch (e) { /* 편집기 실행 */ }
}

function menuUrl() {
  var u = ScriptApp.getService().getUrl();
  var msg = u ? '학생: ' + u + '\n교사: ' + u + '?page=teacher' : '아직 웹 앱으로 배포하지 않았습니다.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* 편집기 실행 */ }
  return msg;
}

/* ── 작은 도구 ────────────────────────────────────────── */
function cache_() { return CacheService.getScriptCache(); }
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('「' + name + '」 시트가 없습니다. 시트 메뉴 「자습실 → ① 시트 준비하기」 를 먼저 실행하세요.');
  return sh;
}
function hex_(bytes) {
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)); }
function token_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase(); }
function newId_() { return 'S' + token_().slice(0, 10); }
function fmt_(d, f) { return Utilities.formatDate(d, TZ, f); }
function today_() { return fmt_(CLOCK.now(), 'yyyy-MM-dd'); }
function hm_() { return fmt_(CLOCK.now(), 'HH:mm'); }
function stamp_() { return fmt_(CLOCK.now(), 'yyyy-MM-dd HH:mm:ss'); }
function fail_(msg, extra) {
  var r = { ok: false, msg: msg };
  if (extra) for (var k in extra) r[k] = extra[k];
  return r;
}
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/** 시트가 날짜 글자를 날짜 값으로 바꿔 놓았어도 'yyyy-MM-dd' 로 되돌린다 */
function dateStr_(v) {
  if (v instanceof Date) return fmt_(v, 'yyyy-MM-dd');
  var s = str_(v);
  if (/^'/.test(s)) s = s.slice(1);
  return s;
}
function stampStr_(v) { return v instanceof Date ? fmt_(v, 'yyyy-MM-dd HH:mm:ss') : str_(v); }

function isDate_(s) {
  if (!DATE_RE.test(s)) return false;
  var p = s.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
}
/** '2026-11-16' → '월' (시간대와 상관없이 달력으로만 셈한다) */
function dayName_(date) {
  var p = date.split('-');
  return '일월화수목금토'.charAt(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay());
}
function addDays_(date, n) {
  var p = date.split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  var mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
  return d.getUTCFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
}

/** 시트에 쓰는 글자 다듬기 — 제어 문자를 없애고 길이를 자르고, 수식으로 읽히지 않게 한다 */
function safeCell_(s, max) {
  s = String(s === null || s === undefined ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (max) s = s.slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
/** 시트에서 읽은 글자에서 수식 막이(') 를 걷어 낸다 */
function unsafeCell_(s) { s = str_(s); return /^'[=+\-@]/.test(s) ? s.slice(1) : s; }

/** 학생 화면에 보이는 가린 이름 — 홍길동 → 홍*동, 김수 → 김*, 남궁민수 → 남**수 */
function mask_(name) {
  name = String(name || '');
  if (name.length <= 1) return '*';
  if (name.length === 2) return name.charAt(0) + '*';
  return name.charAt(0) + new Array(name.length - 1).join('*') + name.charAt(name.length - 1);
}

function truthy_(v) { return v === true || /^(o|O|○|◯|1|y|Y|v|V|✓|✔|TRUE|true)$/.test(str_(v)); }

/* 여러 번 틀림 · 너무 잦은 요청을 세는 칸 (CacheService — 10분 · 1분 지나면 저절로 사라진다) */
/** 캐시에 넣기 — 값이 100KB 를 넘는 등으로 실패해도 앱은 시트에서 읽어 계속 돈다 */
function putJ_(key, obj) {
  try { cache_().put(key, JSON.stringify(obj), CACHE_SEC); } catch (e) { /* 캐시 없이 간다 */ }
}
function cnt_(k) { return Number(cache_().get(k) || 0); }
function bump_(k, sec) { cache_().put(k, String(cnt_(k) + 1), sec || 600); }
/** 1분 동안 limit 번까지만 받는다 */
function rate_(key, limit) {
  var k = 'rl:' + key + ':' + Math.floor(CLOCK.now().getTime() / 60000);
  var n = cnt_(k);
  if (n >= limit) return false;
  cache_().put(k, String(n + 1), 120);
  return true;
}

/** 쓰기는 한 번에 하나씩 — 자물쇠를 못 잡으면 busy 로 돌려주어 화면이 기다렸다 다시 보낸다 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_MS)) {
    return { ok: false, busy: true, msg: '지금 접속한 사람이 많아 차례를 기다리는 중입니다. 새로고침하지 말고 잠시 기다려 주세요.' };
  }
  try { return fn(); } finally { lock.releaseLock(); }
}

/** api 함수를 감싸 오류가 나도 화면에 한국어로 알린다 */
function guard_(fn) {
  try { return fn(); } catch (e) {
    return { ok: false, msg: '서버에서 문제가 생겼습니다: ' + (e && e.message ? e.message : e) };
  }
}

function log_(who, what, detail) {
  try { sheet_(SH_LOG).appendRow([stamp_(), safeCell_(who, 30), safeCell_(what, 40), safeCell_(detail, 300)]); } catch (e) { /* 기록 실패로 본 작업을 막지 않는다 */ }
}

function clearCaches_() {
  var c = cache_();
  c.remove('roster');
  c.remove('sup');
  var t = today_();
  for (var i = -7; i <= 7; i++) c.remove('day:' + addDays_(t, i));
}

/* ── 접속표 ───────────────────────────────────────────── */
function newSession_(obj) {
  var t = token_();
  cache_().put('ss:' + t, JSON.stringify(obj), SESSION_SEC);
  return t;
}
function getSession_(token, kind) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  var raw = cache_().get('ss:' + token);
  if (!raw) return null;
  var s;
  try { s = JSON.parse(raw); } catch (e) { return null; }
  return s && s.k === kind ? s : null;
}
/** 학생 접속표 → 명단의 학생. PIN 을 초기화했거나 명단에서 빠졌으면 null (다시 들어오게 한다) */
function studentOf_(token) {
  var s = getSession_(token, 's');
  if (!s) return null;
  var st = rosterById_(s.id);
  if (!st || !st.ph || st.ph.slice(-10) !== s.st) return null;
  return st;
}
function teacherOf_(token) { return getSession_(token, 't'); }

/* ── 명단 ─────────────────────────────────────────────── */
/**
 * 명단 = { v: 판 번호, list: [ {id,g,c,n,sid,name,d:[월,화,목,금],ph,ps,r} ] }
 * 캐시에 두고 쓴다. 고칠 때마다 캐시를 지운다.
 */
function roster_(inLock) {
  var raw = cache_().get('roster');
  if (raw) { try { return JSON.parse(raw); } catch (e) { /* 다시 만든다 */ } }
  if (inLock) return buildRoster_();
  var lock = LockService.getScriptLock();
  if (lock.tryLock(3000)) {
    try {
      raw = cache_().get('roster');          // 기다리는 동안 다른 요청이 만들어 두었을 수 있다
      if (raw) return JSON.parse(raw);
      return buildRoster_();
    } finally { lock.releaseLock(); }
  }
  return readRoster_();                      // 자물쇠를 못 잡으면 읽기만 하고 캐시에는 넣지 않는다
}

/** 시트에서 명단을 읽어 캐시에 둔다 (자물쇠 안에서). 손으로 붙여 넣은 줄이 있으면 먼저 다듬는다 */
function buildRoster_() {
  var ro = readRoster_();
  if (ro.needFix) {
    normalizeRoster_('자동 정리');
    ro = readRoster_();
  }
  putJ_('roster', ro);
  return ro;
}

function readRoster_() {
  var sh = sheet_(SH_ROSTER);
  var last = sh.getLastRow();
  var out = { v: stamp_() + '#' + Math.floor(Math.random() * 1e6), list: [], needFix: false };
  if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, HEAD_ROSTER.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    var name = str_(row[5]);
    if (!name) continue;
    var id = str_(row[0]);
    var g = Number(row[1]), c = Number(row[2]), n = Number(row[3]);
    var sid = str_(row[4]);
    if (!ID_RE.test(id) || sid !== sidOf_(g, c, n)) out.needFix = true;
    if (!ID_RE.test(id) || !SID_RE.test(sid) || !NAME_RE.test(name)) continue;
    out.list.push({
      id: id, g: g, c: c, n: n, sid: sid, name: name,
      d: [truthy_(row[6]), truthy_(row[7]), truthy_(row[8]), truthy_(row[9])],
      ph: str_(row[10]), ps: str_(row[11]), r: i + 2
    });
  }
  return out;
}

function sidOf_(g, c, n) {
  if (!(g === 1 || g === 2) || !(c >= 1 && c <= CLASS_MAX) || !(n >= 1 && n <= NUM_MAX)) return '';
  if (Math.floor(c) !== c || Math.floor(n) !== n) return '';
  return String(g) + (c < 10 ? '0' : '') + c + (n < 10 ? '0' : '') + n;
}

function rosterById_(id) {
  var list = roster_().list;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function rosterBySid_(sid) {
  var list = roster_().list;
  for (var i = 0; i < list.length; i++) if (list[i].sid === sid) return list[i];
  return null;
}
function rosterMap_(ro) {
  var m = {};
  ro.list.forEach(function (s) { m[s.id] = s; });
  return m;
}

/**
 * 시트에 손으로 붙여 넣은 명단을 다듬는다 — 아이디를 붙이고, 학년 · 반 · 번호로 학번을 채우고,
 * 요일 칸을 O 로 맞춘다. (반드시 자물쇠 안에서 부를 것)
 */
function normalizeRoster_(who) {
  var sh = sheet_(SH_ROSTER);
  var last = sh.getLastRow();
  var res = { ok: true, newIds: 0, fixed: 0, bad: [] };
  if (last < 2) return res;
  var range = sh.getRange(2, 1, last - 1, HEAD_ROSTER.length);
  var vals = range.getValues();
  var seen = {};
  var changed = false;
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    var name = str_(row[5]);
    if (!name) continue;
    var g = Number(row[1]), c = Number(row[2]), n = Number(row[3]);
    var sid = sidOf_(g, c, n);
    if (!sid || !NAME_RE.test(name)) { res.bad.push((i + 2) + '번째 줄: 학년 1~2 · 반 1~' + CLASS_MAX + ' · 번호 1~' + NUM_MAX + ' · 이름 한글 2~5자를 확인하세요.'); continue; }
    if (seen[sid]) { res.bad.push((i + 2) + '번째 줄: 학번 ' + sid + ' 이(가) ' + seen[sid] + '번째 줄과 겹칩니다.'); continue; }
    seen[sid] = i + 2;
    if (!ID_RE.test(str_(row[0]))) { row[0] = newId_(); res.newIds++; changed = true; }
    if (str_(row[4]) !== sid) { row[4] = sid; res.fixed++; changed = true; }
    for (var k = 6; k <= 9; k++) {
      var want = truthy_(row[k]) ? 'O' : '';
      if (str_(row[k]) !== want) { row[k] = want; changed = true; }
    }
  }
  if (changed) {
    range.setValues(vals);
    log_(who, '명단 정리', '아이디 ' + res.newIds + ' · 학번 ' + res.fixed);
  }
  cache_().remove('roster');
  return res;
}

/* ── 그날 기록 ────────────────────────────────────────── */
/**
 * 그날 기록 = { v: 판 번호, rows: { 아이디: {r,seat,p1,p2,memo,at,ch} } }
 *   r 은 시트의 줄 번호. 캐시를 다시 만드는 일은 자물쇠 안에서만 한다.
 */
function loadDay_(date, inLock) {
  var key = 'day:' + date;
  var raw = cache_().get(key);
  if (raw) { try { return JSON.parse(raw); } catch (e) { /* 다시 만든다 */ } }
  if (inLock) {
    var d = readDay_(date);
    putJ_(key, d);
    return d;
  }
  var lock = LockService.getScriptLock();
  if (lock.tryLock(3000)) {
    try {
      raw = cache_().get(key);              // 기다리는 동안 다른 요청이 만들어 두었을 수 있다
      if (raw) return JSON.parse(raw);
      var d2 = readDay_(date);
      putJ_(key, d2);
      return d2;
    } finally { lock.releaseLock(); }
  }
  return readDay_(date);                   // 자물쇠를 못 잡으면 읽기만 하고 캐시에는 넣지 않는다
}

function readDay_(date) {
  var sh = sheet_(SH_REC);
  var last = sh.getLastRow();
  var day = { v: stamp_() + '#' + Math.floor(Math.random() * 1e6), rows: {} };
  if (last < 2) return day;
  /* 날짜 칸만 먼저 읽어 그날 줄이 있는 구간만 통째로 읽는다 */
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  var lo = -1, hi = -1;
  for (var i = 0; i < col.length; i++) {
    if (dateStr_(col[i][0]) === date) { if (lo < 0) lo = i; hi = i; }
  }
  if (lo < 0) return day;
  var vals = sh.getRange(lo + 2, 1, hi - lo + 1, HEAD_REC.length).getValues();
  for (var j = 0; j < vals.length; j++) {
    var row = vals[j];
    if (dateStr_(row[0]) !== date) continue;
    var id = str_(row[1]);
    if (!ID_RE.test(id)) continue;
    var seat = Number(row[5]) || 0;
    day.rows[id] = {
      r: lo + 2 + j, seat: seat >= 1 && seat <= SEAT_MAX ? seat : 0,
      p1: STATUSES.indexOf(str_(row[6])) >= 0 ? str_(row[6]) : '',
      p2: STATUSES.indexOf(str_(row[7])) >= 0 ? str_(row[7]) : '',
      memo: unsafeCell_(row[8]), at: stampStr_(row[9]), ch: Number(row[10]) || 0
    };
  }
  return day;
}

function saveDay_(date, day) {
  day.v = stamp_() + '#' + Math.floor(Math.random() * 1e6);
  putJ_('day:' + date, day);
}

/** 그 자리에 앉은 학생의 아이디 (명단에 없는 기록은 셈하지 않는다) */
function seatOwner_(day, seat, rmap) {
  for (var id in day.rows) {
    if (day.rows[id].seat === seat && rmap[id]) return id;
  }
  return '';
}

/** 기록 한 줄을 시트에 쓴다 (자물쇠 안에서). 캐시의 줄 번호가 어긋났으면 찾아서 고친다 */
function writeRec_(date, id, rec, st, who) {
  var sh = sheet_(SH_REC);
  var vals = [date, id, st.sid, st.name, st.g, rec.seat || '', rec.p1 || '', rec.p2 || '',
    safeCell_(rec.memo, MEMO_MAX), rec.at || '', rec.ch || 0, stamp_(), safeCell_(who, 30)];
  if (rec.r) {
    var chk = sh.getRange(rec.r, 1, 1, 2).getValues()[0];
    if (dateStr_(chk[0]) === date && str_(chk[1]) === id) {
      sh.getRange(rec.r, 1, 1, vals.length).setValues([vals]);
      return;
    }
  }
  var found = findRecRow_(sh, date, id);
  if (found) { rec.r = found; sh.getRange(found, 1, 1, vals.length).setValues([vals]); return; }
  sh.appendRow(vals);
  rec.r = sh.getLastRow();
}

function findRecRow_(sh, date, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, 1, last - 1, 2).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (dateStr_(vals[i][0]) === date && str_(vals[i][1]) === id) return i + 2;
  }
  return 0;
}

/* ── 감독 교사 ────────────────────────────────────────── */
function sups_() {
  var raw = cache_().get('sup');
  if (raw) { try { return JSON.parse(raw); } catch (e) { /* 다시 만든다 */ } }
  var sh = sheet_(SH_SUP);
  var last = sh.getLastRow();
  var list = [];
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r, i) {
      if (str_(r[1])) list.push({ date: dateStr_(r[0]), name: str_(r[1]), r: i + 2 });
    });
  }
  putJ_('sup', list);
  return list;
}
function supsOn_(date) {
  var out = [];
  sups_().forEach(function (s) { if (s.date === date && out.indexOf(s.name) < 0) out.push(s.name); });
  return out;
}
/** 출결을 기록한 교사를 그날 감독 교사로 남긴다 (자물쇠 안에서) */
function addSup_(date, name) {
  var list = sups_();
  var sh = sheet_(SH_SUP);
  for (var i = 0; i < list.length; i++) {
    if (list[i].date === date && list[i].name === name) {
      sh.getRange(list[i].r, 4).setValue(stamp_());
      return;
    }
  }
  sh.appendRow([date, name, stamp_(), stamp_()]);
  list.push({ date: date, name: name, r: sh.getLastRow() });
  putJ_('sup', list);
}

/* ── 학생이 오늘 자리를 고를 수 있나 ────────────────────── */
function window_(st, date) {
  var dn = dayName_(date);
  var idx = DAYS.indexOf(dn);
  var mine = DAYS.filter(function (d, i) { return st.d[i]; }).join('·') || '없음';
  if (idx < 0) return { open: false, why: '오늘(' + dn + '요일)은 야간 자율학습이 없는 날입니다.' };
  if (!st.d[idx]) return { open: false, why: '오늘(' + dn + '요일)은 신청한 요일이 아닙니다. 신청한 요일: ' + mine };
  var hm = hm_();
  if (hm < OPEN_FROM) return { open: false, why: '자리는 ' + OPEN_FROM + '부터 고를 수 있습니다.' };
  if (hm > OPEN_TO) return { open: false, why: '오늘 자리 고르기가 끝났습니다 (' + OPEN_TO + '까지).' };
  return { open: true, why: '' };
}

/* ═══════════════ 학생 api ═══════════════ */

function apiLogin(sid, name, pin) {
  return guard_(function () {
    sid = str_(sid); name = str_(name); pin = str_(pin);
    if (sid.length > 5 || !SID_RE.test(sid)) return fail_('학번은 숫자 5자리로 적어 주세요. (예: 1학년 1반 5번 → 10105)');
    if (name.length > 5 || !NAME_RE.test(name)) return fail_('이름은 한글 2~5자로 적어 주세요.');
    if (pin && !PIN_RE.test(pin)) return fail_('PIN 은 숫자 4자리입니다.');
    if (cnt_('slf:' + sid) >= 5) return fail_('여러 번 틀려 10분 동안 들어갈 수 없습니다. 기다리거나 감독 선생님께 PIN 초기화를 부탁하세요.');
    if (!rate_('login', 400)) return fail_('지금 들어오는 사람이 많습니다. 잠시 뒤 다시 해 주세요.', { busy: true });
    var st = rosterBySid_(sid);
    if (!st || st.name !== name) {
      bump_('slf:' + sid);
      return fail_('야자 명단에서 찾을 수 없습니다. 학번과 이름을 확인하고, 신청했는데도 안 되면 담임 선생님께 말씀드리세요.');
    }
    if (!st.ph) return { ok: false, setup: true, msg: '처음 들어왔네요. 앞으로 쓸 PIN(숫자 4자리)을 정해 주세요.' };
    if (!pin) return fail_('PIN 4자리를 넣어 주세요.');
    if (sha_(st.ps + pin) !== st.ph) {
      bump_('slf:' + sid);
      return fail_('PIN 이 맞지 않습니다. 잊었으면 감독 선생님이나 담임 선생님께 초기화를 부탁하세요.');
    }
    cache_().remove('slf:' + sid);
    return { ok: true, token: newSession_({ k: 's', id: st.id, st: st.ph.slice(-10) }), name: st.name };
  });
}

/** 너무 쉬운 PIN 을 막는다 — 0000 · 1111 · 1234 · 9876 같은 것 */
function weakPin_(pin) {
  if (/^(\d)\1{3}$/.test(pin)) return true;
  var up = '0123456789', down = '9876543210';
  return up.indexOf(pin) >= 0 || down.indexOf(pin) >= 0;
}

function apiSetPin(sid, name, pin, pin2) {
  return guard_(function () {
    sid = str_(sid); name = str_(name); pin = str_(pin); pin2 = str_(pin2);
    if (!SID_RE.test(sid) || !NAME_RE.test(name)) return fail_('학번 · 이름을 다시 확인해 주세요.');
    if (!PIN_RE.test(pin)) return fail_('PIN 은 숫자 4자리로 정해 주세요.');
    if (pin !== pin2) return fail_('두 번 넣은 PIN 이 다릅니다.');
    if (weakPin_(pin)) return fail_('너무 쉬운 PIN 입니다 (같은 숫자 · 이어지는 숫자). 다른 숫자로 정해 주세요.');
    if (cnt_('slf:' + sid) >= 5) return fail_('여러 번 틀려 10분 동안 들어갈 수 없습니다.');
    return withLock_(function () {
      cache_().remove('roster');
      var st = null;
      roster_(true).list.forEach(function (s) { if (s.sid === sid) st = s; });
      if (!st || st.name !== name) { bump_('slf:' + sid); return fail_('야자 명단에서 찾을 수 없습니다.'); }
      if (st.ph) return fail_('이미 PIN 을 정했습니다. PIN 으로 들어오세요. 잊었으면 선생님께 초기화를 부탁하세요.');
      var salt = token_().slice(0, 12) + ':';
      var hash = sha_(salt + pin);
      sheet_(SH_ROSTER).getRange(st.r, 11, 1, 4).setValues([[hash, salt, stamp_(), '학생(PIN 정하기)']]);
      cache_().remove('roster');
      log_(st.sid + ' ' + st.name, 'PIN 정하기', '');
      return { ok: true, token: newSession_({ k: 's', id: st.id, st: hash.slice(-10) }), name: st.name };
    });
  });
}

function apiLogout(token) {
  if (typeof token === 'string' && TOKEN_RE.test(token)) cache_().remove('ss:' + token);
  return { ok: true };
}

/** 학생 화면의 좌석 — 다른 학생은 가린 이름만, 학번 · 학년은 보내지 않는다 */
function apiBoard(token, ver) {
  return guard_(function () {
    var me = studentOf_(token);
    if (!me) return fail_('다시 들어와 주세요.', { relogin: true });
    if (!rate_('s:' + me.id, 30)) return fail_('요청이 너무 잦습니다. 잠시 뒤 저절로 다시 불러옵니다.', { busy: true });
    var date = today_();
    var win = window_(me, date);
    var day = loadDay_(date);
    var ro = roster_();
    var v = day.v + '|' + ro.v;
    var rec = day.rows[me.id];
    var base = {
      ok: true, ver: v, date: date, dayName: dayName_(date), hm: hm_(), open: win.open, why: win.why,
      mine: rec && rec.seat ? rec.seat : 0,
      changesLeft: MAX_CHANGES - (rec ? rec.ch : 0)
    };
    if (ver && ver === v) { base.same = true; return base; }
    var rmap = rosterMap_(ro);
    var seats = {};
    for (var id in day.rows) {
      var r = day.rows[id];
      if (!r.seat || !rmap[id]) continue;
      seats[r.seat] = id === me.id ? { me: 1, n: me.name } : { n: mask_(rmap[id].name) };
    }
    base.seats = seats;
    return base;
  });
}

function apiPick(token, seat) {
  return guard_(function () {
    var me = studentOf_(token);
    if (!me) return fail_('다시 들어와 주세요.', { relogin: true });
    seat = Number(seat);
    if (!(seat >= 1 && seat <= SEAT_MAX) || Math.floor(seat) !== seat) return fail_('없는 좌석입니다.');
    if (!rate_('pick:' + me.id, 6)) return fail_('너무 빨리 누르고 있습니다. 잠시 뒤 다시 해 주세요.');
    return withLock_(function () {
      var date = today_();                         // 날짜는 언제나 서버 시계로 — 다른 날 자리를 잡을 수 없다
      var ro = roster_(true);
      var rmap = rosterMap_(ro);
      var st = rmap[me.id];
      if (!st) return fail_('다시 들어와 주세요.', { relogin: true });
      var win = window_(st, date);
      if (!win.open) return fail_(win.why);
      var day = loadDay_(date, true);
      var owner = seatOwner_(day, seat, rmap);
      if (owner && owner !== st.id) return fail_(seat + '번은 방금 다른 학생이 고른 자리입니다. 다른 자리를 골라 주세요.', { refresh: true });
      var rec = day.rows[st.id] || { r: 0, seat: 0, p1: '', p2: '', memo: '', at: '', ch: 0 };
      if (rec.seat === seat) return { ok: true, seat: seat, changesLeft: MAX_CHANGES - rec.ch };
      if (rec.at) {                                  // 한 번 고른 적이 있으면 바꾸기로 센다
        if (rec.ch >= MAX_CHANGES) return fail_('오늘은 자리를 ' + MAX_CHANGES + '번까지만 바꿀 수 있습니다. 바꿔야 하면 감독 선생님께 말씀드리세요.');
        rec.ch += 1;
      }
      var before = rec.seat;
      rec.seat = seat;
      rec.at = stamp_();
      day.rows[st.id] = rec;
      writeRec_(date, st.id, rec, st, '학생');
      saveDay_(date, day);
      log_(st.sid + ' ' + st.name, before ? '자리 바꾸기' : '자리 고르기', date + ' ' + (before ? before + '번 → ' : '') + seat + '번');
      return { ok: true, seat: seat, changesLeft: MAX_CHANGES - rec.ch };
    });
  });
}

/* ═══════════════ 교사 api ═══════════════ */

function teacherPw_() {
  var raw = PropertiesService.getScriptProperties().getProperty('TPW');
  if (raw) { try { var c = JSON.parse(raw); if (c && c.salt && c.hash) return c; } catch (e) { /* 없는 것으로 본다 */ } }
  return null;
}

function apiTLogin(name, pw) {
  return guard_(function () {
    name = str_(name); pw = String(pw === null || pw === undefined ? '' : pw);
    if (name.length > 6 || !TNAME_RE.test(name)) return fail_('이름은 한글 2~6자로 적어 주세요.');
    if (!pw || pw.length > 30) return fail_('비밀번호를 확인해 주세요.');
    if (cnt_('tlf:' + name) >= 5 || cnt_('tlf*') >= 40) return fail_('비밀번호를 여러 번 틀려 10분 동안 잠겼습니다.');
    var conf = teacherPw_();
    if (!conf) return fail_('아직 교사용 비밀번호를 정하지 않았습니다. 스프레드시트 메뉴 「자습실 → ② 교사 비밀번호 정하기 · 바꾸기」 로 먼저 정해 주세요.');
    if (sha_(conf.salt + pw) !== conf.hash) {
      bump_('tlf:' + name); bump_('tlf*');
      return fail_('이름 또는 비밀번호가 맞지 않습니다.');
    }
    cache_().remove('tlf:' + name);
    return { ok: true, token: newSession_({ k: 't', name: name }), name: name, today: today_() };
  });
}

function tGuard_(token, fn) {
  return guard_(function () {
    var t = teacherOf_(token);
    if (!t) return fail_('다시 들어와 주세요.', { relogin: true });
    if (!rate_('t:' + token.slice(0, 16), 150)) return fail_('요청이 너무 잦습니다. 잠시 뒤 다시 해 주세요.', { busy: true });
    return fn(t);
  });
}

function pubStudent_(s) {
  return { id: s.id, g: s.g, c: s.c, n: s.n, sid: s.sid, name: s.name, d: s.d, pin: !!s.ph };
}

/** 야자감독 화면 — 그날 신청한 학생 + 기록이 있는 학생 */
function apiTBoard(token, date, ver) {
  return tGuard_(token, function () {
    date = str_(date) || today_();
    if (!isDate_(date)) return fail_('날짜가 잘못되었습니다.');
    var day = loadDay_(date);
    var ro = roster_();
    var sup = supsOn_(date);
    var v = day.v + '|' + ro.v + '|' + sup.join(',');
    var base = { ok: true, ver: v, date: date, dayName: dayName_(date), today: today_(), hm: hm_() };
    if (ver && ver === v) { base.same = true; return base; }
    var idx = DAYS.indexOf(dayName_(date));
    var list = [];
    ro.list.forEach(function (s) {
      var rec = day.rows[s.id];
      var applied = idx >= 0 && s.d[idx];
      if (!applied && !rec) return;
      var o = pubStudent_(s);
      o.applied = applied;
      o.seat = rec ? rec.seat : 0;
      o.p1 = rec ? rec.p1 : ''; o.p2 = rec ? rec.p2 : '';
      o.memo = rec ? rec.memo : ''; o.ch = rec ? rec.ch : 0; o.at = rec ? rec.at : '';
      list.push(o);
    });
    base.list = list;
    base.sups = sup;
    return base;
  });
}

/** 전체 명단 (PIN 해시는 빼고) — 학생 찾기 · 담임교사 탭 */
function apiTRoster(token) {
  return tGuard_(token, function () {
    return { ok: true, list: roster_().list.map(pubStudent_) };
  });
}

/**
 * 출결 · 메모 · 자리 빼기
 *   patch = { p1?: 상태|'' , p2?: 상태|'', memo?: 글, clearSeat?: true }
 */
function apiTUpdate(token, date, id, patch) {
  return tGuard_(token, function (t) {
    date = str_(date); id = str_(id);
    if (!isDate_(date)) return fail_('날짜가 잘못되었습니다.');
    if (DAYS.indexOf(dayName_(date)) < 0) return fail_(dayName_(date) + '요일은 야간 자율학습이 없는 날입니다.');
    if (!ID_RE.test(id)) return fail_('학생을 찾을 수 없습니다.');
    if (!patch || typeof patch !== 'object') return fail_('바꿀 내용이 없습니다.');
    var keys = ['p1', 'p2'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (patch[k] !== undefined && patch[k] !== '' && STATUSES.indexOf(patch[k]) < 0) return fail_('없는 출결 상태입니다.');
    }
    if (patch.memo !== undefined && String(patch.memo).length > MEMO_MAX) return fail_('메모는 ' + MEMO_MAX + '자까지 쓸 수 있습니다.');
    return withLock_(function () {
      var rmap = rosterMap_(roster_(true));
      var st = rmap[id];
      if (!st) return fail_('명단에 없는 학생입니다. 명단에서 빠졌을 수 있습니다.');
      var day = loadDay_(date, true);
      var rec = day.rows[id] || { r: 0, seat: 0, p1: '', p2: '', memo: '', at: '', ch: 0 };
      var what = [];
      if (patch.p1 !== undefined && patch.p1 !== rec.p1) { what.push('1교시 ' + (rec.p1 || '-') + '→' + (patch.p1 || '-')); rec.p1 = patch.p1; }
      if (patch.p2 !== undefined && patch.p2 !== rec.p2) { what.push('2교시 ' + (rec.p2 || '-') + '→' + (patch.p2 || '-')); rec.p2 = patch.p2; }
      if (patch.memo !== undefined) {
        var m = safeCell_(patch.memo, MEMO_MAX).replace(/^'/, '');
        if (m !== rec.memo) { what.push('메모 「' + m + '」'); rec.memo = m; }
      }
      if (patch.clearSeat && rec.seat) { what.push(rec.seat + '번 자리 빼기'); rec.seat = 0; }
      if (!what.length) return { ok: true, same: true };
      day.rows[id] = rec;
      writeRec_(date, id, rec, st, t.name);
      saveDay_(date, day);
      addSup_(date, t.name);
      log_(t.name, '출결', date + ' ' + st.sid + ' ' + st.name + ' — ' + what.join(', '));
      return { ok: true };
    });
  });
}

function apiTResetPin(token, id) {
  return tGuard_(token, function (t) {
    id = str_(id);
    if (!ID_RE.test(id)) return fail_('학생을 찾을 수 없습니다.');
    return withLock_(function () {
      cache_().remove('roster');
      var st = rosterMap_(roster_(true))[id];
      if (!st) return fail_('명단에 없는 학생입니다.');
      sheet_(SH_ROSTER).getRange(st.r, 11, 1, 4).setValues([['', '', stamp_(), safeCell_(t.name, 30)]]);
      cache_().remove('roster');
      cache_().remove('slf:' + st.sid);
      log_(t.name, 'PIN 초기화', st.sid + ' ' + st.name);
      return { ok: true, msg: st.name + ' 학생의 PIN 을 지웠습니다. 다음에 들어올 때 새로 정합니다.' };
    });
  });
}

/** 출석부 — 한 학년 · 한 주(월 화 목 금) */
function apiTWeek(token, grade, date) {
  return tGuard_(token, function () {
    grade = Number(grade);
    date = str_(date) || today_();
    if (!(grade === 1 || grade === 2)) return fail_('학년을 골라 주세요.');
    if (!isDate_(date)) return fail_('날짜가 잘못되었습니다.');
    var w = '일월화수목금토'.indexOf(dayName_(date));
    var monday = addDays_(date, w === 0 ? -6 : 1 - w);
    var dates = [monday, addDays_(monday, 1), addDays_(monday, 3), addDays_(monday, 4)];
    var ro = roster_();
    var students = ro.list.filter(function (s) { return s.g === grade; })
      .sort(function (a, b) { return a.c - b.c || a.n - b.n; })
      .map(pubStudent_);
    var ids = {};
    students.forEach(function (s) { ids[s.id] = 1; });
    var recs = {}, sups = {};
    dates.forEach(function (d) {
      var day = loadDay_(d);
      var m = {};
      for (var id in day.rows) {
        if (!ids[id]) continue;
        var r = day.rows[id];
        m[id] = { seat: r.seat, p1: r.p1, p2: r.p2, memo: r.memo };
      }
      recs[d] = m;
      sups[d] = supsOn_(d);
    });
    return { ok: true, grade: grade, dates: dates, students: students, recs: recs, sups: sups, today: today_(), hm: hm_() };
  });
}

/** 담임교사 — 학생 한 명 추가 · 고치기.  s = {id?, g, c, n, name, d:[월,화,목,금]} */
function apiTSaveStudent(token, s) {
  return tGuard_(token, function (t) {
    var v = checkStudent_(s);
    if (!v.ok) return v;
    return withLock_(function () {
      cache_().remove('roster');
      var ro = roster_(true);
      var dup = null, self = null;
      ro.list.forEach(function (x) {
        if (x.sid === v.sid && x.id !== v.id) dup = x;
        if (v.id && x.id === v.id) self = x;
      });
      if (dup) return fail_('학번 ' + v.sid + ' 은(는) 이미 ' + dup.name + ' 학생이 쓰고 있습니다.');
      if (v.id && !self) return fail_('고치려는 학생을 명단에서 찾을 수 없습니다. 화면을 새로 불러와 주세요.');
      var sh = sheet_(SH_ROSTER);
      var marks = v.d.map(function (b) { return b ? 'O' : ''; });
      if (self) {
        sh.getRange(self.r, 2, 1, 9).setValues([[v.g, v.c, v.n, v.sid, v.name].concat(marks)]);
        sh.getRange(self.r, 13, 1, 2).setValues([[stamp_(), safeCell_(t.name, 30)]]);
        log_(t.name, '명단 고치기', self.sid + ' ' + self.name + ' → ' + v.sid + ' ' + v.name + ' ' + dayText_(v.d));
      } else {
        v.id = newId_();
        sh.appendRow([v.id, v.g, v.c, v.n, v.sid, v.name].concat(marks).concat(['', '', stamp_(), safeCell_(t.name, 30)]));
        log_(t.name, '명단 추가', v.sid + ' ' + v.name + ' ' + dayText_(v.d));
      }
      cache_().remove('roster');
      return { ok: true, id: v.id, sid: v.sid };
    });
  });
}

function dayText_(d) { return DAYS.filter(function (x, i) { return d[i]; }).join('·'); }

function checkStudent_(s) {
  if (!s || typeof s !== 'object') return fail_('학생 정보가 없습니다.');
  var id = str_(s.id);
  if (id && !ID_RE.test(id)) return fail_('학생을 찾을 수 없습니다.');
  var g = Number(s.g), c = Number(s.c), n = Number(s.n);
  var name = str_(s.name);
  var sid = sidOf_(g, c, n);
  if (!sid) return fail_('학년(1~2) · 반(1~' + CLASS_MAX + ') · 번호(1~' + NUM_MAX + ')를 확인해 주세요.');
  if (name.length > 5 || !NAME_RE.test(name)) return fail_('이름은 한글 2~5자로 적어 주세요.');
  if (!s.d || s.d.length !== 4) return fail_('신청 요일을 골라 주세요.');
  var d = [0, 1, 2, 3].map(function (i) { return s.d[i] === true; });
  var cnt = d.filter(function (x) { return x; }).length;
  if (cnt < MIN_DAYS) return fail_('야자는 월·화·목·금 가운데 이틀 이상 신청해야 합니다. (' + name + ': ' + (cnt ? dayText_(d) : '없음') + ')');
  return { ok: true, id: id, g: g, c: c, n: n, sid: sid, name: name, d: d };
}

function apiTDeleteStudent(token, id) {
  return tGuard_(token, function (t) {
    id = str_(id);
    if (!ID_RE.test(id)) return fail_('학생을 찾을 수 없습니다.');
    return withLock_(function () {
      cache_().remove('roster');
      var st = rosterMap_(roster_(true))[id];
      if (!st) return fail_('명단에 없는 학생입니다.');
      sheet_(SH_ROSTER).deleteRow(st.r);
      cache_().remove('roster');
      log_(t.name, '명단 지우기', st.sid + ' ' + st.name + ' (지난 출결 기록은 「기록」 시트에 남는다)');
      return { ok: true };
    });
  });
}

/**
 * 담임교사 — 여러 명 붙여넣기. 출석부 표를 그대로 복사해도 되고 「번호 이름 월 금」 처럼 적어도 된다.
 *   apply 가 false 면 미리보기만 돌려준다. 붙여넣기 해석은 서버 한 곳에서만 한다.
 */
function apiTBulk(token, g, c, text, apply) {
  return tGuard_(token, function (t) {
    g = Number(g); c = Number(c);
    if (!sidOf_(g, c, 1)) return fail_('학년 · 반을 먼저 골라 주세요.');
    text = String(text || '');
    if (text.length > 6000) return fail_('한 번에 6000자까지 붙여 넣을 수 있습니다.');
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length > 60) return fail_('한 번에 60줄까지 붙여 넣을 수 있습니다.');
    var ro = roster_();
    var rows = lines.map(function (l) { return parseLine_(l, g, c, ro); });
    var seen = {};
    rows.forEach(function (r) {
      if (r.err) return;
      if (seen[r.sid]) { r.err = '같은 번호가 두 번 나옵니다.'; return; }
      seen[r.sid] = 1;
    });
    var good = rows.filter(function (r) { return !r.err; });
    if (!apply) return { ok: true, rows: rows, good: good.length };
    if (!good.length) return fail_('넣을 수 있는 줄이 없습니다.');
    return withLock_(function () {
      cache_().remove('roster');
      var cur = roster_(true);
      var bySid = {};
      cur.list.forEach(function (x) { bySid[x.sid] = x; });
      var sh = sheet_(SH_ROSTER);
      var added = 0, updated = 0;
      good.forEach(function (r) {
        var marks = r.d.map(function (b) { return b ? 'O' : ''; });
        var old = bySid[r.sid];
        if (old) {
          sh.getRange(old.r, 2, 1, 9).setValues([[r.g, r.c, r.n, r.sid, r.name].concat(marks)]);
          sh.getRange(old.r, 13, 1, 2).setValues([[stamp_(), safeCell_(t.name, 30)]]);
          updated++;
        } else {
          sh.appendRow([newId_(), r.g, r.c, r.n, r.sid, r.name].concat(marks).concat(['', '', stamp_(), safeCell_(t.name, 30)]));
          added++;
        }
      });
      cache_().remove('roster');
      log_(t.name, '명단 붙여넣기', g + '학년 ' + c + '반 — 추가 ' + added + ' · 갱신 ' + updated);
      return { ok: true, added: added, updated: updated };
    });
  });
}

/** 붙여넣기 한 줄 → { g,c,n,sid,name,d, action, err } */
function parseLine_(line, g, c, ro) {
  var raw = String(line).slice(0, 200);
  var cells = raw.indexOf('\t') >= 0 ? raw.split('\t') : raw.trim().split(/\s+/);
  cells = cells.map(function (x) { return String(x).trim(); });
  var out = { text: raw.replace(/\t/g, ' ').trim().slice(0, 60), g: g, c: c, n: 0, sid: '', name: '', d: [false, false, false, false], action: '', err: '' };
  var k = -1;
  for (var i = 0; i < cells.length; i++) {
    if (NAME_RE.test(cells[i]) && DAYS.indexOf(cells[i]) < 0) { k = i; break; }
  }
  if (k < 0) { out.err = '이름(한글 2~5자)을 찾지 못했습니다.'; return out; }
  out.name = cells[k];
  var nums = cells.slice(0, k).filter(function (x) { return /^\d{1,2}$/.test(x); }).map(Number);
  if (!nums.length) { out.err = '번호를 찾지 못했습니다.'; return out; }
  out.n = nums[nums.length - 1];
  if (nums.length >= 2 && nums[nums.length - 2] !== c) { out.err = nums[nums.length - 2] + '반 학생입니다 (지금 고른 반은 ' + c + '반).'; return out; }
  var marks = cells.slice(k + 1);
  var dayWords = marks.join(' ').match(/[월화목금]/g);
  if (dayWords && marks.every(function (x) { return !x || /^[월화목금,·\s]+$/.test(x); })) {
    out.d = DAYS.map(function (d) { return dayWords.indexOf(d) >= 0; });
  } else if (marks.length >= 7) {
    out.d = [0, 1, 2, 3].map(function (i) { return truthy_(marks[2 * i]) || truthy_(marks[2 * i + 1]); });   // 출석부 표 — 요일마다 1·2교시 두 칸
  } else {
    out.d = [0, 1, 2, 3].map(function (i) { return truthy_(marks[i]); });
  }
  var v = checkStudent_({ g: g, c: c, n: out.n, name: out.name, d: out.d });
  if (!v.ok) { out.err = v.msg; return out; }
  out.sid = v.sid;
  var old = null;
  ro.list.forEach(function (x) { if (x.sid === v.sid) old = x; });
  out.action = old ? (old.name === v.name ? '갱신' : '갱신 (이름 ' + old.name + ' → ' + v.name + ')') : '추가';
  return out;
}
