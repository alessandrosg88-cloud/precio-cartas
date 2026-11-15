// Descarga cada día los precios de los juegos "extra" y los guarda en /data/<juego>.json
//  - Cartas, códigos, rarezas y precio en $ : TCGplayer (vía tcgcsv.com, datos públicos diarios)
//  - Precio en € : guía de precios pública de Cardmarket (archivos oficiales diarios)
// No necesita ninguna API key. Se ejecuta con: node scripts/update-data.mjs
import { writeFile, mkdir } from 'node:fs/promises';

const GAMES = {
  onepiece: { name: 'One Piece',          tcg: [68],     cm: 18 },
  dragonball: { name: 'Dragon Ball',      tcg: [80, 27], cm: 13 },
  digimon:  { name: 'Digimon',            tcg: [63],     cm: 17 },
  lorcana:  { name: 'Lorcana',            tcg: [71],     cm: 19 },
  gundam:   { name: 'Gundam',             tcg: [86],     cm: 24 },
  riftbound:{ name: 'League of Legends (Riftbound)', tcg: [89], cm: 22 },
  weiss:    { name: 'Weiß Schwarz',       tcg: [20],     cm: 10 },
  wow:      { name: 'World of Warcraft',  tcg: [13],     cm: 2 },
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
async function loadTcg(categoryId){
  const groups = (await getJSON(`https://tcgcsv.com/tcgplayer/${categoryId}/groups`)).results;
  const sets = {}, cards = [];
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
      if (!ext.Number && !ext.Rarity) continue; // no es una carta suelta
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
  return { sets, cards };
}

// ---------- Cardmarket (archivos públicos oficiales) ----------
const CM = 'https://downloads.s3.cardmarket.com/productCatalog';
const CM_HEADERS = { Referer: 'https://www.cardmarket.com/' };
async function loadCardmarket(idGame){
  const [prods, guide] = await Promise.all([
    getJSON(`${CM}/productList/products_singles_${idGame}.json`, CM_HEADERS),
    getJSON(`${CM}/priceGuide/price_guide_${idGame}.json`, CM_HEADERS),
  ]);
  const products = prods.products || prods;
  const prices = {};
  for (const p of guide.priceGuides || guide) prices[p.idProduct] = p;
  const updated = guide.createdAt || guide.created_at || prods.createdAt || null;
  console.log(`   Cardmarket: ${products.length} productos, ${Object.keys(prices).length} precios (fecha: ${updated}; claves: ${Object.keys(guide).join(',')})`);
  return { products, prices, updated };
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

await mkdir('data', { recursive: true });
const index = {};
for (const [key, G] of Object.entries(GAMES)) {
  if (only && only !== key) continue;
  console.log(`\n== ${G.name} ==`);
  try {
    const all = { sets: {}, cards: [] };
    for (const cat of G.tcg) {
      const t = await loadTcg(cat);
      Object.assign(all.sets, t.sets); all.cards.push(...t.cards);
    }
    console.log(`   TCGplayer: ${all.cards.length} cartas en ${Object.keys(all.sets).length} sets`);
    let cmUpdated = null;
    try {
      const cm = await loadCardmarket(G.cm);
      cmUpdated = cm.updated;
      console.log(`   Emparejadas con Cardmarket: ${matchCardmarket(all, cm)}`);
    } catch (e) { console.log('   ⚠️ Cardmarket no disponible:', e.message); }
    const out = { game: G.name, updated: new Date().toISOString(), cmUpdated, sets: all.sets, cards: all.cards };
    await writeFile(`data/${key}.json`, JSON.stringify(out));
    index[key] = { name: G.name, cards: all.cards.length, updated: out.updated };
  } catch (e) {
    console.log(`   ❌ Error en ${G.name}:`, e.message);
  }
}
if (!only) await writeFile('data/index.json', JSON.stringify(index, null, 1));
console.log('\nListo.');
