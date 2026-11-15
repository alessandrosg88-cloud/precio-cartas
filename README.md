# 🔎 Precio Cartas

Web muy sencilla para ver el precio de una carta escribiendo su código.

Funciona con **Pokémon**, **Yu-Gi-Oh!** y **Magic: The Gathering**.

## Cómo se usa
1. Elige el juego.
2. Escribe el código que viene impreso en la carta:
   - Pokémon: `PAL 125`, `sv3-125` o el nombre
   - Yu-Gi-Oh!: `LOB-EN001` (también `LOB-SP001`) o el nombre en inglés
   - Magic: `MH3 123` o el nombre en inglés
   - O pulsa 📷 para **escanear el código con la cámara** (o subir una foto).
3. Pulsa **Buscar** y verás el precio de Cardmarket (€) y TCGplayer ($).

## Datos
El precio principal es el de **Cardmarket (€)**. Se consulta en directo cada vez que buscas o pulsas 🔄 *Actualizar precio*. No hace falta ninguna API key.

Precios de APIs públicas y gratuitas: [pokemontcg.io](https://pokemontcg.io), [YGOPRODeck](https://ygoprodeck.com/api-guide/) y [Scryfall](https://scryfall.com/docs/api). Los precios son orientativos.

Todo está en un solo archivo: `index.html`.
