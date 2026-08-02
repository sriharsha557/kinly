// Gives every plant its own idle rhythm.
//
// Before this, each plant swayed at exactly the same amplitude and period,
// separated only by a delay of index * 400ms - close enough to synchronized
// that a row of them read as mechanical rather than alive. Varying all three
// values is how games break up idle animations.
//
// Keyed on userId rather than row index so a plant keeps its character when
// the row reorders, and derived rather than random so it does not change
// between renders.
//
// Dependency-free so node:test can import it under --experimental-strip-types.

export interface SwayProfile {
  // Degrees of rotation to either side.
  amplitude: number;
  // Milliseconds for one half-cycle (upright to full lean).
  period: number;
  // Milliseconds before the loop starts, so plants do not begin in step.
  delay: number;
}

export const SWAY_RANGES = {
  amplitude: [1.1, 2.0],
  period: [2600, 3800],
  delay: [0, 1200],
} as const;

// FNV-1a followed by MurmurHash3's fmix32 finalizer.
//
// The finalizer is not optional here. FNV-1a's last operation is a multiply,
// and multiplication only propagates a change upward through the word - so
// two UUIDs differing in their final character come out differing by about 1
// in the high bytes. Slicing those bytes for `period` then produced a 5ms
// difference across a 1200ms range, putting two plants back in the
// near-lockstep this module exists to break. fmix32's shift-xor rounds spread
// a single-bit input change across the whole word.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function lerp(unit: number, [min, max]: readonly [number, number]): number {
  return min + unit * (max - min);
}

export function swayProfile(userId: string): SwayProfile {
  const h = hash(userId);
  // Three independent slices of the hash. Reusing one value for all three
  // would couple them - every slow plant would also be the widest-swaying.
  return {
    amplitude: lerp(((h >>> 0) & 0xff) / 255, SWAY_RANGES.amplitude),
    period: lerp(((h >>> 8) & 0xff) / 255, SWAY_RANGES.period),
    delay: lerp(((h >>> 16) & 0xff) / 255, SWAY_RANGES.delay),
  };
}
