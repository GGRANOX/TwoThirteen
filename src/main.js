import { solve, makeGrid } from './search.js';
import { hillClimbing } from './localsearch.js';
import { aiMove, minimax, alphaBeta, winner, isFull } from './adversarial.js';

const $ = (id) => document.getElementById(id);
const say = (el, text, kind = '') => { el.textContent = text; el.className = 'msg ' + kind; };
const NAMES = { astar: 'A*', ucs: 'UCS', bfs: 'BFS', dfs: 'DFS' };

// ---------- Tabs ----------
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
}));

// ======================= Апта 2: Search =======================
const S = { cells: makeGrid(15, 25), start: [7, 3], goal: [7, 21], vis: new Map(), path: [], timer: 0, painting: false };
const sc = $('s-canvas'), sctx = sc.getContext('2d');
const CELL = 26;

function sDraw() {
  const R = S.cells.length, C = S.cells[0].length;
  sc.width = C * CELL; sc.height = R * CELL;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const w = S.cells[r][c], x = c * CELL, y = r * CELL;
    sctx.fillStyle = w === 0 ? '#2d333b' : S.vis.has(r * C + c) ? '#9ecbff' : w > 1 ? `hsl(30 70% ${88 - w * 3}%)` : '#fff';
    sctx.fillRect(x, y, CELL, CELL);
    sctx.strokeStyle = '#d0d7de'; sctx.strokeRect(x + .5, y + .5, CELL, CELL);
    if (w > 1) { sctx.fillStyle = '#7a4a00'; sctx.font = '11px sans-serif'; sctx.fillText(w, x + 9, y + 17); }
  }
  sctx.fillStyle = '#f2cc60';
  S.path.forEach(([r, c]) => sctx.fillRect(c * CELL + 6, r * CELL + 6, CELL - 12, CELL - 12));
  for (const [p, col] of [[S.start, '#2ea043'], [S.goal, '#e5534b']]) {
    sctx.fillStyle = col; sctx.beginPath();
    sctx.arc(p[1] * CELL + CELL / 2, p[0] * CELL + CELL / 2, CELL / 2 - 3, 0, 7); sctx.fill();
  }
}

function sCell(e) {
  const rect = sc.getBoundingClientRect(), k = sc.width / rect.width;
  return [Math.floor(((e.clientY - rect.top) * k) / CELL), Math.floor(((e.clientX - rect.left) * k) / CELL)];
}
function sPaint(e) {
  const [r, c] = sCell(e);
  if (r < 0 || c < 0 || r >= S.cells.length || c >= S.cells[0].length) return;
  const mode = $('s-mode').value, same = (p) => p[0] === r && p[1] === c;
  sStop();
  if (mode === 'start') { if (S.cells[r][c] && !same(S.goal)) S.start = [r, c]; }
  else if (mode === 'goal') { if (S.cells[r][c] && !same(S.start)) S.goal = [r, c]; }
  else if (!same(S.start) && !same(S.goal)) S.cells[r][c] = mode === 'wall' ? 0 : mode === 'w5' ? 5 : mode === 'w9' ? 9 : 1;
  S.vis.clear(); S.path = []; sDraw();
}
sc.addEventListener('pointerdown', (e) => { S.painting = true; sPaint(e); });
sc.addEventListener('pointermove', (e) => { if (S.painting && !/start|goal/.test($('s-mode').value)) sPaint(e); });
addEventListener('pointerup', () => { S.painting = false; });

function sStop() { clearTimeout(S.timer); S.timer = 0; }
function sReset() { sStop(); S.vis.clear(); S.path = []; $('s-result').innerHTML = ''; $('s-explain').textContent = ''; }

const sOpts = () => [$('s-algo').value, S.cells, S.start, S.goal, $('s-heur').value];

$('s-run').onclick = () => {
  sReset();
  let res;
  try { res = solve(...sOpts()); } catch (e) { say($('s-msg'), e.message, 'err'); sDraw(); return; }
  const C = S.cells[0].length, per = Math.max(1, Math.round(($('s-speed').value / 100) ** 2 * 20));
  let i = 0;
  say($('s-msg'), 'Іздеу жүріп жатыр…');
  const tick = () => {
    for (let k = 0; k < per && i < res.visited.length; k++, i++) S.vis.set(res.visited[i][0] * C + res.visited[i][1], 1);
    sDraw();
    if (i < res.visited.length) { S.timer = setTimeout(tick, 16); return; }
    if (res.found) { S.path = res.path; sDraw(); say($('s-msg'), `Жол табылды: ұзындығы ${res.path.length - 1} қадам, құны ${res.cost}.`, 'ok'); }
    else say($('s-msg'), 'Жол жоқ: бастау мен аяқтау арасы қабырғамен жабылған.', 'err');
    showResult([[sOpts()[0], res]]);
  };
  tick();
};

$('s-compare').onclick = () => {
  sReset();
  try {
    const rows = ['bfs', 'dfs', 'ucs', 'astar'].map((a) => [a, solve(a, S.cells, S.start, S.goal, $('s-heur').value)]);
    const best = rows.find((r) => r[0] === 'astar')[1];
    if (best.found) S.path = best.path;
    S.vis.clear(); sDraw(); showResult(rows);
    say($('s-msg'), best.found ? 'Салыстыру дайын (жолақ — A* жолы).' : 'Жол жоқ.', best.found ? 'ok' : 'err');
  } catch (e) { say($('s-msg'), e.message, 'err'); }
};

function showResult(rows) {
  $('s-result').innerHTML = '<table><tr><th>Алгоритм</th><th>Табылды</th><th>Құны</th><th>Ашылған түйін</th><th>Уақыт, мс</th></tr>' +
    rows.map(([a, r]) => `<tr><td>${NAMES[a]}</td><td>${r.found ? 'иә' : 'жоқ'}</td><td>${r.cost ?? '—'}</td><td>${r.expanded}</td><td>${r.ms.toFixed(2)}</td></tr>`).join('') + '</table>';
  $('s-explain').innerHTML = '<b>Түсіндірме:</b> BFS қадам санын азайтады, бірақ салмақты ескермейді; DFS жолды табады, бірақ оңтайлы емес; ' +
    'UCS жиналған құнды (g) бойынша оңтайлы; A* f = g + h бойынша бағытталған, үйлесімді (admissible) эвристикада оңтайлы әрі UCS-тан аз түйін ашады.';
}

$('s-resize').onclick = () => {
  try { S.cells = makeGrid(+$('s-rows').value, +$('s-cols').value); } catch (e) { say($('s-msg'), e.message, 'err'); return; }
  S.start = [0, 0]; S.goal = [S.cells.length - 1, S.cells[0].length - 1];
  sReset(); say($('s-msg'), ''); sDraw();
};
$('s-clear').onclick = () => { S.cells = S.cells.map((r) => r.map(() => 1)); sReset(); say($('s-msg'), ''); sDraw(); };
$('s-random').onclick = () => {
  sReset(); say($('s-msg'), '');
  S.cells = S.cells.map((row, r) => row.map((_, c) => ((r === S.start[0] && c === S.start[1]) || (r === S.goal[0] && c === S.goal[1]) ? 1 : Math.random() < 0.25 ? 0 : 1)));
  sDraw();
};
sDraw();

// ======================= Апта 3: Hill Climbing =======================
const Q = { res: null, i: 0, timer: 0 };
const qc = $('q-canvas'), qctx = qc.getContext('2d');

function qDraw() {
  const step = Q.res?.steps[Q.i];
  const n = step ? step.state.length : +$('q-n').value || 8, size = Math.min(520, n * 40), cs = size / n;
  qc.width = qc.height = size;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    qctx.fillStyle = (r + c) % 2 ? '#b58863' : '#f0d9b5'; qctx.fillRect(c * cs, r * cs, cs, cs);
  }
  if (!step) return;
  qctx.font = `${cs * 0.7}px serif`; qctx.textAlign = 'center'; qctx.textBaseline = 'middle';
  step.state.forEach((row, c) => {
    const attacked = step.state.some((r2, c2) => c2 !== c && (r2 === row || Math.abs(r2 - row) === Math.abs(c2 - c)));
    qctx.fillStyle = attacked ? '#c0392b' : '#1e8449';
    qctx.fillText('♛', c * cs + cs / 2, row * cs + cs / 2 + 2);
  });
  $('q-info').innerHTML = `<b>Қадам ${Q.i}/${Q.res.steps.length - 1}</b> · restart #${step.restart} · конфликттер h = <b>${step.h}</b>` +
    (Q.i === Q.res.steps.length - 1 ? (Q.res.solved ? ' · <b>шешім табылды ✔</b>' : ' · шешім табылмады (жергілікті минимум)') : '') +
    '<br>Hill Climbing әр қадамда h-ты ең көп азайтатын ферзь жылжытады; жергілікті минимумда тоқтап, кездейсоқ қайта бастайды (random restart).';
}
$('q-run').onclick = () => {
  clearInterval(Q.timer);
  try {
    Q.res = hillClimbing(+$('q-n').value, { maxRestarts: +$('q-restarts').value, seed: +$('q-seed').value });
  } catch (e) { say($('q-msg'), e.message, 'err'); return; }
  Q.i = 0; $('q-slider').max = Q.res.steps.length - 1; $('q-slider').value = 0;
  say($('q-msg'), Q.res.solved ? `Шешім табылды: ${Q.res.restarts} restart, ${Q.res.steps.length - 1} қадам.` : `Шешім табылмады, соңғы h=${Q.res.h}. Restarts санын көбейтіңіз.`, Q.res.solved ? 'ok' : 'err');
  qDraw();
};
$('q-slider').oninput = (e) => { Q.i = +e.target.value; qDraw(); };
$('q-play').onclick = () => {
  if (!Q.res) { say($('q-msg'), 'Алдымен «Іске қосу» басыңыз.', 'err'); return; }
  clearInterval(Q.timer);
  if (Q.i >= Q.res.steps.length - 1) Q.i = 0;
  Q.timer = setInterval(() => {
    if (Q.i >= Q.res.steps.length - 1) { clearInterval(Q.timer); return; }
    Q.i++; $('q-slider').value = Q.i; qDraw();
  }, 250);
};
qDraw();

// ======================= Апта 4: Minimax =======================
const T = { b: Array(9).fill(null), over: false };
function tRender() {
  const box = $('t-board'); box.innerHTML = '';
  T.b.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.textContent = v || ''; btn.disabled = !!v || T.over;
    btn.setAttribute('aria-label', `Ұяшық ${i + 1}`);
    btn.onclick = () => tHuman(i); box.appendChild(btn);
  });
}
function tCheck() {
  const w = winner(T.b);
  if (w || isFull(T.b)) {
    T.over = true;
    say($('t-msg'), w === 'X' ? 'Сіз жеңдіңіз!' : w === 'O' ? 'AI жеңді.' : 'Тең ойын.', w === 'X' ? 'ok' : '');
    return true;
  }
  return false;
}
function tAI() {
  const algo = $('t-algo').value;
  const res = aiMove(T.b, algo);
  const mm = minimax([...T.b], 'O').stats.nodes, ab = alphaBeta([...T.b], 'O').stats.nodes;
  T.b[res.move] = 'O';
  $('t-info').innerHTML = `<b>AI жүрісі:</b> ұяшық ${res.move + 1}, бағасы ${res.value}. Қаралған түйіндер — Minimax: <b>${mm}</b>, Alpha-Beta: <b>${ab}</b> ` +
    `(үнемдеу ${(100 * (1 - ab / mm)).toFixed(0)}%). Таңдалған: ${algo === 'minimax' ? 'Minimax' : 'Alpha-Beta'}.<br>` +
    'Minimax бүкіл ойын ағашын қарап, AI үшін мәнді максимумдайды, адам үшін минимумдайды; Alpha-Beta нәтижеге әсер етпейтін тармақтарды кеседі.';
}
function tHuman(i) {
  if (T.over || T.b[i]) return;
  T.b[i] = 'X';
  if (!tCheck()) { say($('t-msg'), ''); tAI(); tCheck(); }
  tRender();
}
$('t-new').onclick = () => {
  T.b = Array(9).fill(null); T.over = false; say($('t-msg'), 'Сіздің жүрісіңіз (X).'); $('t-info').textContent = '';
  if ($("t-first").value === "ai") { tAI(); say($('t-msg'), 'Сіздің жүрісіңіз (X).'); }
  tRender();
};
$('t-new').click();
