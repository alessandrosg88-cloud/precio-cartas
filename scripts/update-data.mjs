// Descarga cada día los precios de los juegos "extra" y los guarda en /data/<juego>.json
//  - Cartas, códigos, rarezas y precio en $ : TCGplayer (vía tcgcsv.com, datos públicos diarios)
//  - Precio en € : guía de precios pública de Cardmarket (archivos oficiales diarios)
// No necesita ninguna API key. Se ejecuta con: node scripts/update-data.mjs
import { writeFile, mkdir, rm } from 'node:fs/promises';

const GAMES = {
  onepiece: { name: 'One Piece',          tcg: [68],     cm: 18 },
  dragonball: { name: 'Dragon Ball',      tcg: [80, 27], cm: 13 },
  digimon:  { name: 'Digimon',            tcg: [63],     cm: 17 },
  lorcana:  { name: 'Lorcana',            tcg: [71],     cm: 19 },
  gundam:   { name: 'Gundam',             tcg: [86],     cm: 24 },
  riftbound:{ name: 'League of Legends (Riftbound)', tcg: [89], cm: 22 },
  weiss:    { name: 'Weiß Schwarz',       tcg: [20],     cm: 10 },
  wow:      { name: 'World of Warcraft',  tcg: [13],     cm: 2 },
  // De estos tres las cartas sueltas se consultan en directo; aquí solo bajamos los productos sellados
  pokemon:  { name: 'Pokémon',            tcg: [3],      cm: 6, sealedOnly: true },
  yugioh:   { name: 'Yu-Gi-Oh!',          tcg: [2],      cm: 3, sealedOnly: true },
  magic:    { name: 'Magic',              tcg: [1],      cm: 1, sealedOnly: true },
};
const only = process.argv[2]; // opcional: actualizar solo un juego

const UA = { 'User-Agent': 'precio-cartas (github.com/alessandrosg88-cloud/precio-cartas)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, headers = {}, tries = 4){
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...headers } });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1500 * i);
    }
  }
}
// Ejecuta tareas de pocas en pocas para no saturar el servidor
async function pool(items, n, fn){
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Precio principal de Cardmarket: tendencia; si no hay, media; si solo hay foil, el de foil
const cmPrice = pg => pg ? (pg.trend || pg.avg || pg['trend-foil'] || pg['avg-foil'] || null) : null;
const r2 = v => v == null || v === 0 ? null : Math.round(v * 100) / 100;

// ---------- TCGplayer (tcgcsv) ----------
async function loadTcg(categoryId, sealedOnly){
  const groups = (await getJSON(`https://tcgcsv.com/tcgplayer/${categoryId}/groups`)).results;
  const sets = {}, cards = [], texts = {}, fields = new Set(), sealed = [], sealedSets = {};
  await pool(groups, 4, async g => {
    const [prods, prices] = await Promise.all([
      getJSON(`https://tcgcsv.com/tcgplayer/${categoryId}/${g.groupId}/products`).catch(() => ({ results: [] })),
      getJSON(`https://tcgcsv.com/tcgplayer/${categoryId}/${g.groupId}/prices`).catch(() => ({ results: [] })),
    ]);
    const byId = {};
    for (const p of prices.results || []) (byId[p.productId] ||= []).push(p);
    let n = 0;
    for (const p of prods.results || []) {
      const ext = Object.fromEntries((p.extendedData || []).map(e => [e.name, e.value]));
      if (!ext.Number && !ext.Rarity) {          // producto sellado (cajas, sobres, mazos…)
        const pr = (byId[p.productId] || [])[0] || {};
        sealed.push({ id: p.productId, n: p.name, g: g.groupId, u: r2(pr.marketPrice ?? pr.midPrice), ul: r2(pr.lowPrice), t: sealedType(p.name) });
        sealedSets[g.groupId] = { n: g.name, d: (g.publishedOn || '').slice(0, 10) };
        continue;
      }
      if (sealedOnly) continue;
      // Texto y datos de la carta (efecto, coste, poder…) para "Cómo se usa esta carta"
      const t = {};
      for (const e of p.extendedData || []) if (!['Number', 'Rarity'].includes(e.name) && e.value) { t[e.displayName || e.name] = e.value; fields.add(e.displayName || e.name); }
      if (Object.keys(t).length) (texts[g.groupId] ||= {})[p.productId] = t;
      const pr = byId[p.productId] || [];
      const main = pr.find(x => /normal/i.test(x.subTypeName)) || pr[0] || {};
      const foil = pr.find(x => x !== main && /foil|holo/i.test(x.subTypeName));
      cards.push({
        id: p.productId, n: p.name, c: ext.Number || '', r: ext.Rarity || '', g: g.groupId,
        u: r2(main.marketPrice ?? main.midPrice), ul: r2(main.lowPrice),
        uf: foil ? r2(foil.marketPrice ?? foil.midPrice) : null,
      });
      n++;
    }
    if (n) sets[g.groupId] = { n: g.name, a: g.abbreviation || '', d: (g.publishedOn || '').slice(0, 10) };
  });
  console.log(`   Campos de texto: ${[...fields].join(', ')}`);
  return { sets, cards, texts, sealed, sealedSets };
}

// Tipo de producto sellado según su nombre
function sealedType(name){
  const n = name.toLowerCase();
  if (/\bcase\b/.test(n)) return 'case';
  if (/elite trainer box|\betb\b/.test(n)) return 'etb';
  if (/booster box|booster display|draft booster box|play booster box|collector booster box|set booster box/.test(n)) return 'box';
  if (/\btins?\b/.test(n)) return 'coll';
  if (/deck|starter|structure|precon/.test(n)) return 'deck';
  if (/booster pack|\bpack\b|blister|sleeved booster|booster$/.test(n)) return 'pack';
  if (/\bdisplay\b/.test(n)) return 'box';
  if (/bundle|collection|premium|gift|box|set/.test(n)) return 'coll';
  return 'other';
}

// ---------- Cardmarket (archivos públicos oficiales) ----------
const CM = 'https://downloads.s3.cardmarket.com/productCatalog';
const CM_HEADERS = { Referer: 'https://www.cardmarket.com/' };
async function loadCardmarket(idGame){
  const [prods, guide, non] = await Promise.all([
    getJSON(`${CM}/productList/products_singles_${idGame}.json`, CM_HEADERS),
    getJSON(`${CM}/priceGuide/price_guide_${idGame}.json`, CM_HEADERS),
    getJSON(`${CM}/productList/products_nonsingles_${idGame}.json`, CM_HEADERS).catch(() => ({ products: [] })),
  ]);
  const products = prods.products || prods;
  const nonsingles = non.products || non;
  const prices = {};
  for (const p of guide.priceGuides || guide) prices[p.idProduct] = p;
  const updated = guide.createdAt || guide.created_at || prods.createdAt || null;
  console.log(`   Cardmarket: ${products.length} productos, ${Object.keys(prices).length} precios (fecha: ${updated}; claves: ${Object.keys(guide).join(',')})`);
  return { products, nonsingles, prices, updated };
}

// Une cada carta de TCGplayer con su producto de Cardmarket:
// 1) empareja expansiones por los nombres de cartas que comparten
// 2) dentro de cada expansión, empareja por nombre; si hay varias versiones con el
//    mismo nombre, las ordena por precio (la más barata con la más barata) y las marca como aproximadas
function matchCardmarket(tcg, cm){
  const byExp = {};
  for (const p of cm.products) (byExp[p.idExpansion] ||= []).push(p);
  const byGroup = {};
  for (const c of tcg.cards) (byGroup[c.g] ||= []).push(c);

  // Cardmarket a veces pone el código en el nombre: "Roronoa Zoro (OP01-001)".
  // Esos productos se emparejan por nombre + código en TODO el juego (sirve también para promos).
  const cmCode = p => { const m = p.name.match(/\(([A-Z0-9]+-[A-Z0-9]+)\)/i); return m ? normCode(m[1]) : ''; };
  const tcgCode = c => normCode(String(c.c).split(' ')[0]);
  const globalByCode = {};
  for (const p of cm.products) { const k = cmCode(p); if (k) (globalByCode[norm(p.name) + '|' + k] ||= []).push(p); }

  let matched = 0, rejected = 0;
  // Empareja una lista de cartas TCGplayer con una lista de productos Cardmarket de la misma carta
  const pair = (list, cmList) => {
    const price = p => cmPrice(cm.prices[p.idProduct]) ?? Infinity;
    const a = [...list].sort((x, y) => (x.u ?? Infinity) - (y.u ?? Infinity));
    const b = [...cmList].sort((x, y) => price(x) - price(y));
    const sameCount = a.length === b.length;
    const used = new Set();
    a.forEach((c, i) => {
      let p;
      if (sameCount) p = b[i];                                  // mismo nº de versiones: por orden de precio
      else {                                                    // si no: el de precio más parecido
        const target = Math.log((c.u || 0.1) * 0.92);
        p = b.filter(x => !used.has(x)).sort((x, y) =>
          Math.abs(Math.log(price(x) || 0.1) - target) - Math.abs(Math.log(price(y) || 0.1) - target))[0] || b[b.length - 1];
      }
      used.add(p);
      const pg = cm.prices[p.idProduct];
      if (!pg) return;
      const e = cmPrice(pg);
      // Comprobación: si el precio en € no se parece nada al de $, el emparejamiento es dudoso -> no lo usamos
      if (e && c.u && Math.max(e, c.u) > 3 && (e / c.u > 3 || e / c.u < 0.33)) { rejected++; return; }
      c.cm = p.idProduct;
      c.e = r2(e); c.el = r2(pg.low || pg['low-foil']); c.e30 = r2(pg.avg30 || pg['avg30-foil']);
      c.ef = r2(pg['trend-foil'] || pg['trend-holo']);
      if (a.length > 1 || b.length > 1) c.ea = 1;              // hay varias versiones: avisar
      matched++;
    });
  };

  // 1) Por nombre + código en todo el juego
  const tcgByCode = {};
  for (const c of tcg.cards) { const k = norm(c.n) + '|' + tcgCode(c); if (globalByCode[k]) (tcgByCode[k] ||= []).push(c); }
  for (const [k, list] of Object.entries(tcgByCode)) pair(list, globalByCode[k]);

  // 2) El resto, por nombre dentro de la expansión equivalente (solo productos sin código en el nombre)
  const expNames = Object.fromEntries(Object.entries(byExp).map(([e, ps]) => [e, new Set(ps.map(p => norm(p.name)))]));
  for (const cards of Object.values(byGroup)) {
    const names = new Set(cards.map(c => norm(c.n)));
    let best = null, bestScore = 0;
    for (const [e, set] of Object.entries(expNames)) {
      let inter = 0; for (const n of names) if (set.has(n)) inter++;
      const score = inter / Math.max(names.size, set.size);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (!best || bestScore < 0.5) continue;
    const cmByName = {};
    for (const p of byExp[best]) if (!cmCode(p)) (cmByName[norm(p.name)] ||= []).push(p);
    const tcgByName = {};
    for (const c of cards) if (!c.cm && !tcgByCode[norm(c.n) + '|' + tcgCode(c)] && cmByName[norm(c.n)]) (tcgByName[norm(c.n)] ||= []).push(c);
    for (const [n, list] of Object.entries(tcgByName)) pair(list, cmByName[n]);
  }
  return `${matched} (descartadas por precio dudoso: ${rejected})`;
}

// Une cada producto sellado de TCGplayer con el de Cardmarket.
// Los nombres no son iguales ("Booster Box" vs "Booster Display"), así que comparamos las palabras
// importantes (la expansión) dentro del mismo tipo de producto y nos quedamos con el más parecido.
const STOP = new Set(['booster','box','display','pack','packs','case','the','of','and','english','en','tcg','card','game','set',
  'pokemon','yu','gi','oh','magic','gathering','mtg','sealed','trading','cards','edition','1st','unlimited','a','de',
  'disney','lorcana','dragon','ball','super','fusion','world','digimon','gundam','riftbound','league','legends','weiss','schwarz','warcraft','wow','bandai']);
const words = s => new Set(norm(s.replace(/&/g, ' and ')).split(' ').filter(w => w && !STOP.has(w)));
function matchSealed(list, cm, sets = {}){
  const cands = cm.nonsingles.filter(p => cmPrice(cm.prices[p.idProduct]))
    .map(p => ({ p, t: sealedType(p.name), w: words(p.name) }));
  const index = {};
  for (const c of cands) for (const w of c.w) (index[c.t + '|' + w] ||= []).push(c);
  let n = 0; const usedBy = {};
  for (const s of list) {
    let w = words(s.n);
    if (w.size < 2) w = words(s.n + ' ' + (sets[s.g]?.n || '')); // "Booster Pack" -> añade el nombre de la expansión
    if (!w.size) continue;
    const seen = new Set(); let best = null, bestScore = 0;
    for (const x of w) for (const c of index[s.t + '|' + x] || []) {
      if (seen.has(c)) continue; seen.add(c);
      let inter = 0; for (const y of w) if (c.w.has(y)) inter++;
      const score = inter / (w.size + c.w.size - inter);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best || bestScore < 0.75) continue;
    const pg = cm.prices[best.p.idProduct], e = cmPrice(pg);
    if (s.u && Math.max(e, s.u) > 5 && (e / s.u > 2.5 || e / s.u < 0.4)) continue; // precio muy distinto: dudoso
    // cada producto de Cardmarket solo se usa una vez: para el que más se parece
    const prev = usedBy[best.p.idProduct];
    if (prev && prev.score >= bestScore) continue;
    if (prev) { delete prev.s.cm; delete prev.s.e; delete prev.s.el; delete prev.s.e30; n--; }
    usedBy[best.p.idProduct] = { s, score: bestScore };
    s.cm = best.p.idProduct; s.e = r2(e); s.el = r2(pg.low); s.e30 = r2(pg.avg30); n++;
  }
  const ej = list.filter(s => s.t === 'box').slice(0, 3).map(s => s.n).join(' | ');
  const ejc = cands.filter(c => c.t === 'box').slice(0, 3).map(c => c.p.name).join(' | ');
  console.log(`   Ejemplos TCG: ${ej}\n   Ejemplos CM: ${ejc}`);
  return n;
}

// ---------- Duel Masters (Torekakaku, precios en yenes de Japón) ----------
// Duel Masters no está en Cardmarket ni en TCGplayer. Torekakaku publica el precio de cada carta.
// Su robots.txt permite el acceso; vamos despacio (1 página cada ~1,2 s) para no cargar su servidor.
const TK = 'https://torekakaku.com';
const decode = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
async function getText(url, tries = 3){
  for (let i = 1; ; i++) {
    try { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(r.status + ' ' + url); return await r.text(); }
    catch (e) { if (i >= tries) throw e; await sleep(3000 * i); }
  }
}
async function loadDuelMasters(){
  const html = await getText(`${TK}/dm/packlist/`);
  const packs = [...html.matchAll(/href="\/dm\/cardlist\/\?packid=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => {
    const t = decode(m[2]);
    const d = (t.match(/発売日[:：]\s*(\d{4}\/\d{2}\/\d{2})/) || [])[1] || '';
    return { id: m[1], n: t.replace(/発売日[\s\S]*$/, '').trim(), d: d.replace(/\//g, '-') };
  });
  const sets = {}, cards = [], seen = new Set();
  for (const pk of [...new Map(packs.map(x => [x.id, x])).values()]) {
    await sleep(1200);
    let h; try { h = await getText(`${TK}/dm/cardlist/?packid=${pk.id}`); } catch (e) { console.log('   ⚠️', e.message); continue; }
    sets[pk.id] = { n: pk.n, d: pk.d };
    for (const m of h.matchAll(/href="\/dm\/card\/\?cardid=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      if (seen.has(m[1])) continue;
      const b = m[2], f = cls => (b.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)<\\/div>`)) || [])[1] || '';
      const kata = f('rankkata');
      const rar = decode((kata.match(/class="descitem"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      const code = decode(kata.replace(/<span[\s\S]*?<\/span>/, ''));
      const yen = Number((decode(f('rankkakaku')).match(/([\d,]+)\s*円/) || [])[1]?.replace(/,/g, '')) || null;
      const name = decode(f('ranktitle'));
      if (!name) continue;
      seen.add(m[1]);
      cards.push({ id: Number(m[1]), n: name, c: code, r: rar, g: pk.id, y: yen });
    }
  }
  return { sets, cards };
}

await mkdir('data/sealed', { recursive: true });
const index = {};
for (const [key, G] of Object.entries(GAMES)) {
  if (only && only !== key) continue;
  console.log(`\n== ${G.name} ==`);
  try {
    const all = { sets: {}, cards: [], texts: {}, sealed: [], sealedSets: {} };
    for (const cat of G.tcg) {
      const t = await loadTcg(cat, G.sealedOnly);
      Object.assign(all.sets, t.sets); all.cards.push(...t.cards); Object.assign(all.texts, t.texts);
      all.sealed.push(...t.sealed); Object.assign(all.sealedSets, t.sealedSets);
    }
    console.log(`   TCGplayer: ${all.cards.length} cartas en ${Object.keys(all.sets).length} sets`);
    let cmUpdated = null;
    try {
      const cm = await loadCardmarket(G.cm);
      cmUpdated = cm.updated;
      if (!G.sealedOnly) console.log(`   Emparejadas con Cardmarket: ${matchCardmarket(all, cm)}`);
      console.log(`   Sellados: ${all.sealed.length}, con precio Cardmarket: ${matchSealed(all.sealed, cm, all.sealedSets)}`);
    } catch (e) { console.log('   ⚠️ Cardmarket no disponible:', e.message); }
    await writeFile(`data/sealed/${key}.json`, JSON.stringify({ updated: new Date().toISOString(), cmUpdated, sets: all.sealedSets, items: all.sealed }));
    if (G.sealedOnly) continue;
    const out = { game: G.name, updated: new Date().toISOString(), cmUpdated, sets: all.sets, cards: all.cards };
    await writeFile(`data/${key}.json`, JSON.stringify(out));
    // textos: un archivo por expansión, así la web solo descarga lo que necesita
    await rm(`data/text/${key}`, { recursive: true, force: true });
    await mkdir(`data/text/${key}`, { recursive: true });
    for (const [g, t] of Object.entries(all.texts)) await writeFile(`data/text/${key}/${g}.json`, JSON.stringify(t));
    index[key] = { name: G.name, cards: all.cards.length, updated: out.updated };
  } catch (e) {
    console.log(`   ❌ Error en ${G.name}:`, e.message);
  }
}
if (!only || only === 'duelmasters') {
  console.log('\n== Duel Masters (Torekakaku) ==');
  try {
    const dm = await loadDuelMasters();
    console.log(`   ${dm.cards.length} cartas en ${Object.keys(dm.sets).length} packs, con precio: ${dm.cards.filter(c => c.y).length}`);
    if (dm.cards.length > 1000) // si algo falla y salen pocas, no machacamos los datos buenos de ayer
      await writeFile('data/duelmasters.json', JSON.stringify({ game: 'Duel Masters', updated: new Date().toISOString(), currency: 'JPY', sets: dm.sets, cards: dm.cards }));
    index.duelmasters = { name: 'Duel Masters', cards: dm.cards.length };
  } catch (e) { console.log('   ❌ Error en Duel Masters:', e.message); }
}
if (!only) await writeFile('data/index.json', JSON.stringify(index, null, 1));
console.log('\nListo.');
