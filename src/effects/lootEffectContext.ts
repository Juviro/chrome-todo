import { createContext } from "react";

export type LootOrigin = {
  x: number;
  y: number;
};

export type LootEffectContextValue = {
  spawnLoot: (origin: LootOrigin) => void;
};

export const LootEffectContext = createContext<LootEffectContextValue | null>(
  null,
);
