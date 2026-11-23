// =====================================================================
//  SOBRE DIARIO
//  - Cada usuario con sesión recibe un sobre al día (uno por cuenta, también entre la web y la app).
//  - Dentro hay una carta al azar (Pikachu, Charizard, Blue-Eyes White Dragon, Dark Magician,
//    Luffy o Zoro) con marco de bronce, plata u oro.
//  - Cuantos más días seguidos entres (racha), más fácil es que salga de oro.
//  - Se guarda en Firestore: users/{uid}/sobre/estado (las reglas ya permiten users/{uid}/**).
//  Lo cargan precio-cartas y precio-telefono (esta lo pide por su <base href>).
// =====================================================================
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, runTransaction, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Cartas posibles ----------
const OPT = 'https://optcgapi.com/media/static/Card_Images/';
const LIM = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP01/';
const CARDS = [
  { id: 'pikachu',   img: ['https://images.pokemontcg.io/base1/58_hires.png', 'https://images.pokemontcg.io/base1/58.png'] },
  { id: 'charizard', img: ['https://images.pokemontcg.io/base1/4_hires.png', 'https://images.pokemontcg.io/base1/4.png'] },
  { id: 'blueeyes',  img: ['https://images.ygoprodeck.com/images/cards/89631139.jpg'] },
  { id: 'darkmagician', img: ['https://images.ygoprodeck.com/images/cards/46986414.jpg'] },
  { id: 'luffy',     img: [OPT + 'OP01-003.jpg', LIM + 'OP01-003_EN.webp'] },
  { id: 'zoro',      img: [OPT + 'OP01-001.jpg', LIM + 'OP01-001_EN.webp'] },
];
const FRAMES = ['bronce', 'plata', 'oro'];

// Probabilidad de oro según la racha: 5 % el primer día, +3 % por cada día seguido, máximo 45 %.
// Plata 30 % fija (o lo que quede); el resto, bronce.
function rollFrame(streak){
  const gold = Math.min(0.05 + 0.03 * Math.max(0, streak - 1), 0.45);
  const silver = Math.min(0.30, 1 - gold);
  const r = Math.random();
  return r < gold ? 'oro' : r < gold + silver ? 'plata' : 'bronce';
}
const rollCard = () => CARDS[Math.floor(Math.random() * CARDS.length)].id;

const pad = n => String(n).padStart(2, '0');
const dayOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dayOf(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayOf(d); };

// ---------- Texto de la instrucción (único texto que se ve) ----------
const HINT = {
  es: 'Abre el sobre: desliza el dedo por la línea dorada de arriba',
  en: 'Open the pack: swipe along the gold line at the top',
  it: 'Apri la bustina: scorri il dito sulla linea dorata in alto',
  fr: 'Ouvre le booster : fais glisser ton doigt sur la ligne dorée en haut',
  nl: 'Open het pakje: veeg over de gouden lijn bovenaan',
  de: 'Öffne das Booster: wische über die goldene Linie oben',
  ja: 'パックを開けよう：上の金色のラインを指でなぞってね',
  zh: '打开卡包：用手指划过顶部的金色线',
  ko: '팩을 열어 보세요: 위쪽 금색 선을 따라 밀어 주세요',
};
const lang = () => {
  try { if (typeof LANG !== 'undefined' && HINT[LANG]) return LANG; } catch (e) {}
  try { const s = localStorage.getItem('idioma'); if (HINT[s]) return s; } catch (e) {}
  return 'es';
};

// ---------- Estilos ----------
const css = `
.sb-ov{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;
  background:radial-gradient(ellipse at 50% 40%,rgba(106,68,242,.55),rgba(13,11,22,.94) 70%);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  opacity:0;transition:opacity .35s;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
.sb-ov.in{opacity:1}
.sb-stage{position:relative;width:min(240px,62vw);aspect-ratio:240/360;perspective:1200px}
.sb-hint{color:#fff5d9;font:600 15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;max-width:300px;padding:0 20px;
  text-shadow:0 2px 10px rgba(0,0,0,.6);transition:opacity .3s}
.sb-hint.off{opacity:0}

/* Sobre */
.sb-pack{position:absolute;inset:0;animation:sb-float 3.2s ease-in-out infinite;filter:drop-shadow(0 18px 30px rgba(0,0,0,.55))}
.sb-body,.sb-top{position:absolute;left:0;right:0;overflow:hidden;
  background:
    radial-gradient(circle at 50% 52%,rgba(255,201,74,.35),transparent 32%),
    repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,transparent 10px 20px),
    linear-gradient(160deg,#8f72ff 0%,#6a44f2 35%,#4a26c9 60%,#a347e6 100%)}
.sb-body{top:15%;bottom:0;clip-path:polygon(0 0,100% 0,100% 97%,95% 100%,90% 97%,85% 100%,80% 97%,75% 100%,70% 97%,65% 100%,60% 97%,55% 100%,50% 97%,45% 100%,40% 97%,35% 100%,30% 97%,25% 100%,20% 97%,15% 100%,10% 97%,5% 100%,0 97%);
  background-position:0 -54px,0 0,0 0;border-radius:0}
.sb-top{top:0;height:15%;clip-path:polygon(0 18%,5% 0,10% 18%,15% 0,20% 18%,25% 0,30% 18%,35% 0,40% 18%,45% 0,50% 18%,55% 0,60% 18%,65% 0,70% 18%,75% 0,80% 18%,85% 0,90% 18%,95% 0,100% 18%,100% 100%,0 100%);
  transform-origin:100% 100%;transition:transform .7s cubic-bezier(.3,.7,.2,1),opacity .7s}
.sb-top::after,.sb-body::after{content:'';position:absolute;left:0;right:0;height:5px;background:linear-gradient(90deg,#a87a12,#ffe9a0,#f2b01e,#fff3b0,#c9971c)}
.sb-top::after{bottom:0}.sb-body::after{bottom:3%}
.sb-pack.open .sb-top{transform:translate(40%,-160%) rotate(28deg);opacity:0}
/* línea dorada para rasgar */
.sb-line{position:absolute;left:4%;right:4%;top:15%;height:0;border-top:2px dashed rgba(255,233,160,.85);transform:translateY(-1px);z-index:3;pointer-events:none}
.sb-tear{position:absolute;left:4%;top:15%;height:4px;width:0;transform:translateY(-2px);z-index:4;pointer-events:none;border-radius:4px;
  background:linear-gradient(90deg,#fff3b0,#ffc94a);box-shadow:0 0 12px #ffc94a,0 0 24px #ffc94a}
.sb-grab{position:absolute;left:0;right:0;top:0;height:30%;z-index:5;cursor:grab}
.sb-grab:active{cursor:grabbing}
/* emblema dorado (sin texto) */
.sb-emb{position:absolute;left:50%;top:57%;width:34%;aspect-ratio:1;transform:translate(-50%,-50%) rotate(45deg);border-radius:14%;
  background:linear-gradient(135deg,#a87a12,#ffe9a0 30%,#f2b01e 55%,#fff3b0 75%,#c9971c);box-shadow:0 0 0 4px rgba(255,255,255,.15),0 0 30px rgba(255,201,74,.55)}
.sb-emb::before{content:'';position:absolute;inset:22%;border-radius:12%;background:linear-gradient(135deg,#4a26c9,#8f72ff);box-shadow:inset 0 0 0 3px rgba(255,243,176,.7)}
.sb-emb::after{content:'';position:absolute;inset:38%;border-radius:50%;background:radial-gradient(circle,#fff3b0,#f2b01e)}
.sb-band{position:absolute;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#ffc94a,transparent);opacity:.75}
.sb-shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.38) 48%,transparent 60%);
  background-size:250% 100%;animation:sb-shine 3.4s ease-in-out infinite;mix-blend-mode:screen;pointer-events:none}
.sb-pack.open{animation:none}
.sb-pack.gone{transition:transform .8s cubic-bezier(.5,0,.8,.4),opacity .8s;transform:translateY(120%);opacity:0}
@keyframes sb-float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-8px) rotate(1deg)}}
@keyframes sb-shine{0%{background-position:150% 0}60%,100%{background-position:-60% 0}}
.sb-nudge{animation:sb-nudge .5s}
@keyframes sb-nudge{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px) rotate(-2deg)}75%{transform:translateX(6px) rotate(2deg)}}

/* Carta */
.sb-card{position:absolute;left:7%;right:7%;top:20%;aspect-ratio:63/88;z-index:-1;transform-style:preserve-3d;
  transition:transform 1s cubic-bezier(.2,.8,.2,1),left 1s,right 1s,top 1s}
.sb-card.up{z-index:6;transform:translateY(-34%)}
.sb-card.show{left:-8%;right:-8%;top:-2%;transform:rotateY(180deg)}
.sb-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:16px;overflow:hidden}
.sb-back{background:
    radial-gradient(circle at 50% 50%,#ffc94a 0 9%,transparent 10%),
    radial-gradient(circle at 50% 50%,transparent 0 17%,rgba(255,201,74,.8) 18% 19%,transparent 20%),
    repeating-conic-gradient(from 0deg,rgba(255,255,255,.06) 0 10deg,transparent 10deg 20deg),
    linear-gradient(160deg,#4a26c9,#17142a);box-shadow:inset 0 0 0 6px #c9971c,inset 0 0 0 9px #17142a}
.sb-front{transform:rotateY(180deg);padding:4.5%;box-sizing:border-box}
.sb-front img{display:block;width:100%;height:100%;object-fit:cover;border-radius:10px;position:relative;z-index:1}
.sb-front::after{content:'';position:absolute;inset:0;z-index:2;border-radius:16px;pointer-events:none;
  background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.45) 45%,transparent 58%);background-size:260% 100%;animation:sb-shine 2.8s ease-in-out infinite}
.sb-front.bronce{background:linear-gradient(135deg,#5a2f12,#e0a070 22%,#9a5a2a 45%,#f3c69a 65%,#6e3a17 85%,#c47a3d);box-shadow:0 0 30px rgba(205,127,50,.55)}
.sb-front.plata{background:linear-gradient(135deg,#6d7480,#f4f6fa 22%,#a9b0bb 45%,#ffffff 65%,#7b828e 85%,#d5dae2);box-shadow:0 0 36px rgba(220,228,240,.65)}
.sb-front.oro{background:linear-gradient(135deg,#7a5a12,#f7e08a 20%,#c9971c 42%,#fff3b0 62%,#a87a12 82%,#ffd75e);
  box-shadow:0 0 30px rgba(255,201,74,.9),0 0 80px rgba(255,201,74,.55);animation:sb-glow 1.8s ease-in-out infinite}
@keyframes sb-glow{0%,100%{box-shadow:0 0 26px rgba(255,201,74,.85),0 0 70px rgba(255,201,74,.45)}50%{box-shadow:0 0 40px rgba(255,220,120,1),0 0 110px rgba(255,201,74,.7)}}
.sb-front.plata::after{animation-duration:3.4s}
.sb-front.bronce::after{opacity:.6;animation-duration:4s}

/* destello y chispas */
.sb-flash{position:absolute;left:50%;top:45%;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%) scale(0);pointer-events:none;z-index:7;opacity:0}
.sb-flash.go{animation:sb-flash .9s ease-out forwards}
@keyframes sb-flash{0%{opacity:1;transform:translate(-50%,-50%) scale(0)}100%{opacity:0;transform:translate(-50%,-50%) scale(90)}}
.sb-spark{position:absolute;width:7px;height:7px;border-radius:50%;pointer-events:none;z-index:8;animation:sb-spark 1.6s ease-out forwards}
@keyframes sb-spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.sb-x{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,233,160,.5);
  background:rgba(23,20,42,.6);color:#fff5d9;font-size:18px;cursor:pointer;opacity:0;transition:opacity .4s;pointer-events:none}
.sb-x.on{opacity:1;pointer-events:auto}
@media (prefers-reduced-motion:reduce){.sb-pack,.sb-shine,.sb-front::after,.sb-front.oro{animation:none}}
`;

let shown = false;
function showPack(state, onOpened){
  if (shown || document.querySelector('.sb-ov')) return;
  shown = true;
  const card = CARDS.find(c => c.id === state.card) || CARDS[0];
  const frame = FRAMES.includes(state.frame) ? state.frame : 'bronce';

  if (!document.getElementById('sb-css')) {
    const st = document.createElement('style'); st.id = 'sb-css'; st.textContent = css; document.head.appendChild(st);
  }
  const ov = document.createElement('div');
  ov.className = 'sb-ov';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `
    <button class="sb-x" aria-label="✕">✕</button>
    <div class="sb-stage">
      <div class="sb-card"><div class="sb-face sb-back"></div><div class="sb-face sb-front ${frame}"><img alt="" referrerpolicy="no-referrer"></div></div>
      <div class="sb-pack">
        <div class="sb-body"><div class="sb-band" style="top:16%"></div><div class="sb-band" style="bottom:12%"></div><div class="sb-emb"></div><div class="sb-shine"></div></div>
        <div class="sb-top"><div class="sb-shine"></div></div>
        <div class="sb-line"></div><div class="sb-tear"></div>
        <div class="sb-grab" tabindex="0" role="button" aria-label="${HINT[lang()]}"></div>
      </div>
      <div class="sb-flash"></div>
    </div>
    <div class="sb-hint">${HINT[lang()]}</div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));

  const $ = s => ov.querySelector(s);
  const img = $('.sb-front img');
  let src = 0;
  img.onerror = () => { if (++src < card.img.length) img.src = card.img[src]; };
  img.src = card.img[0];

  const pack = $('.sb-pack'), grab = $('.sb-grab'), tear = $('.sb-tear'), cardEl = $('.sb-card');
  let startX = null, opened = false;

  const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 350); };
  $('.sb-x').onclick = close;

  function open(){
    if (opened) return; opened = true;
    tear.style.width = '92%';
    $('.sb-hint').classList.add('off');
    pack.classList.add('open');
    onOpened && onOpened();
    setTimeout(() => cardEl.classList.add('up'), 450);
    setTimeout(() => pack.classList.add('gone'), 1050);
    setTimeout(() => {
      cardEl.classList.add('show');
      const fl = $('.sb-flash');
      fl.style.background = frame === 'oro' ? 'radial-gradient(circle,#fff3b0,#ffc94a)' : frame === 'plata' ? 'radial-gradient(circle,#fff,#cfd6e0)' : 'radial-gradient(circle,#f3c69a,#c47a3d)';
      fl.classList.add('go');
      sparks(frame === 'oro' ? 46 : frame === 'plata' ? 26 : 14);
    }, 1500);
    setTimeout(() => { $('.sb-x').classList.add('on'); }, 2400);
    setTimeout(() => { ov.onclick = e => { if (!e.target.closest('.sb-x')) close(); }; }, 2600);
  }
  function sparks(n){
    const stage = $('.sb-stage');
    const cols = frame === 'oro' ? ['#fff3b0', '#ffc94a', '#f2b01e'] : frame === 'plata' ? ['#ffffff', '#dfe4ec', '#b8c0cc'] : ['#f3c69a', '#e0a070', '#c47a3d'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'sb-spark';
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 180;
      s.style.cssText = `left:50%;top:45%;background:${cols[i % 3]};box-shadow:0 0 8px ${cols[i % 3]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px;animation-delay:${Math.random() * .25}s`;
      stage.appendChild(s); setTimeout(() => s.remove(), 2000);
    }
  }

  // Rasgar: deslizar el dedo (o el ratón) a lo largo de la línea dorada
  const w = () => grab.getBoundingClientRect().width;
  grab.addEventListener('pointerdown', e => { if (opened) return; startX = e.clientX; grab.setPointerCapture?.(e.pointerId); });
  grab.addEventListener('pointermove', e => {
    if (startX == null || opened) return;
    const p = Math.max(0, Math.min(1, Math.abs(e.clientX - startX) / (w() * 0.75)));
    tear.style.width = (p * 92) + '%';
    if (p >= 1) { startX = null; open(); }
  });
  const cancel = () => {
    if (startX == null || opened) return; startX = null;
    tear.style.transition = 'width .3s'; tear.style.width = '0';
    setTimeout(() => tear.style.transition = '', 300);
    pack.classList.remove('sb-nudge'); void pack.offsetWidth; pack.classList.add('sb-nudge');
  };
  grab.addEventListener('pointerup', cancel);
  grab.addEventListener('pointercancel', cancel);
  grab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  // si toca el sobre en otro sitio, el sobre se mueve para indicar dónde rasgar
  $('.sb-body').addEventListener('click', () => { if (opened) return; pack.classList.remove('sb-nudge'); void pack.offsetWidth; pack.classList.add('sb-nudge'); });
  document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape' && opened) { close(); document.removeEventListener('keydown', esc); } });
}

// ---------- Estado del día (Firestore, con copia local si falla) ----------
async function claimToday(uid){
  const t = today(), y = yesterday();
  const ref = doc(db, 'users', uid, 'sobre', 'estado');
  try {
    return await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const s = snap.exists() ? snap.data() : {};
      if (s.day === t) return { ...s, ref };
      const streak = s.day === y ? (s.streak || 0) + 1 : 1;
      const next = { day: t, streak, card: rollCard(), frame: rollFrame(streak), opened: false, best: Math.max(streak, s.best || 0) };
      tx.set(ref, next, { merge: true });
      return { ...s, ...next, ref };
    });
  } catch (e) {
    // sin conexión o sin permisos: se guarda en este dispositivo
    const k = 'pc_sobre_' + uid;
    let s = {}; try { s = JSON.parse(localStorage.getItem(k)) || {}; } catch (_) {}
    if (s.day !== t) {
      const streak = s.day === y ? (s.streak || 0) + 1 : 1;
      s = { ...s, day: t, streak, card: rollCard(), frame: rollFrame(streak), opened: false };
      try { localStorage.setItem(k, JSON.stringify(s)); } catch (_) {}
    }
    return { ...s, local: k };
  }
}
function markOpened(uid, s){
  if (s.local) {
    try { const d = JSON.parse(localStorage.getItem(s.local)) || {}; d.opened = true; const a = d.album || {}; a[s.card + '_' + s.frame] = (a[s.card + '_' + s.frame] || 0) + 1; d.album = a; localStorage.setItem(s.local, JSON.stringify(d)); } catch (_) {}
    return;
  }
  updateDoc(s.ref, { opened: true, ['album.' + s.card + '_' + s.frame]: increment(1) }).catch(() => {});
}

let lastUid = null;
onAuthStateChanged(auth, async u => {
  if (!u) { lastUid = null; return; }
  if (u.uid === lastUid) return;
  lastUid = u.uid;
  const s = await claimToday(u.uid);
  if (s.opened || auth.currentUser?.uid !== u.uid) return;
  // espera a que se cierre la ventana de entrar (si está abierta)
  const wait = () => { const l = document.getElementById('login'); return l && !l.hidden; };
  const go = () => wait() ? setTimeout(go, 400) : showPack(s, () => markOpened(u.uid, s));
  setTimeout(go, 600);
});
