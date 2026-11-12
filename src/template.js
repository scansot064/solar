const RAD = Math.PI / 180;
const PAPER_SIZES = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [215.9, 279.4],
  Ledger: [279.4, 431.8]
};
const TEMPLATE_CACHE_LIMIT = 12;
const templateCache = new Map();

function boxOverlaps(a, b) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function formatLabelLines(event, scale, { formatTime, formatNumber, translate }) {
  const lines = [formatTime(event.t)];
  if (event.z) {
    lines.push(translate(`event.${event.tag}`));
  }
  lines.push(`${formatNumber(event.h * scale)} cm${event.cap ? '*' : ''}`);
  return lines;
}

export function placeLabel({ event, x, y, scale, occupiedBoxes, helpers }) {
  const lines = formatLabelLines(event, scale, helpers);
  const width = Math.max(...lines.map(line => line.length)) * 1.5 + 1;
  const height = lines.length * 3.3;
  const horizontalDirection = Math.sin(event.A * RAD);
  const verticalDirection = -Math.cos(event.A * RAD);
  const directions = [
    [horizontalDirection, verticalDirection],
    [-horizontalDirection, -verticalDirection],
    [-verticalDirection, horizontalDirection],
    [verticalDirection, -horizontalDirection]
  ];
  let fallback;

  for (const [directionX, directionY] of directions) {
    const labelX = x + directionX * 2.8;
    const labelY = y + directionY * 2.8;
    const align =
      directionX > 0.35 ? 'start' : directionX < -0.35 ? 'end' : 'middle';
    const left =
      align === 'start'
        ? labelX
        : align === 'end'
          ? labelX - width
          : labelX - width / 2;
    const top =
      directionY < -0.5
        ? labelY - height
        : directionY > 0.5
          ? labelY
          : labelY - height / 2;
    const box = [left, top, left + width, top + height];
    const label = { lines, align, x: labelX, y: top + 2.4, box };

    fallback ??= label;
    if (!occupiedBoxes.some(other => boxOverlaps(other, box))) {
      return label;
    }
  }

  return fallback;
}

function wrapText(text, maxChars) {
  const result = [];
  let line = '';

  text.split(/\s+/).forEach(word => {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length > maxChars) {
      result.push(line);
      line = word;
    } else {
      line += ` ${word}`;
    }
  });

  if (line) {
    result.push(line);
  }
  return result;
}

export function findHeaderBox({
  width,
  height,
  diagramBoxes,
  tableBoxes,
  radius,
  margin,
  cropCircle,
  state,
  options,
  helpers
}) {
  const { translate, formatNumber, citySummary } = helpers;
  const originalRadius = state.radius;
  const scaledRadius = radius / 10;
  const scaling =
    scaledRadius < originalRadius
      ? translate('pdf.scaledDown', { radius: formatNumber(originalRadius) })
      : scaledRadius > originalRadius
        ? translate('pdf.scaledUp', { radius: formatNumber(originalRadius) })
        : '';
  const dateText = new Date(`${state.date}T12:00:00Z`).toLocaleDateString(
    options.language,
    { day: 'numeric', month: 'long', timeZone: 'UTC' }
  );
  const texts = [
    {
      text: translate('pdf.titleLine', {
        latitude: Math.abs(state.latitude),
        hemisphere: state.latitude >= 0 ? 'N' : 'S',
        date: dateText
      }),
      pt: 10.5,
      bold: 1,
      step: 3.7
    },
    {
      text: translate('pdf.subtitle', {
        declination: formatNumber(state.declination),
        radius: formatNumber(scaledRadius),
        scaling,
        model: translate(state.model === 'cupula' ? 'pdf.modelDome' : 'pdf.modelPole'),
        paper: options.paper
      }),
      pt: 8,
      step: 3.2
    },
    {
      text: translate('pdf.daylight', { hours: formatNumber(state.daylightAngle / 7.5) }),
      pt: 7.5,
      step: 2.8
    },
    { text: citySummary, pt: 7.5, step: 2.8 },
    {
      text: translate('pdf.instructions', {
        trimmed: state.events.some(event => event.cap) ? translate('pdf.trimmed') : ''
      }),
      pt: 8,
      step: 3.2
    },
    { text: translate('pdf.solarTime'), pt: 8, bold: 1, step: 3.2 }
  ];
  const obstacles = [
    ...diagramBoxes,
    ...tableBoxes.map(box => [box[0] - 2, box[1] - 2, box[2] + 2, box[3] + 2])
  ];
  const xCoordinates = [margin, width - margin];
  const yCoordinates = [margin, height - margin - 14];

  obstacles.forEach(box => {
    xCoordinates.push(
      Math.max(margin, Math.min(width - margin, box[0])),
      Math.max(margin, Math.min(width - margin, box[2]))
    );
    yCoordinates.push(
      Math.max(margin, Math.min(height - margin - 14, box[1])),
      Math.max(margin, Math.min(height - margin - 14, box[3]))
    );
  });

  const candidates = [];
  for (const left of xCoordinates) {
    for (const right of xCoordinates) {
      if (right - left < 52) {
        continue;
      }
      for (const top of yCoordinates) {
        for (const bottom of yCoordinates) {
          const overlapsObstacle = obstacles.some(
            box => left < box[2] && right > box[0] && top < box[3] && bottom > box[1]
          );
          if (bottom - top >= 25 && !overlapsObstacle) {
            candidates.push({ x: left, y: top, w: right - left, h: bottom - top });
          }
        }
      }
    }
  }
  candidates.sort((first, second) => first.x - second.x || second.h * first.w - first.h * second.w);

  for (const box of candidates) {
    const lines = texts.map(item => ({
      ...item,
      lines: wrapText(
        item.text,
        Math.max(cropCircle ? 8 : 14, Math.floor(box.w / (item.pt * 0.18)))
      )
    }));
    lines[0].lines.slice(0, -1).forEach((line, index) => {
      if (line.endsWith(' -')) {
        lines[0].lines[index] = line.slice(0, -2);
      }
    });

    const contentHeight =
      lines.reduce((sum, item) => sum + item.lines.length * item.step + 2, 0) + 10;
    if (contentHeight > box.h) {
      continue;
    }

    const items = [];
    let y = box.y + 3;
    lines.forEach(item => {
      item.lines.forEach((line, index) => {
        items.push({
          x: box.x + 2,
          y: y + index * item.step,
          s: line,
          pt: item.pt,
          b: item.bold || 0
        });
      });
      y += item.lines.length * item.step + 2;
    });

    return {
      items,
      scale: {
        x1: box.x + 2,
        y1: y,
        x2: box.x + 52,
        y2: y,
        c: [140, 140, 140],
        label: translate('pdf.scaleCheck'),
        labelY: y + 4,
        box
      }
    };
  }

  return null;
}

function createOccupancy({ state, helpers, geometry, cardinalLabels, radius, scale }) {
  const { events } = state;
  const { inArc, gapCenter, arcStart, arcLength } = geometry;
  const points = [];
  const boxes = [];
  const placed = [];
  const labels = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pointMinX = Infinity;
  let pointMinY = Infinity;
  let pointMaxX = -Infinity;
  let pointMaxY = -Infinity;

  const addBounds = box => {
    minX = Math.min(minX, box[0]);
    minY = Math.min(minY, box[1]);
    maxX = Math.max(maxX, box[2]);
    maxY = Math.max(maxY, box[3]);
  };
  const addBox = box => {
    boxes.push(box);
    addBounds(box);
  };
  const addPointBounds = box => {
    pointMinX = Math.min(pointMinX, box[0]);
    pointMinY = Math.min(pointMinY, box[1]);
    pointMaxX = Math.max(pointMaxX, box[2]);
    pointMaxY = Math.max(pointMaxY, box[3]);
  };

  for (let degrees = 0; degrees <= arcLength; degrees += 2) {
    const angle = (arcStart + degrees) * RAD;
    const x = radius * Math.sin(angle);
    const y = -radius * Math.cos(angle);
    points.push([x, y]);
    addBounds([x, y, x, y]);
  }

  const positions = events.map(event => {
    const distance = (event.r / state.radius) * radius;
    return [
      distance * Math.sin(event.A * RAD),
      -distance * Math.cos(event.A * RAD)
    ];
  });
  positions.forEach(([x, y]) => {
    const marker = [x - 2.2, y - 2.2, x + 2.2, y + 2.2];
    addBox(marker);
    addPointBounds(marker);
    placed.push(marker);
  });

  const center = [-5, -5, 5, 5];
  addBox(center);
  addPointBounds(center);
  placed.push(center);

  const observerX = 8 * Math.sin(gapCenter);
  const observerY = -8 * Math.cos(gapCenter) + 1.2;
  const observerLabel = [observerX - 12, observerY - 4, observerX + 12, observerY + 3];
  addBox(observerLabel);
  addPointBounds(observerLabel);

  cardinalLabels.forEach(([, angle]) => {
    if (!inArc(angle)) {
      return;
    }

    const x = (radius + 6) * Math.sin(angle * RAD);
    const y = -(radius + 6) * Math.cos(angle * RAD);
    const box = [x - 3.5, y - 3.5, x + 3.5, y + 3.5];
    addBox(box);
    placed.push(box);
  });

  positions.forEach(([x, y], index) => {
    const label = placeLabel({
      event: events[index],
      x,
      y,
      scale,
      occupiedBoxes: placed,
      helpers
    });
    const box = label.box;
    placed.push(box);
    addBox(box);
    addPointBounds(box);
    labels.push(label);
  });

  return {
    points,
    boxes,
    labels,
    positions,
    bounds: [minX - 3, minY - 3, maxX + 3, maxY + 3],
    pointBounds: [pointMinX - 3, pointMinY - 3, pointMaxX + 3, pointMaxY + 3]
  };
}

function intersectsLayout(rectangle, occupancy, offsetX, offsetY) {
  for (const [x, y] of occupancy.points) {
    const translatedX = x + offsetX;
    const translatedY = y + offsetY;
    if (
      translatedX > rectangle[0] &&
      translatedX < rectangle[2] &&
      translatedY > rectangle[1] &&
      translatedY < rectangle[3]
    ) {
      return true;
    }
  }

  return occupancy.boxes.some(
    box =>
      box[0] + offsetX < rectangle[2] &&
      box[2] + offsetX > rectangle[0] &&
      box[1] + offsetY < rectangle[3] &&
      box[3] + offsetY > rectangle[1]
  );
}

function findPlacement({ width, height, columns, radius, scale, force, context }) {
  const { state, options, helpers, geometry, margin, cellWidth, cardinalLabels } = context;
  const occupancy = createOccupancy({
    state,
    helpers,
    geometry,
    cardinalLabels,
    radius,
    scale
  });
  const bounds = occupancy.bounds;
  const placementBounds = options.cropCircle ? occupancy.pointBounds : bounds;
  const boxWidth = placementBounds[2] - placementBounds[0];
  const boxHeight = placementBounds[3] - placementBounds[1];
  const availableWidth = width - 2 * margin;
  const top = margin;
  const contentBottom = height - margin - (options.cropCircle ? 14 : 0);
  const availableHeight = contentBottom - top;
  const exceedsBounds =
    !options.cropCircle &&
    (bounds[2] - bounds[0] > availableWidth ||
      bounds[3] - bounds[1] > height - margin - top);
  if (exceedsBounds || boxWidth > availableWidth || boxHeight > availableHeight) {
    return null;
  }

  const groupWidth = columns > 1 ? 64 : cellWidth;
  const groupGap = columns > 1 ? 4 : 6;
  const rowHeight = columns > 1 ? 3 : 4.2;
  const rowCount = Math.ceil(state.events.length / columns);
  const tableWidth = columns * groupWidth + (columns - 1) * groupGap;
  const tableHeight = (rowCount + 1) * rowHeight;
  const offsets = [];

  for (const fractionY of [0, 0.5, 1]) {
    for (const fractionX of [0, 0.25, 0.5, 0.75, 1]) {
      offsets.push([
        margin + fractionX * (availableWidth - boxWidth) - placementBounds[0],
        top + fractionY * (availableHeight - boxHeight) - placementBounds[1]
      ]);
    }
  }

  let best = null;
  for (const [offsetX, offsetY] of offsets) {
    const northBox = geometry.includesNorth
      ? [offsetX - 3.5, offsetY - radius - 9.5, offsetX + 3.5, offsetY - radius - 2.5]
      : null;
    const northVisible =
      northBox &&
      northBox[0] >= margin &&
      northBox[1] >= (options.cropCircle ? margin : 0) &&
      northBox[2] <= width - margin &&
      northBox[3] <= (options.cropCircle ? contentBottom : height - margin);
    const north = northVisible ? northBox : null;
    if (!options.cropCircle && northBox && !northVisible) {
      continue;
    }

    const slots = [
      [width - margin - tableWidth, offsetY + bounds[1] + 9],
      [margin, offsetY + bounds[1] + 9],
      [width - margin - tableWidth, height - margin - tableHeight],
      [margin, height - margin - tableHeight]
    ];
    const nightSlots = [];
    if (!geometry.fullCircle) {
      for (const distance of [0.47, 0.45, 0.43, 0.5]) {
        for (const cross of [0, -0.08, 0.08]) {
          const x =
            offsetX +
            Math.sin(geometry.gapCenter) * radius * distance +
            Math.cos(geometry.gapCenter) * radius * cross;
          const y =
            offsetY -
            Math.cos(geometry.gapCenter) * radius * distance +
            Math.sin(geometry.gapCenter) * radius * cross;
          nightSlots.push([x - tableWidth / 2, y - tableHeight / 2]);
        }
      }
    }
    slots.unshift(...nightSlots);

    const xCandidates = [
      margin,
      width / 2 - tableWidth / 2,
      width - margin - tableWidth,
      offsetX + bounds[0],
      offsetX + (bounds[0] + bounds[2] - tableWidth) / 2,
      offsetX + bounds[2] - tableWidth
    ];
    const yCandidates = [
      top,
      (top + height - margin - tableHeight) / 2,
      height - margin - tableHeight,
      offsetY + bounds[1],
      offsetY + (bounds[1] + bounds[3] - tableHeight) / 2,
      offsetY + bounds[3] - tableHeight
    ];
    xCandidates.forEach(x => yCandidates.forEach(y => slots.push([x, y])));

    for (const [slotIndex, [tableX, tableY]] of slots.entries()) {
      const outsidePage =
        tableX < margin ||
        tableX + tableWidth > width - margin ||
        tableY < top ||
        tableY + tableHeight > contentBottom;
      if (outsidePage) {
        continue;
      }

      const tableRectangle = [
        tableX - 3,
        tableY - 3,
        tableX + tableWidth + 3,
        tableY + tableHeight + 3
      ];
      if (!force && intersectsLayout(tableRectangle, occupancy, offsetX, offsetY)) {
        continue;
      }

      const diagramBounds = options.cropCircle ? occupancy.pointBounds : bounds;
      const diagramBoxes = [[
        diagramBounds[0] + offsetX,
        diagramBounds[1] + offsetY,
        diagramBounds[2] + offsetX,
        diagramBounds[3] + offsetY
      ]];
      const tableBoxes = Array.from({ length: columns }, (_, column) => {
        const columnX = tableX + column * (groupWidth + groupGap);
        return [
          columnX - 1,
          tableY,
          columnX + groupWidth + 1,
          tableY + tableHeight
        ];
      });
      const header = findHeaderBox({
        width,
        height,
        diagramBoxes,
        tableBoxes: north ? [...tableBoxes, north] : tableBoxes,
        radius,
        margin,
        cropCircle: options.cropCircle,
        state,
        options,
        helpers
      });
      if (!header) {
        continue;
      }

      const candidate = {
        offsetX,
        offsetY,
        tableX,
        tableY,
        columns,
        rowCount,
        tableWidth,
        tableHeight,
        groupWidth,
        groupGap,
        rowHeight,
        night: slotIndex < nightSlots.length,
        header,
        occupancy
      };
      const hasBetterHeader = !best || header.items[0].x < best.header.items[0].x;
      const sameHeaderPosition =
        best && header.items[0].x === best.header.items[0].x;
      if (hasBetterHeader || (sameHeaderPosition && candidate.night && !best.night)) {
        best = candidate;
      }
    }
  }

  return best;
}

function lineIntersectsBox(x1, y1, x2, y2, box) {
  let minT = 0;
  let maxT = 1;
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const boundaries = [
    [-deltaX, x1 - box[0]],
    [deltaX, box[2] - x1],
    [-deltaY, y1 - box[1]],
    [deltaY, box[3] - y1]
  ];

  for (const [p, q] of boundaries) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }
      continue;
    }

    const t = q / p;
    if (p < 0) {
      if (t > maxT) {
        return false;
      }
      minT = Math.max(minT, t);
    } else {
      if (t < minT) {
        return false;
      }
      maxT = Math.min(maxT, t);
    }
  }
  return true;
}

function itemTouchesBox(box, item) {
  if (item.k === 't') {
    const width = item.s.length * item.pt * 0.19;
    const left =
      item.an === 'end'
        ? item.x - width
        : item.an === 'middle'
          ? item.x - width / 2
          : item.x;
    return (
      left < box[2] &&
      left + width > box[0] &&
      item.y - item.pt * 0.4 < box[3] &&
      item.y + item.pt * 0.08 > box[1]
    );
  }
  if (item.k === 'r') {
    return (
      item.x < box[2] &&
      item.x + item.w > box[0] &&
      item.y < box[3] &&
      item.y + item.h > box[1]
    );
  }
  if (item.k === 'c') {
    const closestX = Math.max(box[0], Math.min(item.x, box[2]));
    const closestY = Math.max(box[1], Math.min(item.y, box[3]));
    const radius = item.r + (item.w || 0) / 2;
    return (item.x - closestX) ** 2 + (item.y - closestY) ** 2 <= radius ** 2;
  }
  if (item.k === 'l') {
    return lineIntersectsBox(item.x1, item.y1, item.x2, item.y2, box);
  }

  for (let index = 1; index < item.pts.length; index++) {
    if (lineIntersectsBox(...item.pts[index - 1], ...item.pts[index], box)) {
      return true;
    }
  }
  return false;
}

export function drawGlobe({ items, width, height, state, helpers }) {
  const { formatNumber } = helpers;

  for (let diameter = 40; diameter >= 28; diameter -= 2) {
    const radius = diameter * 0.32;
    const globeWidth = 2 * radius + 12;
    const globeHeight = 2 * radius + 16;

    for (let y = height - 20 - globeHeight; y >= 8; y -= 4) {
      for (let x = 8; x <= width - globeWidth - 8; x += 4) {
        const box = [x, y, x + globeWidth, y + globeHeight];
        if (items.some(item => itemTouchesBox(box, item))) {
          continue;
        }

        const centerX = x + radius + 2;
        const centerY = y + radius + 4;
        const declinationAngle = state.declination * RAD;
        const latitudeAngle = (state.latitude - state.declination) * RAD;
        const latitudeY = centerY - radius * Math.sin(latitudeAngle);
        const stroke = [75, 91, 105];
        const equator = [177, 185, 192];
        const blue = [32, 121, 174];
        const sun = [220, 151, 47];

        items.push(
          { k: 'c', x: centerX, y: centerY, r: radius, c: [247, 250, 252], fill: 1 },
          { k: 'c', x: centerX, y: centerY, r: radius, c: stroke, w: 0.45 }
        );

        const eastX = Math.cos(declinationAngle);
        const eastY = Math.sin(declinationAngle);
        const northX = Math.sin(declinationAngle);
        const northY = -Math.cos(declinationAngle);
        if (Math.abs(state.latitude) > 1e-6) {
          items.push({
            k: 'l',
            x1: centerX - radius * eastX,
            y1: centerY - radius * eastY,
            x2: centerX + radius * eastX,
            y2: centerY + radius * eastY,
            c: equator,
            w: 0.25
          });
        }
        items.push({
          k: 'l',
          x1: centerX - (radius + 2) * northX,
          y1: centerY - (radius + 2) * northY,
          x2: centerX + (radius + 2) * northX,
          y2: centerY + (radius + 2) * northY,
          c: equator,
          w: 0.2
        });

        const latitudeOffset = radius * Math.sin(state.latitude * RAD);
        const latitudeHalf = radius * Math.cos(state.latitude * RAD);
        items.push({
          k: 'l',
          x1: centerX + latitudeOffset * northX - latitudeHalf * eastX,
          y1: centerY + latitudeOffset * northY - latitudeHalf * eastY,
          x2: centerX + latitudeOffset * northX + latitudeHalf * eastX,
          y2: centerY + latitudeOffset * northY + latitudeHalf * eastY,
          c: blue,
          w: 0.85
        });

        const surfaceX = centerX + radius * Math.cos(latitudeAngle);
        items.push(
          { k: 'c', x: surfaceX, y: latitudeY, r: 1.35, c: [255, 255, 255], fill: 1 },
          { k: 'c', x: surfaceX, y: latitudeY, r: 0.85, c: blue, fill: 1 }
        );

        if (Math.cos(latitudeAngle) > 0) {
          const sunX = x + globeWidth - 3.4;
          for (const offset of [-3.2, 0, 3.2]) {
            const rayY = Math.max(
              centerY - radius * 0.88,
              Math.min(centerY + radius * 0.88, latitudeY + offset)
            );
            const rayEdge =
              centerX + Math.sqrt(Math.max(0, radius * radius - (rayY - centerY) ** 2));
            items.push({
              k: 'l',
              x1: rayEdge,
              y1: rayY,
              x2: sunX - 1.8,
              y2: rayY,
              c: sun,
              w: 0.3
            });
          }

          items.push({ k: 'c', x: sunX, y: latitudeY, r: 1.6, c: sun, fill: 1 });
          for (let angle = 0; angle < 360; angle += 45) {
            const radians = angle * RAD;
            items.push({
              k: 'l',
              x1: sunX + 2.1 * Math.sin(radians),
              y1: latitudeY - 2.1 * Math.cos(radians),
              x2: sunX + 3.1 * Math.sin(radians),
              y2: latitudeY - 3.1 * Math.cos(radians),
              c: sun,
              w: 0.35
            });
          }
        }

        items.push({
          k: 't',
          x: centerX,
          y: centerY + radius + 6,
          s: `${formatNumber(Math.abs(state.latitude), 0)}º ${state.latitude >= 0 ? 'N' : 'S'}`,
          pt: 7.5,
          c: blue,
          an: 'middle'
        });
        return;
      }
    }
  }
}

function cacheKey(state, options, helpers) {
  return JSON.stringify({ state, options, citySummary: helpers.citySummary });
}

function getCachedLayout(key) {
  if (!templateCache.has(key)) {
    return null;
  }

  const cached = templateCache.get(key);
  templateCache.delete(key);
  templateCache.set(key, cached);
  return cached;
}

function findBestLayout({
  portraitWidth,
  portraitHeight,
  originalRadius,
  cropCircle,
  context
}) {
  let best = null;

  for (const landscape of [0, 1]) {
    for (const columns of [1, 2, 3]) {
      const width = landscape ? portraitHeight : portraitWidth;
      const height = landscape ? portraitWidth : portraitHeight;
      const maxRadius = cropCircle
        ? 500
        : Math.min(
            originalRadius * 10,
            Math.max(portraitWidth, portraitHeight) - context.margin * 2
          );
      let maximum = 0;

      for (let candidateRadius = Math.floor(maxRadius / 5) * 5; candidateRadius >= 15; candidateRadius -= 5) {
        const placement = findPlacement({
          width,
          height,
          columns,
          radius: candidateRadius,
          scale: 1,
          context
        });
        if (placement) {
          maximum = candidateRadius;
          break;
        }
      }
      if (!maximum) {
        continue;
      }

      const selectedRadius = Math.max(3, Math.floor((maximum / 10) * 2) / 2);
      const placement = findPlacement({
        width,
        height,
        columns,
        radius: selectedRadius * 10,
        scale: 1,
        context
      });
      const candidate = {
        width,
        height,
        landscape,
        columns,
        radius: selectedRadius,
        night: placement.night
      };
      const largerRadius = !best || candidate.radius > best.radius;
      const preferredNightPlacement =
        best &&
        candidate.radius === best.radius &&
        candidate.night &&
        !best.night;
      if (largerRadius || preferredNightPlacement) {
        best = candidate;
      }
    }
  }

  return best || {
    width: portraitWidth,
    height: portraitHeight,
    landscape: 0,
    columns: 2,
    radius: 3
  };
}

function createTableItems({ placement, state, helpers, isDome, scale, cellWidth }) {
  const tableItems = [];
  const black = [0, 0, 0];
  const gray = [140, 140, 140];
  const lightGray = [165, 165, 165];
  const tableFont = placement.columns > 1 ? 6.5 : 7.5;
  const columnValues = isDome ? [0, 33, 49, 63, 78] : [0, 33, 49, 0, 63];
  const columnPositions = columnValues.map(
    value => (value * placement.groupWidth) / cellWidth
  );
  const addTableText = (x, y, text, color, align = 'start', bold = 0) => {
    tableItems.push({ k: 't', x, y, s: text, pt: tableFont, c: color, an: align, b: bold });
  };

  for (let column = 0; column < placement.columns; column++) {
    const columnX =
      placement.tableX + column * (placement.groupWidth + placement.groupGap);
    const headerY = placement.tableY + 3;
    addTableText(columnX + columnPositions[0], headerY, helpers.translate('table.time'), gray, 'start', 1);
    addTableText(columnX + columnPositions[1], headerY, helpers.translate('pdf.elevation'), gray, 'end');
    addTableText(columnX + columnPositions[2], headerY, helpers.translate('pdf.azimuth'), gray, 'end');
    if (isDome) {
      addTableText(columnX + columnPositions[3], headerY, helpers.translate('pdf.distance'), gray, 'end');
    }
    addTableText(columnX + columnPositions[4], headerY, helpers.translate('pdf.height'), gray, 'end');

    state.events
      .slice(column * placement.rowCount, (column + 1) * placement.rowCount)
      .forEach((event, index) => {
        const rowY = headerY + (index + 1) * placement.rowHeight;
        const time = helpers.formatTime(event.t);
        const eventLabel = event.z ? ` ${helpers.translate(`event.${event.tag}`)}` : '';
        const elevation = `${helpers.formatNumber(event.displayElevation, 0)}º`;
        const azimuth = `${helpers.formatNumber(event.displayAzimuth, 0)}º`;
        const height = `${helpers.formatNumber(event.h * scale)} cm${event.cap ? '*' : ''}`;

        addTableText(columnX + columnPositions[0], rowY, time + eventLabel, lightGray);
        addTableText(columnX + columnPositions[1], rowY, elevation, lightGray, 'end');
        addTableText(columnX + columnPositions[2], rowY, azimuth, lightGray, 'end');
        if (isDome) {
          addTableText(
            columnX + columnPositions[3],
            rowY,
            helpers.formatNumber(event.r * scale),
            lightGray,
            'end'
          );
        }
        addTableText(columnX + columnPositions[4], rowY, height, lightGray, 'end');
      });
  }

  return tableItems;
}

function createVisibleCardinals({
  cardinalLabels,
  inArc,
  cropCircle,
  offsetX,
  offsetY,
  diagramRadius,
  margin,
  width,
  contentBottom
}) {
  return cardinalLabels
    .filter(([, angle]) => {
      if (!inArc(angle)) {
        return false;
      }

      const sin = Math.sin(angle * RAD);
      const cos = -Math.cos(angle * RAD);
      const x = offsetX + (diagramRadius + 6) * sin;
      const y = offsetY + (diagramRadius + 6) * cos;
      return (
        !cropCircle ||
        (x >= margin + 6 &&
          x <= width - margin - 6 &&
          y >= margin + 6 &&
          y <= contentBottom - 6)
      );
    })
    .map(([label, angle]) => ({
      label,
      angle,
      x: offsetX + (diagramRadius + 6) * Math.sin(angle * RAD),
      y: offsetY - (diagramRadius + 6) * Math.cos(angle * RAD)
    }));
}

export function layoutTemplate({ state, options, helpers }) {
  if (!state.events.length) {
    return null;
  }

  const key = cacheKey(state, options, helpers);
  const cachedLayout = getCachedLayout(key);
  if (cachedLayout) {
    return cachedLayout;
  }

  const [portraitWidth, portraitHeight] = PAPER_SIZES[options.paper];
  const originalRadius = state.radius;
  const isDome = state.model === 'cupula';
  const cropCircle = isDome && options.cropCircle;
  const margin = 10;
  const cellWidth = 78;
  const azimuths = state.events.map(event => event.A).sort((a, b) => a - b);
  let largestGap = -1;
  let gapIndex = 0;

  azimuths.forEach((angle, index) => {
    const gap =
      index < azimuths.length - 1
        ? azimuths[index + 1] - angle
        : azimuths[0] + 360 - angle;
    if (gap > largestGap) {
      largestGap = gap;
      gapIndex = index;
    }
  });

  const fullCircle = largestGap < 70;
  const arcStart = fullCircle ? 0 : azimuths[(gapIndex + 1) % azimuths.length] - 12;
  const arcLength = fullCircle ? 360 : 360 - largestGap + 24;
  const inArc = angle => fullCircle || ((angle - arcStart + 720) % 360) <= arcLength;
  const gapCenter = fullCircle ? Math.PI : (azimuths[gapIndex] + largestGap / 2) * RAD;
  const cardinalLabels = [
    ['N', 0],
    ['E', 90],
    ['S', 180],
    [helpers.translate('pdf.west'), 270]
  ];
  const geometry = {
    fullCircle,
    arcStart,
    arcLength,
    gapCenter,
    includesNorth: inArc(0),
    inArc
  };
  const context = {
    state,
    options: { ...options, cropCircle },
    helpers,
    geometry,
    margin,
    cellWidth,
    cardinalLabels
  };
  const best = findBestLayout({
    portraitWidth,
    portraitHeight,
    originalRadius,
    cropCircle,
    context
  });

  let placement;
  let pageRadius = best.radius;
  while (pageRadius > 3 && !placement) {
    placement = findPlacement({
      width: best.width,
      height: best.height,
      columns: best.columns,
      radius: pageRadius * 10,
      scale: pageRadius / originalRadius,
      context
    });
    if (!placement) {
      pageRadius -= 0.5;
    }
  }
  const { width, height, landscape, columns } = best;
  if (!placement) {
    placement = findPlacement({
      width,
      height,
      columns,
      radius: pageRadius * 10,
      scale: pageRadius / originalRadius,
      force: true,
      context
    });
  }
  if (!placement) {
    pageRadius = 3;
    placement = findPlacement({
      width,
      height,
      columns,
      radius: 30,
      scale: 3 / originalRadius,
      force: true,
      context
    });
  }
  if (!placement) {
    return null;
  }

  const scale = pageRadius / originalRadius;
  const diagramRadius = pageRadius * 10;
  const { offsetX, offsetY } = placement;
  const items = [];
  const black = [0, 0, 0];
  const gray = [140, 140, 140];
  const addText = (x, y, text, fontSize, color, align = 'start', bold = 0) => {
    items.push({ k: 't', x, y, s: text, pt: fontSize, c: color, an: align, b: bold });
  };

  placement.header.items.forEach(item => {
    addText(item.x, item.y, item.s, item.pt, gray, 'start', item.b);
  });
  items.push({
    k: 'l',
    x1: placement.header.scale.x1,
    y1: placement.header.scale.y1,
    x2: placement.header.scale.x2,
    y2: placement.header.scale.y2,
    c: gray,
    w: 0.4
  });
  addText(
    placement.header.scale.x2,
    placement.header.scale.labelY,
    placement.header.scale.label,
    6.5,
    gray,
    'end'
  );
  const tableItems = createTableItems({
    placement,
    state,
    helpers,
    isDome,
    scale,
    cellWidth
  });

  const arc = [];
  for (let degrees = 0; degrees <= geometry.arcLength; degrees++) {
    const angle = (geometry.arcStart + degrees) * RAD;
    arc.push([
      offsetX + diagramRadius * Math.sin(angle),
      offsetY - diagramRadius * Math.cos(angle)
    ]);
  }
  items.push({ k: 'p', pts: arc, c: black, w: 0.4 });

  const contentBottom = height - margin - (cropCircle ? 14 : 0);
  const visibleCardinals = createVisibleCardinals({
    cardinalLabels,
    inArc,
    cropCircle,
    offsetX,
    offsetY,
    diagramRadius,
    margin,
    width,
    contentBottom
  });
  visibleCardinals.forEach(({ label, angle, x, y }) => {
    const sin = Math.sin(angle * RAD);
    const cos = -Math.cos(angle * RAD);
    items.push({
      k: 'l',
      x1: offsetX + (diagramRadius - 2) * sin,
      y1: offsetY + (diagramRadius - 2) * cos,
      x2: offsetX + (diagramRadius + 2) * sin,
      y2: offsetY + (diagramRadius + 2) * cos,
      c: black,
      w: 0.4
    });
    addText(x, y + 1.3, label, 10, black, 'middle', 1);
  });

  const positions = placement.occupancy.positions.map(([x, y]) => [
    x + offsetX,
    y + offsetY
  ]);
  const labelItems = [];
  state.events.forEach((event, index) => {
    const [x, y] = positions[index];
    const label = placement.occupancy.labels[index];
    const box = [
      label.box[0] + offsetX,
      label.box[1] + offsetY,
      label.box[2] + offsetX,
      label.box[3] + offsetY
    ];

    items.push(
      { k: 'l', x1: offsetX, y1: offsetY, x2: x, y2: y, c: black, w: 0.12 },
      { k: 'c', x, y, r: 1.1, c: black, fill: 1 }
    );
    labelItems.push({
      k: 'r',
      x: box[0] - 0.3,
      y: box[1] - 0.2,
      w: box[2] - box[0] + 0.6,
      h: box[3] - box[1] + 0.4,
      c: [255, 255, 255]
    });
    label.lines.forEach((text, line) => {
      labelItems.push({
        k: 't',
        x: offsetX + label.x,
        y: offsetY + label.y + line * 3.3,
        s: text,
        pt: 8,
        c: black,
        an: label.align,
        b: line === label.lines.length - 1 ? 1 : 0
      });
    });
  });
  items.push(
    ...labelItems,
    { k: 'c', x: offsetX, y: offsetY, r: 2.5, c: black, w: 0.5 },
    { k: 'l', x1: offsetX - 4, y1: offsetY, x2: offsetX + 4, y2: offsetY, c: black, w: 0.3 },
    { k: 'l', x1: offsetX, y1: offsetY - 4, x2: offsetX, y2: offsetY + 4, c: black, w: 0.3 }
  );
  addText(
    offsetX + 8 * Math.sin(geometry.gapCenter),
    offsetY - 8 * Math.cos(geometry.gapCenter) + 1.2,
    helpers.translate('pdf.observer'),
    7,
    black,
    'middle'
  );

  for (let column = 0; column < placement.columns; column++) {
    items.push({
      k: 'r',
      x: placement.tableX + column * (placement.groupWidth + placement.groupGap) - 1,
      y: placement.tableY,
      w: placement.groupWidth + 2,
      h: placement.tableHeight,
      c: [255, 255, 255]
    });
  }
  items.push(...tableItems);
  addText(margin, height - 7, helpers.translate('pdf.attribution'), 6.5, gray);
  addText(margin, height - 3, helpers.translate('pdf.license'), 6.5, gray);

  drawGlobe({ items, width, height, state, helpers });
  const result = {
    P: items,
    W: width,
    H: height,
    land: landscape,
    Rc: pageRadius,
    k: scale,
    R0: originalRadius,
    pk: options.paper
  };
  templateCache.set(key, result);
  if (templateCache.size > TEMPLATE_CACHE_LIMIT) {
    templateCache.delete(templateCache.keys().next().value);
  }
  return result;
}
