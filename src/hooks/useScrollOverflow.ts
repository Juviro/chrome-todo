import { useCallback, useEffect, useRef, useState } from "react";

const SCROLL_EDGE_THRESHOLD_PX = 2;

export type ScrollOverflow = {
  canScrollUp: boolean;
  canScrollDown: boolean;
};

export const useScrollOverflow = <T extends HTMLElement>(
  deps: unknown[],
) => {
  const ref = useRef<T>(null);
  const [overflow, setOverflow] = useState<ScrollOverflow>({
    canScrollUp: false,
    canScrollDown: false,
  });

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const canScrollUp = scrollTop > SCROLL_EDGE_THRESHOLD_PX;
    const canScrollDown =
      scrollTop + clientHeight < scrollHeight - SCROLL_EDGE_THRESHOLD_PX;

    setOverflow((prev) =>
      prev.canScrollUp === canScrollUp && prev.canScrollDown === canScrollDown
        ? prev
        : { canScrollUp, canScrollDown },
    );
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    measure();
    element.addEventListener("scroll", measure, { passive: true });

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", measure);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { ref, overflow };
};
