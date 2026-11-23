// =====================================================================
//  SOBRE DIARIO
//  - Cada usuario con sesión recibe un sobre al día (uno por cuenta, también entre la web y la app).
//  - Dentro hay una carta al azar (Pikachu, Charizard, Blue-Eyes White Dragon, Dark Magician,
//    Luffy o Zoro) con marco de bronce, plata u oro.
//  - Cuantos más días seguidos entres (racha), más fácil es que salga de oro.
//  - Se guarda en Firestore: users/{uid}/sobre/estado (las reglas ya permiten users/{uid}/**).
//  - Pantalla «Colección virtual» (botón 🎴 de la barra) con las cartas, misiones y logros.
//  - Las cartas repetidas dan puntos (bronce 2, plata 5, oro 15); 10 puntos = 1 sobre extra.
//  Lo cargan precio-cartas y precio-telefono (esta lo pide por su <base href>).
// =====================================================================
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

function showPack(state, onOpened){
  if (document.querySelector('.sb-ov')) return;
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

// =====================================================================
//  COLECCIÓN VIRTUAL, MISIONES Y LOGROS
//  Estado en users/{uid}/sobre/estado:
//   day, streak, best, card, frame, opened  → sobre del día
//   album { 'pikachu_oro': n }, opens        → cartas conseguidas
//   extra                                     → sobres extra (premios de misiones)
//   week { id, opens, rare }, claimed { }     → misiones semanales
//   ach { id: fecha }                         → logros desbloqueados
// =====================================================================
const TXT = {
  en: {
    'Colección virtual': 'Virtual collection', 'Virtual': 'Virtual', 'Entra para recibir un sobre cada día y empezar tu colección virtual.': 'Sign in to get a pack every day and start your virtual collection.',
    'Entrar': 'Sign in', 'Cartas': 'Cards', 'Racha': 'Streak', 'días': 'days', 'Sobres abiertos': 'Packs opened', 'Oro hoy': 'Gold today',
    'Abrir el sobre de hoy': 'Open today’s pack', 'Ya abriste el sobre de hoy. Vuelve mañana.': 'You already opened today’s pack. Come back tomorrow.',
    'Abrir sobre extra': 'Open bonus pack', 'Misiones': 'Missions', 'Diaria': 'Daily', 'Semanales': 'Weekly', 'Logros': 'Achievements',
    'Recompensa: 1 sobre extra': 'Reward: 1 bonus pack', 'Reclamar': 'Claim', 'Reclamada': 'Claimed', 'Abre el sobre de hoy': 'Open today’s pack',
    'Abre 3 sobres esta semana': 'Open 3 packs this week', 'Abre 7 sobres esta semana': 'Open 7 packs this week',
    'Consigue una carta de plata u oro esta semana': 'Get a silver or gold card this week', 'Llega a una racha de 5 días': 'Reach a 5-day streak',
    'Cuantos más días seguidos entres, más fácil es que salga una carta de oro.': 'The more days in a row you sign in, the more likely you get a gold card.',
    'Bronce': 'Bronze', 'Plata': 'Silver', 'Oro': 'Gold', '¡Logro desbloqueado!': 'Achievement unlocked!', '¡Sobre extra conseguido!': 'Bonus pack earned!',
    'Primer sobre': 'First pack', 'Abre tu primer sobre': 'Open your first pack', 'Coleccionista': 'Collector', 'Abre 10 sobres': 'Open 10 packs',
    'Gran coleccionista': 'Great collector', 'Abre 30 sobres': 'Open 30 packs', 'Leyenda': 'Legend', 'Abre 100 sobres': 'Open 100 packs',
    'Constante': 'Steady', 'Racha de 3 días': '3-day streak', 'Imparable': 'Unstoppable', 'Racha de 7 días': '7-day streak', 'Un mes entero': 'A whole month', 'Racha de 30 días': '30-day streak',
    'Brillo plateado': 'Silver shine', 'Consigue una carta de plata': 'Get a silver card', 'Toque de oro': 'Golden touch', 'Consigue una carta de oro': 'Get a gold card',
    'Trío completo': 'Full trio', 'Una carta con los 3 marcos': 'One card in all 3 frames', 'Entrenador': 'Trainer', 'Pikachu y Charizard': 'Pikachu and Charizard',
    'Duelista': 'Duelist', 'Blue-Eyes y Dark Magician': 'Blue-Eyes and Dark Magician', 'Sombrero de paja': 'Straw Hat', 'Luffy y Zoro': 'Luffy and Zoro',
    'Todos los personajes': 'All characters', 'Las 6 cartas, con cualquier marco': 'All 6 cards, any frame', 'Rey Midas': 'King Midas', 'Las 6 cartas de oro': 'All 6 cards in gold',
    'Colección completa': 'Complete collection', 'Las 18 cartas': 'All 18 cards',
    'Puntos': 'Points', 'puntos': 'points', 'Carta repetida': 'Duplicate card', 'Canjear por un sobre': 'Exchange for a pack',
    'Cada carta repetida te da puntos. Cámbialos por sobres.': 'Every duplicate card gives you points. Exchange them for packs.',
    'Cambia {0} puntos por un sobre en la Colección virtual.': 'Exchange {0} points for a pack in the Virtual collection.',
  },
  it: {
    'Colección virtual': 'Collezione virtuale', 'Virtual': 'Virtuale', 'Entra para recibir un sobre cada día y empezar tu colección virtual.': 'Accedi per ricevere una bustina ogni giorno e iniziare la tua collezione virtuale.',
    'Entrar': 'Accedi', 'Cartas': 'Carte', 'Racha': 'Serie', 'días': 'giorni', 'Sobres abiertos': 'Bustine aperte', 'Oro hoy': 'Oro oggi',
    'Abrir el sobre de hoy': 'Apri la bustina di oggi', 'Ya abriste el sobre de hoy. Vuelve mañana.': 'Hai già aperto la bustina di oggi. Torna domani.',
    'Abrir sobre extra': 'Apri bustina extra', 'Misiones': 'Missioni', 'Diaria': 'Giornaliera', 'Semanales': 'Settimanali', 'Logros': 'Traguardi',
    'Recompensa: 1 sobre extra': 'Premio: 1 bustina extra', 'Reclamar': 'Riscatta', 'Reclamada': 'Riscattata', 'Abre el sobre de hoy': 'Apri la bustina di oggi',
    'Abre 3 sobres esta semana': 'Apri 3 bustine questa settimana', 'Abre 7 sobres esta semana': 'Apri 7 bustine questa settimana',
    'Consigue una carta de plata u oro esta semana': 'Ottieni una carta d’argento o d’oro questa settimana', 'Llega a una racha de 5 días': 'Raggiungi una serie di 5 giorni',
    'Cuantos más días seguidos entres, más fácil es que salga una carta de oro.': 'Più giorni di fila entri, più è facile trovare una carta d’oro.',
    'Bronce': 'Bronzo', 'Plata': 'Argento', 'Oro': 'Oro', '¡Logro desbloqueado!': 'Traguardo sbloccato!', '¡Sobre extra conseguido!': 'Bustina extra ottenuta!',
    'Primer sobre': 'Prima bustina', 'Abre tu primer sobre': 'Apri la tua prima bustina', 'Coleccionista': 'Collezionista', 'Abre 10 sobres': 'Apri 10 bustine',
    'Gran coleccionista': 'Grande collezionista', 'Abre 30 sobres': 'Apri 30 bustine', 'Leyenda': 'Leggenda', 'Abre 100 sobres': 'Apri 100 bustine',
    'Constante': 'Costante', 'Racha de 3 días': 'Serie di 3 giorni', 'Imparable': 'Inarrestabile', 'Racha de 7 días': 'Serie di 7 giorni', 'Un mes entero': 'Un mese intero', 'Racha de 30 días': 'Serie di 30 giorni',
    'Brillo plateado': 'Lucentezza d’argento', 'Consigue una carta de plata': 'Ottieni una carta d’argento', 'Toque de oro': 'Tocco d’oro', 'Consigue una carta de oro': 'Ottieni una carta d’oro',
    'Trío completo': 'Trio completo', 'Una carta con los 3 marcos': 'Una carta con le 3 cornici', 'Entrenador': 'Allenatore', 'Pikachu y Charizard': 'Pikachu e Charizard',
    'Duelista': 'Duellante', 'Blue-Eyes y Dark Magician': 'Blue-Eyes e Dark Magician', 'Sombrero de paja': 'Cappello di paglia', 'Luffy y Zoro': 'Luffy e Zoro',
    'Todos los personajes': 'Tutti i personaggi', 'Las 6 cartas, con cualquier marco': 'Le 6 carte, con qualsiasi cornice', 'Rey Midas': 'Re Mida', 'Las 6 cartas de oro': 'Le 6 carte d’oro',
    'Colección completa': 'Collezione completa', 'Las 18 cartas': 'Tutte le 18 carte',
    'Puntos': 'Punti', 'puntos': 'punti', 'Carta repetida': 'Carta doppia', 'Canjear por un sobre': 'Scambia per una bustina',
    'Cada carta repetida te da puntos. Cámbialos por sobres.': 'Ogni carta doppia ti dà punti. Scambiali con bustine.',
    'Cambia {0} puntos por un sobre en la Colección virtual.': 'Scambia {0} punti per una bustina nella Collezione virtuale.',
  },
};
const t = s => (TXT[lang()] && TXT[lang()][s]) || s;
// para la barra de navegación de las páginas (usa T() de la web si no hay traducción aquí)
window.sbT = s => (TXT[lang()] && TXT[lang()][s]) || (typeof T === 'function' ? T(s) : s);

const NAMES = { pikachu: 'Pikachu', charizard: 'Charizard', blueeyes: 'Blue-Eyes White Dragon', darkmagician: 'Dark Magician', luffy: 'Monkey D. Luffy', zoro: 'Roronoa Zoro' };
const FNAME = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro' };
// La racha es la misma que la de la página (🔥 de Inicio). Si no está disponible, se usa la de los sobres.
const siteStreak = () => { try { const v = window.GX?.streak?.(); if (typeof v === 'number' && v > 0) return v; } catch (e) {} return null; };
const siteBest = () => { try { const v = window.GX?.best?.(); if (typeof v === 'number') return v; } catch (e) {} return 0; };
const streakOf = s => siteStreak() ?? (s.day === today() || s.day === yesterday() ? (s.streak || 0) : 0);
const goldChance = streak => Math.min(0.05 + 0.03 * Math.max(0, (streak || 1) - 1), 0.45);
const has = (s, c, f) => (s.album?.[c + '_' + f] || 0) > 0;
const hasAny = (s, c) => FRAMES.some(f => has(s, c, f));
const owned = s => CARDS.reduce((n, c) => n + FRAMES.filter(f => has(s, c.id, f)).length, 0);
const opensOf = s => s.opens ?? Object.values(s.album || {}).reduce((a, b) => a + b, 0);

function weekId(d = new Date()){
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - dn);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return x.getUTCFullYear() + '-W' + pad(Math.ceil(((x - y0) / 86400000 + 1) / 7));
}
const weekOf = s => s.week?.id === weekId() ? s.week : { id: weekId(), opens: 0, rare: false };

const DAILY = [{ id: 'd1', txt: 'Abre el sobre de hoy', done: s => s.day === today() && !!s.opened }];
const WEEKLY = [
  { id: 'w3', txt: 'Abre 3 sobres esta semana', goal: 3, val: s => weekOf(s).opens },
  { id: 'w7', txt: 'Abre 7 sobres esta semana', goal: 7, val: s => weekOf(s).opens },
  { id: 'wr', txt: 'Consigue una carta de plata u oro esta semana', goal: 1, val: s => weekOf(s).rare ? 1 : 0 },
  { id: 'ws', txt: 'Llega a una racha de 5 días', goal: 5, val: s => streakOf(s) },
];
const ACH = [
  ['a1', '📦', 'Primer sobre', 'Abre tu primer sobre', s => opensOf(s) >= 1],
  ['a10', '🗃️', 'Coleccionista', 'Abre 10 sobres', s => opensOf(s) >= 10],
  ['a30', '🏛️', 'Gran coleccionista', 'Abre 30 sobres', s => opensOf(s) >= 30],
  ['a100', '👑', 'Leyenda', 'Abre 100 sobres', s => opensOf(s) >= 100],
  ['s3', '🔥', 'Constante', 'Racha de 3 días', s => (s.best || 0) >= 3],
  ['s7', '⚡', 'Imparable', 'Racha de 7 días', s => (s.best || 0) >= 7],
  ['s30', '🌙', 'Un mes entero', 'Racha de 30 días', s => (s.best || 0) >= 30],
  ['fp', '🥈', 'Brillo plateado', 'Consigue una carta de plata', s => CARDS.some(c => has(s, c.id, 'plata'))],
  ['fo', '🥇', 'Toque de oro', 'Consigue una carta de oro', s => CARDS.some(c => has(s, c.id, 'oro'))],
  ['tri', '🎖️', 'Trío completo', 'Una carta con los 3 marcos', s => CARDS.some(c => FRAMES.every(f => has(s, c.id, f)))],
  ['pk', '⚡', 'Entrenador', 'Pikachu y Charizard', s => hasAny(s, 'pikachu') && hasAny(s, 'charizard')],
  ['yg', '🐉', 'Duelista', 'Blue-Eyes y Dark Magician', s => hasAny(s, 'blueeyes') && hasAny(s, 'darkmagician')],
  ['op', '🏴‍☠️', 'Sombrero de paja', 'Luffy y Zoro', s => hasAny(s, 'luffy') && hasAny(s, 'zoro')],
  ['all', '🌟', 'Todos los personajes', 'Las 6 cartas, con cualquier marco', s => CARDS.every(c => hasAny(s, c.id))],
  ['gold', '💛', 'Rey Midas', 'Las 6 cartas de oro', s => CARDS.every(c => has(s, c.id, 'oro'))],
  ['full', '🏆', 'Colección completa', 'Las 18 cartas', s => owned(s) === CARDS.length * FRAMES.length],
];

// ---------- Guardar (Firestore con transacción; si falla, en este dispositivo) ----------
let uid = null, state = null;
const LKEY = () => 'pc_sobre_' + uid;
async function update(fn){
  const u = uid; if (!u) return null;
  const ref = doc(db, 'users', u, 'sobre', 'estado');
  let out;
  try {
    out = await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      const s = snap.exists() ? snap.data() : {};
      const r = fn(s);
      if (r === false) return { s, r };
      tx.set(ref, s);
      return { s, r };
    });
  } catch (e) {
    let s = {}; try { s = JSON.parse(localStorage.getItem(LKEY())) || {}; } catch (_) {}
    const r = fn(s);
    if (r !== false) try { localStorage.setItem(LKEY(), JSON.stringify(s)); } catch (_) {}
    out = { s, r };
  }
  if (uid === u) { state = out.s; redraw(); }
  return out.r;
}
function newDay(s){
  const t0 = today();
  if (s.day === t0) return;
  const streak = siteStreak() ?? (s.day === yesterday() ? (s.streak || 0) + 1 : 1);
  Object.assign(s, { day: t0, streak, card: rollCard(), frame: rollFrame(streak), opened: false, best: Math.max(streak, s.best || 0, siteBest()) });
}
// Puntos por carta repetida (misma carta y mismo marco) y precio de un sobre en la tienda
const DUP_PTS = { bronce: 2, plata: 5, oro: 15 };
const PACK_COST = 10;
const retroPts = s => Object.entries(s.album || {}).reduce((t0, [k, n]) => t0 + Math.max(0, n - 1) * (DUP_PTS[k.split('_')[1]] || 0), 0);
// apunta una carta abierta; devuelve los logros nuevos y los puntos ganados si era repetida
function applyOpen(s, card, frame){
  s.album = s.album || {};
  const dup = (s.album[card + '_' + frame] || 0) > 0 ? DUP_PTS[frame] : 0;
  if (dup) s.points = (s.points || 0) + dup;
  s.opens = opensOf(s) + 1;
  s.album[card + '_' + frame] = (s.album[card + '_' + frame] || 0) + 1;
  const w = weekOf(s); s.week = { id: w.id, opens: (w.opens || 0) + 1, rare: w.rare || frame !== 'bronce' };
  s.best = Math.max(s.best || 0, s.streak || 0, streakOf(s), siteBest());
  return { ids: newAch(s), dup };
}
function newAch(s){
  s.ach = s.ach || {};
  s.best = Math.max(s.best || 0, siteBest());
  const fresh = [];
  for (const [id, , , , ok] of ACH) if (!s.ach[id] && ok(s)) { s.ach[id] = today(); fresh.push(id); }
  return fresh;
}
function celebrate(r){
  if (!r) return;
  const ids = r.ids || [];
  if (r.dup) setTimeout(() => window.pcToast?.('🔁', t('Carta repetida') + ': +' + r.dup + ' ' + t('puntos'), t('Cambia {0} puntos por un sobre en la Colección virtual.').replace('{0}', PACK_COST), 5000), 900);
  ids.forEach((id, i) => { const a = ACH.find(x => x[0] === id); if (a) setTimeout(() => window.pcToast?.(a[1], t('¡Logro desbloqueado!'), t(a[2]), 5000), (r.dup ? 2600 : 600) + i * 1800); });
}

// ---------- Abrir sobres ----------
function openDaily(){
  if (!state || state.day !== today() || state.opened) return;
  showPack(state, () => update(s => { newDay(s); if (s.opened) return false; s.opened = true; return applyOpen(s, s.card, s.frame); })
    .then(celebrate));
}
async function openExtra(){
  if (document.querySelector('.sb-ov')) return;
  const r = await update(s => {
    newDay(s);
    if (!(s.extra > 0)) return false;
    s.extra--;
    const card = rollCard(), frame = rollFrame(streakOf(s) || 1);
    return { card, frame, ...applyOpen(s, card, frame) };
  });
  if (r) showPack(r, () => celebrate(r));
}
// tienda: cambia puntos por un sobre extra
async function buyPack(){
  const r = await update(s => {
    if ((s.points || 0) < PACK_COST) return false;
    s.points -= PACK_COST; s.extra = (s.extra || 0) + 1;
    return true;
  });
  if (r) window.pcToast?.('🎁', t('¡Sobre extra conseguido!'), '', 3500);
}
async function claim(id){
  const r = await update(s => {
    const m = WEEKLY.find(x => x.id === id), k = id + '_' + weekId();
    s.claimed = s.claimed || {};
    if (!m || s.claimed[k] || m.val(s) < m.goal) return false;
    for (const key of Object.keys(s.claimed)) if (!key.endsWith(weekId())) delete s.claimed[key]; // limpia semanas viejas
    s.claimed[k] = 1; s.extra = (s.extra || 0) + 1;
    return true;
  });
  if (r) window.pcToast?.('🎁', t('¡Sobre extra conseguido!'), '', 4000);
}

// ---------- Pantalla "Colección virtual" ----------
const vcss = `
.vc-head{display:flex;align-items:center;gap:14px;margin:4px 0 14px}
.vc-head .ic{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:26px;background:linear-gradient(135deg,#6a44f2,#a347e6);box-shadow:0 6px 18px -4px rgba(106,68,242,.55)}
.vc-head h2{margin:0;font-size:22px}.vc-head p{margin:2px 0 0;color:var(--muted);font-size:13px}
.vc-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 12px}
.vc-shop{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.vc-shop .pts{font-size:26px;font-weight:800;background:linear-gradient(135deg,#c9971c,#f2b01e);-webkit-background-clip:text;background-clip:text;color:transparent}
.vc-shop .tx{flex:1;min-width:180px;color:var(--muted);font-size:13px}
.vc-tbl{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.vc-tbl span{font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;color:#17142b}
.vc-kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px;text-align:center}
.vc-kpi b{display:block;font-size:20px}.vc-kpi small{color:var(--muted);font-size:11.5px;font-weight:600}
.vc-sec{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px 16px;margin:0 0 12px}
.vc-sec h3{margin:0 0 10px;font-size:16px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.vc-sec h3 small{color:var(--muted);font-size:12px;font-weight:600}
.vc-btn{border:0;border-radius:12px;padding:11px 16px;font-weight:700;font-size:15px;cursor:pointer;color:#17142b;
  background:linear-gradient(135deg,#ffe9a0,#ffc94a 50%,#f2b01e);box-shadow:0 4px 14px rgba(242,176,30,.35)}
.vc-btn.soft{background:var(--accent-soft);color:var(--accent);box-shadow:none}
.vc-btn[disabled]{opacity:.55;cursor:default}
.vc-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.vc-note{color:var(--muted);font-size:13px;margin:8px 0 0}
.vc-grid{display:grid;grid-template-columns:1fr;gap:6px}
@media (min-width:1000px){.vc-grid{grid-template-columns:repeat(2,1fr);gap:16px 28px}}
.vc-grp{display:grid;grid-template-columns:repeat(3,minmax(0,140px));gap:12px 10px}
.vc-name{font-weight:700;font-size:14px;margin:8px 0 12px}
.vc-slot{position:relative;aspect-ratio:63/88;border-radius:10px;padding:5%;box-sizing:border-box;cursor:default;border:0}
.vc-slot img{width:100%;height:100%;object-fit:cover;border-radius:6px;display:block}
.vc-slot.bronce{background:linear-gradient(135deg,#5a2f12,#e0a070 22%,#9a5a2a 45%,#f3c69a 65%,#6e3a17 85%,#c47a3d)}
.vc-slot.plata{background:linear-gradient(135deg,#6d7480,#f4f6fa 22%,#a9b0bb 45%,#ffffff 65%,#7b828e 85%,#d5dae2)}
.vc-slot.oro{background:linear-gradient(135deg,#7a5a12,#f7e08a 20%,#c9971c 42%,#fff3b0 62%,#a87a12 82%,#ffd75e);box-shadow:0 0 14px rgba(255,201,74,.6)}
.vc-slot.have{cursor:pointer}
.vc-slot.lock{background:var(--accent-soft);border:2px dashed var(--line)}
.vc-slot.lock::after{content:'?';position:absolute;inset:0;display:grid;place-items:center;font-size:28px;font-weight:800;color:var(--muted);opacity:.6}
.vc-slot .n{position:absolute;right:4px;bottom:4px;background:rgba(23,20,42,.85);color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px}
.vc-slot .f{position:absolute;left:50%;top:-8px;transform:translateX(-50%);font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--card);border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.vc-mis{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
.vc-mis:first-of-type{border-top:0}
.vc-mis .tx{flex:1;min-width:0}.vc-mis .tx b{display:block;font-size:14px}.vc-mis .tx small{color:var(--muted);font-size:12px}
.vc-bar{height:7px;border-radius:9px;background:var(--accent-soft);overflow:hidden;margin-top:6px}
.vc-bar i{display:block;height:100%;background:linear-gradient(90deg,#6a44f2,#a347e6)}
.vc-mis .ok{font-size:20px}
.vc-mis .vc-btn{padding:7px 12px;font-size:13px}
.vc-ach{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.vc-a{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:14px;padding:9px 10px}
.vc-a .e{font-size:24px;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#ffe9a0,#ffc94a)}
.vc-a b{display:block;font-size:13px}.vc-a small{color:var(--muted);font-size:11.5px;line-height:1.25;display:block}
.vc-a.off{opacity:.45}.vc-a.off .e{background:var(--accent-soft);filter:grayscale(1)}
.vc-zoom .vc-big{width:min(300px,74vw);aspect-ratio:63/88;border-radius:16px;padding:4.5%;box-sizing:border-box;position:relative}
.vc-zoom .vc-big img{width:100%;height:100%;object-fit:cover;border-radius:10px;display:block}
@media (max-width:620px){.vc-kpis{grid-template-columns:repeat(2,1fr)}.vc-kpis .vc-kpi:last-child{grid-column:1/-1}}
`;
function imgTag(c){ return `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${c.img[0]}" data-alt="${c.img.slice(1).join('|')}">`; }
function fixImgs(root){
  root.querySelectorAll('img[data-alt]').forEach(im => im.onerror = () => {
    const alt = im.dataset.alt ? im.dataset.alt.split('|') : []; if (!alt.length) return im.onerror = null;
    im.dataset.alt = alt.slice(1).join('|'); im.src = alt[0];
  });
}
const active = () => { try { return typeof view !== 'undefined' && view === 'vir'; } catch (e) { return false; } };
function redraw(){ if (active()) render(); }

function render(){
  const out = document.getElementById('out'); if (!out) return;
  if (!document.getElementById('vc-css')) { const st = document.createElement('style'); st.id = 'vc-css'; st.textContent = vcss; document.head.appendChild(st); }
  const head = `<div class="vc-head"><div class="ic">🎴</div><div><h2>${t('Colección virtual')}</h2><p>${t('Cuantos más días seguidos entres, más fácil es que salga una carta de oro.')}</p></div></div>`;
  if (!auth.currentUser) {
    out.innerHTML = head + `<div class="vc-sec"><p style="margin:0 0 12px">${t('Entra para recibir un sobre cada día y empezar tu colección virtual.')}</p><button class="vc-btn" id="vcLogin">👤 ${t('Entrar')}</button></div>`;
    out.querySelector('#vcLogin').onclick = () => window.cuentaAPI?.login('');
    return;
  }
  const s = state || {};
  const streak = streakOf(s);
  const wk = weekId(), claimed = s.claimed || {};
  const total = CARDS.length * FRAMES.length;

  const daily = s.day === today() && !s.opened
    ? `<button class="vc-btn" id="vcDaily">🎁 ${t('Abrir el sobre de hoy')}</button>`
    : `<p class="vc-note" style="margin:0">✅ ${t('Ya abriste el sobre de hoy. Vuelve mañana.')}</p>`;
  const extra = s.extra > 0 ? `<button class="vc-btn soft" id="vcExtra">✨ ${t('Abrir sobre extra')} (${s.extra})</button>` : '';

  const grid = CARDS.map(c => `<div><div class="vc-name">${NAMES[c.id]}</div><div class="vc-grp">` + FRAMES.map(f => {
    const n = s.album?.[c.id + '_' + f] || 0;
    return n ? `<button class="vc-slot ${f} have" data-c="${c.id}" data-f="${f}" aria-label="${NAMES[c.id]} · ${t(FNAME[f])}"><span class="f">${t(FNAME[f])}</span>${imgTag(c)}${n > 1 ? `<span class="n">×${n}</span>` : ''}</button>`
      : `<div class="vc-slot lock" aria-label="?"><span class="f">${t(FNAME[f])}</span></div>`;
  }).join('') + '</div></div>').join('');

  const mis = m => {
    const v = m.val(s), done = v >= m.goal, got = claimed[m.id + '_' + wk];
    return `<div class="vc-mis"><div class="tx"><b>${t(m.txt)}</b><small>🎁 ${t('Recompensa: 1 sobre extra')} · ${Math.min(v, m.goal)}/${m.goal}</small>
      <div class="vc-bar"><i style="width:${Math.min(100, v / m.goal * 100)}%"></i></div></div>
      ${got ? `<span class="ok" title="${t('Reclamada')}">✅</span>` : `<button class="vc-btn" data-claim="${m.id}"${done ? '' : ' disabled'}>${t('Reclamar')}</button>`}</div>`;
  };
  const dailyM = DAILY.map(m => `<div class="vc-mis"><div class="tx"><b>${t(m.txt)}</b><small>🔥 ${t('Racha')}: ${streak} ${t('días')}</small></div><span class="ok">${m.done(s) ? '✅' : '⬜'}</span></div>`).join('');
  const got = Object.keys(s.ach || {}).length;
  const ach = ACH.map(([id, e, n, d]) => `<div class="vc-a${s.ach?.[id] ? '' : ' off'}"><span class="e">${e}</span><div><b>${t(n)}</b><small>${t(d)}</small></div></div>`).join('');

  out.innerHTML = head + `
    <div class="vc-kpis">
      <div class="vc-kpi"><b>${owned(s)}/${total}</b><small>${t('Cartas')}</small></div>
      <div class="vc-kpi"><b>🔥 ${streak}</b><small>${t('Racha')} (${t('días')})</small></div>
      <div class="vc-kpi"><b>${opensOf(s)}</b><small>${t('Sobres abiertos')}</small></div>
      <div class="vc-kpi"><b>💎 ${s.points || 0}</b><small>${t('Puntos')}</small></div>
      <div class="vc-kpi"><b>${Math.round(goldChance(streak || 1) * 100)} %</b><small>${t('Oro hoy')}</small></div>
    </div>
    <div class="vc-sec"><div class="vc-row">${daily}${extra}</div></div>
    <div class="vc-sec"><h3>💎 ${t('Puntos')} <small>${t('Carta repetida')}</small></h3><div class="vc-shop">
      <span class="pts">💎 ${s.points || 0}</span>
      <div class="tx">${t('Cada carta repetida te da puntos. Cámbialos por sobres.')}
        <div class="vc-tbl"><span style="background:linear-gradient(135deg,#e0a070,#f3c69a)">${t('Bronce')} +${DUP_PTS.bronce}</span><span style="background:linear-gradient(135deg,#cfd6e0,#fff)">${t('Plata')} +${DUP_PTS.plata}</span><span style="background:linear-gradient(135deg,#f7e08a,#ffc94a)">${t('Oro')} +${DUP_PTS.oro}</span></div></div>
      <button class="vc-btn" id="vcBuy"${(s.points || 0) >= PACK_COST ? '' : ' disabled'}>🎁 ${t('Canjear por un sobre')} (${PACK_COST} 💎)</button>
      <div class="vc-bar" style="flex-basis:100%;margin:0"><i style="width:${Math.min(100, (s.points || 0) / PACK_COST * 100)}%"></i></div>
    </div></div>
    <div class="vc-sec"><h3>🎴 ${t('Colección virtual')} <small>${owned(s)}/${total}</small></h3><div class="vc-grid">${grid}</div></div>
    <div class="vc-sec"><h3>🎯 ${t('Misiones')} <small>${t('Diaria')}</small></h3>${dailyM}</div>
    <div class="vc-sec"><h3>📅 ${t('Misiones')} <small>${t('Semanales')}</small></h3>${WEEKLY.map(mis).join('')}</div>
    <div class="vc-sec"><h3>🏅 ${t('Logros')} <small>${got}/${ACH.length}</small></h3><div class="vc-ach">${ach}</div></div>`;
  fixImgs(out);
  out.querySelector('#vcDaily')?.addEventListener('click', openDaily);
  out.querySelector('#vcExtra')?.addEventListener('click', openExtra);
  out.querySelector('#vcBuy')?.addEventListener('click', buyPack);
  out.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claim(b.dataset.claim));
  out.querySelectorAll('.vc-slot.have').forEach(b => b.onclick = () => zoom(b.dataset.c, b.dataset.f));
}
function zoom(cid, f){
  const c = CARDS.find(x => x.id === cid); if (!c || document.querySelector('.sb-ov')) return;
  if (!document.getElementById('sb-css')) { const st = document.createElement('style'); st.id = 'sb-css'; st.textContent = css; document.head.appendChild(st); }
  const ov = document.createElement('div'); ov.className = 'sb-ov vc-zoom';
  ov.innerHTML = `<button class="sb-x on" aria-label="✕">✕</button><div class="vc-big sb-front ${f}" style="transform:none">${imgTag(c)}</div>`;
  document.body.appendChild(ov); fixImgs(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
  const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 350); };
  ov.onclick = close;
}
window.SOBRE = { show: () => render() };

// ---------- Sesión ----------
onAuthStateChanged(auth, async u => {
  uid = u ? u.uid : null; state = null;
  redraw();
  if (!u) return;
  await update(s => { const before = s.day; newDay(s); const ids = newAch(s);
    let ch = false; if (!s.ptsInit) { s.points = (s.points || 0) + retroPts(s); s.ptsInit = 1; ch = true; } // puntos de las repetidas de antes
    return before === s.day && !ids.length && !ch ? false : true; });
  if (uid !== u.uid || !state || state.opened) return;
  // espera a que se cierre la ventana de entrar (si está abierta)
  const busy = () => { const l = document.getElementById('login'), e = document.getElementById('esheet'); return (l && !l.hidden) || (e && !e.hidden); };
  const go = () => busy() ? setTimeout(go, 400) : openDaily();
  setTimeout(go, 600);
});
// la barra de navegación ya se dibujó antes de cargar este archivo: se vuelve a dibujar con las traducciones
try { if (typeof drawTabbar === 'function') drawTabbar(); } catch (e) {}
