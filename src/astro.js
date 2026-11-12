const DEG_TO_RAD = Math.PI / 180;

export const AXIAL_TILT = 23.44;
export const POLAR_CIRCLE_OFFSET = 66.56;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function computeSun(latitude, date) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('Date must be a YYYY-MM-DD string.');
  }

  const utcDate = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(utcDate.getTime()) || utcDate.toISOString().slice(0, 10) !== date) {
    throw new RangeError('Date must be a valid calendar date.');
  }

  const dayNumber = Math.floor(
    (utcDate - Date.UTC(utcDate.getUTCFullYear(), 0, 0)) / 864e5
  );
  const declination = AXIAL_TILT * Math.sin((360 / 365) * (dayNumber - 81) * DEG_TO_RAD);
  const latitudeRad = latitude * DEG_TO_RAD;
  const declinationRad = declination * DEG_TO_RAD;
  const sinLatitude = Math.sin(latitudeRad);
  const cosLatitude = Math.cos(latitudeRad);
  const sinDeclination = Math.sin(declinationRad);
  const cosDeclination = Math.cos(declinationRad);
  const tanDeclination = Math.tan(declinationRad);
  const dayAngle =
    Math.acos(clamp(-Math.tan(latitudeRad) * tanDeclination, -1, 1)) / DEG_TO_RAD;

  const at = (hour, z) => {
    const hourAngle = 15 * (hour - 12);
    const hourAngleRad = hourAngle * DEG_TO_RAD;
    const sinHourAngle = Math.sin(hourAngleRad);
    const cosHourAngle = Math.cos(hourAngleRad);
    const sinElevation = z
      ? 0
      : clamp(
          sinLatitude * sinDeclination + cosLatitude * cosDeclination * cosHourAngle,
          -1,
          1
        );
    const elevation = Math.asin(sinElevation) / DEG_TO_RAD;
    const azimuth =
      (Math.atan2(
        sinHourAngle,
        cosHourAngle * sinLatitude - tanDeclination * cosLatitude
      ) /
        DEG_TO_RAD +
        540) %
      360;

    return {
      t: hour,
      H: hourAngle,
      se: sinElevation,
      e: elevation,
      A: azimuth,
      z
    };
  };

  const events = [];
  for (let hour = 0; hour < 24; hour++) {
    const event = at(hour);
    if (event.e > 0.05) {
      events.push(event);
    }
  }

  const pathSamples = [];
  const samplePathAt = (hour, atHorizon = false) => {
    const position = at(hour, atHorizon);
    pathSamples.push({
      elevation: position.e,
      azimuth: position.A
    });
  };

  if (dayAngle > 0 && dayAngle < 180) {
    const sunriseHour = 12 - dayAngle / 15;
    const sunsetHour = 12 + dayAngle / 15;
    events.push(
      Object.assign(at(sunriseHour, 1), { tag: 'sunrise' }),
      Object.assign(at(sunsetHour, 1), { tag: 'sunset' })
    );

    samplePathAt(sunriseHour, true);
    const firstQuarterHour = Math.ceil(sunriseHour * 4) / 4;
    for (let hour = firstQuarterHour; hour < sunsetHour; hour += 0.25) {
      if (hour > sunriseHour) {
        samplePathAt(hour);
      }
    }
    samplePathAt(sunsetHour, true);
  } else if (dayAngle === 180) {
    for (let hour = 0; hour <= 24; hour += 0.25) {
      samplePathAt(hour);
    }
  }
  events.sort((first, second) => first.t - second.t);

  return { dayNumber, declination, dayAngle, events, pathSamples };
}
