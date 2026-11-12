import { AXIAL_TILT, POLAR_CIRCLE_OFFSET } from './astro.js';

const DEG_TO_RAD = Math.PI / 180;
const TILT_LATITUDES = [
  AXIAL_TILT,
  -AXIAL_TILT,
  POLAR_CIRCLE_OFFSET,
  -POLAR_CIRCLE_OFFSET
];
const GRID_OFFSETS = [-63, -42, -21, 0, 21, 42, 63];

function renderLatitudeGrid(lines) {
  return lines
    .map(
      ([start, end]) =>
        `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="var(--ac)" stroke-opacity=".6"/>`
    )
    .join('');
}

function renderSunPath(lines) {
  return lines
    .map(
      ([start, end]) =>
        `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="var(--ac)" stroke-width="1.6"/>`
    )
    .join('');
}

function renderTiltLines(projectLatitude) {
  return TILT_LATITUDES.map(latitude => {
    const [start, end] = projectLatitude(latitude);
    return `
      <line
        x1="${start[0]}"
        y1="${start[1]}"
        x2="${end[0]}"
        y2="${end[1]}"
        stroke="var(--mu)"
        stroke-dasharray="3 3"
        stroke-opacity=".8"
      />
    `;
  }).join('');
}

function renderObserverMarker({ x, y, latitudeAngle }) {
  const dx = 14 * Math.sin(latitudeAngle);
  const dy = 14 * Math.cos(latitudeAngle);

  return [
    `<line x1="${x - dx}" y1="${y - dy}" x2="${x + dx}" y2="${y + dy}" stroke="var(--bl)" stroke-width="1.4"/>`,
    `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--bl)" stroke="var(--bg)" stroke-width="1.5"/>`,
    `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="var(--bl)" stroke-opacity=".5"/>`
  ].join('');
}

function renderBase({ latitudeGrid, sunPath, tiltLines, referenceLines, observerMarker }) {
  return (
    renderLatitudeGrid(latitudeGrid) +
    referenceLines +
    renderTiltLines(tiltLines) +
    renderSunPath(sunPath) +
    observerMarker
  );
}

function renderSvg(content) {
  const label = content.translate('earth.section');

  return `
    <svg
      viewBox="0 0 260 200"
      font-size="9"
      fill="currentColor"
      role="img"
      aria-label="${label}"
    >
      <title>${label}</title>
      ${content.markup}
    </svg>
  `;
}

function renderElevation(latitude, declination, { translate, formatNumber }, kind) {
  const elevation = 90 - Math.abs(latitude - declination);
  const sunElevation =
    elevation > 0
      ? translate('earth.elevation', { value: formatNumber(elevation, 0) })
      : translate('earth.noSun');

  if (kind === 'sol') {
    const tilt =
      Math.abs(declination) < 1
        ? translate('earth.solarAxisStill')
        : translate('earth.axisTilt', {
            degrees: formatNumber(Math.abs(declination)),
            direction: translate(declination > 0 ? 'earth.axisToward' : 'earth.axisAway') + ' '
          });

    return translate(
      'earth.solIntro',
      {
        tilt,
        declination: formatNumber(declination),
        latitude: Math.abs(latitude),
        hemisphere: latitude >= 0 ? 'N' : 'S',
        elevation: sunElevation
      },
      ['elevation']
    );
  }

  return translate(
    'earth.tierraIntro',
    {
      declination: formatNumber(declination),
      latitude: Math.abs(latitude),
      hemisphere: latitude >= 0 ? 'N' : 'S',
      elevation: sunElevation
    },
    ['elevation']
  );
}

export function renderEarthSol({ latitude, declination, helpers }) {
  const radius = 70;
  const centerX = 95;
  const centerY = 100;
  const declinationRad = declination * DEG_TO_RAD;
  const project = (angle, scale = radius, side = 0) => {
    const direction = side ? Math.PI - angle * DEG_TO_RAD : angle * DEG_TO_RAD;
    const theta = direction - declinationRad;
    return [
      centerX + scale * Math.cos(theta),
      centerY - scale * Math.sin(theta)
    ];
  };

  let markup = `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="var(--day)" stroke="var(--mu)"/>`;
  markup += `<path d="M${centerX} ${centerY - radius}A${radius} ${radius} 0 0 0 ${centerX} ${centerY + radius}Z" fill="var(--night)"/>`;

  const latitudeGrid = GRID_OFFSETS.map(offset => [
    [225, centerY - offset],
    [centerX + Math.sqrt(radius * radius - offset * offset), centerY - offset]
  ]);
  const northAxisStart = project(90, radius + 10);
  const northAxisEnd = project(-90, radius + 10);
  const axis = `
    <line
      x1="${northAxisStart[0]}"
      y1="${northAxisStart[1]}"
      x2="${northAxisEnd[0]}"
      y2="${northAxisEnd[1]}"
      stroke="var(--fg)"
      stroke-width="1.5"
    />
  `;
  const equatorStart = project(0);
  const equatorEnd = project(0, radius, 1);
  const equator = `<line x1="${equatorStart[0]}" y1="${equatorStart[1]}" x2="${equatorEnd[0]}" y2="${equatorEnd[1]}" stroke="var(--mu)"/>`;
  const referenceLines = axis + equator;
  const tiltLines = angle => [project(angle), project(angle, radius, 1)];
  const latitudeAngle = latitude * DEG_TO_RAD - declinationRad;
  const [observerX, observerY] = project(latitude);
  const sunPath =
    Math.cos(latitudeAngle) > 0 ? [[[225, observerY], [observerX, observerY]]] : [];
  const observerMarker = renderObserverMarker({
    x: observerX,
    y: observerY,
    latitudeAngle
  });

  markup += renderBase({ latitudeGrid, sunPath, tiltLines, referenceLines, observerMarker });

  const north = project(90, radius + 19);
  const south = project(-90, radius + 19);
  markup += `<text x="${north[0]}" y="${north[1] + 3}" text-anchor="middle" font-weight="700">N</text>`;
  markup += `<text x="${south[0]}" y="${south[1] + 3}" text-anchor="middle" font-weight="700">S</text>`;
  markup += `
    <text
      x="${centerX + 30}"
      y="${centerY + radius + 22}"
      text-anchor="middle"
      fill="var(--mu)"
    >${helpers.translate('svg.day')}</text>
  `;
  markup += `
    <text
      x="${centerX - 30}"
      y="${centerY + radius + 22}"
      text-anchor="middle"
      fill="var(--mu)"
    >${helpers.translate('svg.night')}</text>
  `;

  const sunX = 235;
  const sunIcon = [
    `<circle cx="${sunX}" cy="${centerY + 5}" r="8" fill="var(--day)"/>`,
    `
      <g stroke="var(--day)" stroke-width="1.5">
        <path d="M${sunX} ${centerY - 8}v-5m0 36v-5m-13-13h-5m36 0h-5m-22-9-4-4m26 26-4-4m0-18 4-4m-26 26 4-4"/>
      </g>
    `,
    `
      <text x="${sunX}" y="${centerY + 40}" text-anchor="middle" fill="var(--mu)">
        ${helpers.translate('svg.fixedSun')}
      </text>
    `
  ].join('');
  markup += sunIcon;

  const svg = renderSvg({ markup, translate: helpers.translate });
  return svg + `<div class="mu">${renderElevation(latitude, declination, helpers, 'sol')}</div>`;
}

export function renderEarthTierra({ latitude, declination, helpers }) {
  const radius = 70;
  const centerX = 70;
  const centerY = 100;
  const declinationRad = declination * DEG_TO_RAD;
  const sinDeclination = Math.sin(declinationRad);
  const cosDeclination = Math.cos(declinationRad);
  const project = (angle, scale = radius) => [
    centerX + scale * Math.cos(angle * DEG_TO_RAD),
    centerY - scale * Math.sin(angle * DEG_TO_RAD)
  ];

  const dayStart = [
    centerX - radius * sinDeclination,
    centerY - radius * cosDeclination
  ];
  const dayEnd = [
    centerX + radius * sinDeclination,
    centerY + radius * cosDeclination
  ];
  let markup = `
    <circle
      cx="${centerX}"
      cy="${centerY}"
      r="${radius}"
      fill="var(--night)"
      stroke="var(--mu)"
    />
    <path
      d="M${dayStart[0]} ${dayStart[1]}A${radius} ${radius} 0 0 1 ${dayEnd[0]} ${dayEnd[1]}Z"
      fill="var(--day)"
      stroke="var(--mu)"
    />
  `;

  const latitudeGrid = GRID_OFFSETS.map(offset => {
    const halfChord = Math.sqrt(radius * radius - offset * offset);
    const projectedX = -sinDeclination * offset + halfChord * cosDeclination;
    const projectedY = cosDeclination * offset + halfChord * sinDeclination;
    return [
      [
        centerX + projectedX + 140 * cosDeclination,
        centerY - projectedY - 140 * sinDeclination
      ],
      [centerX + projectedX, centerY - projectedY]
    ];
  });
  const referenceLines = `
    <line
      x1="${centerX}"
      y1="${centerY - radius - 8}"
      x2="${centerX}"
      y2="${centerY + radius + 8}"
      stroke="var(--fg)"
      stroke-width="1.5"
    />
    <line
      x1="${centerX}"
      y1="${centerY}"
      x2="${centerX + radius}"
      y2="${centerY}"
      stroke="var(--mu)"
    />
  `;
  const tiltLines = angle => [[centerX, centerY], project(angle)];
  const latitudeAngle = latitude * DEG_TO_RAD;
  const [observerX, observerY] = project(latitude);
  const sunPath =
    Math.cos(latitudeAngle - declinationRad) > 0
      ? [[[observerX, observerY], [observerX + 140 * cosDeclination, observerY - 140 * sinDeclination]]]
      : [];
  const observerMarker = renderObserverMarker({
    x: observerX,
    y: observerY,
    latitudeAngle
  });

  markup += renderBase({ latitudeGrid, sunPath, tiltLines, referenceLines, observerMarker });
  markup += `<text x="${centerX}" y="${centerY - radius - 11}" text-anchor="middle" font-weight="700">N</text>`;
  markup += `<text x="${centerX}" y="${centerY + radius + 19}" text-anchor="middle" font-weight="700">S</text>`;

  const sunX = centerX + 160 * cosDeclination;
  const sunY = centerY - 160 * sinDeclination;
  markup += `<circle cx="${sunX}" cy="${sunY}" r="8" fill="var(--day)"/>`;
  markup += `
    <g stroke="var(--day)" stroke-width="1.5">
      <path d="M${sunX} ${sunY - 13}v-5m0 36v-5m-13-13h-5m36 0h-5m-22-9-4-4m26 26-4-4m0-18 4-4m-26 26 4-4"/>
    </g>
  `;

  const svg = renderSvg({ markup, translate: helpers.translate });
  return svg + `<div class="mu">${renderElevation(latitude, declination, helpers, 'tierra')}</div>`;
}
