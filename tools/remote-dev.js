/*!
 * 깃허브 화면 시험대 — 배포하지 않고 「깃허브 화면 ↔ doPost」 길을 브라우저로 확인한다.
 * © 2026 티쳐무 · 모든 권리 보유
 *
 *   node tools/remote-dev.js   →   화면 http://127.0.0.1:5530/  (학생)  ·  /teacher.html (교사)
 *                                  가짜 웹 앱  http://127.0.0.1:5531/__exec
 *
 * 화면과 웹 앱을 서로 다른 주소(포트)에 두어 실제처럼 「다른 곳으로 보내는 요청」 이 되게 했다.
 * 가짜 웹 앱은 구글처럼 POST 에 302 로 답하고, 화면은 그 주소를 따라가 JSON 을 받는다.
 * 그 뒤에는 가짜 시트 위의 진짜 Code.gs(doPost) 가 돈다 — 미리보기와 같은 지어낸 명단 · 시계(2026-11-16 월 18:10~).
 * 화면이 쿠키를 실어 보내면 콘솔에 「⚠ 쿠키가 실려 왔습니다」 가 찍힌다 (credentials: 'omit' 이 빠진 것).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { build, DEMO_PW } = require('./preview.js');
const { loadServer } = require('./gas-load.js');
const SEED = require('./seed.js');

const PAGE_PORT = 5530, EXEC_PORT = 5531;
const OUT = path.join(__dirname, '..', 'dist', 'remote-dev');
const EXEC = 'http://127.0.0.1:' + EXEC_PORT + '/__exec';

build('student', { out: path.join(OUT, 'index.html'), remote: EXEC,
  notice: '<b>깃허브 화면 시험대</b> — 화면은 ' + PAGE_PORT + ' 번, 가짜 웹 앱은 ' + EXEC_PORT + ' 번 포트. 학생 <b>10105 김하랑 / 3141</b> · <a href="teacher.html">교사 화면</a>' });
build('teacher', { out: path.join(OUT, 'teacher.html'), remote: EXEC,
  notice: '<b>깃허브 화면 시험대</b> — 교사 비밀번호 <b>' + DEMO_PW + '</b> · <a href="./">학생 화면</a>' });

/* 가짜 시트 위의 진짜 Code.gs — 학생 화면과 교사 화면이 같은 시트를 쓴다(실제와 같다) */
const { api, gas } = loadServer();
const T0 = Date.now(), FIX = Date.parse('2026-11-16T18:10:00+09:00');
api.CLOCK.now = () => new Date(FIX + (Date.now() - T0));
api.setupSheets();
api.setTeacherPw_(DEMO_PW);
SEED.plant(api, gas);

const echo = new Map();
let n = 0;
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (req.headers.cookie) console.log('⚠ 쿠키가 실려 왔습니다: ' + req.headers.cookie);
  if (req.method === 'POST' && req.url === '/__exec') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const out = api.doPost({ postData: { contents: body, type: req.headers['content-type'] } });
      const key = String(++n);
      echo.set(key, out.getContent());
      let fn = '?';
      try { fn = JSON.parse(body).fn; } catch (e) { /* 그대로 둔다 */ }
      console.log('doPost ' + fn + ' (' + (req.headers['content-type'] || '-') + ')');
      /* 구글도 POST 에는 302 로 답하고, 결과는 다른 주소(echo)에서 내준다 */
      res.writeHead(302, Object.assign({ Location: '/__echo?k=' + key }, cors));
      res.end();
    });
    return;
  }
  if (req.method === 'GET' && req.url.startsWith('/__echo?k=')) {
    const key = req.url.slice('/__echo?k='.length);
    const txt = echo.get(key);
    echo.delete(key);
    res.writeHead(txt ? 200 : 404, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
    res.end(txt || '{}');
    return;
  }
  if (req.method === 'OPTIONS') console.log('⚠ 사전 요청(OPTIONS)이 왔습니다 — text/plain 이 아닌 것 같습니다');
  res.writeHead(404, cors);
  res.end();
}).listen(EXEC_PORT, '127.0.0.1');

http.createServer((req, res) => {
  const name = req.url.split('?')[0] === '/teacher.html' ? 'teacher.html' : 'index.html';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(path.join(OUT, name)));
}).listen(PAGE_PORT, '127.0.0.1', () => {
  console.log('깃허브 화면 시험대 → http://127.0.0.1:' + PAGE_PORT + '/  (가짜 웹 앱 ' + EXEC + ')');
});
