# Reusable Home Assistant decision logic

This repository is a **JavaScript library**, not a Home Assistant custom integration or HACS package. It contains instance-neutral logic and fictitious examples. It does not install files into Home Assistant or deploy to any home.

## Ventilation decision

`evaluateVentilation(input)` evaluates whether outdoor air is useful given temperature, relative humidity, rain, HVAC mode and a **required, caller-supplied policy**. It returns a decision state plus reasons/flags; it never controls devices. Relative humidity inputs use percentages, temperature uses °C, and absolute humidity is returned in g/m³.

```js
import { evaluateVentilation } from './lib/ventilation_decision.mjs';
import { demoPolicy } from './examples/demo_policy.mjs';

const decision = evaluateVentilation({
  month: 7,
  indoorTemperature: 28,
  indoorHumidity: 50,
  outdoorTemperature: 21,
  outdoorHumidity: 50,
  forecastMax48h: 30,
  forecastMin48h: 12,
  policy: demoPolicy,
});
```

The example policy is fictitious. Set and validate comfort thresholds for each installation separately. A missing policy or incomplete sensor input yields `datos_insuficientes`; callers must treat that state as **no action**. The library intentionally contains no entity IDs, people, network addresses, credentials, notifications or physical actions.

Run `npm test` before reusing it. An integration, blueprint or package that consumes this library needs its own tests, installation path and live-instance validation.
