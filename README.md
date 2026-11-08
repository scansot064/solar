# Solar

Proyecto de recorrido solar durante un día según latitud y fecha. La interfaz está disponible en español e inglés; usa los catálogos `locales/es.json` y `locales/en.json`.

Como la aplicación carga los catálogos y `ciudades.json` con `fetch`, ejecútala desde un servidor web (no abras `index.html` directamente como archivo). Por ejemplo:

```sh
python3 -m http.server
```

Después, abre `http://localhost:8000`. Los estilos están en `style.css` y el comportamiento en `app.js`.

## Solar

Explore the Sun's path throughout the day by latitude and date. The interface is available in Spanish and English, using the `locales/es.json` and `locales/en.json` catalogs.

The app loads the catalogs and `ciudades.json` with `fetch`, so run it from a web server rather than opening `index.html` directly. For example:

```sh
python3 -m http.server
```

Then open `http://localhost:8000`. Styles are in `style.css`; application logic is in `app.js`.
