import { useEffect, useState } from 'react';
import { countdownLabel } from '../engine/formatCountdown';

/**
 * Live countdown label from an absolute deadline, or `null` when inactive.
 * Derived during render so a new/cleared `phaseEndsAt` never paints the previous value.
 * Re-renders about 4×/sec so the display stays smooth without thrashing.
 */
export function usePhaseCountdown(phaseEndsAt: number | null | undefined): string | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (phaseEndsAt == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [phaseEndsAt]);

  return countdownLabel(phaseEndsAt, Date.now());
}
