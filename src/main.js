import * as astro from './astro.js';
import * as earthView from './earthView.js';
import * as i18n from './i18n.js';
import * as template from './template.js';
import * as pdf from './pdf.js';

export function createApp({ state, modules }) {
  const { clamp, computeSun } = modules.astro;
  const { renderEarthSol, renderEarthTierra } = modules.earthView;
  const {
    getLanguage,
    getSavedLanguage,
    getTranslation,
    setLanguage,
    tr
  } = modules.i18n;
  const { layoutTemplate } = modules.template;
  const { genPDF, renderPdfPreviewSvg } = modules.pdf;
  const $ = id => document.getElementById(id);
  const radiansPerDegree = Math.PI / 180;

  const formatNumber = (value, digits = 1) =>
    value.toFixed(digits).replace('.', getLanguage() === 'es' ? ',' : '.');
  const formatTime = time => {
    let hour = Math.floor(time);
    let minute = Math.round((time - hour) * 60);
    if (minute === 60) {
      hour++;
      minute = 0;
    }
    return `${hour}:${String(minute).padStart(2, '0')}`;
  };

  let events = state.events;
  let solarState = state.solar;
  let selectedIndex = state.selectedIndex;
  let cities = state.cities;
  let earthViewMode = state.earthView;

  function setTheme(theme) {
    if (!['light', 'dark'].includes(theme)) {
      throw new Error(`Unsupported theme: ${theme}`);
    }

    document.documentElement.dataset.theme = theme;
    $('theme').value = theme;
    try {
      localStorage.setItem('solar-theme', theme);
    } catch (error) {
      console.warn('Could not save theme preference.', error);
    }
  }

  function getCitySummary(latitude) {
    const formatLatitude = value =>
      `${Math.abs(Math.round(value))}º ${value >= 0 ? 'N' : 'S'}`;

    if (cities === null) {
      return '';
    }
    if (!cities.length) {
      return tr('cities.unavailable');
    }

    const nearbyCities = cities
      .filter(city => Math.abs(city.lat - latitude) <= 1)
      .slice(0, 4)
      .map(city => city.nombre);
    if (nearbyCities.length) {
      return tr('cities.nearby', { names: nearbyCities.join(', ') });
    }
    if (latitude <= -62) {
      return tr('cities.antarctica');
    }
    if (latitude >= 84) {
      return tr('cities.arctic');
    }

    const closestCity = cities.reduce((closest, city) =>
      Math.abs(city.lat - latitude) < Math.abs(closest.lat - latitude) ? city : closest
    );
    if (Math.abs(closestCity.lat - latitude) <= 3) {
      return tr('cities.closest', {
        name: closestCity.nombre,
        latitude: formatLatitude(closestCity.lat)
      });
    }
    return tr('cities.empty');
  }

  function updateCities() {
    $('cities').textContent = getCitySummary(+$('lat').value);
  }

  function run(keepSelection) {
    const latitude = +$('lat').value;
    const radius = +$('R').value;
    const model = $('mode').value;
    const maxPoleHeight = +$('hmax').value;
    const {
      dayNumber,
      declination,
      dayAngle,
      events: computedEvents
    } = computeSun(latitude, $('date').value);
    const sinLatitude = Math.sin(latitude * radiansPerDegree);
    const cosLatitude = Math.cos(latitude * radiansPerDegree);
    const sinDeclination = Math.sin(declination * radiansPerDegree);
    const cosDeclination = Math.cos(declination * radiansPerDegree);

    events = computedEvents;
    state.events = events;
    events.forEach(event => {
      event.e0 = event.e;
      event.A0 = event.A;
      event.e = Math.round(event.e);
      event.A = Math.round(event.A) % 360;
    });
    events.forEach(event => {
      const elevationRadians = event.e * radiansPerDegree;
      if (model === 'cupula') {
        event.r = radius * Math.cos(elevationRadians);
        event.h = radius * Math.sin(elevationRadians);
      } else {
        event.r = radius;
        event.h = radius * Math.tan(elevationRadians);
        event.cap = event.h > maxPoleHeight;
        if (event.cap) {
          event.h = maxPoleHeight;
        }
      }
    });

    solarState = {
      lat: latitude,
      R: radius,
      mode: model,
      N: dayNumber,
      dec: declination,
      sp: sinLatitude,
      cp: cosLatitude,
      sd: sinDeclination,
      cd: cosDeclination,
      H0: dayAngle,
      hmax: maxPoleHeight
    };
    state.solar = solarState;

    $('hmax-label').hidden = model !== 'poste';
    $('sum').innerHTML = !events.length
      ? tr('summary.polarNight')
      : (dayAngle === 180 ? tr('summary.polarDay') : '') +
        tr('summary.declination', { value: formatNumber(declination) }) +
        ' · ' +
        tr('summary.daylight', { value: formatNumber(dayAngle / 7.5) });

    renderEarth();
    updateCities();
    if (!keepSelection || selectedIndex >= events.length) {
      selectedIndex = 0;
      events.forEach((event, index) => {
        if (event.e > events[selectedIndex].e) {
          selectedIndex = index;
        }
      });
    }

    draw();
    updateTemplatePreview();
    state.selectedIndex = selectedIndex;
  }

  function renderPlanSvg() {
    const radius = solarState.R;
    const viewRadius = radius + 3;
    const svgParts = [
      `<svg
        viewBox="${-viewRadius} ${-viewRadius} ${2 * viewRadius} ${2 * viewRadius}"
        font-size="${radius / 12}"
        text-anchor="middle"
        role="img"
        aria-label="${tr('results.label')}"
      >`,
      `<title>${tr('results.label')}</title>`,
      `<circle r="${radius}" fill="none" stroke="var(--ln)"/>`,
      `<circle r="${radius / 2}" fill="none" stroke="var(--ln)" stroke-dasharray="2 2"/>`,
      `<path d="M${-radius} 0H${radius}M0 ${-radius}V${radius}" stroke="var(--ln)"/>`
    ];
    const cardinalLabels = [
      ['N', 0, -radius - 1],
      ['S', 0, radius + 1.8],
      ['E', radius + 1.2, 0.4],
      [tr('pdf.west'), -radius - 1.2, 0.4]
    ];

    cardinalLabels.forEach(([label, x, y]) => {
      svgParts.push(
        `<text x="${x}" y="${y}" fill="var(--mu)" font-weight="700">${label}</text>`
      );
    });

    const points = events.map(event => [
      event.r * Math.sin(event.A * radiansPerDegree),
      -event.r * Math.cos(event.A * radiansPerDegree)
    ]);
    const pathPoints = points.map(point => point.join(',')).join(' ');
    svgParts.push(
      `<polyline points="${pathPoints}" fill="none" stroke="var(--ac)" stroke-opacity=".5" stroke-dasharray="1 .6"/>`
    );

    events.forEach((event, index) => {
      const [x, y] = points[index];
      const color = event.z ? 'var(--bl)' : 'var(--ac)';
      const labelX = x + Math.sin(event.A * radiansPerDegree) * 1.3;
      const labelY = y - Math.cos(event.A * radiansPerDegree) * 1.3 + 0.35;
      const markerRadius = index === selectedIndex ? 0.6 : 0.4;
      const markerStroke = index === selectedIndex ? 'var(--fg)' : 'none';
      const label = event.z ? tr(`event.${event.tag}`) : `${Math.round(event.t)}h`;

      svgParts.push(
        `<circle cx="${x}" cy="${y}" r="${markerRadius}" fill="${color}" stroke="${markerStroke}" stroke-width=".15"/>`,
        `<text x="${labelX}" y="${labelY}" fill="${color}">${label}</text>`
      );
    });

    svgParts.push(
      `<circle r=".5" fill="var(--fg)"/>`,
      `<text y="1.6" fill="var(--mu)">${tr('pdf.observer')}</text>`,
      '</svg>'
    );
    return svgParts.join('');
  }

  function renderEventTable() {
    const headers = [
      tr('table.time'),
      tr('table.elevation'),
      tr('table.azimuth')
    ];
    if (solarState.mode === 'cupula') {
      headers.push(tr('table.distance'));
    }
    headers.push(tr('table.pole'));

    const headerHtml = headers.map(label => `<th>${label}</th>`).join('');
    const rows = events.map((event, index) => {
      const selectedClass = index === selectedIndex ? 'sel' : '';
      const timeLabel = `${formatTime(event.t)}${event.tag ? ` ${tr(`event.${event.tag}`)}` : ''}`;
      const distanceCell =
        solarState.mode === 'cupula' ? `<td>${formatNumber(event.r)}</td>` : '';
      const cappedMarker = event.cap ? ' *' : '';

      return `
        <tr data-i="${index}" tabindex="0" class="${selectedClass}">
          <td>${timeLabel}</td>
          <td>${formatNumber(event.e, 0)}º</td>
          <td>${formatNumber(event.A, 0)}º</td>
          ${distanceCell}
          <td>${formatNumber(event.h)}${cappedMarker}</td>
        </tr>
      `;
    });
    const tableNote =
      tr('table.solarTime') +
      ' ' +
      tr('table.rounding') +
      ' ' +
      tr('table.rowHelp') +
      (events.some(event => event.cap) ? tr('table.trimmed') : '');

    return [
      `<table class="solar-table"><thead><tr>${headerHtml}</tr></thead><tbody>`,
      rows.join(''),
      '</tbody></table>',
      `<p class="mu noprint table-note">${tableNote}</p>`
    ].join('');
  }

  function draw() {
    if (!events.length) {
      $('plan').innerHTML = '';
      $('tab').innerHTML = '';
      $('steps').innerHTML = '';
      $('craft').innerHTML = '';
      return;
    }

    $('plan').innerHTML = renderPlanSvg();
    $('tab').innerHTML = renderEventTable();
    renderSteps();
  }

  function renderSteps() {
    const event = events[selectedIndex];
    const {
      lat: latitude,
      R: radius,
      N: dayNumber,
      dec: declination,
      sp: sinLatitude,
      cp: cosLatitude,
      sd: sinDeclination,
      cd: cosDeclination
    } = solarState;
    const cosineAzimuth = Math.cos(event.A0 * radiansPerDegree);
    const azimuthDenominator = Math.cos(event.e * radiansPerDegree) * cosLatitude;
    const azimuthAngle = Math.acos(clamp(cosineAzimuth, -1, 1)) / radiansPerDegree;
    const afternoonText =
      event.H > 0 ? tr('steps.afternoon', { angle: formatNumber(azimuthAngle) }) : '';

    const elevationExplanation = tr('steps.elevation', {
      latitude,
      sinLat: formatNumber(sinLatitude, 3),
      sinDec: formatNumber(sinDeclination, 3),
      cosLat: formatNumber(cosLatitude, 3),
      cosDec: formatNumber(cosDeclination, 3),
      cosHour: formatNumber(Math.cos(event.H * radiansPerDegree), 3),
      sine: formatNumber(event.se, 3),
      exact: formatNumber(event.e0),
      rounded: formatNumber(event.e, 0)
    });
    const azimuthExplanation =
      azimuthDenominator > 1e-6
        ? tr('steps.azimuth', {
            cosine: formatNumber(cosineAzimuth, 3),
            angle: formatNumber(azimuthAngle),
            afternoon: afternoonText,
            actual: formatNumber(event.A0),
            rounded: formatNumber(event.A, 0)
          })
        : tr('steps.azimuthUndefined');
    const explanationParts = [
      `<b>${tr('steps.title', { time: formatTime(event.t) })}</b>`,
      `<p>${tr('steps.declination', { day: dayNumber, value: formatNumber(declination, 2) })}</p>`,
      `<p>${tr('steps.hourAngle', { time: formatNumber(event.t, 2), value: formatNumber(event.H) })}</p>`,
      `<p>${elevationExplanation}</p>`,
      `<p>${azimuthExplanation}</p>`
    ];

    if (solarState.mode === 'cupula') {
      explanationParts.push(
        `<p>${tr('steps.dome', {
          radius,
          elevation: formatNumber(event.e, 0),
          sin: formatNumber(Math.sin(event.e * radiansPerDegree), 3),
          height: formatNumber(event.h),
          cos: formatNumber(Math.cos(event.e * radiansPerDegree), 3),
          distance: formatNumber(event.r),
          azimuth: formatNumber(event.A, 0)
        })}</p>`
      );
    } else {
      explanationParts.push(
        `<p>${tr('steps.pole', {
          radius,
          elevation: formatNumber(event.e, 0),
          tan: formatNumber(Math.tan(event.e * radiansPerDegree), 3),
          height: formatNumber(radius * Math.tan(event.e * radiansPerDegree)),
          capped: event.cap ? tr('steps.capped', { height: solarState.hmax }) : ''
        })}</p>`
      );
    }

    $('steps').innerHTML = explanationParts.join('');
    renderCraftInstructions();
  }

  function renderEarth() {
    const renderOptions = {
      latitude: +$('lat').value,
      declination: solarState.dec,
      helpers: { translate: tr, formatNumber }
    };
    $('earth').innerHTML =
      earthViewMode === 'sol'
        ? renderEarthSol(renderOptions)
        : renderEarthTierra(renderOptions);
  }

  let dragging = false;
  const earthElement = $('earth');
  let latitudeUpdateTimer;

  function scheduleLatitudeUpdate() {
    clearTimeout(latitudeUpdateTimer);
    latitudeUpdateTimer = setTimeout(() => {
      run(false);
      latitudeUpdateTimer = null;
    }, 120);
  }

  function pickLatitude(pointerEvent) {
    const fixedSun = earthViewMode === 'sol';
    const centerX = fixedSun ? 95 : 70;
    const bounds = earthElement.querySelector('svg').getBoundingClientRect();
    const x = ((pointerEvent.clientX - bounds.left) * 260) / bounds.width - centerX;
    const y = 100 - ((pointerEvent.clientY - bounds.top) * 200) / bounds.height;
    const latitudeAngle =
      Math.atan2(y, fixedSun ? x : Math.max(x, 0)) / radiansPerDegree +
      (fixedSun ? solarState.dec : 0);

    $('lat').value = Math.max(-90, Math.min(90, Math.round(latitudeAngle)));
    scheduleLatitudeUpdate();
  }

  earthElement.addEventListener('pointerdown', pointerEvent => {
    dragging = true;
    earthElement.setPointerCapture(pointerEvent.pointerId);
    pickLatitude(pointerEvent);
  });
  earthElement.addEventListener('pointermove', pointerEvent => {
    if (dragging) {
      pickLatitude(pointerEvent);
    }
  });
  addEventListener('pointerup', () => {
    dragging = false;
  });

  function renderCraftInstructions() {
    if (!events.length) {
      $('craft').innerHTML = '';
      return;
    }

    const event = events[selectedIndex];
    const radius = solarState.R;
    const isDome = solarState.mode === 'cupula';
    const azimuth = event.A;
    const maxHeight = Math.max(...events.map(item => item.h));
    const requiredLength = Math.ceil(maxHeight) + 3;
    const direction =
      azimuth <= 180
        ? `${formatNumber(azimuth, 0)}º ${tr('craft.right')}`
        : tr('craft.left', {
            azimuth: formatNumber(azimuth, 0),
            remainder: formatNumber(360 - azimuth, 0)
          });
    const renderList = keys => keys.map(key => `<li>${tr(key)}</li>`).join('');
    const baseSteps = renderList(['craft.base1', 'craft.base2', 'craft.base3']);
    const azimuthSteps = renderList(['craft.azimuth3', 'craft.azimuth4']);
    const reflectionQuestions = renderList([
      'craft.question1',
      'craft.question2',
      'craft.question3',
      'craft.question4',
      'craft.question5',
      'craft.question6'
    ]);
    const distanceInstructions = isDome
      ? tr('craft.distanceDome', { distance: formatNumber(event.r) })
      : tr('craft.distancePole', { radius });
    const horizonNote = event.h < 0.05 ? tr('craft.horizon') : '';

    $('craft').innerHTML = `
      <h2>${tr('craft.title')}</h2>
      <p class="mu">${tr('craft.materials', { size: 2 * radius + 6, length: requiredLength })}</p>
      <h3>${tr('craft.baseTitle')}</h3>
      <ol>${baseSteps}</ol>
      <h3>${tr('craft.azimuthTitle')}</h3>
      <p>${tr('craft.azimuthIntro')}</p>
      <ol>
        <li>${tr('craft.azimuth1')}</li>
        <li>${tr('craft.azimuth2', {
          time: formatTime(event.t),
          azimuth: formatNumber(azimuth, 0),
          direction
        })}</li>
        ${azimuthSteps}
      </ol>
      <h3>${tr('craft.distanceTitle')}</h3>
      <ol>
        <li>${distanceInstructions}</li>
        <li>${tr('craft.distance2')}</li>
      </ol>
      <h3>${tr('craft.heightTitle')}</h3>
      <ol>
        <li>${tr('craft.height1', { height: formatNumber(event.h), horizon: horizonNote })}</li>
        <li>${tr('craft.height2')}</li>
        <li>${tr('craft.height3', { elevation: formatNumber(event.e, 0) })}</li>
      </ol>
      <h2 class="reflection-title">${tr('craft.questionsTitle')}</h2>
      <ol>${reflectionQuestions}</ol>
    `;
  }

  function getTemplateInput() {
    const citySummary =
      Array.isArray(cities) && cities.length
        ? getCitySummary(solarState.lat)
        : tr('pdf.citiesUnavailable');

    return {
      state: {
        events,
        radius: solarState.R,
        model: solarState.mode,
        latitude: solarState.lat,
        declination: solarState.dec,
        daylightAngle: solarState.H0,
        date: $('date').value
      },
      options: {
        paper: $('paper').value,
        cropCircle: $('crop-circle').checked,
        language: getLanguage()
      },
      helpers: {
        translate: tr,
        formatNumber,
        formatTime,
        citySummary
      }
    };
  }

  function updateTemplatePreview() {
    const layout = layoutTemplate(getTemplateInput());
    $('crop-circle').disabled = solarState.mode !== 'cupula';

    if (!layout) {
      $('tinfo').innerHTML = tr('pdf.noSun');
      $('tprev').innerHTML = '';
      return;
    }

    const sizeMessage =
      layout.Rc < layout.R0
        ? tr('pdf.reduced', {
            radius: formatNumber(layout.R0),
            factor: formatNumber(layout.k, 2)
          })
        : layout.Rc > layout.R0
          ? tr('pdf.enlarged', {
              radius: formatNumber(layout.R0),
              factor: formatNumber(layout.k, 2)
            })
          : tr('pdf.unchanged');
    const cropNotice =
      $('crop-circle').checked && solarState.mode === 'cupula'
        ? ` · ${tr('pdf.cropNotice')}`
        : '';
    const orientation = tr(layout.land ? 'pdf.landscape' : 'pdf.portrait');

    $('tinfo').innerHTML =
      tr('pdf.preview', {
        paper: layout.pk,
        orientation,
        radius: formatNumber(layout.Rc)
      }) +
      sizeMessage +
      cropNotice +
      tr('pdf.points');
    $('tprev').innerHTML = renderPdfPreviewSvg(layout);
  }

  function generatePDF(open) {
    genPDF({
      open,
      template: getTemplateInput(),
      latitude: solarState.lat,
      date: $('date').value,
      translate: tr
    });
  }

  $('paper').addEventListener('input', updateTemplatePreview);
  $('crop-circle').addEventListener('change', updateTemplatePreview);
  $('bpdf').addEventListener('click', () => generatePDF(false));
  $('bpdfo').addEventListener('click', () => generatePDF(true));
  $('tab').addEventListener('click', domEvent => {
    const row = domEvent.target.closest('tr[data-i]');
    if (row) {
      selectedIndex = +row.dataset.i;
      state.selectedIndex = selectedIndex;
      draw();
    }
  });
  $('tab').addEventListener('keydown', domEvent => {
    if (
      (domEvent.key === 'Enter' || domEvent.key === ' ') &&
      domEvent.target.matches('tr[data-i]')
    ) {
      domEvent.preventDefault();
      domEvent.target.click();
    }
  });
  $('language').addEventListener('change', async domEvent => {
    try {
      await switchLanguage(domEvent.target.value);
    } catch (error) {
      console.error(error);
      $('language').value = getLanguage();
      $('status').textContent = getTranslation('language.loadError') || error.message;
      $('status').hidden = false;
    }
  });

  async function switchLanguage(language) {
    await setLanguage(language);
    run(true);
  }

  $('theme').addEventListener('change', domEvent => setTheme(domEvent.target.value));
  $('rnd').addEventListener('click', () => {
    clearTimeout(latitudeUpdateTimer);
    latitudeUpdateTimer = null;

    const year = new Date().getFullYear();
    const start = Date.UTC(year, 0, 1);
    const days = (Date.UTC(year + 1, 0, 1) - start) / 864e5;
    $('lat').value = Math.floor(Math.random() * 181) - 90;
    $('date').value = new Date(start + Math.floor(Math.random() * days) * 864e5)
      .toISOString()
      .slice(0, 10);
    run(false);
  });
  $('lat').addEventListener('input', scheduleLatitudeUpdate);
  $('lat').addEventListener('change', () => {
    clearTimeout(latitudeUpdateTimer);
    latitudeUpdateTimer = null;
    run(false);
  });
  ['date', 'R', 'mode', 'hmax'].forEach(id => {
    $(id).addEventListener('input', () => run(false));
  });

  document.querySelectorAll('#etg button').forEach((button, _, buttons) => {
    button.addEventListener('click', () => {
      earthViewMode = button.dataset.v;
      state.earthView = earthViewMode;
      buttons.forEach(viewButton => {
        const isSelected = viewButton === button;
        viewButton.classList.toggle('on', isSelected);
        viewButton.setAttribute('aria-pressed', String(isSelected));
      });
      renderEarth();
    });
  });

  try {
    const savedTheme = localStorage.getItem('solar-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
  } catch (error) {
    console.warn('Could not read saved theme preference.', error);
  }

  setLanguage(getSavedLanguage())
    .then(() => {
      run(true);
      fetch('ciudades.json')
        .then(response => {
          if (!response.ok) {
            throw new Error(`Could not load ciudades.json (${response.status})`);
          }
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data)) {
            throw new Error('ciudades.json must contain an array');
          }
          cities = data;
          state.cities = cities;
          updateCities();
          renderEarth();
        })
        .catch(error => {
          console.error(error);
          cities = [];
          state.cities = cities;
          updateCities();
          renderEarth();
        });
    })
    .catch(error => {
      console.error(error);
      $('status').textContent = error.message;
      $('status').hidden = false;
    });

  return { run, switchLanguage, generatePDF, state };
}

const state = {
  events: [],
  solar: {},
  selectedIndex: 0,
  cities: null,
  earthView: 'sol'
};

const solarApp = createApp({
  state,
  modules: { astro, earthView, i18n, template, pdf }
});

window.solarApp = solarApp;
window.runSolar = solarApp.run;
window.setSolarLanguage = solarApp.switchLanguage;
window.generateSolarPdf = solarApp.generatePDF;
