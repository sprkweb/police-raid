import { useEffect, useState } from 'react';
import { formatCountdown } from '../engine/formatCountdown';

/**
 * Live countdown label from an absolute deadline, or `null` when inactive.
 * Re-renders about 4×/sec so the display stays smooth without thrashing.
 */
export function usePhaseCountdown(phaseEndsAt: number | null | undefined): string | null {
  const [label, setLabel] = useState<string | null>(() => {
    if (phaseEndsAt == null) return null;
    return formatCountdown(phaseEndsAt - Date.now());
  });

  useEffect(() => {
    if (phaseEndsAt == null) {
      setLabel(null);
      return;
    }

    const tick = () => {
      setLabel(formatCountdown(phaseEndsAt - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phaseEndsAt]);

  return label;
}
