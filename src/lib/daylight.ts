// Which part of the day the garden's sky should reflect.
//
// Clock-based, in the device's local time. Real sunrise/sunset was considered
// and rejected: it needs latitude, there is no hemisphere-agnostic substitute,
// and the app requests no location permission - adding a permission prompt to
// move a gradient by forty minutes is a bad trade. The optional `solar`
// argument exists so that if sunrise/sunset ever arrives from a feature that
// legitimately needs location, this becomes an argument rather than a rewrite.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export type DaylightPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface SolarTimes {
  // Local hours as floats, e.g. 6.5 for 06:30.
  sunrise: number;
  sunset: number;
}

// Fixed boundaries, used when no solar times are available.
const DAWN_START = 5;
const DAY_START = 8;
const DUSK_START = 17;
const NIGHT_START = 20;

// How long the dawn and dusk bands last around actual sunrise/sunset. Both
// straddle the event rather than following it, which is what "golden hour"
// actually looks like.
const TWILIGHT = 1.5;

export function daylightPhase(date: Date, solar?: SolarTimes): DaylightPhase {
  const hour = date.getHours() + date.getMinutes() / 60;

  if (solar) {
    if (hour >= solar.sunrise - TWILIGHT && hour < solar.sunrise + TWILIGHT) return 'dawn';
    if (hour >= solar.sunset - TWILIGHT && hour < solar.sunset + TWILIGHT) return 'dusk';
    // Not in either twilight band, so the only question left is which side of
    // the sun's day we are on. Written as a single comparison against both
    // ends so the pre-dawn small hours (hour < sunrise) fall through to night
    // rather than needing their own wrap-around case.
    return hour >= solar.sunrise && hour < solar.sunset ? 'day' : 'night';
  }

  if (hour >= DAWN_START && hour < DAY_START) return 'dawn';
  if (hour >= DAY_START && hour < DUSK_START) return 'day';
  if (hour >= DUSK_START && hour < NIGHT_START) return 'dusk';
  return 'night';
}
