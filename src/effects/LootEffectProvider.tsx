import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createId } from "../storage/defaults";
import { LootEffectLayer, type ActiveLootEffect } from "./LootEffectLayer";
import { LootEffectContext, type LootOrigin } from "./lootEffectContext";
import { LOOT_TIER_CONFIG } from "./lootTiers";
import { useLootStreak } from "./useLootStreak";
import "../styles/loot.scss";

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const LootEffectProvider = ({ children }: { children: ReactNode }) => {
  const [effects, setEffects] = useState<ActiveLootEffect[]>([]);
  const { registerCompletion } = useLootStreak();

  const removeEffect = useCallback((id: string) => {
    setEffects((prev) => prev.filter((effect) => effect.id !== id));
  }, []);

  const spawnLoot = useCallback(
    (origin: LootOrigin) => {
      if (prefersReducedMotion()) return;

      const { combo, tier } = registerCompletion();
      const id = createId();
      const durationMs = LOOT_TIER_CONFIG[tier].durationMs;

      setEffects((prev) => [
        ...prev,
        { id, x: origin.x, y: origin.y, tier, combo },
      ]);

      window.setTimeout(() => removeEffect(id), durationMs);
    },
    [registerCompletion, removeEffect],
  );

  const value = useMemo(() => ({ spawnLoot }), [spawnLoot]);

  return (
    <LootEffectContext.Provider value={value}>
      {children}
      <LootEffectLayer effects={effects} />
    </LootEffectContext.Provider>
  );
};
