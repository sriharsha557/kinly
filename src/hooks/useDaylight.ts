import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { daylightPhase, type DaylightPhase } from '../lib/daylight';

// The phase only ever changes at four moments in the day, so polling is
// generous at five minutes - the worst case is the sky arriving a few minutes
// late, which nobody can perceive against a boundary as soft as "dusk starts".
const POLL_MS = 5 * 60 * 1000;

// Which part of the day the garden should reflect, kept current while the
// screen is focused and left alone when it is not. The interval is torn down
// on blur rather than running for the life of the app: a timer that only
// feeds a gradient has no business waking the device from another tab.
export function useDaylight(): DaylightPhase {
  const [phase, setPhase] = useState(() => daylightPhase(new Date()));

  useFocusEffect(
    useCallback(() => {
      // Refresh on focus as well as on the interval - returning to Home after
      // an hour away should show the right sky immediately, not up to five
      // minutes later.
      setPhase(daylightPhase(new Date()));
      const id = setInterval(() => setPhase(daylightPhase(new Date())), POLL_MS);
      return () => clearInterval(id);
    }, []),
  );

  return phase;
}
