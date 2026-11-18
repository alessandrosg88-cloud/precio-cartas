// =====================================================================
//  CENTRADO PSA — mide el centrado de una carta con una foto
//  Líneas rojas: borde de la carta. Líneas azules: borde del dibujo/marco.
//  Todo se calcula en el navegador; la foto no se sube a ningún sitio.
// =====================================================================

// Límites de PSA: [nota, frontal (lado mayor %), trasera (lado mayor %)]
const PSA_CENTER = [[10, 55, 75], [9, 60, 90], [8, 65, 90], [7, 70, 90], [6, 80, 90], [5, 85, 90], [3, 90, 90], [2, 90, 90]];
const PSA_NAMES = { 10: 'Gem Mint', 9: 'Mint', 8: 'NM-MT', 7: 'NM', 6: 'EX-MT', 5: 'EX', 4: 'VG-EX', 3: 'VG', 2: 'Good', 1: 'Poor' };
const CEN_LINES = ['oL', 'oR', 'oT', 'oB', 'iL', 'iR', 'iT', 'iB'];
const CEN = { side: 'front', sel: 'iL', drag: null, sides: { front: null, back: null } };

function psaCenterGrade(worst, side){
  const col = side === 'back' ? 2 : 1;
  for (const row of PSA_CENTER) if (worst <= row[col] + 1e-9) return row[0];
  return 1;
}

// Porcentajes de un lado medido
function cenMeasure(s){
  const L = s.L;
  const a = L.iL - L.oL, b = L.oR - L.iR, c = L.iT - L.oT, d = L.oB - L.iB;
  const lr = a + b > 0 ? a / (a + b) * 100 : 50;
  const tb = c + d > 0 ? c / (c + d) * 100 : 50;
  const worst = Math.max(lr, 100 - lr, tb, 100 - tb);
  return { lr, tb, worst };
}

function lineName(k){
  const kind = k[0] === 'o' ? T('Borde de la carta') : T('Borde del dibujo');
  const pos = { L: 'izquierda', R: 'derecha', T: 'arriba', B: 'abajo' }[k[1]];
  return kind + ' · ' + T(pos);
}

// ---------- Imagen girada ----------
function cenBuildBase(s){
  const img = s.img;
  const max = 1600, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2); g.rotate(s.rot * Math.PI / 180);
  g.drawImage(img, -w / 2, -h / 2, w, h);
  s.base = c;
}

// ---------- Enderezado automático: busca el giro con los bordes más nítidos ----------
function cenAutoTilt(s){
  const img = s.img, k = Math.min(1, 420 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(20, Math.round(img.naturalWidth * k)), h = Math.max(20, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const score = a => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2); g.rotate(a * Math.PI / 180); g.drawImage(img, -w / 2, -h / 2, w, h);
    const d = g.getImageData(0, 0, w, h).data, gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) gray[i] = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114;
    const col = new Float32Array(w), row = new Float32Array(h);
    for (let y = Math.round(h * .15); y < h * .85; y++) for (let x = 0; x < w - 1; x++) col[x] += Math.abs(gray[y * w + x + 1] - gray[y * w + x]);
    for (let x = Math.round(w * .15); x < w * .85; x++) for (let y = 0; y < h - 1; y++) row[y] += Math.abs(gray[(y + 1) * w + x] - gray[y * w + x]);
    const mx = (p, a, b) => { let m = 0; for (let i = Math.max(0, a | 0); i < Math.min(p.length - 1, b); i++) m = Math.max(m, p[i]); return m; };
    return mx(col, 0, w * .3) + mx(col, w * .7, w) + mx(row, 0, h * .3) + mx(row, h * .7, h);
  };
  try {
    let best = 0, bs = score(0);
    for (let a = -6; a <= 6.001; a += .5) { const v = score(a); if (v > bs * 1.0001) { bs = v; best = a; } }
    for (let a = best - .4; a <= best + .401; a += .1) { const v = score(a); if (v > bs * 1.0001) { bs = v; best = a; } }
    s.rot = Math.round(best * 10) / 10;
  } catch (e) { s.rot = 0; }
}

// ---------- Detección automática de bordes (aproximada) ----------
function cenAutoDetect(s){
  const src = s.base, k = Math.min(1, 900 / Math.max(src.width, src.height));
  const w = Math.max(20, Math.round(src.width * k)), h = Math.max(20, Math.round(src.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  let data;
  try { data = g.getImageData(0, 0, w, h).data; } catch (e) { return cenDefault(s); }
  // salto de color (suma de R, G y B) entre píxeles vecinos; el borde está en x + 0,5
  const dif = (i, j) => Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
  const col = new Float32Array(w), row = new Float32Array(h);
  for (let y = Math.round(h * .25); y < h * .75; y++)
    for (let x = 0; x < w - 1; x++) col[x] += dif((y * w + x) * 4, (y * w + x + 1) * 4);
  for (let x = Math.round(w * .25); x < w * .75; x++)
    for (let y = 0; y < h - 1; y++) row[y] += dif((y * w + x) * 4, ((y + 1) * w + x) * 4);
  const C = col, R = row;
  const peak = (p, a, b) => { a = Math.max(1, Math.round(a)); b = Math.min(p.length - 2, Math.round(b)); let m = a; for (let i = a; i <= b; i++) if (p[i] > p[m]) m = i; return m; };
  // primer pico fuerte yendo desde 'from' hacia 'to' (el marco suele ser el primer borde claro tras el borde de la carta)
  const firstPeak = (p, from, to) => {
    const a = Math.round(Math.min(from, to)), b = Math.round(Math.max(from, to));
    const m = p[peak(p, a, b)], dir = to > from ? 1 : -1;
    for (let i = Math.round(from); dir > 0 ? i <= b : i >= a; i += dir)
      if (p[i] >= m * .45 && p[i] >= (p[i - 1] || 0) && p[i] >= (p[i + 1] || 0)) return i;
    return peak(p, a, b);
  };
  const gapW = Math.max(2, w * .012), gapH = Math.max(2, h * .012);
  const oL = peak(C, 1, w * .3), oR = peak(C, w * .7, w - 2);
  const oT = peak(R, 1, h * .3), oB = peak(R, h * .7, h - 2);
  const cw = oR - oL, ch = oB - oT;
  const iL = firstPeak(C, oL + gapW, oL + cw * .2), iR = firstPeak(C, oR - gapW, oR - cw * .2);
  const iT = firstPeak(R, oT + gapH, oT + ch * .2), iB = firstPeak(R, oB - gapH, oB - ch * .2);
  // posición con precisión de subpíxel (parábola sobre el pico)
  const sub = (p, i) => { const a = p[i - 1] || 0, b = p[i], c = p[i + 1] || 0, d = a - 2 * b + c; return i + .5 + (d ? Math.max(-.5, Math.min(.5, (a - c) / (2 * d))) : 0); };
  s.L = { oL: sub(C, oL) / w, oR: sub(C, oR) / w, oT: sub(R, oT) / h, oB: sub(R, oB) / h,
          iL: sub(C, iL) / w, iR: sub(C, iR) / w, iT: sub(R, iT) / h, iB: sub(R, iB) / h };
  cenFix(s);
}
function cenDefault(s){
  s.L = { oL: .1, oR: .9, oT: .08, oB: .92, iL: .15, iR: .85, iT: .13, iB: .87 };
}
// Mantiene el orden: exterior < interior en cada lado
function cenFix(s){
  const L = s.L, e = .004;
  for (const k of CEN_LINES) L[k] = Math.min(1, Math.max(0, L[k]));
  if (!(L.oL < L.iL - e && L.iL < L.iR - e && L.iR < L.oR - e && L.oT < L.iT - e && L.iT < L.iB - e && L.iB < L.oB - e)) cenDefault(s);
}

// ---------- Dibujo ----------
function cenDraw(){
  const cv = $('cenCanvas'), s = CEN.sides[CEN.side];
  if (!cv || !s) return;
  const wrap = cv.parentElement;
  const maxW = wrap.clientWidth, maxH = Math.max(260, window.innerHeight * .7);
  let w = maxW, h = w * s.base.height / s.base.width;
  if (h > maxH) { h = maxH; w = h * s.base.width / s.base.height; }
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.drawImage(s.base, 0, 0, w, h);
  cenDrawLines(g, s, w, h);
  // lupa mientras se arrastra
  if (CEN.drag && CEN.drag.pos) {
    const [px, py] = CEN.drag.pos, z = 4, R = Math.min(70, w * .2), src = R * 2 / z;
    const lx = px < w / 2 ? w - R * 2 - 8 : 8, ly = 8;
    g.save();
    g.beginPath(); g.rect(lx, ly, R * 2, R * 2); g.clip();
    g.fillStyle = '#000'; g.fillRect(lx, ly, R * 2, R * 2);
    const bx = s.base.width / w, by = s.base.height / h;
    g.drawImage(s.base, (px - src / 2) * bx, (py - src / 2) * by, src * bx, src * by, lx, ly, R * 2, R * 2);
    g.translate(lx + R - px * z, ly + R - py * z); g.scale(z, z);
    cenDrawLines(g, s, w, h, 1 / z);
    g.restore();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(lx, ly, R * 2, R * 2);
  }
}
function cenDrawLines(g, s, w, h, k = 1){
  const L = s.L;
  for (const key of CEN_LINES) {
    const v = L[key], vert = key[1] === 'L' || key[1] === 'R', on = key === CEN.sel;
    g.strokeStyle = key[0] === 'o' ? '#ef4444' : '#22d3ee';
    g.lineWidth = (on ? 3 : 1.6) * k;
    g.setLineDash(on ? [] : [6 * k, 4 * k]);
    g.beginPath();
    if (vert) { g.moveTo(v * w, 0); g.lineTo(v * w, h); } else { g.moveTo(0, v * h); g.lineTo(w, v * h); }
    g.stroke();
  }
  g.setLineDash([]);
}

// ---------- Resultado ----------
function cenBar(pct, a, b){
  const f = n => n.toLocaleString(LOCALE(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `<div class="cbar"><div class="cbl"><span>${a}</span><b>${f(pct)} / ${f(100 - pct)}</b><span>${b}</span></div>
    <div class="cbt"><i style="left:${pct}%"></i><em></em></div></div>`;
}
function cenResult(){
  const box = $('cenRes'); if (!box) return;
  const s = CEN.sides[CEN.side]; if (!s) { box.innerHTML = ''; return; }
  const m = cenMeasure(s), gr = psaCenterGrade(m.worst, CEN.side);
  const both = CEN.sides.front && CEN.sides.back;
  let comb = '';
  if (both) {
    const gf = psaCenterGrade(cenMeasure(CEN.sides.front).worst, 'front');
    const gb = psaCenterGrade(cenMeasure(CEN.sides.back).worst, 'back');
    const g2 = Math.min(gf, gb);
    comb = `<div class="cgrade small"><span>${T('Con frontal y trasera')}</span><b>PSA ${g2}</b><small>${PSA_NAMES[g2]}</small></div>`;
  }
  box.innerHTML = `
    ${cenBar(m.lr, T('izquierda'), T('derecha'))}
    ${cenBar(m.tb, T('arriba'), T('abajo'))}
    <div class="cgrades">
      <div class="cgrade"><span>${T('Nota máxima por centrado')} (${T(CEN.side === 'back' ? 'Trasera' : 'Frontal')})</span><b>PSA ${gr}</b><small>${PSA_NAMES[gr]}</small></div>
      ${comb}
    </div>
    ${CEN.side === 'front' && !CEN.sides.back && gr >= 9 ? `<p class="note">${T('Mide también la trasera para saber si llega al 10 (PSA pide 75/25 o mejor detrás).')}</p>` : ''}`;
  const sel = $('cenSel'); if (sel) sel.textContent = T('Línea seleccionada: {0}', lineName(CEN.sel));
  document.querySelectorAll('.cside').forEach(b => b.classList.toggle('done', !!CEN.sides[b.dataset.side]));
}

// ---------- Pantalla ----------
function showCentering(){
  redraw = () => showCentering();
  const s = CEN.sides[CEN.side];
  const sideBtn = k => `<button class="chip cside${CEN.side === k ? ' on' : ''}${CEN.sides[k] ? ' done' : ''}" data-side="${k}">${T(k === 'front' ? 'Frontal' : 'Trasera')}</button>`;
  const pick = `<div class="cpick">
      <label class="gbtn"><span>${T('📷 Hacer foto')}</span><input type="file" accept="image/*" capture="environment" hidden class="cfile"></label>
      <label class="gbtn soft"><span>${T('🖼️ Subir foto')}</span><input type="file" accept="image/*" hidden class="cfile"></label>
    </div>`;
  out.innerHTML = `${backBtn()}<div class="gpage cpage">
    <h2>${T('📐 Centrado PSA')}</h2>
    <p class="cintro">${T('Haz una foto de tu carta recta y de frente, y ajusta las líneas: las rojas al borde de la carta y las azules al borde del marco del dibujo. Te decimos el centrado y la nota máxima de PSA que permite.')}</p>
    <div class="sfilters">${sideBtn('front')}${sideBtn('back')}</div>
    ${!s ? `${pick}
      <div id="cenMsg"></div>
      <p class="ctips"><b>${T('Consejos para que salga bien:')}</b><br>
      • ${T('Pon la carta sobre un fondo liso y oscuro (o claro si la carta es oscura).')}<br>
      • ${T('Hazla desde arriba, sin inclinar el móvil, y sin funda o con una funda sin reflejos.')}<br>
      • ${T('Que la carta ocupe casi toda la foto.')}</p>` : `
      <div class="ctools">
        <button class="gbtn" id="cenAuto">${T('✨ Detectar bordes')}</button>
        <label class="gbtn soft"><span>${T('🔄 Otra foto')}</span><input type="file" accept="image/*" hidden class="cfile"></label>
        <label class="crot">${T('Inclinación')} <input type="range" id="cenRot" min="-6" max="6" step="0.1" value="${s.rot}"> <span id="cenRotV">${s.rot.toFixed(1)}°</span></label>
      </div>
      <p class="note">${T('Arrastra cada línea a su sitio. Para afinar, toca una línea y usa las flechas.')}</p>
      <div class="cwrap"><canvas id="cenCanvas" tabindex="0"></canvas></div>
      <div class="cfine">
        <span id="cenSel"></span>
        <span class="cbtns"><button id="cenM">${'◀'}</button><button id="cenP">${'▶'}</button></span>
      </div>
      <div class="clegend"><span><i style="background:#ef4444"></i>${T('Borde de la carta')}</span><span><i style="background:#22d3ee"></i>${T('Borde del dibujo')}</span></div>
      <div id="cenRes"></div>`}
    <p class="note">${T('Solo se mide el centrado. PSA también mira esquinas, bordes y superficie, así que la nota final puede ser más baja. Es orientativo.')}
      ${T('Las fotos no se suben a ningún sitio: todo se calcula en tu móvil.')}</p>
    <details class="grade"><summary>${T('Límites de centrado de PSA')}</summary>
      <table class="gtable"><tr><td><b>${T('Nota')}</b></td><td><b>${T('Frontal')}</b></td><td><b>${T('Trasera')}</b></td></tr>
      ${PSA_CENTER.map(([n, f, b]) => `<tr><td>PSA ${n} · ${PSA_NAMES[n]}</td><td>${f}/${100 - f}</td><td>${b}/${100 - b}</td></tr>`).join('')}</table>
    </details>
  </div>`;
  wireBack();
  document.querySelectorAll('.cside').forEach(b => b.onclick = () => { CEN.side = b.dataset.side; showCentering(); });
  document.querySelectorAll('.cfile').forEach(inp => inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) cenLoad(f); });
  if (s) cenWire(s);
}

function cenLoad(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const s = { img, rot: 0 };
    cenAutoTilt(s); cenBuildBase(s); cenAutoDetect(s);
    CEN.sides[CEN.side] = s; CEN.sel = 'iL';
    showCentering();
  };
  img.onerror = () => { URL.revokeObjectURL(url); const m = $('cenMsg'); if (m) m.innerHTML = `<div class="msg err">${T('No se ha podido abrir la foto. Prueba con otra.')}</div>`; };
  img.src = url;
}

function cenWire(s){
  const cv = $('cenCanvas');
  const nudge = dir => {
    const vert = CEN.sel[1] === 'L' || CEN.sel[1] === 'R';
    s.L[CEN.sel] += dir / (vert ? s.base.width : s.base.height);
    cenClampOne(s, CEN.sel); cenDraw(); cenResult();
  };
  $('cenAuto').onclick = () => {
    cenAutoTilt(s); cenBuildBase(s); cenAutoDetect(s);
    $('cenRot').value = s.rot; $('cenRotV').textContent = s.rot.toFixed(1) + '°';
    cenDraw(); cenResult();
  };
  $('cenRot').oninput = e => { s.rot = Number(e.target.value); $('cenRotV').textContent = s.rot.toFixed(1) + '°'; cenBuildBase(s); cenDraw(); };
  $('cenRot').onchange = () => { cenAutoDetect(s); cenDraw(); cenResult(); };
  $('cenM').onclick = () => nudge(-1);
  $('cenP').onclick = () => nudge(1);
  cv.onkeydown = e => {
    const map = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    if (map[e.key]) { e.preventDefault(); nudge(map[e.key] * (e.shiftKey ? 5 : 1)); }
  };
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
  cv.onpointerdown = e => {
    const [x, y, w, h] = pos(e);
    let best = null, bd = 1e9;
    for (const k of CEN_LINES) {
      const vert = k[1] === 'L' || k[1] === 'R';
      const d = Math.abs(vert ? x - s.L[k] * w : y - s.L[k] * h);
      if (d < bd) { bd = d; best = k; }
    }
    if (bd > 28) return;
    CEN.sel = best; CEN.drag = { pos: [x, y] };
    cv.setPointerCapture(e.pointerId); cv.focus({ preventScroll: true });
    cenDraw(); cenResult();
  };
  cv.onpointermove = e => {
    if (!CEN.drag) return;
    const [x, y, w, h] = pos(e);
    const vert = CEN.sel[1] === 'L' || CEN.sel[1] === 'R';
    s.L[CEN.sel] = vert ? x / w : y / h;
    cenClampOne(s, CEN.sel);
    CEN.drag.pos = [x, y];
    cenDraw(); cenResult();
  };
  cv.onpointerup = cv.onpointercancel = () => { CEN.drag = null; cenDraw(); };
  window.removeEventListener('resize', cenDraw); window.addEventListener('resize', cenDraw);
  cenDraw(); cenResult();
}

// Una línea no puede cruzar a su pareja (exterior/interior) ni a la del lado contrario
function cenClampOne(s, k){
  const L = s.L, e = .002;
  const lim = {
    oL: [0, L.iL - e], iL: [L.oL + e, L.iR - e], iR: [L.iL + e, L.oR - e], oR: [L.iR + e, 1],
    oT: [0, L.iT - e], iT: [L.oT + e, L.iB - e], iB: [L.iT + e, L.oB - e], oB: [L.iB + e, 1],
  }[k];
  L[k] = Math.min(lim[1], Math.max(lim[0], L[k]));
}
