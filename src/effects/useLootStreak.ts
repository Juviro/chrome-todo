import { useCallback, useEffect, useRef } from "react";
import { getTierForCombo, type LootTier } from "./lootTiers";
import {
  getLocalDayKey,
  loadLootStreak,
  saveLootStreak,
} from "./lootStreakStorage";

export type LootStreakResult = {
  combo: number;
  tier: LootTier;
};

export const useLootStreak = () => {
  const comboRef = useRef(0);
  const dayRef = useRef(getLocalDayKey());

  useEffect(() => {
    loadLootStreak().then((stored) => {
      const today = getLocalDayKey();
      dayRef.current = today;
      comboRef.current =
        stored && stored.day === today ? stored.combo : 0;
    });
  }, []);

  const registerCompletion = useCallback((): LootStreakResult => {
    const today = getLocalDayKey();

    if (dayRef.current !== today) {
      comboRef.current = 0;
      dayRef.current = today;
    }

    comboRef.current += 1;
    const combo = comboRef.current;
    const tier = getTierForCombo(combo);

    saveLootStreak({ day: today, combo });

    return { combo, tier };
  }, []);

  return { registerCompletion };
};
