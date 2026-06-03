import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "../types";
import { SAVE_DEBOUNCE_MS } from "../constants";
import { loadState } from "../storage/loadState";
import { saveState } from "../storage/saveState";

export const useAppState = () => {
  const [state, setState] = useState<AppState | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    loadState().then((loaded) => {
      setState(loaded);
      stateRef.current = loaded;
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    stateRef.current = state;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveState(state);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state]);

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState) => {
      setState((prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
    },
    [],
  );

  const replaceState = useCallback((next: AppState) => {
    setState(next);
    stateRef.current = next;
    saveState(next);
  }, []);

  return { state, updateState, replaceState, isLoading: state === null };
};
