/*!
 * 시험 모으기 — 새 시험 파일을 만들면 여기에 한 줄 넣는다.
 * © 2026 티쳐무 · 모든 권리 보유
 */
import { run } from './harness.mjs';
import './layout.test.mjs';
import './server.test.mjs';
import './extra.test.mjs';
import './fixed.test.mjs';

process.stdout.write('\n1·2학년 자습실 좌석배치도 — 점검\n');
run();
