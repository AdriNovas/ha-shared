export function absoluteHumidity(temperature, relativeHumidity) {
  return 6.112
    * (Math.E ** ((17.67 * temperature) / (temperature + 243.5)))
    * relativeHumidity
    * 2.1674
    / (273.15 + temperature);
}

function validPolicy(policy) {
  if (!policy || !policy.seasons || !policy.humidity || !policy.temperature
      || !policy.anticipation || !policy.humidityTolerance) return false;
  const seasons = Object.values(policy.seasons);
  if (!seasons.length || !seasons.every((item) => Array.isArray(item.months)
      && typeof item.name === 'string' && Number.isFinite(item.low)
      && Number.isFinite(item.high) && item.low < item.high)) return false;
  const numericKeys = {
    humidity: ['moderate', 'critical', 'dryingAdvantage', 'closePenalty'],
    temperature: ['actionMargin', 'usefulDelta', 'closeDelta', 'heatingOutdoorLimit'],
    anticipation: ['hotTomorrow', 'coldTomorrow', 'comfortMargin',
      'nightPrecoolStartHour', 'nightPrecoolEndHour', 'nightPrecoolDelta'],
    humidityTolerance: ['cooling', 'heating', 'precooling'],
  };
  return Object.entries(numericKeys).every(([section, keys]) =>
    keys.every((key) => Number.isFinite(policy[section][key])));
}

export function seasonalRange(month, policy) {
  if (!validPolicy(policy) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const season = Object.values(policy.seasons).find((item) => item.months.includes(month));
  return season ? { season: season.name, low: season.low, high: season.high } : null;
}

export function evaluateVentilation(input = {}) {
  const {
    month,
    indoorTemperature: ti,
    indoorHumidity: hi,
    outdoorTemperature: te,
    outdoorHumidity: he,
    windowsOpen = false,
    hvacMode = 'off',
    raining = false,
    rainSoon = false,
    forecastMax48h = 0,
    forecastMin48h = 99,
    hour = null,
    policy,
  } = input;

  if (!validPolicy(policy)) {
    return { state: 'datos_insuficientes', reason: 'invalid_policy' };
  }
  for (const [name, value] of Object.entries({ month, ti, hi, te, he })) {
    if (!Number.isFinite(value)) return { state: 'datos_insuficientes', reason: `invalid_${name}` };
  }
  if (hi < 0 || hi > 100 || he < 0 || he > 100
      || (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23))
      || !Number.isFinite(forecastMax48h) || !Number.isFinite(forecastMin48h)
      || typeof windowsOpen !== 'boolean' || typeof raining !== 'boolean'
      || typeof rainSoon !== 'boolean' || typeof hvacMode !== 'string') {
    return { state: 'datos_insuficientes', reason: 'invalid_input' };
  }

  const range = seasonalRange(month, policy);
  if (!range) return { state: 'datos_insuficientes', reason: 'invalid_month_or_seasons' };
  const { season, low, high } = range;
  const humidity = policy.humidity;
  const temperature = policy.temperature;
  const anticipation = policy.anticipation;
  const tolerance = policy.humidityTolerance;
  const indoorAbsoluteHumidity = absoluteHumidity(ti, hi);
  const outdoorAbsoluteHumidity = absoluteHumidity(te, he);
  const wantsDrying = hi >= humidity.moderate
    && outdoorAbsoluteHumidity <= indoorAbsoluteHumidity - humidity.dryingAdvantage;
  const wantsCooling = ti >= high && te <= ti - temperature.usefulDelta
    && outdoorAbsoluteHumidity <= indoorAbsoluteHumidity + tolerance.cooling;
  const wantsHeating = ti <= low && te >= ti + temperature.usefulDelta
    && te <= high + temperature.heatingOutdoorLimit
    && outdoorAbsoluteHumidity <= indoorAbsoluteHumidity + tolerance.heating;
  const heatSoon = forecastMax48h >= anticipation.hotTomorrow;
  const coldSoon = forecastMin48h <= anticipation.coldTomorrow;
  // A configurable early-night window permits anticipatory cooling.
  const earlyNight = Number.isInteger(hour)
    && (hour >= anticipation.nightPrecoolStartHour || hour < anticipation.nightPrecoolEndHour);
  const precoolDelta = earlyNight ? anticipation.nightPrecoolDelta : temperature.usefulDelta;
  const canPrecool = heatSoon && ti >= low + anticipation.comfortMargin
    && te <= ti - precoolDelta
    && outdoorAbsoluteHumidity <= indoorAbsoluteHumidity + tolerance.precooling;
  const canPreheat = coldSoon && ti <= high - anticipation.comfortMargin
    && te >= ti + temperature.usefulDelta
    && outdoorAbsoluteHumidity <= indoorAbsoluteHumidity + tolerance.heating;
  const openingUseful = wantsDrying || wantsCooling || wantsHeating || canPrecool || canPreheat;

  let state;
  const conditioningActive = ['auto', 'cool', 'dry', 'heat'].includes(hvacMode);

  if (conditioningActive) state = windowsOpen ? 'cerrar' : 'mantener_cerradas';
  else if (openingUseful && (raining || rainSoon)) state = windowsOpen ? 'cerrar' : 'esperar_lluvia';
  else if (hi >= humidity.critical && wantsDrying) state = windowsOpen ? 'mantener_abiertas' : 'ventilar_breve';
  else if (ti >= high + temperature.actionMargin && wantsCooling) state = windowsOpen ? 'mantener_abiertas' : 'abrir_refrescar';
  else if (ti <= low - temperature.actionMargin && wantsHeating) state = windowsOpen ? 'mantener_abiertas' : 'abrir_calentar';
  else if (canPrecool) state = windowsOpen ? 'mantener_abiertas' : 'preenfriar';
  else if (canPreheat) state = windowsOpen ? 'mantener_abiertas' : 'precalentar';
  else if (hi >= humidity.moderate && wantsDrying) state = windowsOpen ? 'mantener_abiertas' : 'ventilar_breve';
  else if (windowsOpen && (
    outdoorAbsoluteHumidity >= indoorAbsoluteHumidity + humidity.closePenalty
    || (ti > high && te >= ti - temperature.closeDelta)
    || (ti < low && te <= ti + temperature.closeDelta)
  )) state = 'cerrar';
  else state = windowsOpen && openingUseful ? 'mantener_abiertas' : 'mantener_cerradas';

  return {
    state,
    season,
    comfortLow: low,
    comfortHigh: high,
    indoorAbsoluteHumidity,
    outdoorAbsoluteHumidity,
    flags: {
      wantsDrying,
      wantsCooling,
      wantsHeating,
      canPrecool,
      canPreheat,
      earlyNight,
      openingUseful,
    },
  };
}
