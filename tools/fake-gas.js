/*!
 * 가짜 구글 앱스 스크립트 환경 — 시험(node)과 미리보기(브라우저)가 함께 쓴다.
 * (꿈누리 출판의 것을 가져와 시간대(Asia/Seoul) · 16진수 UUID · 줄 지우기 · A1 범위를 더했다)
 * © 2026 티쳐무 · 모든 권리 보유
 *
 * ⚠ 이 파일은 node 와 브라우저 양쪽에서 돌아야 하므로 ES5 문법으로만 쓴다.
 *   (let·const·화살표 함수·템플릿 문자열을 쓰지 말 것)
 */
(function (root) {
  'use strict';

  /* ── SHA-256 (동기) ──────────────────────────────────────
     앱스 스크립트의 Utilities.computeDigest 를 흉내 내기 위해 직접 구현했다.
     브라우저의 crypto.subtle 은 비동기라 여기서는 쓸 수 없다. */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0xd800 || c >= 0xe000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function sha256Bytes(str) {
    var msg = utf8Bytes(str);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = msg.length * 8;
    msg = msg.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    msg.push(0, 0, 0, 0, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255);

    var w = new Array(64), i, j, a, b, c, d, e, f, g, hh, t1, t2, s0, s1, ch, maj;
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    for (i = 0; i < msg.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = (msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) | (msg[i + j * 4 + 2] << 8) | msg[i + j * 4 + 3];
      }
      for (j = 16; j < 64; j++) {
        s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; hh = H[7];
      for (j = 0; j < 64; j++) {
        s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        ch = (e & f) ^ (~e & g);
        t1 = (hh + s1 + ch + K[j] + w[j]) | 0;
        s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (s0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    /* 앱스 스크립트는 부호 있는 바이트(-128~127)를 준다 — 그 성질까지 흉내 낸다 */
    return out.map(function (x) { return x > 127 ? x - 256 : x; });
  }

  /* ── 가짜 시트 ───────────────────────────────────────── */
  function FakeSheet(name) {
    this.name = name;
    this.cells = [];        // cells[r][c] — 0부터
    this.hidden = false;
    this.frozenRows = 0;
    this.frozenCols = 0;
    this.widths = {};
  }
  FakeSheet.prototype.getName = function () { return this.name; };
  FakeSheet.prototype.hideSheet = function () { this.hidden = true; return this; };
  FakeSheet.prototype.setFrozenRows = function (n) { this.frozenRows = n; return this; };
  FakeSheet.prototype.setFrozenColumns = function (n) { this.frozenCols = n; return this; };
  FakeSheet.prototype.setColumnWidth = function (c, w) { this.widths[c] = w; return this; };

  function filled(v) { return v !== '' && v !== null && v !== undefined; }

  FakeSheet.prototype.getLastRow = function () {
    var last = 0;
    for (var r = 0; r < this.cells.length; r++) {
      var row = this.cells[r] || [];
      for (var c = 0; c < row.length; c++) if (filled(row[c])) { last = r + 1; break; }
    }
    return last;
  };
  FakeSheet.prototype.getLastColumn = function () {
    var last = 0;
    for (var r = 0; r < this.cells.length; r++) {
      var row = this.cells[r] || [];
      for (var c = 0; c < row.length; c++) if (filled(row[c]) && c + 1 > last) last = c + 1;
    }
    return last;
  };
  FakeSheet.prototype._cell = function (r, c) {
    if (!this.cells[r]) this.cells[r] = [];
    var v = this.cells[r][c];
    return v === undefined ? '' : v;
  };
  FakeSheet.prototype.deleteRow = function (r) {
    this.cells.splice(r - 1, 1);
    return this;
  };
  FakeSheet.prototype.getMaxRows = function () { return Math.max(1000, this.cells.length); };
  FakeSheet.prototype.getRange = function (row, col, nr, nc) {
    var sh = this;
    /* 'A:A' 같은 A1 표기 — 서식만 바꾸는 데 쓰므로 아무 일도 하지 않는 범위를 준다 */
    if (typeof row === 'string') {
      var noop = { setNumberFormat: function () { return noop; }, setFontWeight: function () { return noop; },
                   setBackground: function () { return noop; } };
      return noop;
    }
    nr = nr == null ? 1 : nr;
    nc = nc == null ? 1 : nc;
    if (row < 1 || col < 1 || nr < 1 || nc < 1) throw new Error('범위가 잘못되었습니다: ' + [row, col, nr, nc].join(','));
    var api = {
      getValues: function () {
        var out = [];
        for (var r = 0; r < nr; r++) {
          var line = [];
          for (var c = 0; c < nc; c++) line.push(sh._cell(row - 1 + r, col - 1 + c));
          out.push(line);
        }
        return out;
      },
      setValues: function (vals) {
        if (vals.length !== nr || vals[0].length !== nc) {
          throw new Error('setValues 크기가 범위와 다릅니다 (' + nr + 'x' + nc + ' ← ' + vals.length + 'x' + vals[0].length + ')');
        }
        for (var r = 0; r < vals.length; r++) {
          if (!sh.cells[row - 1 + r]) sh.cells[row - 1 + r] = [];
          for (var c = 0; c < vals[r].length; c++) sh.cells[row - 1 + r][col - 1 + c] = vals[r][c];
        }
        return api;
      },
      getValue: function () { return sh._cell(row - 1, col - 1); },
      setValue: function (v) {
        if (!sh.cells[row - 1]) sh.cells[row - 1] = [];
        sh.cells[row - 1][col - 1] = v;
        return api;
      },
      setFontWeight: function () { return api; },
      setBackground: function () { return api; },
      setNumberFormat: function () { return api; },
      getRow: function () { return row; }
    };
    return api;
  };
  FakeSheet.prototype.appendRow = function (vals) {
    var r = this.getLastRow();
    if (!this.cells[r]) this.cells[r] = [];
    for (var c = 0; c < vals.length; c++) this.cells[r][c] = vals[c];
    return this;
  };
  FakeSheet.prototype.dump = function () {
    var last = this.getLastRow(), wide = this.getLastColumn(), out = [];
    for (var r = 0; r < last; r++) {
      var line = [];
      for (var c = 0; c < wide; c++) line.push(this._cell(r, c));
      out.push(line);
    }
    return out;
  };

  /* ── base64 (node·브라우저 공용) ─────────────────────── */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64encode(bytes) {
    var out = '', i;
    for (i = 0; i < bytes.length; i += 3) {
      var a = bytes[i] & 255, b = i + 1 < bytes.length ? bytes[i + 1] & 255 : 0, c = i + 2 < bytes.length ? bytes[i + 2] & 255 : 0;
      var n = (a << 16) | (b << 8) | c;
      out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63) +
             (i + 1 < bytes.length ? B64.charAt((n >> 6) & 63) : '=') +
             (i + 2 < bytes.length ? B64.charAt(n & 63) : '=');
    }
    return out;
  }
  function b64decode(str) {
    var s = String(str).replace(/[^A-Za-z0-9+\/]/g, ''), out = [], i;
    for (i = 0; i < s.length; i += 4) {
      var n = (B64.indexOf(s.charAt(i)) << 18) | (B64.indexOf(s.charAt(i + 1)) << 12) |
              ((i + 2 < s.length ? B64.indexOf(s.charAt(i + 2)) : 0) << 6) | (i + 3 < s.length ? B64.indexOf(s.charAt(i + 3)) : 0);
      out.push((n >> 16) & 255);
      if (i + 2 < s.length) out.push((n >> 8) & 255);
      if (i + 3 < s.length) out.push(n & 255);
    }
    return out;
  }

  /* ── 가짜 환경 만들기 ─────────────────────────────────── */
  function makeGas(opts) {
    opts = opts || {};
    var sheets = {};
    var order = [];
    var props = {};
    var cache = {};
    var seq = 0;
    var active = null;
    var activeRow = 1;
    var alerts = [];
    var dialogs = [];
    var promptAnswers = (opts.promptAnswers || (opts.promptAnswer != null ? [opts.promptAnswer] : [])).slice();
    function nextId(p) { seq++; return p + '-' + (1000 + seq) + '-' + ((seq * 7919) % 10000); }

    function getSheetByName(n) { return sheets[n] || null; }
    function insertSheet(n) { sheets[n] = new FakeSheet(n); order.push(n); return sheets[n]; }

    var ssId = 'ss-fake-0001';
    var ss = {
      getSheetByName: getSheetByName,
      insertSheet: insertSheet,
      getSheets: function () { return order.map(function (n) { return sheets[n]; }); },
      getId: function () { return ssId; },
      getName: function () { return '1·2학년 자습실 (가짜 시트)'; }
    };

    var UI_BUTTON = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' };
    var ui = {
      alert: function () {
        var args = Array.prototype.slice.call(arguments);
        alerts.push(args.join(' | '));
        return args[args.length - 1] === 'YES_NO' ? UI_BUTTON.YES : UI_BUTTON.OK;
      },
      prompt: function () {
        var ans = promptAnswers.length ? promptAnswers.shift() : '';
        return {
          getSelectedButton: function () { return UI_BUTTON.OK; },
          getResponseText: function () { return ans; }
        };
      },
      showModalDialog: function (html, title) { dialogs.push({ title: title, html: html && html.getContent ? html.getContent() : '' }); },
      createMenu: function () {
        var m = { items: [], addItem: function (a, b) { m.items.push(b); return m; },
                  addSeparator: function () { return m; }, addToUi: function () { return m; } };
        return m;
      },
      ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
      Button: UI_BUTTON
    };

    var SpreadsheetApp = {
      getActiveSpreadsheet: function () { return ss; },
      /* opts.noUi 는 「편집기에서 ▶ 실행」 상황을 흉내 낸다 — 그때는 getUi() 가 막힌다 */
      getUi: function () {
        if (opts.noUi) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
        return ui;
      },
      getActiveSheet: function () {
        var sh = active || ss.getSheets()[0];
        if (sh && !sh.getActiveRange) sh.getActiveRange = function () { return { getRow: function () { return activeRow; } }; };
        return sh;
      },
      _setActive: function (name, row) { active = sheets[name]; activeRow = row; }
    };

    var lockHeld = false;
    var LockService = {
      getScriptLock: function () {
        return {
          tryLock: function () { if (lockHeld) return false; lockHeld = true; return true; },
          waitLock: function () { lockHeld = true; },
          releaseLock: function () { lockHeld = false; },
          hasLock: function () { return lockHeld; }
        };
      }
    };

    function propStore() {
      return {
        getProperty: function (k) { return props[k] === undefined ? null : props[k]; },
        setProperty: function (k, v) { props[k] = String(v); return this; },
        deleteProperty: function (k) { delete props[k]; return this; }
      };
    }
    var PropertiesService = { getDocumentProperties: propStore, getScriptProperties: propStore };

    var CacheService = {
      getScriptCache: function () {
        return {
          get: function (k) { return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
          put: function (k, v) { cache[k] = String(v); },
          remove: function (k) { delete cache[k]; }
        };
      }
    };

    function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

    function newBlob(bytes, type, name) {
      return {
        getBytes: function () { return bytes; },
        getContentType: function () { return type; },
        getName: function () { return name; }
      };
    }

    var Utilities = {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: function (algo, text) { return sha256Bytes(String(text)); },
      /* 진짜와 같은 모양(16진수 32자 + 붙임표 4개)으로 만든다 — 서버가 접속표 모양을 검사한다 */
      getUuid: function () {
        var hx = '0123456789abcdef', out = '', i;
        for (i = 0; i < 32; i++) out += hx.charAt(Math.floor(Math.random() * 16));
        return out.slice(0, 8) + '-' + out.slice(8, 12) + '-' + out.slice(12, 16) + '-' + out.slice(16, 20) + '-' + out.slice(20);
      },
      base64Encode: b64encode,
      base64Decode: b64decode,
      newBlob: newBlob,
      /* 시간대를 진짜처럼 따른다 — 'Asia/Seoul' 이면 컴퓨터 시간대와 상관없이 UTC+9 로 적는다 */
      formatDate: function (d, tz, fmt) {
        var t = new Date(d).getTime();
        var u = new Date(tz === 'Asia/Seoul' ? t + 9 * 3600000 : t - new Date(t).getTimezoneOffset() * 60000);
        return String(fmt)
          .replace('yyyy', u.getUTCFullYear())
          .replace('MM', pad(u.getUTCMonth() + 1, 2))
          .replace('dd', pad(u.getUTCDate(), 2))
          .replace('HH', pad(u.getUTCHours(), 2))
          .replace('mm', pad(u.getUTCMinutes(), 2))
          .replace('ss', pad(u.getUTCSeconds(), 2));
      }
    };

    /* ── 드라이브 ── */
    var files = {}, folders = {};
    function DriveFile(name, type, bytes, folder) {
      this.id = nextId('file'); this.name = name; this.type = type; this.bytes = bytes || [];
      this.desc = ''; this.trashed = false; this.folder = folder || null;
      files[this.id] = this;
    }
    DriveFile.prototype.getId = function () { return this.id; };
    DriveFile.prototype.getName = function () { return this.name; };
    DriveFile.prototype.setDescription = function (d) { this.desc = String(d); return this; };
    DriveFile.prototype.getDescription = function () { return this.desc; };
    DriveFile.prototype.setTrashed = function (t) { this.trashed = !!t; return this; };
    DriveFile.prototype.getBlob = function () { return newBlob(this.bytes, this.type, this.name); };
    DriveFile.prototype.moveTo = function (f) { this.folder = f; return this; };
    DriveFile.prototype.getParents = function () {
      var list = this.folder ? [this.folder] : [], i = 0;
      return { hasNext: function () { return i < list.length; }, next: function () { return list[i++]; } };
    };
    function Folder(name) { this.id = nextId('folder'); this.name = name; folders[this.id] = this; }
    Folder.prototype.getId = function () { return this.id; };
    Folder.prototype.getName = function () { return this.name; };
    Folder.prototype.createFile = function (blob) {
      return new DriveFile(blob.getName(), blob.getContentType(), blob.getBytes(), this);
    };
    Folder.prototype.createFolder = function (name) { return new Folder(name); };
    var rootFolder = new Folder('내 드라이브');
    var ssFile = new DriveFile('1·2학년 자습실 (가짜 시트)', 'application/vnd.google-apps.spreadsheet', [], rootFolder);
    delete files[ssFile.id];
    ssFile.id = ssId;
    files[ssId] = ssFile;

    var DriveApp = {
      createFolder: function (name) { return new Folder(name); },
      getFolderById: function (id) { if (!folders[id]) throw new Error('없는 폴더: ' + id); return folders[id]; },
      getFileById: function (id) {
        if (!files[id] || files[id].trashed) throw new Error('없는 파일: ' + id);
        return files[id];
      },
      getRootFolder: function () { return rootFolder; },
      _files: files
    };

    /* ── 구글 문서 — 무엇을 어떤 차례로 붙였는지 기록만 한다 ── */
    var docs = [];
    function Para(kind, text) {
      this.kind = kind; this.text = text; this.heading = 'NORMAL'; this.align = '';
    }
    Para.prototype.setHeading = function (h) { this.heading = h; return this; };
    Para.prototype.setAlignment = function (a) { this.align = a; return this; };
    Para.prototype.editAsText = function () {
      return { setItalic: function () { return this; }, setBold: function () { return this; } };
    };
    var DocumentApp = {
      ParagraphHeading: { TITLE: 'TITLE', SUBTITLE: 'SUBTITLE', HEADING1: 'HEADING1', HEADING2: 'HEADING2',
                          HEADING3: 'HEADING3', NORMAL: 'NORMAL' },
      HorizontalAlignment: { LEFT: 'LEFT', CENTER: 'CENTER', RIGHT: 'RIGHT' },
      create: function (name) {
        var id = nextId('doc');
        var items = [];
        var body = {
          appendParagraph: function (t) { var p = new Para('p', String(t)); items.push(p); return p; },
          appendPageBreak: function () { items.push({ kind: 'break' }); return {}; },
          appendTable: function (rows) { items.push({ kind: 'table', rows: rows }); return {}; },
          appendImage: function (blob) {
            var w = 800, hgt = 600;
            var img = { kind: 'image', type: blob.getContentType(),
              getWidth: function () { return w; }, getHeight: function () { return hgt; },
              setWidth: function (x) { w = x; img.w = x; return img; },
              setHeight: function (x) { hgt = x; img.h = x; return img; } };
            items.push(img);
            return img;
          }
        };
        var doc = { name: name, id: id, items: items, closed: false,
          getBody: function () { return body; }, getId: function () { return id; },
          getUrl: function () { return 'https:\/\/docs.google.com\/document\/d\/' + id + '\/edit'; },
          saveAndClose: function () { doc.closed = true; } };
        var f = new DriveFile(name, 'application/vnd.google-apps.document', [], rootFolder);
        delete files[f.id];
        f.id = id;
        files[id] = f;
        docs.push(doc);
        return doc;
      }
    };

    var ScriptApp = {
      getService: function () {
        return { getUrl: function () { return opts.url === undefined ? 'https:\/\/script.google.com\/macros\/s\/FAKE\/exec' : opts.url; } };
      }
    };

    var ContentService = {
      MimeType: { JSON: 'application/json' },
      createTextOutput: function (t) {
        return { _t: t, setMimeType: function () { return this; }, getContent: function () { return this._t; } };
      }
    };

    var HtmlService = {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutput: function (s) {
        return { _s: s, setWidth: function () { return this; }, setHeight: function () { return this; },
                 getContent: function () { return this._s; } };
      },
      createHtmlOutputFromFile: function (n) {
        return { getContent: function () { return '<!-- ' + n + ' -->'; } };
      },
      createTemplateFromFile: function (n) {
        var t = { file: n, evaluate: function () {
          return { file: n, boot: t.BOOT, setTitle: function () { return this; }, addMetaTag: function () { return this; },
                   setXFrameOptionsMode: function () { return this; } };
        } };
        return t;
      }
    };

    return {
      SpreadsheetApp: SpreadsheetApp,
      PropertiesService: PropertiesService,
      CacheService: CacheService,
      LockService: LockService,
      Utilities: Utilities,
      DriveApp: DriveApp,
      DocumentApp: DocumentApp,
      ScriptApp: ScriptApp,
      ContentService: ContentService,
      HtmlService: HtmlService,
      sheets: sheets,
      props: props,
      cache: cache,
      alerts: alerts,
      dialogs: dialogs,
      docs: docs,
      files: files,
      /** 미리보기 씨앗용 — 그림 파일을 드라이브에 바로 만든다 */
      makeFile: function (name, type, bytes, desc) {
        var f = new DriveFile(name, type, bytes, rootFolder);
        f.setDescription(desc || '');
        return f.getId();
      }
    };
  }

  var GAS_NAMES = ['SpreadsheetApp', 'PropertiesService', 'CacheService', 'LockService', 'Utilities',
                   'DriveApp', 'DocumentApp', 'ScriptApp', 'ContentService', 'HtmlService'];

  var api = { makeGas: makeGas, FakeSheet: FakeSheet, sha256Bytes: sha256Bytes,
              b64encode: b64encode, b64decode: b64decode, utf8Bytes: utf8Bytes, GAS_NAMES: GAS_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FAKEGAS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
