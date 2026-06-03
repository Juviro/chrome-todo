import { useCallback, useRef } from "react";
import {
  getTierForCombo,
  LOOT_COMBO_IDLE_RESET_MS,
  LOOT_COMBO_WINDOW_MS,
  type LootTier,
} from "./lootTiers";

export type LootStreakResult = {
  combo: number;
  tier: LootTier;
};

export const useLootStreak = () => {
  const comboRef = useRef(0);
  const lastCompletedAtRef = useRef(0);
  const idleResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleResetTimer = useCallback(() => {
    if (idleResetTimerRef.current) {
      clearTimeout(idleResetTimerRef.current);
      idleResetTimerRef.current = null;
    }
  }, []);

  const registerCompletion = useCallback((): LootStreakResult => {
    const now = Date.now();
    const elapsed = now - lastCompletedAtRef.current;

    if (elapsed > LOOT_COMBO_WINDOW_MS) {
      comboRef.current = 0;
    }

    comboRef.current += 1;
    lastCompletedAtRef.current = now;

    const combo = comboRef.current;
    const tier = getTierForCombo(combo);

    clearIdleResetTimer();
    idleResetTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      lastCompletedAtRef.current = 0;
    }, LOOT_COMBO_IDLE_RESET_MS);

    return { combo, tier };
  }, [clearIdleResetTimer]);

  return { registerCompletion };
};
