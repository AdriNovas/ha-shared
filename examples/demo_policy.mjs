// Fictitious example. These values are not intended as comfort advice.
export const demoPolicy = Object.freeze({
  seasons: {
    warm: { months: [6, 7, 8], name: 'warm', low: 21, high: 27 },
    mild: { months: [4, 5, 9, 10], name: 'mild', low: 19, high: 25 },
    cold: { months: [1, 2, 3, 11, 12], name: 'cold', low: 18, high: 24 },
  },
  humidity: { moderate: 67, critical: 75, dryingAdvantage: 1, closePenalty: 1.5 },
  temperature: { actionMargin: 0.5, usefulDelta: 1.5, closeDelta: 0.3, heatingOutdoorLimit: 2 },
  anticipation: {
    hotTomorrow: 31, coldTomorrow: 5, comfortMargin: 0.5,
    nightPrecoolStartHour: 22, nightPrecoolEndHour: 1, nightPrecoolDelta: 0.7,
  },
  humidityTolerance: { cooling: 1, heating: 1.5, precooling: 0.5 },
});
