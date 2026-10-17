# Penalty Rush

Juego arcade de penaltis online 1 contra 1. Busca rival, invita a un amigo a una partida privada, compite por puntos y desbloquea porteros para los duelos.

## Modos de juego

- Partidas públicas contra rivales online.
- Partidas privadas con código de invitación.
- Partidas como invitado, sin sumar puntos al ranking.

## Desarrollo local

Instala las dependencias y arranca el servidor:

```bash
npm install
npm start
```

Abre la dirección local que muestre la terminal. Live Server solo sirve los archivos estáticos y no activa las cuentas, partidas ni el ranking online.

Si cambias clases de Tailwind en `index.html` o `js/`, regenera la hoja estática antes de publicar:

```bash
npm run build:css
```

## Despliegue en Vercel

El proyecto incluye funciones en `api/` para cuentas, ranking y partidas. Configura `DATABASE_URL` en el entorno de Vercel y vuelve a desplegar. El juego principal usa `js/games/penaltis.js`, `js/online.js` y `js/keepers.js`.

## Visibilidad en buscadores

La URL pública principal es `https://futbolminigames.vercel.app/`. El proyecto incluye una URL canónica, `robots.txt`, `sitemap.xml` y datos estructurados que describen el juego. Tras publicar cambios, comprueba esa URL en Google Search Console y envía `https://futbolminigames.vercel.app/sitemap.xml` desde el informe de sitemaps. Usa el informe de rendimiento para revisar consultas, clics e impresiones antes de decidir nuevas mejoras de contenido.
