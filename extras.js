// =====================================================================
//  EXTRAS
//  - Modo oscuro / claro y moneda (original, € o $)
//  - Enlace propio para cada búsqueda y cada carta (#juego=…&q=…&v=…), con el botón Atrás del navegador
//  - Autocompletar mientras se escribe
//  - Portada de cada juego: las que más suben, las que más bajan, las más caras y las últimas expansiones
//  Usa las variables de la página principal (game, GAMES, search, current, jump, T, esc, $, money…)
// =====================================================================
(() => {
  const bar = document.querySelector('.langbar');

  // ---------------- MODO OSCURO ----------------
  const root = document.documentElement;
  const dark = () => (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  try { const t = localStorage.getItem('tema'); if (t) root.dataset.theme = t; } catch (e) {}
  bar.insertAdjacentHTML('beforeend', `<div class="curbar"><button class="lsel" id="cursel" aria-haspopup="listbox" aria-expanded="false"></button><div class="lmenu" id="curmenu" role="listbox"></div></div>
    <button class="lsel" id="theme"></button>`);
  const drawTheme = () => { const b = $('theme'); b.textContent = dark() ? '☀️' : '🌙';
    b.title = T(dark() ? 'Modo claro' : 'Modo oscuro'); b.setAttribute('aria-label', b.title); };
  $('theme').onclick = () => {
    root.dataset.theme = dark() ? 'light' : 'dark';
    try { localStorage.setItem('tema', root.dataset.theme); } catch (e) {}
    drawTheme();
  };

  // ---------------- MONEDA ----------------
  const CURS = [['orig', 'Moneda original', '🌐'], ['EUR', 'Euros (€)', '€'], ['USD', 'Dólares (US$)', '$']];
  function drawCur(){
    const c = CURS.find(x => x[0] === CUR);
    $('cursel').textContent = `💱 ${c[0] === 'orig' ? '€ / $' : c[2]} ▾`;
    $('cursel').title = T('Moneda de los precios');
    $('curmenu').innerHTML = CURS.map(([k, t, ico]) => `<button data-cur="${k}" class="${k === CUR ? 'on' : ''}">${ico} ${T(t)}</button>`).join('') +
      `<div class="who" style="border:0;border-top:1px solid var(--line);margin:4px 0 0">${T('Cambio del BCE')}${FX.date ? ' · ' + fecha(FX.date) : ''}: 1 € = ${(1 / FX.USD).toFixed(3)} US$</div>`;
    $('curmenu').querySelectorAll('[data-cur]').forEach(b => b.onclick = () => {
      CUR = b.dataset.cur;
      try { localStorage.setItem('moneda', CUR); } catch (e) {}
      $('curmenu').classList.remove('open');
      drawCur(); refresh();
    });
  }
  $('cursel').onclick = e => { e.stopPropagation(); $('curmenu').classList.toggle('open'); };
  document.addEventListener('click', e => { if (!e.target.closest('.curbar')) $('curmenu').classList.remove('open'); });
  // vuelve a dibujar lo que haya en pantalla (ficha, resultados o portada)
  function refresh(){ if (redraw) redraw(); else if (homeOn) showHome(); }
  fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,JPY').then(r => r.ok ? r.json() : null).then(d => {
    if (!d?.rates?.USD) return;
    FX.USD = 1 / d.rates.USD; if (d.rates.JPY) FX.JPY = 1 / d.rates.JPY; FX.date = d.date;
    drawCur();
    if (CUR !== 'orig') refresh();
  }).catch(() => {});

  // al cambiar de idioma, traduce también estos botones
  document.querySelectorAll('#lmenu button').forEach(b => b.addEventListener('click', () => setTimeout(() => { drawTheme(); drawCur(); if (homeOn) showHome(); }, 300)));
  drawTheme(); drawCur();

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
    const h = p.toString() ? '#' + p.toString().replace(/\+/g, '%20') : location.pathname + location.search;
    if (('#' + location.hash.slice(1)) === h || (!p.toString() && !location.hash)) return;
    if (push && !routing) history.pushState(null, '', h); else history.replaceState(null, '', h);
    lastHash = location.hash;
  }
  const vKey = () => { if (!current) return ''; const l = current.label(current.items[current.index]); return [l.t, l.r].filter(Boolean).join('|'); };
  window.onSearch = q => { homeOn = false; writeHash({ g: game, q }, true); };
  window.afterGrid = () => { homeOn = false; document.title = `${$('q').value.trim() || T('Resultados')} · Precio Cartas`; };
  window.afterRender = v => {
    homeOn = false;
    document.title = `${v.name} · Precio Cartas`;
    if (!v.deepQ) return;
    const now = readHash();
    const st = { g: game, q: v.deepQ, v: current && current.items.length > 1 ? vKey() : '' };
    // otra carta: nueva entrada en el historial (Atrás vuelve a los resultados); otra versión: se sustituye
    writeHash(st, now.q !== st.q || now.g !== st.g);
    const sh = $('share');
    if (sh) sh.onclick = async () => {
      const url = location.href;
      try {
        if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ title: document.title, url });
        else { await navigator.clipboard.writeText(url); sh.textContent = '✅ ' + T('Enlace copiado'); }
      } catch (e) { prompt(T('Copia este enlace:'), url); }
    };
  };
  window.goHome = () => { writeHash({ g: game }, true); showHome(); };

  async function openRoute(){
    const st = readHash();
    if (!st.g && !st.q) { if (!out.innerHTML.trim() || !homeOn) { $('q').value = ''; current = null; backStack = []; foldHelp(false); showHome(); } return; }
    routing = true;
    try {
      if (st.g && GAMES[st.g] && st.g !== game) {
        game = st.g;
        try { localStorage.setItem('juego', game); } catch (e) {}
        showGame(); showHelp();
      }
      if (!st.q) { $('q').value = ''; out.innerHTML = ''; current = null; foldHelp(false); showHome(); return; }
      $('q').value = st.q;
      await search();
      if (st.v && current) {
        const k = current.items.findIndex(it => { const l = current.label(it); return [l.t, l.r].filter(Boolean).join('|') === st.v; });
        if (k >= 0 && k !== current.index) { current.index = k; await drawCurrent(); }
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
      return [...names.values()].sort((a, b) => (a.c.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1) - (b.c.name.toLowerCase().startsWith(q.toLowerCase()) ? 0 : 1))
        .slice(0, 8).map(({ c, n }) => ({ name: c.name, sub: T('{0} versiones', n), img: pkmImg(c, 'low'), q: c.name }));
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

  // ---------------- PORTADA ----------------
  let homeOn = false;
  const topCache = {};
  const loadTop = key => topCache[key] ||= fetch(`data/top/${key}.json`).then(r => r.ok ? r.json() : null).catch(() => null);
  const pctTxt = x => { if (!x.e || !x.e30) return ''; const p = (x.e - x.e30) / x.e30 * 100;
    return `<small class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'}${Math.abs(p).toFixed(0)}%</small>`; };
  const tileHTML = (x, k) => `<button class="tile" data-k="${k}" title="${esc([x.n, x.c, x.r, x.s].filter(Boolean).join(' · '))}">
      ${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy">` : '<span class="noimg">🃏</span>'}
      <span class="tn">${esc(x.n)}</span><span class="tr">${esc([x.c, x.r].filter(Boolean).join(' · '))}</span>
      <span class="tp">${x.price || ''} ${x.pct || ''}</span></button>`;

  async function showHome(){
    const key = game, g = GAMES[key];
    homeOn = true; redraw = null; current = null;
    document.title = 'Precio Cartas';
    let tabs = null, sets = [], note = '';
    if (g.type === 'local' || key === 'yugioh') {
      const t = await loadTop(key);
      if (t) {
        const tcg = x => key === 'yugioh' || g.type === 'local' ? `https://tcgplayer-cdn.tcgplayer.com/product/${x.id}_200w.jpg` : '';
        const map = arr => (arr || []).map(x => ({ ...x, img: tcg(x), price: eur(x.e) || usd(x.u), pct: pctTxt(x) }));
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
    if (game !== key || !homeOn) return; // el usuario ya hizo otra cosa mientras cargaba
    let tab = tabs?.[0]?.[0];
    const draw = () => {
      homeOn = true; redraw = null; current = null;
      const cur = tabs?.find(x => x[0] === tab);
      out.innerHTML = `<div class="home">
        ${tabs?.length ? `<h2>🔥 ${T('Tendencias de {0}', esc(g.label))}</h2>
          <div class="chips">${tabs.map(([k, t]) => `<button class="chip${k === tab ? ' on' : ''}" data-tab="${k}">${T(t)}</button>`).join('')}</div>
          <div class="rail" id="hrail">${cur[2].map(tileHTML).join('')}</div>
          ${note ? `<p class="note">${note}</p>` : ''}` : ''}
        ${sets.length ? `<h2>🆕 ${T('Últimas expansiones')}</h2>
          <div class="sets">${sets.map((s, k) => `<button class="chip" data-set="${k}">${esc(s.n)}${s.d ? ` <small>${fecha(s.d)}</small>` : ''}</button>`).join('')}</div>` : ''}
      </div>`;
      out.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
      out.querySelectorAll('#hrail .tile').forEach(b => b.onclick = () => {
        const x = cur[2][b.dataset.k];
        $('q').value = x.q || x.n;
        if (x.open) { backStack = [draw]; current = null; foldHelp(true); window.onSearch($('q').value); loading(T('Cargando…')); x.open(); }
        else { search().then(() => backStack.unshift(draw)); }
      });
      out.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
        homeOn = false; backStack = [draw]; current = null; loading(T('Cargando la expansión…'));
        Promise.resolve().then(sets[b.dataset.set].open).catch(() => error(T('No se pudo cargar la expansión.')));
      });
    };
    draw();
  }
  window.showHome = showHome;

  // ---------------- AL ABRIR LA PÁGINA ----------------
  if (location.hash.length > 1) openRoute(); else showHome();
})();
