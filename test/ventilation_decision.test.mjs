import assert from 'node:assert/strict';
import test from 'node:test';
import { absoluteHumidity, evaluateVentilation, seasonalRange } from '../lib/ventilation_decision.mjs';
import { demoPolicy } from '../examples/demo_policy.mjs';

const base = {
  month: 7,
  indoorTemperature: 24,
  indoorHumidity: 50,
  outdoorTemperature: 24,
  outdoorHumidity: 50,
  forecastMax48h: 26,
  forecastMin48h: 12,
  policy: demoPolicy,
};

test('the policy is explicit and missing data does not recommend action', () => {
  assert.deepEqual(evaluateVentilation({ ...base, policy: undefined }), {
    state: 'datos_insuficientes', reason: 'invalid_policy',
  });
  assert.equal(evaluateVentilation({ ...base, outdoorHumidity: NaN }).state, 'datos_insuficientes');
  assert.equal(evaluateVentilation({ ...base, outdoorHumidity: 130 }).state, 'datos_insuficientes');
  assert.equal(evaluateVentilation({ ...base, policy: { ...demoPolicy, humidity: {} } }).state, 'datos_insuficientes');
  assert.equal(evaluateVentilation({ ...base, month: 13 }).state, 'datos_insuficientes');
});

test('humidity calculation and seasonal ranges are independent of a home', () => {
  assert.ok(absoluteHumidity(25, 60) > absoluteHumidity(25, 40));
  assert.deepEqual(seasonalRange(7, demoPolicy), { season: 'warm', low: 21, high: 27 });
});

test('active conditioning requires windows closed', () => {
  assert.equal(evaluateVentilation({ ...base, hvacMode: 'cool', windowsOpen: true }).state, 'cerrar');
});

test('rain blocks an otherwise useful cooling opportunity', () => {
  const input = { ...base, indoorTemperature: 29, outdoorTemperature: 21 };
  assert.equal(evaluateVentilation(input).state, 'abrir_refrescar');
  assert.equal(evaluateVentilation({ ...input, raining: true }).state, 'esperar_lluvia');
});

test('a second fictitious profile can change the result without changing code', () => {
  const policy = structuredClone(demoPolicy);
  policy.seasons.warm.high = 30;
  const input = { ...base, indoorTemperature: 28, outdoorTemperature: 21, policy };
  assert.equal(evaluateVentilation(input).state, 'mantener_cerradas');
  assert.equal(evaluateVentilation({ ...input, policy: demoPolicy }).state, 'abrir_refrescar');
});
