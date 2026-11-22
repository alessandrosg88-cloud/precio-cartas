// =====================================================================
//  CUENTAS DE USUARIO (Firebase, plan gratuito Spark)
//  - Entrar con Google o con email + contraseña (Firebase Authentication)
//  - Mi colección y favoritos guardados en Firestore: users/{uid}/items/{carta}
//    (las reglas de Firestore solo dejan a cada usuario leer y escribir sus propias cartas)
//  Usa variables de la página principal: game, GAMES, search, out, backStack, current, T, esc, $
// =====================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Configuración pública de la app web (no es secreta: la seguridad la ponen las reglas de Firestore)
const app = initializeApp({
  apiKey: 'AIzaSyBe6sgVxhXGKYilnV0Dghj8Z9wn6TSWobc',
  authDomain: 'precio-cartas.firebaseapp.com',
  projectId: 'precio-cartas',
  storageBucket: 'precio-cartas.firebasestorage.app',
  messagingSenderId: '729865479700',
  appId: '1:729865479700:web:f960c11e34422c9d7a2901',
});
const auth = getAuth(app);
const db = getFirestore(app);

let user = null;
let items = new Map();     // id -> datos de la carta guardada
let unsub = null;
let lastCard = null;       // última carta dibujada (para el bloque "Mi colección" de la ficha)

// ---------- Botón de cuenta (arriba, junto al idioma) ----------
const bar = document.querySelector('.langbar');
bar.insertAdjacentHTML('afterbegin', `<div class="acct"><button class="lsel" id="acct"></button><div class="lmenu" id="acctMenu"></div></div>`);
const acct = $('acct'), menu = $('acctMenu');
function drawAcct(){
  if (!user) { acct.textContent = T('👤 Entrar'); menu.innerHTML = ''; return; }
  const nm = user.displayName || user.email || '';
  acct.innerHTML = (user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : '👤') + ' ' + esc(nm.split(/[ @]/)[0]) + ' ▾';
  const cols = [...items.values()];
  menu.innerHTML = `<div class="who">${esc(nm)}</div>
    <button data-a="col">📚 ${T('Mi colección')} (${cols.filter(i => i.qty > 0).length})</button>
    <button data-a="fav">⭐ ${T('Favoritos')} (${cols.filter(i => i.fav).length})</button>
    ${cols.some(i => i.alert) ? `<button data-a="alert">🔔 ${T('Alertas de precio')} (${cols.filter(hitAlert).length}/${cols.filter(i => i.alert).length})</button>` : ''}
    <button data-a="out">🚪 ${T('Salir')}</button>`;
  menu.querySelectorAll('button').forEach(b => b.onclick = () => {
    menu.classList.remove('open');
    if (b.dataset.a === 'out') signOut(auth);
    else showMine(b.dataset.a);
  });
}
acct.onclick = e => {
  e.stopPropagation();
  if (!user) return openLogin();
  menu.classList.toggle('open');
};
document.addEventListener('click', e => { if (!e.target.closest('.acct')) menu.classList.remove('open'); });

// ---------- Ventana para entrar / crear cuenta ----------
document.body.insertAdjacentHTML('beforeend', `<div class="login" id="login" hidden><div class="lbox" role="dialog" aria-modal="true">
  <button class="lclose" id="lclose" aria-label="Cerrar">✕</button>
  <h2>👤 Precio Cartas</h2>
  <button class="gbtn google" id="lgoogle"></button>
  <p class="lor" id="lor"></p>
  <input id="lemail" type="email" autocomplete="email">
  <input id="lpass" type="password" autocomplete="current-password">
  <div class="lrow"><button class="gbtn" id="lin"></button><button class="gbtn soft" id="lnew"></button></div>
  <button class="link" id="lforgot"></button>
  <p class="lmsg" id="lmsg"></p>
</div></div>`);
function openLogin(msg = ''){
  $('lgoogle').textContent = T('Entrar con Google');
  $('lor').textContent = T('o con tu email');
  $('lemail').placeholder = T('Email'); $('lpass').placeholder = T('Contraseña');
  $('lin').textContent = T('Entrar'); $('lnew').textContent = T('Crear cuenta');
  $('lforgot').textContent = T('¿Olvidaste la contraseña?');
  $('lmsg').textContent = msg; $('lmsg').className = 'lmsg';
  $('login').hidden = false;
}
const closeLogin = () => { $('login').hidden = true; };
$('lclose').onclick = closeLogin;
$('login').onclick = e => { if (e.target.id === 'login') closeLogin(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('login').hidden) closeLogin(); });
const ERR = {
  'auth/invalid-credential': 'Email o contraseña incorrectos.', 'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'Email o contraseña incorrectos.', 'auth/email-already-in-use': 'Ese email ya tiene una cuenta. Entra con él.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.', 'auth/invalid-email': 'Escribe un email válido.',
  'auth/missing-password': 'La contraseña debe tener al menos 6 caracteres.',
};
const fail = e => { if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
  $('lmsg').textContent = T(ERR[e?.code] || 'No se pudo iniciar sesión. Inténtalo otra vez.'); $('lmsg').className = 'lmsg err'; };
const done = () => closeLogin();
$('lgoogle').onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).then(done, fail);
$('lin').onclick = () => signInWithEmailAndPassword(auth, $('lemail').value.trim(), $('lpass').value).then(done, fail);
$('lnew').onclick = () => createUserWithEmailAndPassword(auth, $('lemail').value.trim(), $('lpass').value).then(done, fail);
$('lpass').onkeydown = e => { if (e.key === 'Enter') $('lin').click(); };
$('lforgot').onclick = () => {
  const em = $('lemail').value.trim();
  if (!em) return fail({ code: 'auth/invalid-email' });
  sendPasswordResetEmail(auth, em).then(() => { $('lmsg').textContent = T('Te hemos enviado un email para cambiar la contraseña.'); $('lmsg').className = 'lmsg ok'; }, fail);
};

// ---------- Sesión y datos ----------
onAuthStateChanged(auth, u => {
  user = u; items = new Map();
  if (unsub) { unsub(); unsub = null; }
  if (u) unsub = onSnapshot(collection(db, 'users', u.uid, 'items'), snap => {
    items = new Map(snap.docs.map(d => [d.id, d.data()]));
    drawAcct(); drawMine();
    if (mineView) showMine(mineView, true);
  });
  drawAcct(); drawMine();
  if (!u && mineView) { mineView = null; out.innerHTML = ''; }
});

// ---------- La carta que se está viendo ----------
// texto sin HTML; si el precio se ve convertido a otra moneda, se guarda el original (data-o)
const plain = h => { const d = document.createElement('div'); d.innerHTML = h || '';
  d.querySelectorAll('.conv[data-o]').forEach(x => x.replaceWith(x.dataset.o)); return d.textContent.trim(); };
const curOf = txt => /€/.test(txt) ? 'EUR' : /¥|円/.test(txt) ? 'JPY' : /\$/.test(txt) ? 'USD' : '';
function cardFrom(v){
  const label = v.versionLabel || '';
  const meta = plain(v.meta);
  const code = label ? label.split(' · ')[0] : '';
  const price = plain(v.mainValue);
  return {
    game, name: v.name || '', label, rarity: v.rarity || '',
    set: (meta.split(' · ')[0] || '').trim(),
    img: v.img || '', q: code && game === 'yugioh' ? code : ($('q').value.trim() || v.name || ''),
    value: Number(v.value) || null, price, cur: curOf(price),
  };
}
const idOf = c => (c.game + '|' + c.name + '|' + c.label).replace(/\//g, '∕').slice(0, 400);
async function save(c, patch){
  const id = idOf(c), old = items.get(id) || {};
  const data = { ...old, ...c, qty: old.qty || 0, fav: !!old.fav, ...patch, updated: serverTimestamp() };
  // precio cuando la guardaste (para ver cuánto ha subido o bajado desde entonces)
  if (data.v0 == null && c.value) { data.v0 = c.value; data.cur0 = c.cur; }
  if (!data.qty && !data.fav && !data.alert) return deleteDoc(doc(db, 'users', user.uid, 'items', id));
  return setDoc(doc(db, 'users', user.uid, 'items', id), data);
}

// Bloque "Mi colección / Favorito" dentro de la ficha de la carta
window.cuentaCard = v => {
  lastCard = cardFrom(v);
  drawMine();
  // si ya la tienes guardada, actualiza su precio con el de ahora
  const old = user && items.get(idOf(lastCard));
  if (old && lastCard.value && old.value !== lastCard.value) save(lastCard, {}).catch(() => {});
};
function drawMine(){
  const box = $('mine'); if (!box || !lastCard) return;
  const it = user && items.get(idOf(lastCard));
  const qty = it?.qty || 0;
  box.innerHTML = `${qty
      ? `<span class="qty"><span>${T('En tu colección: {0}', '')}</span><button data-q="-1" aria-label="−">−</button><b>${qty}</b><button data-q="1" aria-label="+">+</button></span>`
      : `<button class="gbtn" data-q="1">${T('➕ Añadir a mi colección')}</button>`}
    <button class="gbtn soft${it?.fav ? ' on' : ''}" data-f="1">${it?.fav ? T('★ En favoritos') : T('☆ Añadir a favoritos')}</button>
    ${lastCard.value && lastCard.cur ? `<span class="alert">🔔 ${T('Avísame si baja de')}
      <input type="number" min="0" step="0.01" inputmode="decimal" id="alertv" value="${it?.alert ?? ''}" placeholder="${(lastCard.value * 0.8).toFixed(2)}"> ${lastCard.cur === 'EUR' ? '€' : lastCard.cur === 'USD' ? 'US$' : '¥'}
      ${it?.alert && lastCard.value <= it.alert ? `<span class="hit">✅ ${T('¡Ya está por debajo de tu precio!')}</span>` : ''}</span>` : ''}`;
  const av = $('alertv');
  if (av) av.onchange = () => {
    if (!user) { av.value = ''; return openLogin(T('Entra para guardar cartas en tu colección.')); }
    const n = Number(String(av.value).replace(',', '.'));
    save(lastCard, { alert: n > 0 ? n : null });
  };
  box.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
    if (!user) return openLogin(T('Entra para guardar cartas en tu colección.'));
    save(lastCard, { qty: Math.max(0, qty + Number(b.dataset.q)) });
  });
  box.querySelector('[data-f]').onclick = () => {
    if (!user) return openLogin(T('Entra para guardar cartas en tu colección.'));
    save(lastCard, { fav: !it?.fav });
  };
}

const hitAlert = i => i.alert && i.value && i.value <= i.alert;
// cambio de precio desde que la guardaste
const sinceTxt = i => { if (!i.v0 || !i.value || (i.cur0 && i.cur0 !== i.cur)) return '';
  const p = (i.value - i.v0) / i.v0 * 100; if (Math.abs(p) < 1) return '';
  return ` · <span class="chg ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)} %</span> ${T('desde que la guardaste')}`; };
// Descarga la lista en CSV (se abre con Excel, Numbers o Google Sheets)
function downloadCSV(list, view){
  const q = v => { const t = String(v ?? ''); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const num = v => v == null ? '' : String(v).replace('.', ',');
  const head = ['Juego', 'Carta', 'Versión', 'Expansión', 'Rareza', 'Cantidad', 'Precio', 'Moneda', 'Valor total', 'Precio al guardarla', 'Favorito', 'Alerta (baja de)'];
  const rows = list.map(i => [GAMES[i.game]?.label || i.game, i.name, i.label, i.set, i.rarity, i.qty || 0, num(i.value), i.cur,
    num(i.value ? Math.round(i.value * Math.max(1, i.qty || 0) * 100) / 100 : null), num(i.v0), i.fav ? 'sí' : '', num(i.alert)]);
  const csv = '\ufeff' + [head, ...rows].map(r => r.map(q).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${view === 'fav' ? 'favoritos' : view === 'alert' ? 'alertas' : 'coleccion'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Pantalla "Mi colección" / "Favoritos" ----------
let mineView = null, groupBy = 'set', gameFilter = 'all';
function showMine(view, keep){
  if (!keep) { backStack = []; current = null; window.scrollTo({ top: out.offsetTop - 10 }); }
  mineView = view;
  redraw = () => showMine(mineView, true);
  const all = [...items.values()].filter(i => view === 'fav' ? i.fav : view === 'alert' ? i.alert : i.qty > 0);
  const games = [...new Set(all.map(i => i.game))];
  if (gameFilter !== 'all' && !games.includes(gameFilter)) gameFilter = 'all';
  const list = all.filter(i => gameFilter === 'all' || i.game === gameFilter);
  // valor total por moneda
  const tot = {};
  for (const i of list) if (i.value && i.cur) tot[i.cur] = (tot[i.cur] || 0) + i.value * (view === 'col' ? i.qty : 1);
  // valor cuando las guardaste, para ver cuánto ha cambiado la colección
  let then = 0, nowSame = 0;
  for (const i of list) if (i.v0 && i.value && (!i.cur0 || i.cur0 === i.cur)) { const m = view === 'col' ? i.qty : 1; then += i.v0 * m; nowSame += i.value * m; }
  const totChg = then ? (nowSame - then) / then * 100 : null;
  const totTxt = Object.entries(tot).map(([c, v]) => money(v, c, c === 'JPY' ? 0 : 2)).join(' + ');
  // agrupa: juego › expansión o rareza
  const key2 = i => groupBy === 'rarity' ? (i.rarity || '—') : (i.set || T('Sin expansión'));
  const tree = {};
  for (const i of list) ((tree[i.game] ||= {})[key2(i)] ||= []).push(i);
  const sumOf = arr => { const t = {}; for (const i of arr) if (i.value && i.cur) t[i.cur] = (t[i.cur] || 0) + i.value * (view === 'col' ? i.qty : 1);
    return Object.entries(t).map(([c, v]) => money(v, c, c === 'JPY' ? 0 : 2)).join(' + '); };
  const row = i => `<div class="mrow" data-id="${esc(idOf(i))}">
      ${i.img ? `<img src="${esc(i.img)}" alt="" loading="lazy">` : '<span class="noimg">🃏</span>'}
      <div class="mi"><button class="link mopen">${esc(i.name)}</button>
        <div class="note">${esc([i.label, groupBy === 'rarity' ? i.set : i.rarity].filter(Boolean).join(' · '))}</div>
        <div class="note">${esc(i.price || '')}${sinceTxt(i)}${i.updated?.toDate ? ' · ' + T('Precio guardado el {0}. Abre la carta para actualizarlo.', i.updated.toDate().toLocaleDateString(LOCALE())) : ''}</div>
        ${i.alert ? `<div class="note${hitAlert(i) ? ' bell' : ''}">🔔 ${T('Avísame si baja de')} ${esc(String(i.alert).replace('.', ','))}${hitAlert(i) ? ' · ✅ ' + T('¡Ya está por debajo de tu precio!') : ''}</div>` : ''}</div>
      <div class="mq">${view === 'col' ? `<button data-q="-1">−</button><b>${i.qty}</b><button data-q="1">+</button>` : ''}
        <button class="mfav${i.fav ? ' on' : ''}" data-f="1" title="${T('Favoritos')}">${i.fav ? '★' : '☆'}</button>
        <button data-del="1" title="${T('Quitar')}">🗑</button></div></div>`;
  const alertsN = [...items.values()].filter(i => i.alert).length;
  out.innerHTML = `<div class="mine-page">
    <div class="chips mtabs"><button class="chip${view === 'col' ? ' on' : ''}" data-v="col">📚 ${T('Mi colección')} (${[...items.values()].filter(i => i.qty > 0).length})</button>
      <button class="chip${view === 'fav' ? ' on' : ''}" data-v="fav">⭐ ${T('Favoritos')} (${[...items.values()].filter(i => i.fav).length})</button>
      ${alertsN ? `<button class="chip${view === 'alert' ? ' on' : ''}" data-v="alert">🔔 ${T('Alertas de precio')} (${alertsN})</button>` : ''}</div>
    ${all.length ? `<div class="bar mbar">
      <select id="mgame"><option value="all">${T('Todos los juegos')}</option>${games.map(g => `<option value="${g}"${g === gameFilter ? ' selected' : ''}>${esc(GAMES[g]?.label || g)}</option>`).join('')}</select>
      <label>${T('Agrupar por')} <select id="mgroup"><option value="set">${T('Expansión')}</option><option value="rarity"${groupBy === 'rarity' ? ' selected' : ''}>${T('Rareza')}</option></select></label>
      <button class="gbtn soft" id="mcsv" style="margin:0">⬇️ ${T('Descargar (Excel / CSV)')}</button>
    </div>
    <div class="big"><div class="lbl">${T('Valor total')} · ${T('{0} cartas', view === 'col' ? list.reduce((s, i) => s + i.qty, 0) : list.length)}</div><div class="val">${totTxt || '—'}</div>
      ${totChg != null && Math.abs(totChg) >= 0.5 ? `<div class="trend"><span class="chg ${totChg > 0 ? 'up' : 'down'}">${totChg > 0 ? '▲' : '▼'} ${Math.abs(totChg).toFixed(1)} %</span> <small>${T('desde que las guardaste')}</small></div>` : ''}
      ${view === 'alert' ? `<p class="note">${T('Las alertas se comprueban cuando abres la carta o esta lista: la web no puede enviarte avisos con el navegador cerrado.')}</p>` : ''}</div>
    ${Object.entries(tree).map(([g, groups]) => `<h3 class="mg">${ICONS[g] || ''} ${esc(GAMES[g]?.label || g)} <small>${sumOf(Object.values(groups).flat())}</small></h3>
      ${Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).map(([k, arr]) => `<details class="mset" open><summary>${esc(k)} <small>· ${T('{0} cartas', arr.length)} · ${sumOf(arr)}</small></summary>
        ${arr.sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name, 'en', { numeric: true })).map(row).join('')}</details>`).join('')}`).join('')}`
    : `<div class="msg">${T(view === 'fav' ? 'No tienes favoritos todavía.' : view === 'alert' ? 'No tienes alertas. Abre una carta y escribe un precio en «🔔 Avísame si baja de».' : 'Tu colección está vacía. Busca una carta y pulsa «➕ Añadir a mi colección».')}</div>`}
  </div>`;
  out.querySelectorAll('.mtabs .chip').forEach(b => b.onclick = () => showMine(b.dataset.v, true));
  if ($('mgame')) $('mgame').onchange = e => { gameFilter = e.target.value; showMine(view, true); };
  if ($('mgroup')) $('mgroup').onchange = e => { groupBy = e.target.value; showMine(view, true); };
  if ($('mcsv')) $('mcsv').onclick = () => downloadCSV(list, view);
  out.querySelectorAll('.mrow').forEach(r => {
    const i = items.get(r.dataset.id); if (!i) return;
    r.querySelectorAll('[data-q]').forEach(b => b.onclick = () => save(i, { qty: Math.max(0, i.qty + Number(b.dataset.q)) }));
    r.querySelector('[data-f]').onclick = () => save(i, { fav: !i.fav });
    r.querySelector('[data-del]').onclick = () => save(i, view === 'fav' ? { fav: false } : view === 'alert' ? { alert: null } : { qty: 0 });
    r.querySelector('.mopen').onclick = () => openItem(i);
  });
}
// Abre la ficha de una carta guardada (vuelve a buscarla)
function openItem(i){
  const from = mineView || 'col';
  mineView = null;
  if (game !== i.game) document.querySelector(`.tab[data-game="${i.game}"]`)?.click();
  $('q').value = i.q || i.name;
  search().then(() => { backStack.push(() => showMine(from)); if (redraw) redraw(); });
}
// al hacer una búsqueda normal se sale de la pantalla de colección
$('form').addEventListener('submit', () => { mineView = null; });
// al cambiar el idioma, redibuja el botón de cuenta
document.querySelectorAll('#lmenu button').forEach(b => b.addEventListener('click', () => setTimeout(drawAcct, 300)));
