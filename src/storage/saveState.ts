import type { AppState } from "../types";
import { STORAGE_KEY } from "../constants";

export const saveState = (state: AppState): Promise<void> =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
  });
