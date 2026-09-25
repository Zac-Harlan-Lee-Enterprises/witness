export interface Debounced {
  (): void;
  flush(): void;
  cancel(): void;
}

/** Trailing-edge debounce with explicit flush (used for autosave). */
export function debounce(fn: () => void, waitMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = (): void => {
    timer = null;
    fn();
  };
  const debounced = (() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  }) as Debounced;
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      run();
    }
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
