import { LOOT_STREAK_STORAGE_KEY } from "../constants";
import { storageArea } from "../storage/storageArea";

export type LootStreakState = {
  day: string;
  combo: number;
};

export const getLocalDayKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isLootStreakState = (value: unknown): value is LootStreakState => {
  if (!value || typeof value !== "object") return false;
  const state = value as LootStreakState;
  return typeof state.day === "string" && typeof state.combo === "number";
};

export const loadLootStreak = (): Promise<LootStreakState | null> =>
  storageArea
    .get(LOOT_STREAK_STORAGE_KEY)
    .then((stored) => (isLootStreakState(stored) ? stored : null));

export const saveLootStreak = (state: LootStreakState): Promise<void> =>
  storageArea.set(LOOT_STREAK_STORAGE_KEY, state);
