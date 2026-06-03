import { useContext } from "react";
import { LootEffectContext } from "./lootEffectContext";

export const useSpawnLoot = () => {
  const context = useContext(LootEffectContext);
  if (!context) {
    throw new Error("useSpawnLoot must be used within LootEffectProvider");
  }
  return context.spawnLoot;
};
