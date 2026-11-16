// =====================================================================
//  "CÓMO SE USA ESTA CARTA" — explica cada carta en español:
//  qué tipo es, cómo se juega / invoca y qué hace su efecto.
// =====================================================================
const P = t => `<p>${t}</p>`;
const LI = arr => `<ul>${arr.filter(Boolean).map(x => `<li>${x}</li>`).join('')}</ul>`;
const cardText = (t, lang) => t ? `<div class="ctext"><div class="lbl2">${T('Texto de la carta')}${lang ? ' (' + T(lang) + ')' : ''}</div>${esc(t).replace(/\n/g, '<br>')}</div>` : '';

// ---------------------------- YU-GI-OH! ----------------------------
function howtoYugioh(c){
  const t = c.type || '', d = c.desc || '', out = [];
  if (/Spell/i.test(t)) {
    const kinds = {
      'Normal': T('Se juega en <b>tu turno</b> (Fase Principal). Hace su efecto y se va al Cementerio.'),
      'Quick-Play': T('<b>Mágica Rápida</b>: desde la mano solo en tu turno, pero si la colocas boca abajo puedes activarla también en el <b>turno del rival</b> (no en el mismo turno en que la colocas).'),
      'Continuous': T('<b>Mágica Continua</b>: se queda en el campo y su efecto dura mientras siga boca arriba.'),
      'Equip': T('<b>Mágica de Equipo</b>: se equipa a un monstruo y le da su efecto. Si el monstruo se va, ella también.'),
      'Field': T('<b>Mágica de Campo</b>: va en la Zona de Campo y afecta a todo el juego. Solo puede haber 1 por jugador.'),
      'Ritual': T('<b>Mágica de Ritual</b>: sirve para <b>Invocar por Ritual</b> a un monstruo de Ritual sacrificando monstruos cuyos Niveles sumen lo que pide.'),
    };
    out.push(P(`${T('🟩 <b>Carta Mágica</b>.')} ${kinds[c.race] || kinds.Normal}`));
  } else if (/Trap/i.test(t)) {
    const kinds = {
      'Normal': T('Hace su efecto y se va al Cementerio.'),
      'Continuous': T('<b>Trampa Continua</b>: se queda en el campo y su efecto dura.'),
      'Counter': T('<b>Trampa de Contraefecto</b>: se usa para responder y <b>anular</b> otras cartas o efectos. Es la más rápida.'),
    };
    out.push(P(`${T('🟪 <b>Carta de Trampa</b>. Primero la <b>colocas boca abajo</b>; puedes activarla a partir del <b>turno siguiente</b>, también en el turno del rival.')} ${kinds[c.race] || ''}`));
  } else {
    const lv = c.level, stats = c.atk != null ? `ATK ${c.atk}${c.def != null ? ' / DEF ' + c.def : ''}` : '';
    let how;
    if (/Link/i.test(t)) how = T('🔵 <b>Monstruo de Enlace (Link-{0})</b>. Vive en el <b>Deck Extra</b>. Para invocarlo mandas al Cementerio los <b>materiales</b> que pide (los pone al principio del texto). Cada monstruo cuenta como 1 material (o como su número Link si es de Enlace). Solo está en Ataque y apunta con sus flechas a otras zonas.', c.linkval);
    else if (/XYZ/i.test(t)) how = T('⬛ <b>Monstruo Xyz (Rango {0})</b>. Vive en el <b>Deck Extra</b>. Para invocarlo pones uno encima de otro los monstruos del <b>mismo Nivel</b> que pide (ej. "2 Level {0} monsters"). Esos materiales se quedan debajo y se gastan para usar sus efectos.', lv);
    else if (/Synchro/i.test(t)) how = T('⬜ <b>Monstruo de Sincronía (Nivel {0})</b>. Vive en el <b>Deck Extra</b>. Mandas al Cementerio <b>1 Cantante (Tuner)</b> + otros monstruos que no sean Cantantes, y sus Niveles tienen que sumar <b>exactamente {0}</b>.', lv);
    else if (/Fusion/i.test(t)) how = T('🟪 <b>Monstruo de Fusión (Nivel {0})</b>. Vive en el <b>Deck Extra</b>. Se invoca con una carta como <b>"Polymerization"</b>, mandando al Cementerio los monstruos que pide su texto (los materiales).', lv);
    else if (/Ritual/i.test(t)) how = T('🟦 <b>Monstruo de Ritual (Nivel {0})</b>. Necesitas su <b>Carta Mágica de Ritual</b> y sacrificar monstruos cuyos Niveles sumen <b>{0} o más</b>.', lv);
    else {
      const trib = lv <= 4 ? T('<b>Invocación Normal</b> directa, sin sacrificios (1 por turno).')
        : lv <= 6 ? T('Para la Invocación Normal tienes que <b>sacrificar 1 monstruo</b> tuyo.')
        : T('Para la Invocación Normal tienes que <b>sacrificar 2 monstruos</b> tuyos.');
      how = T('🟧 <b>Monstruo de Nivel {0}</b>.', lv) + ' ' + trib;
      if (/cannot be Normal Summoned|must (first )?be Special Summoned/i.test(d))
        how = T('🟧 <b>Monstruo de Nivel {0}</b> que <b>no se puede Invocar de forma Normal</b>: solo sale por <b>Invocación Especial</b>, como explica su texto.', lv);
    }
    out.push(P(how));
    if (/Pendulum/i.test(t)) out.push(P(T('🌗 También es <b>Péndulo</b> (Escala {0}): puedes ponerlo en tu Zona de Péndulo como si fuera una Mágica. Con 2 escalas puestas, invocas a la vez monstruos con Nivel entre las dos.', c.scale)));
    if (/Normal Monster/i.test(t)) out.push(P(T('Es un <b>monstruo Normal</b>: no tiene efecto, solo sus puntos de ataque y defensa.')));
    else if (/Effect|Flip|Spirit|Toon|Union|Gemini|Tuner/i.test(t)) out.push(P(T('Tiene un <b>efecto</b>: lo explica su texto de abajo.') + (/FLIP:/i.test(d) ? ' ' + T('Es de <b>Volteo</b>: su efecto se activa cuando se pone boca arriba.') : '') + (/Quick Effect/i.test(d) ? ' ' + T('Tiene un <b>Efecto Rápido</b>: puede usarlo también en el turno del rival.') : '')));
    if (/Tuner/i.test(t)) out.push(P(T('Es <b>Cantante (Tuner)</b>: sirve como material para las Invocaciones por Sincronía.')));
    if (stats) out.push(P(`⚔️ ${stats} · ${esc(c.attribute || '')} · ${esc(c.race || '')}`));
  }
  const tl = c._lang || 'inglés';
  if (c.pend_desc) out.push(cardText(c.pend_desc, T('efecto de Péndulo') + ', ' + T(tl)), cardText(c.monster_desc, T('efecto de monstruo') + ', ' + T(tl)));
  else out.push(cardText(d, tl));
  return out.join('');
}

// ---------------------------- POKÉMON ----------------------------
async function howtoPokemon(id){
  const TL = { es: 'es', en: 'en', it: 'it', fr: 'fr', nl: 'nl', de: 'de', ja: 'ja', zh: 'zh-tw', ko: 'ko' }[LANG] || 'en';
  let c = await getJSON(`https://api.tcgdex.net/v2/${TL}/cards/${id}`).catch(() => null);
  let lang = LANG_NAME();
  if (!c || !c.category) { c = await getJSON(`https://api.tcgdex.net/v2/en/cards/${id}`); lang = 'inglés'; }
  if (!c) return P(T('No hay información de esta carta.'));
  const out = [];
  if (/pok|ポケモン|宝可梦|寶可夢|포켓몬/i.test(c.category)) {
    const basic = /b[aá]sic|base|たね|基础|基礎|기본|basis/i.test(c.stage || '');
    out.push(P(basic
      ? T('🟢 <b>Pokémon Básico</b>: lo puedes poner directamente en juego (como Activo o en la Banca).')
      : T('🔼 <b>{0}</b>: no se juega solo. Se pone <b>encima de {1}</b> (que debe llevar al menos un turno en juego) para evolucionarlo. Conserva las Energías y el daño.', esc(c.stage || T('Evolución')), esc(c.evolveFrom || T('su forma anterior')))));
    if (/\bex\b|\bV\b|VMAX|VSTAR|GX/.test(c.name)) out.push(P(T('⭐ Es un Pokémon especial (ex / V / GX…): más fuerte, pero si queda Fuera de Combate el rival coge <b>2 Premios</b> (3 si es VMAX).')));
    out.push(P(T('❤️ <b>{0} PS</b> (puntos de salud) · Tipo: {1}', c.hp, esc((c.types || []).join(', ')))));
    for (const a of c.abilities || [])
      out.push(P(`✨ <b>${esc(a.type || T('Habilidad'))}: ${esc(a.name)}</b><br>${esc(a.effect || '')}`));
    for (const a of c.attacks || [])
      out.push(P(`⚔️ <b>${esc(a.name)}</b>${a.damage ? ' — ' + T('<b>{0}</b> de daño', esc(a.damage)) : ''}<br>${T('Necesita:')} ${(a.cost || []).length ? esc(a.cost.join(' + ')) : T('nada (gratis)')}${a.effect ? '<br>' + esc(a.effect) : ''}`));
    const w = (c.weaknesses || []).map(x => `${x.type} ${x.value}`).join(', ');
    const r = (c.resistances || []).map(x => `${x.type} ${x.value}`).join(', ');
    out.push(LI([w && T('Debilidad: <b>{0}</b> (recibe más daño de ese tipo)', esc(w)), r && T('Resistencia: {0}', esc(r)),
      c.retreat != null && T('Coste de retirada: <b>{0}</b> Energía(s) para cambiarlo por uno de la Banca', c.retreat)]));
  } else if (/entren|trainer|dresseur|allenat|trainer|トレーナー|训练家|訓練家|트레이너/i.test(c.category)) {
    const tt = String(c.trainerType || '');
    const kind = /partid|support|サポート|支援|서포트|soutien|unterstütz|aiuto|ondersteun/i.test(tt) ? T('🧑 <b>Partidario</b>: solo puedes jugar <b>1 por turno</b> (y no en el primer turno del que empieza).')
      : /estad|stadium|スタジアム|竞技场|競技場|스타디움|stade|stadion/i.test(tt) ? T('🏟️ <b>Estadio</b>: se queda en juego y afecta a los dos jugadores. Solo hay 1 a la vez.')
      : /herram|tool|どうぐ|道具|도구|outil|werkzeug|strument|uitrust/i.test(tt) ? T('🔧 <b>Herramienta</b>: se une a uno de tus Pokémon y le da su efecto.')
      : T('🎒 <b>Objeto</b>: puedes jugar <b>todos los que quieras</b> en tu turno.');
    out.push(P(T('Carta de <b>Entrenador</b>.') + ' ' + kind));
    out.push(cardText(c.effect, lang));
  } else {
    out.push(P(T('⚡ Carta de <b>Energía</b>: puedes unir <b>1 por turno</b> a uno de tus Pokémon. Los ataques piden Energías para poder usarse.')));
    out.push(cardText(c.effect, lang));
  }
  return out.join('');
}

// ---------------------------- MAGIC ----------------------------
const MANA = { W: 'blanco', U: 'azul', B: 'negro', R: 'rojo', G: 'verde', C: 'incoloro', X: 'X (el que elijas)' };
function explainMana(cost){
  if (!cost) return '';
  const parts = [...cost.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  const out = []; let generic = 0;
  for (const s of parts) {
    if (/^\d+$/.test(s)) generic += +s;
    else out.push(s.split('/').map(x => MANA[x] ? T(MANA[x]) : x).join(' ' + T('o') + ' '));
  }
  const count = {}; out.forEach(x => count[x] = (count[x] || 0) + 1);
  return [generic ? T('{0} de cualquier color', generic) : '', ...Object.entries(count).map(([k, n]) => `${n} ${k}`)].filter(Boolean).join(' + ');
}
const KEYWORDS = {
  'Flying': 'Vuela: solo la pueden bloquear criaturas con Vuela o Alcance.',
  'Trample': 'Arrolla: el daño que sobra al bloqueador pasa al jugador.',
  'Haste': 'Prisa: puede atacar el mismo turno en que entra.',
  'Deathtouch': 'Toque mortal: cualquier daño que haga a una criatura la destruye.',
  'Lifelink': 'Vínculo vital: ganas tantas vidas como el daño que hace.',
  'Vigilance': 'Vigilancia: atacar no la gira.',
  'First strike': 'Daña primero: hace su daño de combate antes que las demás.',
  'Double strike': 'Doble golpe: hace daño dos veces en combate.',
  'Flash': 'Destello: la puedes jugar en cualquier momento, como un instantáneo.',
  'Reach': 'Alcance: puede bloquear criaturas con Vuela.',
  'Menace': 'Amenaza: hacen falta 2 o más criaturas para bloquearla.',
  'Hexproof': 'Antimaleficio: el rival no puede hacerla objetivo de sus hechizos.',
  'Indestructible': 'Indestructible: no se destruye por daño ni por efectos de "destruir".',
  'Defender': 'Defensor: no puede atacar.',
  'Ward': 'Custodia: si el rival la hace objetivo, tiene que pagar un coste extra o se anula.',
};
async function howtoMagic(c){
  const tl = c.type_line || '';
  const out = [];
  const kinds = [
    [/Land/, '🏔️ <b>Tierra</b>: no cuesta nada. Puedes jugar <b>1 por turno</b> y se gira para dar maná.'],
    [/Creature/, '🐉 <b>Criatura</b>: se juega en tu fase principal. No puede atacar el turno en que entra (salvo Prisa). Fuerza/Resistencia: <b>{0}</b>.', (c.power ?? '?') + '/' + (c.toughness ?? '?')],
    [/Instant/, '⚡ <b>Instantáneo</b>: lo puedes jugar <b>en cualquier momento</b>, incluso en el turno del rival. Hace su efecto y se va al cementerio.'],
    [/Sorcery/, '📜 <b>Conjuro</b>: solo en <b>tu fase principal</b>. Hace su efecto y se va al cementerio.'],
    [/Planeswalker/, '🧙 <b>Planeswalker</b>: un aliado poderoso con <b>lealtad</b> ({0}). Una vez por turno usas una de sus habilidades (+ suma lealtad, − la gasta). El rival puede atacarle.', c.loyalty ?? '?'],
    [/Battle/, '🛡️ <b>Batalla</b>: se juega en tu fase principal y tus criaturas la atacan para derrotarla y conseguir su recompensa.'],
    [/Enchantment/, '✨ <b>Encantamiento</b>: se queda en el campo y su efecto dura. Si es un <b>Aura</b>, se pega a una carta.'],
    [/Artifact/, '⚙️ <b>Artefacto</b>: un objeto que se queda en el campo. Si es un <b>Equipo</b>, se equipa a una criatura pagando su coste de equipar.'],
  ];
  const k = kinds.filter(([re]) => re.test(tl)).map(x => T(x[1], x[2]));
  out.push(P(`<b>${esc(tl)}</b>`), ...k.map(P));
  if (c.mana_cost) out.push(P(T('💧 <b>Coste</b>:') + ' ' + c.mana_cost.split(' // ').map(m => `${esc(m)} → ${T('paga {0} de maná', esc(explainMana(m) || '0'))}`).join(' &nbsp;|&nbsp; ')));
  const kw = (c.keywords || []).map(k => KEYWORDS[k] ? `<b>${k}</b> — ${T(KEYWORDS[k])}` : null).filter(Boolean);
  if (kw.length) out.push(`<div class="lbl2">${T('Palabras clave')}</div>` + LI(kw));
  // Texto en el idioma elegido si Scryfall lo tiene
  const SL = { es: 'es', it: 'it', fr: 'fr', de: 'de', ja: 'ja', zh: 'zhs', ko: 'ko' }[LANG];
  let tr = null;
  if (SL && c.lang !== SL) tr = await getJSON(`https://api.scryfall.com/cards/${c.set}/${encodeURIComponent(c.collector_number)}/${SL}`).catch(() => null);
  const text = tr?.printed_text || c.oracle_text || c.card_faces?.map(f => `${f.name}: ${f.oracle_text}`).join('\n\n');
  out.push(cardText(text, tr?.printed_text ? LANG_NAME() : 'inglés'));
  return out.join('');
}

// ------------------ JUEGOS CON DATOS DIARIOS ------------------
// Explicación de cada tipo de carta por juego (se busca por palabras del tipo)
const TIPOS = {
  onepiece: [
    [/leader/i, '👑 <b>Líder</b>: empieza en juego. Sus Vidas marcan cuántas cartas de Vida tienes y puede atacar cada turno.'],
    [/character/i, '🧑 <b>Personaje</b>: se juega pagando su coste en DON!!. Ataca el turno siguiente (salvo que tenga <b>Rush</b>). Su número de <b>Counter</b> sirve para defender desde la mano.'],
    [/event/i, '⚡ <b>Evento</b>: se paga y hace su efecto una vez. Los que dicen <b>[Counter]</b> se usan en el turno del rival para defenderte.'],
    [/stage/i, '🏝️ <b>Escenario</b>: se queda en juego y da su efecto. Solo 1 a la vez.'],
    [/don/i, '🔴 <b>DON!!</b>: tu energía. Se usa para pagar cartas o se da a un personaje para darle +1000 de poder.'],
  ],
  dragonball: [
    [/leader/i, '👑 <b>Líder</b>: empieza en juego. Cuando cumples la condición de <b>Despertar</b> se da la vuelta y se hace más fuerte.'],
    [/battle/i, '🥊 <b>Carta de Batalla</b>: tus luchadores. Se juegan pagando Energía. Su número de <b>Combo</b> (izquierda) se suma al poder en un ataque.'],
    [/extra/i, '⚡ <b>Carta Extra</b>: de un solo uso. Se paga, hace su efecto y se va.'],
  ],
  digimon: [
    [/egg/i, '🥚 <b>Digi-Huevo</b>: va en tu mazo de huevos. Se abre en la zona de Crianza y evoluciona allí antes de salir al campo.'],
    [/digimon/i, '🦖 <b>Digimon</b>: se juega pagando su coste, o se <b>digievoluciona</b> poniéndolo encima de un Digimon del nivel anterior pagando su coste de evolución (y robas 1 carta).'],
    [/tamer/i, '🧒 <b>Tamer</b>: se queda en juego y da efectos a tus Digimon.'],
    [/option/i, '⚡ <b>Opción</b>: se usa una vez y hace su efecto. Si sale de tu Seguridad, a veces se usa gratis.'],
  ],
  lorcana: [
    [/song/i, '🎵 <b>Canción</b>: una Acción que puedes jugar gratis <b>girando</b> a un personaje de coste igual o mayor.'],
    [/character/i, '🧑 <b>Personaje</b>: se juega pagando tinta. Puede <b>Explorar</b> (ganar Saber ◆) o <b>Desafiar</b> (luchar) desde el turno siguiente.'],
    [/action/i, '⚡ <b>Acción</b>: se paga, hace su efecto y se va al descarte.'],
    [/item/i, '🎒 <b>Objeto</b>: se queda en juego y da su efecto.'],
    [/location/i, '🏰 <b>Lugar</b>: tus personajes pueden moverse allí; da Saber al principio de tu turno.'],
  ],
  gundam: [
    [/unit/i, '🤖 <b>Unidad</b>: el robot que lucha. Necesitas Recursos igual a su <b>Nivel</b> y pagas su <b>Coste</b>. Hasta 6 en juego.'],
    [/pilot/i, '🧑‍✈️ <b>Piloto</b>: va debajo de una Unidad, le suma AP y HP y le da su habilidad. Si encaja, la Unidad puede atacar ya (<b>Link</b>).'],
    [/command/i, '⚡ <b>Comando</b>: de un solo uso. Algunos se usan en el turno del rival.'],
    [/base/i, '🏯 <b>Base</b>: va en tu zona de Escudos y los protege. Solo 1 a la vez.'],
    [/resource/i, '🔋 <b>Recurso</b>: tu energía. Pones 1 por turno.'],
  ],
  riftbound: [
    [/legend/i, '👑 <b>Leyenda</b>: marca los colores de tu mazo y tiene una habilidad propia.'],
    [/champion/i, '🦸 <b>Campeón</b>: una Unidad especial; tu Campeón elegido empieza en juego.'],
    [/unit/i, '🧑 <b>Unidad</b>: se paga con Runas y se mueve a los Campos de Batalla para luchar y conquistarlos.'],
    [/spell/i, '⚡ <b>Hechizo</b>: de un solo uso, ayuda a tus Unidades.'],
    [/gear/i, '🛡️ <b>Equipo</b>: mejora a tus Unidades.'],
    [/rune/i, '🔮 <b>Runa</b>: tu energía. Recibes 2 por turno.'],
    [/battlefield/i, '🗺️ <b>Campo de Batalla</b>: el lugar que se conquista para ganar puntos.'],
  ],
  weiss: [
    [/climax/i, '💥 <b>Clímax</b>: solo 1 por turno, en la fase de Clímax. Potencia a tus personajes. Si sale al recibir daño, ¡cancela el daño!'],
    [/event/i, '⚡ <b>Evento</b>: se paga, hace su efecto y se va.'],
    [/character/i, '🧑 <b>Personaje</b>: se pone en tu escenario (3 delante y 2 detrás). Solo puedes jugarlo si tu nivel es igual o mayor que el suyo y tienes un color que coincida.'],
  ],
  wow: [
    [/hero/i, '👑 <b>Héroe</b>: tu personaje principal; si su vida llega a 0, pierdes.'],
    [/ally/i, '🧑 <b>Aliado</b>: lucha a tu lado. Puede atacar y proteger.'],
    [/ability/i, '⚡ <b>Habilidad</b>: un hechizo o técnica de un solo uso.'],
    [/weapon|armor|item|equipment/i, '🗡️ <b>Equipo</b>: arma o armadura para tu Héroe.'],
    [/quest/i, '📜 <b>Misión</b>: se juega como recurso boca arriba y da una recompensa.'],
    [/location/i, '🏰 <b>Lugar</b>: se queda en juego y da efectos.'],
  ],
};
const textCache = {};
async function howtoLocal(key, c){
  const fileKey = key + '/' + c.g;
  if (!textCache[fileKey]) textCache[fileKey] = fetch(`data/text/${key}/${c.g}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  const t = (await textCache[fileKey])[c.id] || {};
  const clean = s => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .split('\n').map(l => l.trim()).filter(l => !/^disclaimer/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const entries = Object.entries(t).map(([k, v]) => [k, clean(v)]).filter(([, v]) => v);
  const isText = k => /description|text|effect|ability/i.test(k);
  const typeVal = (entries.find(([k]) => /card ?type|^type|category|class/i.test(k)) || [])[1] || c.n;
  const tipo = (TIPOS[key] || []).find(([re]) => re.test(typeVal));
  const out = [];
  if (tipo) out.push(P(T(tipo[1])));
  const stats = entries.filter(([k, v]) => !isText(k) && v.length < 60);
  if (stats.length) out.push(`<table class="stats">${stats.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`);
  for (const [k, v] of entries.filter(([k]) => isText(k))) out.push(cardText(v, 'inglés'));
  if (!out.length) out.push(P(T('No hay información del texto de esta carta. Mira la guía "Cómo se juega" de arriba.')));
  return out.join('');
}

// Página con la guía de un juego
function showGuide(key){
  const g = GUIAS[key]; if (!g) return;
  redraw = () => showGuide(key);
  out.innerHTML = `${backBtn()}<div class="gpage">
    <h2>${T('📖 Cómo se juega a {0}', esc(GAMES[key].label))}</h2>
    ${g.map(([ico, t, txt]) => `<div class="gstep"><div class="gico">${ico}</div><div><h3>${T(t)}</h3><p>${T(txt)}</p></div></div>`).join('')}
    <p class="note">${T('Es un resumen para empezar. Cada carta puede cambiar las reglas: lo que dice la carta manda.')}</p>
  </div>`;
  wireBack();
  toTop();
}
