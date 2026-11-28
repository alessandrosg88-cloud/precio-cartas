# 🔎 Precio Cartas

Web para ver el precio de una carta escribiendo (o escaneando) su código. **Versión para PC** de la app [Precio Telefono](https://alessandrosg88-cloud.github.io/precio-telefono/): mismo diseño (violeta y oro), misma cuenta y mismas secciones, pero con barra lateral, buscador siempre arriba (atajo «/») y el contenido en columnas. En pantallas pequeñas se ve como la app, con la barra abajo.

> La app del teléfono carga desde esta web `acceso.js`, `i18n*.js`, `guias.js`, `como-se-usa.js`, `centrado.js`, `logo.jpg` y `data/`: no se deben renombrar ni borrar.

**Juegos:** Pokémon · Yu-Gi-Oh! · Magic · One Piece · Dragon Ball (Fusion World y Masters) · Digimon · Lorcana · Gundam · League of Legends (Riftbound) · Weiß Schwarz · World of Warcraft · Duel Masters (solo enlaces de búsqueda)

## Qué hace
- Busca por **código** o por **nombre**. También con 📷 **la cámara** (o subiendo una foto).
- Muestra el precio de **Cardmarket (€)** y **TCGplayer ($)**.
- **Versiones y rarezas:** con las flechas ‹ ›, deslizando el dedo o con ← → cambias entre las versiones de la carta (ediciones, rarezas, alt art, paralelas…) y se actualiza la imagen y el precio.
- **Ver la expansión entera:** todas las cartas del set, ordenables por precio.
- **Ordenar y filtrar versiones:** por precio o código, por rareza o escribiendo la expansión; botones «💎 La más cara» y «🪙 La más barata».
- **Historial de precios:** gráfico con el precio de cada día (`data/hist/`, lo guarda la Action) y las medias de Cardmarket de 1, 7 y 30 días; ▲▼ % frente a la media de 30 días.
- **Enlaces:** cada búsqueda y cada carta tienen su propia dirección (`#juego=…&q=…&v=…`) para compartirla o guardarla; funciona el botón Atrás del navegador.
- **Autocompletar** mientras escribes, con foto y precio.
- **Portada:** las cartas que más suben, las que más bajan, las más caras (`data/top/`) y las últimas expansiones.
- **Moneda:** ver todo en la moneda original, en euros o en dólares (cambio del BCE). Modo oscuro/claro.
- **Mi colección:** cambio de precio desde que guardaste cada carta, alertas «avísame si baja de…» y descarga en CSV (Excel).
- **Gradeo:** enlaces a PSA, CGC, Beckett, SGC, TAG y PCA con sus precios aproximados.

### Yu-Gi-Oh!
- **Fotos reales** de cada impresión (set, idioma, rareza y edición) sacadas de los escaneos de [Yugipedia](https://yugipedia.com), en vez de las imágenes de YGOPRODeck, que son réplicas («Not For Use in Sanctioned Tournaments»). Si no hay foto de esa impresión, se muestra la réplica con un aviso.
- **Varias impresiones con el mismo código** (p. ej. LOB-EN001 original, reimpresión y 25 aniversario): se elige la tuya tocando su foto y el precio cambia.
- **Precio y rareza de cada impresión** desde TCGplayer, separados por edición (1ª edición, ilimitada…). Corrige las rarezas erróneas de YGOPRODeck («New», «2», Common donde es Ultra Rare…) y añade las que faltan (p. ej. las 7 rarezas de las Rarity Collection). Las impresiones que TCGplayer no vende (europeas antiguas como LOB-E001) muestran un precio orientativo marcado con «≈».
- **Overframe (Extended Art):** las versiones con el dibujo fuera del marco salen como versión aparte, con su propio precio, su foto (los escaneos «-EA» de Yugipedia) y la etiqueta 🖼️ Overframe en la ficha, el selector de versiones (filtro «Overframe»), la expansión y la colección. Al abrirlas desde la colección se abre la versión Overframe guardada, no la normal.
- **Códigos japoneses y de Asia (OCG):** LOSP-JP004, LOCH-KR001, RC04-AE001… se buscan en las listas de cada expansión de Yugipedia (nombre, rarezas y si es Overframe), con la foto japonesa y el precio de la versión inglesa como referencia (Cardmarket y TCGplayer no venden cartas del OCG). Se pueden guardar en la colección.
- **Starlight Rare:** etiqueta ✨ Starlight en la ficha, las versiones, la expansión y la colección (junto a 🖼️ Overframe si es las dos cosas).
- **Grand Master Rare:** se ven con la etiqueta 🏆 GMR, su foto propia (escaneos «GMR» de Yugipedia) y se pueden añadir a la colección aunque no tengan precio público.
- **Otros idiomas:** se puede buscar por código en alemán, francés, italiano, portugués o español (LOB-DE001, LOB-FR001, LOB-IT001, LOB-PT001, LOB-SP001 y los antiguos LOB-G001…) o por el nombre de la carta en esos idiomas. Cada carta muestra su nombre en los 5 idiomas.

## De dónde salen los precios (sin API keys)
- Pokémon: [TCGdex](https://tcgdex.dev) · Magic: [Scryfall](https://scryfall.com/docs/api) — en directo.
- Yu-Gi-Oh!: datos de la carta y versiones de [YGOPRODeck](https://ygoprodeck.com/api-guide/) (en directo); precio y rareza de cada impresión de TCGplayer (`data/ygo/`, actualizado cada día); fotos y nombres en otros idiomas de [Yugipedia](https://yugipedia.com).
- Resto de juegos: la **GitHub Action** `Actualizar precios` se ejecuta cada día, descarga la guía de precios pública de **Cardmarket** y los datos de TCGplayer ([tcgcsv.com](https://tcgcsv.com)) y guarda `data/<juego>.json`.
- Para actualizar a mano: pestaña **Actions → Actualizar precios → Run workflow**. En «Solo este juego» puedes poner uno (p. ej. `yugioh`) o dejarlo vacío para todos.

Duel Masters no está en Cardmarket ni en TCGplayer, así que no hay precios públicos.
