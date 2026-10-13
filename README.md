# ⚽ Futbolín Kids Arena (HTML5 & Canvas)

Plataforma web de minijuegos de fútbol orientada a móviles y diseñada especialmente para niños, con rendimiento nativo a **60 FPS** y una arquitectura de **SEO Técnico de Máximo Nivel**.

---

## 🎮 Minijuegos Incluidos

1. **⚽ Penaltis Locos**:
   - Gira Mundial con cinco paradas: Tokio, Río de Janeiro, Múnich, Milán y Madrid. Cada ciudad tiene su propio estadio, colores y guardameta.
   - Mapa de destinos con niveles bloqueados hasta superar la tanda anterior, estrellas por nivel y progreso guardado localmente.
   - Mecánica de swipe o arrastre con guía visual dinámica y diana predictiva.
   - Proyección en perspectiva 3D (reducción de escala del balón y trayectoria de parábola).
   - Portero animado con IA reflectiva que reacciona a la dirección y potencia del disparo.
   - Modos de tanda (5 disparos), rachas de gol, palos, paradas épicas y celebración con confeti.

2. **🤹 Dominadas Infinitas**:
   - Mecánica arcade de mantener el balón en el aire mediante toques precisos.
   - Física de gravedad realista, rebote elástico en paredes y control lateral según el punto del toque.
   - Bonus de estrellas doradas coleccionables (+5 pts) flotando por la pantalla.
   - Multiplicadores de combo y elogios de motivación infantil.

3. **🧤 Super Portero**:
   - Perspectiva en primera persona desde el interior de la portería.
   - Control de dos guantes de portero que siguen suavemente el toque táctil o el cursor.
   - Balones entrantes de distinta dificultad (disparos normales, curvas con efecto y tiros de fuego ultra rápidos).
   - Sistema defensivo de 3 vidas y paradas con choque de estrellas.

---

## ⚡ Arquitectura Técnica y Rendimiento

- **100% Mobile-First**: Prevención de scroll involuntario (`overscroll-behavior-y: contain`, `touch-action: none`) y adaptación automática a cualquier resolución de pantalla de smartphone o tablet.
- **Motor Gráfico en HTML5 Canvas Nativo**: Renderizado procedural fluido a 60 FPS con soporte para pantallas Retina / High-DPI (`devicePixelRatio`).
- **Audio de juego (Web Audio API)**: Genera efectos de sonido de forma procedural, sin descargar archivos.
- **Música por destino**: Reproduce un fragmento musical destacado de cada pista externa en bucle, con carga diferida; solo se solicita la pista de la ciudad seleccionada y se detiene al salir del nivel. El silencio global y la pausa también detienen la reproducción. Los enlaces de fuente, autores y licencias Creative Commons se muestran bajo el canvas.
- **Persistencia Local (LocalStorage)**: Sistema de récords (High Scores) y estrellas conseguidas guardadas en el navegador del dispositivo de forma segura y privada.
- **Preparado para PWA**: Incluye `manifest.webmanifest` e icono SVG temático para instalarse como aplicación de pantalla completa en Android e iOS.

## 🏆 Competición online

- Partidas online 1 vs 1 con tres penaltis por jugador y muerte súbita por parejas de tiros.
- La búsqueda empareja a dos jugadores reales y continúa hasta encontrar rival o hasta que se cancele.
- Partidas amistosas mediante código de invitación, sin cambios de rating.
- Cuentas con nickname y avatar, clasificación global, sesiones y resultados guardados en SQLite.
- El backend usa Node.js 22.13 o posterior, SQLite integrado (`node:sqlite`) y WebSockets (`ws`).

Para iniciar la web con el backend online, ejecuta desde la carpeta del proyecto:

```bash
npm install
npm start
```

Abre la dirección local que muestre el servidor (normalmente `http://localhost:3000`). Para ejecutar las pruebas, usa `npm test`. Live Server sirve los minijuegos locales, pero no proporciona API ni WebSockets y, por tanto, no activa las funciones online. La cola y las partidas activas viven en memoria y están pensadas para una única instancia; para jugar por internet se debe desplegar el servidor detrás de HTTPS/WSS.

---

## 🎵 Créditos de las pistas

- Tokio — *Koto performance*, interpretación de koto de Torsodog, CC BY 3.0. [Fuente y detalles](https://commons.wikimedia.org/wiki/File:Koto_performance.ogg).
- Río — *Sideways Samba*, Jason Shaw / Audionautix, CC BY 3.0. [Fuente y detalles](https://commons.wikimedia.org/wiki/File:Audionautix-com-ccby-sidewayssamba.mp3).
- Múnich — *Super Polka*, Kevin MacLeod, CC BY 3.0. [Fuente y detalles](https://commons.wikimedia.org/wiki/File:Super_Polka_(ISRC_USUAN1100056).mp3).
- Milán — *Tarantella napoletana*, United States Air Force Band / Air Force Strings, dominio público. [Fuente y detalles](https://commons.wikimedia.org/wiki/File:Tarantella.ogg).
- Madrid — *Flamenco*, FranciscoKeep DJ Producciones, CC BY 3.0. [Fuente y detalles](https://commons.wikimedia.org/wiki/File:Flamenco_sample_by_FRANCISCOKEEP.ogg).

Las pistas se sirven desde Wikimedia Commons; los enlaces de cada nivel llevan a la ficha con su atribución y términos de licencia.

## 🔍 Estrategia SEO Técnico

- **Metadatos completos**: Title, Description, Robots, Author, Theme-Color y Canonical URL.
- **Keywords estratégicas (Español & Inglés)**: *"mini juegos futbol"*, *"soccer mini games"*, *"juegos de fútbol gratis para niños"*, *"juegos de penaltis online gratis"*, *"juegos de portero de futbol"*.
- **Open Graph & Twitter Cards**: Tarjetas sociales enriquecidas para WhatsApp, Telegram, Facebook y Twitter/X.
- **Schema.org JSON-LD**:
  - `VideoGame`: Categoría, rating PEGI 3 para niños, gratis (0€), compatible con navegadores web.
  - `FAQPage`: 5 preguntas y respuestas estructuradas para obtener fragmentos enriquecidos (*Rich Snippets*) en Google.
  - `WebSite`: Definición canónica del sitio.
- **Contenido Semántico LSI & FAQ**: Sección informativa accesible con beneficios pedagógicos y acordeones semánticos (`<details>` y `<summary>`) que Googlebot indexa de manera limpia y natural.
- **Robots.txt & Sitemap.xml**: Listos para inspección en Google Search Console y Bing Webmaster Tools.

---

## 🚀 Cómo Probar los Minijuegos Locales con Live Server

1. **Con VS Code**:
   - Haz clic derecho sobre el archivo `index.html`.
   - Selecciona **"Open with Live Server"**.
   - Se abrirá en tu navegador en `http://127.0.0.1:5500` (o el puerto configurado).
   - Esta opción es solo para los minijuegos locales; usa `npm start` para las funciones online.

2. **Con Node.js (opcional)**:
   ```bash
   npx serve .
   ```

3. **En el móvil en la misma red Wi-Fi**:
   - Abre la dirección IP local de tu ordenador con el puerto (ej: `http://192.168.1.XX:5500`) en el navegador de tu teléfono móvil o tablet.

## Despliegue en Vercel

El proyecto incluye funciones en `api/` para cuentas, ranking y partidas. En Vercel, conecta el proyecto con una base de datos Neon y configura `DATABASE_URL` en **Settings > Environment Variables** para Production y Preview. Después, vuelve a desplegar. Las cuentas y partidas online se guardan en Neon; el juego consulta estas funciones periódicamente para que el estado de una partida se comparta entre distintas instancias.

Comprueba en el dominio `https://...vercel.app` que puedes registrar/iniciar sesión, ver el ranking, abrir una invitación con dos cuentas y terminar una tanda. Los partidos clasificatorios suman 24 puntos al ganador y restan 24 al otro jugador (sin bajar de cero); las amistosas no cambian el rating. Si aparece un error de base de datos, confirma que `DATABASE_URL` está disponible para el entorno de ese despliegue y vuelve a desplegar tras modificar variables.
