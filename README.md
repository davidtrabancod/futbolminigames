# Futbolín Kids Arena

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

## Despliegue en Vercel

El proyecto incluye funciones en `api/` para cuentas, ranking y partidas. Configura `DATABASE_URL` en el entorno de Vercel y vuelve a desplegar. El juego principal usa `js/games/penaltis.js`, `js/online.js` y `js/keepers.js`.
