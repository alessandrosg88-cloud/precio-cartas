// =====================================================================
//  EXTRAS DE LA WEB (versión PC)
//  - Moneda: original, € o $ (cambio del BCE)
//  - En el PC el buscador va siempre arriba; atajo «/» para escribir
//  - Enlace propio para cada búsqueda y cada carta (#juego=…&q=…&v=…), con el botón Atrás del navegador
//  - Autocompletar mientras se escribe
//  - En Inicio: las cartas que más suben, las que más bajan, las más caras y las últimas expansiones
//  - Pie de la barra lateral: idioma y enlace a la app del teléfono
//  Usa las variables de la página (game, GAMES, view, setView, go2, current, T, esc, $, money…)
// =====================================================================
(() => {
  // textos nuevos de la barra (igual que MOB en la app del teléfono)
  const MORE = {
    en: { Favoritos: 'Favourites', 'Centrado PSA': 'PSA centering', Reglas: 'Rules', 'App del teléfono': 'Phone app', 'todo el mercado': 'whole market' },
    de: { Favoritos: 'Favoriten', 'Centrado PSA': 'PSA-Zentrierung', Reglas: 'Regeln', 'App del teléfono': 'Handy-App', 'todo el mercado': 'ganzer Markt' },
    fr: { Favoritos: 'Favoris', 'Centrado PSA': 'Centrage PSA', Reglas: 'Règles', 'App del teléfono': 'App mobile', 'todo el mercado': 'tout le marché' },
    it: { Favoritos: 'Preferiti', 'Centrado PSA': 'Centratura PSA', Reglas: 'Regole', 'App del teléfono': 'App per telefono', 'todo el mercado': 'tutto il mercato' },
    nl: { Favoritos: 'Favorieten', 'Centrado PSA': 'PSA-centrering', Reglas: 'Regels', 'App del teléfono': 'Telefoon-app', 'todo el mercado': 'hele markt' },
    ja: { Favoritos: 'お気に入り', 'Centrado PSA': 'PSAセンタリング', Reglas: 'ルール', 'App del teléfono': 'スマホアプリ', 'todo el mercado': '市場全体' },
    zh: { Favoritos: '收藏夹', 'Centrado PSA': 'PSA 居中', Reglas: '规则', 'App del teléfono': '手机应用', 'todo el mercado': '整个市场' },
    ko: { Favoritos: '즐겨찾기', 'Centrado PSA': 'PSA 센터링', Reglas: '규칙', 'App del teléfono': '휴대폰 앱', 'todo el mercado': '전체 시장' },
  };
  if (typeof MOB === 'object') for (const [l, o] of Object.entries(MORE)) Object.assign(MOB[l] ||= {}, o);

  const wide = matchMedia('(min-width:1000px)');

  // ---------------- BUSCADOR ARRIBA EN EL PC ----------------
  const sbox = document.querySelector('.sbox'), home0 = sbox.parentNode, next0 = sbox.nextSibling;
  function placeSearch(){
    const bar = document.querySelector('.appbar');
    if (wide.matches) { if (sbox.parentNode !== bar) bar.insertBefore(sbox, bar.querySelector('.sp')); }
    else if (sbox.parentNode !== home0) home0.insertBefore(sbox, next0);
  }
  wide.addEventListener('change', placeSearch); placeSearch();
  addEventListener('keydown', e => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      if (!wide.matches && view !== 'search') go2('search');
      $('q').focus(); $('q').select();
    }
  });

  // ---------------- MONEDA ----------------
  const CURS = [['orig', 'Moneda original', '🌐'], ['EUR', 'Euros (€)', '€'], ['USD', 'Dólares (US$)', '$']];
  $('curbox').innerHTML = `<button class="gchip" id="cursel" aria-haspopup="listbox" aria-expanded="false"></button><div class="lmenu" id="curmenu" role="listbox"></div>`;
  function drawCur(){
    const c = CURS.find(x => x[0] === CUR);
    $('cursel').textContent = `💱 ${c[0] === 'orig' ? '€ / $' : c[2]} ▾`;
    $('cursel').title = T('Moneda de los precios');
    $('curmenu').innerHTML = CURS.map(([k, t, ico]) => `<button data-cur="${k}" class="${k === CUR ? 'on' : ''}">${ico} ${T(t)}</button>`).join('') +
      `<div class="note" style="padding:6px 10px 2px;margin:4px 0 0;border-top:1px solid var(--line)">${T('Cambio del BCE')}${FX.date ? ' · ' + fecha(FX.date) : ''}: 1 € = ${(1 / FX.USD).toFixed(3)} US$</div>`;
    $('curmenu').querySelectorAll('[data-cur]').forEach(b => b.onclick = () => {
      CUR = b.dataset.cur;
      try { localStorage.setItem('moneda', CUR); } catch (e) {}
      $('curmenu').classList.remove('open');
      drawCur(); refresh();
    });
  }
  $('cursel').onclick = e => { e.stopPropagation(); $('curmenu').classList.toggle('open'); };
  document.addEventListener('click', e => { if (!e.target.closest('#curbox')) $('curmenu').classList.remove('open'); });
  // vuelve a dibujar lo que haya en pantalla
  function refresh(){ if (view === 'home') window.GX?.drawHome(); else if (redraw) redraw(); }
  fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,JPY').then(r => r.ok ? r.json() : null).then(d => {
    if (!d?.rates?.USD) return;
    FX.USD = 1 / d.rates.USD; if (d.rates.JPY) FX.JPY = 1 / d.rates.JPY; FX.date = d.date;
    drawCur();
    if (CUR !== 'orig') refresh();
  }).catch(() => {});
  drawCur();

  // ---------------- PIE DE LA BARRA LATERAL (solo PC) ----------------
  const _drawTabbar = drawTabbar;
  drawTabbar = function(){
    _drawTabbar.apply(this, arguments);
    const L = LANGS.find(l => l[0] === LANG);
    $('tabbar').insertAdjacentHTML('beforeend', `<div class="side-foot">
      <button id="sideLang">🌐 ${L ? L[2] + ' ' + L[1] : ''}</button>
      <button id="sideApp">📱 ${T('App del teléfono')} ↗</button></div>`);
    $('sideLang').onclick = () => go2('me');
    $('sideApp').onclick = () => window.open('https://alessandrosg88-cloud.github.io/precio-telefono/', '_blank', 'noopener');
  };
  drawTabbar();

  // ---------------- ENLACES (dirección de la página) ----------------
  // #juego=yugioh&q=LOB-EN001&v=LOB-EN001|Ultra Rare
  let routing = false;       // true mientras se abre una dirección (no hay que guardar otra vez)
  let lastHash = location.hash;
  const readHash = () => { const p = new URLSearchParams(location.hash.slice(1)); return { g: p.get('juego'), q: p.get('q'), v: p.get('v') }; };
  function writeHash(st, push){
    const p = new URLSearchParams();
    if (st.g) p.set('juego', st.g);
    if (st.q) p.set('q', st.q);
    if (st.v) p.set('v', st.v);
    const h = p.toString() ? '#' + p.toString().replace(/\+/g, '%20') : '';
    if (location.hash === h) return;
    const url = h || location.pathname + location.search;
    if (push && !routing) history.pushState(null, '', url); else history.replaceState(null, '', url);
    lastHash = location.hash;
  }
  const vKey = () => { if (!current) return ''; const l = current.label(current.items[current.index]); return [l.t, l.r].filter(Boolean).join('|'); };
  window.onSearch = q => { if (!window.PC_BG) writeHash({ g: game, q }, true); };
  window.afterGrid = () => { document.title = `${$('q').value.trim() || T('Resultados')} · Precio Cartas`; };
  window.afterRender = v => {
    document.title = `${v.name} · Precio Cartas`;
    if (!v.deepQ || window.PC_BG) return;
    const now = readHash();
    const st = { g: game, q: v.deepQ, v: current && current.items.length > 1 ? vKey() : '' };
    // otra carta: nueva entrada en el historial (Atrás vuelve a los resultados); otra versión: se sustituye
    writeHash(st, now.q !== st.q || now.g !== st.g);
    const sh = $('share');
    if (sh) sh.onclick = async () => {
      const url = location.href;
      try { await navigator.clipboard.writeText(url); sh.textContent = '✅ ' + T('Enlace copiado'); }
      catch (e) { prompt(T('Copia este enlace:'), url); }
    };
  };
  // al ir a Inicio, Colección, Perfil… la dirección deja de apuntar a una carta
  window.goHome = () => { document.title = 'Precio Cartas – Colezzioni Saglimbeni Medina'; if (!window.PC_BG && location.hash) writeHash({}, true); };

  async function openRoute(){
    const st = readHash();
    routing = true;
    try {
      if (st.g && GAMES[st.g] && st.g !== game) document.querySelector(`.tab[data-game="${st.g}"]`)?.click();
      if (!st.q) { go2('home'); return; }
      setView('search');
      $('q').value = st.q;
      await search();
      if (st.v && current) {
        const k = current.items.findIndex(it => { const l = current.label(it); return [l.t, l.r].filter(Boolean).join('|') === st.v; });
        if (k >= 0 && k !== current.index) { current.index = k; await drawCurrent(); }
        if (k >= 0) writeHash(st, false);
      }
    } finally { routing = false; }
  }
  addEventListener('popstate', () => { if (location.hash !== lastHash) { lastHash = location.hash; openRoute(); } });

  // ---------------- AUTOCOMPLETAR ----------------
  const qi = $('q'), sug = $('sug');
  let sugItems = [], sel = -1, sugTimer = null, sugSeq = 0;
  const mark = (txt, q) => { const t = esc(txt), w = normName(q).split(/\s+/).filter(Boolean)[0];
    if (!w) return t; const i = normName(txt).indexOf(w); return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + w.length) + '</mark>' + t.slice(i + w.length); };
  function closeSug(){ sug.hidden = true; sugItems = []; sel = -1; qi.setAttribute('aria-expanded', 'false'); }
  function drawSug(list, q){
    sugItems = list; sel = -1;
    if (!list.length || document.activeElement !== qi) return closeSug();
    sug.innerHTML = list.map((x, k) => `<button type="button" class="sg" role="option" data-k="${k}">
      ${x.img !== undefined ? `<img src="${esc(x.img || '')}" alt="" loading="lazy">` : ''}
      <span class="si">${mark(x.name, q)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
      ${x.price ? `<span class="sp">${x.price}</span>` : ''}</button>`).join('');
    sug.hidden = false; qi.setAttribute('aria-expanded', 'true');
    sug.querySelectorAll('.sg').forEach(b => b.onmousedown = e => { e.preventDefault(); pickSug(Number(b.dataset.k)); });
  }
  function pickSug(k){
    const x = sugItems[k]; if (!x) return;
    closeSug();
    qi.value = x.q || x.name;
    setView('search');
    if (!x.open) return search();
    // abre directamente la carta elegida
    backStack = []; current = null; foldHelp(true);
    window.onSearch(qi.value);
    loading(T('Cargando…'));
    Promise.resolve().then(x.open).catch(e => { console.error(e); error(T('No se pudo conectar con la base de datos. Inténtalo de nuevo en unos segundos.')); });
  }
  const isCode = q => /\d/.test(q) && /^[A-Za-z0-9]{1,6}[-\s/]?\d/.test(q.trim());
  async function suggest(q){
    const g = GAMES[game];
    if (g.type === 'local') {
      const d = await loadLocal(game).catch(() => null); if (!d) return [];
      const k = normCode(q), words = normName(q).split(/\s+/).filter(Boolean);
      const byCode = isCode(q) ? d.cards.filter(c => c.k1.startsWith(k) || c.k.startsWith(k)) : [];
      const byName = d.cards.filter(c => words.every(w => c.nn.includes(w)));
      const groups = new Map();
      for (const c of [...byCode, ...byName]) { const key = c.k1 + '|' + c.b; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); }
      const starts = c => c.nn.startsWith(words[0] || '') ? 0 : 1;
      return [...groups.values()].map(arr => arr.sort((a, b) => (localValue(a) ?? 1e9) - (localValue(b) ?? 1e9))[0])
        .sort((a, b) => starts(a) - starts(b) || (localValue(b) ?? 0) - (localValue(a) ?? 0)).slice(0, 8)
        .map(c => ({ name: c.n.replace(/\s*\((?:[^)]*\d{2,}[^)]*)\)/, ''), sub: [c.c, c.r, d.sets[c.g]?.n].filter(Boolean).join(' · '), img: tcgImg(c), price: localPrice(c),
          q: c.c ? String(c.c).split(' ')[0] : c.n, open: () => openLocal(c, sameCard(d, c)) }));
    }
    if (game === 'yugioh') {
      if (isCode(q)) return [];
      const r = await getJSON(`${YGO}/cardinfo.php?fname=${encodeURIComponent(q)}&num=8&offset=0`, 1).catch(() => null);
      return (r?.data || []).slice(0, 8).map(c => ({ name: c.name, sub: [c.type, c.race].filter(Boolean).join(' · '), img: c.card_images?.[0]?.image_url_small,
        price: eur(c.card_prices?.[0]?.cardmarket_price), q: c.name, open: () => openYugioh(c, null, null, null) }));
    }
    if (game === 'magic') {
      if (isCode(q) && /\s\d/.test(q)) return [];
      const r = await getJSON(`${MTG}/cards/autocomplete?q=${encodeURIComponent(q)}`, 1).catch(() => null);
      return (r?.data || []).slice(0, 8).map(n => ({ name: n, q: n,
        open: async () => { const c = await getJSON(`${MTG}/cards/named?exact=${encodeURIComponent(n)}`); if (!c) throw new Error('no'); return openMagic(c); } }));
    }
    if (game === 'pokemon') {
      if (isCode(q)) return [];
      const list = (await getJSON(`${PKM}/cards?name=${encodeURIComponent(q)}`, 1).catch(() => null)) || [];
      const names = new Map();
      for (const c of list) { const k = c.name.toLowerCase(); if (!names.has(k)) names.set(k, { c, n: 0 }); names.get(k).n++; }
      const st = c => c.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1;
      return [...names.values()].sort((a, b) => st(a.c) - st(b.c)).slice(0, 8)
        .map(({ c, n }) => ({ name: c.name, sub: T('{0} versiones', n), img: pkmImg(c, 'low'), q: c.name }));
    }
    return [];
  }
  qi.addEventListener('input', () => {
    clearTimeout(sugTimer);
    const q = qi.value.trim(), mine = ++sugSeq;
    if (q.length < 2) return closeSug();
    sugTimer = setTimeout(async () => {
      const list = await suggest(q).catch(() => []);
      if (mine === sugSeq) drawSug(list, q);
    }, GAMES[game].type === 'local' ? 120 : 260);
  });
  qi.addEventListener('keydown', e => {
    if (sug.hidden) return;
    const n = sugItems.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.key === 'ArrowDown') sel = sel + 1 >= n ? -1 : sel + 1;
      else sel = sel - 1 < -1 ? n - 1 : sel - 1;
      sug.querySelectorAll('.sg').forEach((b, k) => { b.classList.toggle('on', k === sel); if (k === sel) b.scrollIntoView({ block: 'nearest' }); });
    } else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); pickSug(sel); }
    else if (e.key === 'Escape') closeSug();
  });
  qi.addEventListener('blur', () => setTimeout(closeSug, 150));
  $('form').addEventListener('submit', () => { sugSeq++; closeSug(); });

  // ---------------- INICIO: TENDENCIAS DEL MERCADO ----------------
  // data/top/<juego>.json lo prepara cada día la GitHub Action (Cardmarket: hoy frente a la media de 30 días)
  const topCache = {}, trendCache = {};
  const loadTop = key => topCache[key] ||= fetch(`data/top/${key}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  const pctTxt = x => { if (!x.e || !x.e30) return ''; const p = (x.e - x.e30) / x.e30 * 100;
    return `<small class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'}${Math.abs(p).toFixed(0)}%</small>`; };
  async function trendsOf(key){
    const g = GAMES[key];
    let tabs = [], sets = [], note = '';
    if (g.type === 'local' || key === 'yugioh') {
      const t = await loadTop(key);
      if (t) {
        const map = arr => (arr || []).map(x => ({ ...x, img: `https://tcgplayer-cdn.tcgplayer.com/product/${x.id}_200w.jpg`, price: eur(x.e) || usd(x.u), pct: pctTxt(x) }));
        tabs = [['up', '📈 Las que más suben', map(t.up)], ['down', '📉 Las que más bajan', map(t.down)], ['top', '💎 Las más caras', map(t.top)]].filter(x => x[2].length);
        sets = (t.sets || []).map(s => ({ ...s, open: async () => {
          const d = await loadLocal(key);
          const list = d.cards.filter(x => String(x.g) === String(s.g)).sort((a, b) => String(a.c).localeCompare(String(b.c), 'en', { numeric: true }));
          gridLocal(`${esc(s.n)} · ${T('{0} cartas', list.length)}`, list, { sort: true });
        } }));
        note = T('Precios de Cardmarket del {0}. «Suben» y «bajan» comparan el precio de hoy con la media de los últimos 30 días (cartas de 2 € o más).', fecha(t.updated));
      }
    } else if (key === 'magic') {
      const since = new Date(Date.now() - 75 * 864e5).toISOString().slice(0, 10);
      const [r, ss] = await Promise.all([
        getJSON(`${MTG}/cards/search?order=eur&dir=desc&q=${encodeURIComponent(`date>=${since} -is:digital eur>0`)}`, 1).catch(() => null),
        getJSON(`${MTG}/sets`, 1).catch(() => null)]);
      const cards = (r?.data || []).filter(c => Number(c.prices?.eur) > 0).slice(0, 12).map(c => ({ n: c.name, c: `${c.set.toUpperCase()} ${c.collector_number}`, r: c.rarity, s: c.set_name,
        img: mtgImg(c, 'small'), price: eur(c.prices?.eur) || usd(c.prices?.usd), open: () => openMagic(c), q: `${c.set} ${c.collector_number}` }));
      if (cards.length) tabs = [['top', '💎 Las más caras de las últimas expansiones', cards]];
      const today = new Date().toISOString().slice(0, 10);
      sets = (ss?.data || []).filter(s => ['expansion', 'core', 'masters', 'draft_innovation'].includes(s.set_type) && s.released_at <= today && !s.digital)
        .slice(0, 8).map(s => ({ n: s.name, d: s.released_at, open: () => openMagicSet(s.code, s.name) }));
      note = T('Precios de Cardmarket a través de Scryfall.');
    } else if (key === 'pokemon') {
      const ss = (await getJSON(`${PKM}/sets`, 1).catch(() => null)) || [];
      // fuera promos y los sets de la app Pokémon TCG Pocket (A1, A2a, P-A…)
      sets = ss.filter(s => !/promo|trainer kit|mcdonald/i.test(s.name) && !/^(A\d|B\d|P-[AB])/i.test(s.id)).slice(-8).reverse().map(s => ({ n: s.name, open: () => openPokemonSet(s.id) }));
    }
    return { tabs, sets, note };
  }
  let trendTab = 'up';
  async function drawTrends(){
    const box = $('gx'); if (!box || window.PC_BG) return;
    const key = game;
    const t = await (trendCache[key] ||= trendsOf(key).catch(() => ({ tabs: [], sets: [] })));
    if (key !== game || view !== 'home' || !box.querySelector('.hgreet')) return;
    box.querySelector('.trends')?.remove();
    if (!t.tabs.length && !t.sets.length) return;
    if (!t.tabs.some(x => x[0] === trendTab)) trendTab = t.tabs[0]?.[0];
    const cur = t.tabs.find(x => x[0] === trendTab);
    box.insertAdjacentHTML('beforeend', `<div class="gxsec trends">
      ${cur ? `<h3>🔥 ${T('Tendencias de {0}', esc(GAMES[key].label))} <small>${T('todo el mercado')}</small></h3>
        <div class="chips">${t.tabs.map(([k, n]) => `<button class="chip${k === trendTab ? ' on' : ''}" data-tab="${k}">${T(n)}</button>`).join('')}</div>
        <div class="top5">${cur[2].map((x, k) => `<button data-k="${k}" title="${esc([x.n, x.c, x.r, x.s].filter(Boolean).join(' · '))}">
          ${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : '<span class="noimg">🃏</span>'}<span class="nm2">${esc(x.n)}</span>
          <b>${x.price || ''} ${x.pct || ''}</b></button>`).join('')}</div>
        ${t.note ? `<p class="note">${t.note}</p>` : ''}` : ''}
      ${t.sets.length ? `<h3 style="margin-top:14px">🆕 ${T('Últimas expansiones')}</h3>
        <div class="chips">${t.sets.map((s, k) => `<button class="chip" data-set="${k}">${esc(s.n)}${s.d ? ` <small>${fecha(s.d)}</small>` : ''}</button>`).join('')}</div>` : ''}
    </div>`);
    const sec = box.querySelector('.trends');
    sec.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { trendTab = b.dataset.tab; drawTrends(); });
    sec.querySelectorAll('.top5 [data-k]').forEach(b => b.onclick = () => {
      const x = cur[2][b.dataset.k];
      $('q').value = x.q || x.n; setView('search');
      if (x.open) { backStack = []; current = null; foldHelp(true); window.onSearch($('q').value); loading(T('Cargando…')); x.open(); }
      else search();
    });
    sec.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
      setView('search'); backStack = []; current = null; loading(T('Cargando la expansión…'));
      Promise.resolve().then(t.sets[b.dataset.set].open).catch(() => error(T('No se pudo cargar la expansión.')));
    });
  }
  // cada vez que se vuelve a dibujar Inicio, se añaden las tendencias al final
  new MutationObserver(() => { const box = $('gx'); if (view === 'home' && box.querySelector('.hgreet') && !box.querySelector('.trends')) drawTrends(); })
    .observe($('gx'), { childList: true });

  // ---------------- AL ABRIR LA PÁGINA ----------------
  if (!window.PC_BG) {
    if (location.hash.length > 1) setTimeout(openRoute); else drawTrends();
  }
})();
