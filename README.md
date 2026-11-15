# 🔎 Precio Cartas

Web muy sencilla para ver el precio de una carta escribiendo (o escaneando) su código.

**Juegos:** Pokémon · Yu-Gi-Oh! · Magic · One Piece · Dragon Ball (Fusion World y Masters) · Digimon · Lorcana · Gundam · League of Legends (Riftbound) · Weiß Schwarz · World of Warcraft · Duel Masters (solo enlaces de búsqueda)

## Qué hace
- Busca por **código** o por **nombre**. También con 📷 **la cámara** (o subiendo una foto).
- Muestra el precio de **Cardmarket (€)** y **TCGplayer ($)**.
- **Versiones y rarezas:** con las flechas ‹ ›, deslizando el dedo o con ← → cambias entre las versiones de la carta (ediciones, rarezas, alt art, paralelas…) y se actualiza la imagen y el precio.
- **Ver la expansión entera:** todas las cartas del set, ordenables por precio.
- **Gradeo:** enlaces a PSA, CGC, Beckett, SGC, TAG y PCA con sus precios aproximados.

## De dónde salen los precios (sin API keys)
- Pokémon: [TCGdex](https://tcgdex.dev) · Yu-Gi-Oh!: [YGOPRODeck](https://ygoprodeck.com/api-guide/) · Magic: [Scryfall](https://scryfall.com/docs/api) — en directo.
- Resto de juegos: la **GitHub Action** `Actualizar precios` se ejecuta cada día, descarga la guía de precios pública de **Cardmarket** y los datos de TCGplayer ([tcgcsv.com](https://tcgcsv.com)) y guarda `data/<juego>.json`.

Duel Masters no está en Cardmarket ni en TCGplayer, así que no hay precios públicos.
