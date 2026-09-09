import { LOOT_STREAK_STORAGE_KEY } from "../constants";

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
  new Promise((resolve) => {
    chrome.storage.local.get(LOOT_STREAK_STORAGE_KEY, (result) => {
      const stored = result[LOOT_STREAK_STORAGE_KEY];
      resolve(isLootStreakState(stored) ? stored : null);
    });
  });

export const saveLootStreak = (state: LootStreakState): Promise<void> =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [LOOT_STREAK_STORAGE_KEY]: state }, () =>
      resolve(),
    );
  });
