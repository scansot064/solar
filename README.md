# Solar

Proyecto de recorrido solar durante un día según latitud y fecha. La interfaz está disponible en español e inglés; usa los catálogos `locales/es.json` y `locales/en.json`.

Como la aplicación carga los catálogos y `ciudades.json` con `fetch`, ejecútala desde un servidor web (no abras `index.html` directamente como archivo). Por ejemplo:

```sh
python3 -m http.server
```

Después, abre `http://localhost:8000`. Los estilos están en `style.css` y la lógica de la aplicación y sus importaciones están en `src/main.js`.

La imagen principal está guardada en `assets/iss-earth.jpg` (24 KB), por lo que también se sirve desde GitHub Pages sin depender de un servicio de imágenes externo. Se acredita a NASA y procede del [vídeo de la Tierra desde la ISS (Expedition 65)](https://images.nasa.gov/details/jsc2022m000172_Earth_in_4K_Expedition_65_Edition). Se usa el fotograma y no el vídeo de fondo para mantener una carga ligera: la variante de vídeo disponible supera los 240 MB. La tipografía Space Grotesk y DM Sans se carga desde Google Fonts, con alternativas del sistema si el servicio no está disponible.

El contenido original de este proyecto está bajo la licencia [Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/). Se excluyen los recursos y componentes de terceros, que conservan sus respectivas licencias; consulta sus avisos de origen.

## Solar

Explore the Sun's path throughout the day by latitude and date. The interface is available in Spanish and English, using the `locales/es.json` and `locales/en.json` catalogs.

The app loads the catalogs and `ciudades.json` with `fetch`, so run it from a web server rather than opening `index.html` directly. For example:

```sh
python3 -m http.server
```

Then open `http://localhost:8000`. Styles are in `style.css`; application logic and module orchestration are in `src/main.js`.

The hero image is checked into `assets/iss-earth.jpg` (24 KB), so it is served by GitHub Pages without relying on an external image host. It is credited to NASA and comes from the [Earth from Space (ISS Expedition 65) video](https://images.nasa.gov/details/jsc2022m000172_Earth_in_4K_Expedition_65_Edition). The still frame is used instead of the video background to keep the page lightweight: the available video variant is over 240 MB. Space Grotesk and DM Sans load from Google Fonts, with system fallbacks when that service is unavailable.

The original content of this project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/). Third-party assets and components are excluded and remain under their respective licenses; consult their source notices.
