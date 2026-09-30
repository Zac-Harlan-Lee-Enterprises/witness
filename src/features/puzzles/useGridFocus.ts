import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

/**
 * Roving focus for a grid of buttons: one cell is in the Tab order, and the
 * arrow keys (plus Home/End) move between cells. Space and Enter press the
 * focused button as usual, so a grid is fully playable from the keyboard.
 */
export function useGridFocus(
  rows: number,
  cols: number,
  start: readonly [number, number] = [0, 0],
  /** Called for any other key pressed on a cell (e.g. R to turn a piece). */
  onOtherKey?: (event: KeyboardEvent, row: number, col: number) => void,
) {
  const [active, setActive] = useState<readonly [number, number]>(start);
  const cells = useRef(new Map<string, HTMLElement>());

  const focusCell = useCallback((row: number, col: number) => {
    setActive([row, col]);
    cells.current.get(`${row},${col}`)?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent, row: number, col: number) => {
    const moves: Record<string, readonly [number, number]> = {
      ArrowUp: [Math.max(0, row - 1), col],
      ArrowDown: [Math.min(rows - 1, row + 1), col],
      ArrowLeft: [row, Math.max(0, col - 1)],
      ArrowRight: [row, Math.min(cols - 1, col + 1)],
      Home: [row, 0],
      End: [row, cols - 1],
    };
    const target = moves[event.key];
    if (!target) {
      onOtherKey?.(event, row, col);
      return;
    }
    event.preventDefault();
    focusCell(target[0], target[1]);
  };

  /** Props for the cell at (row, col). */
  const cellProps = (row: number, col: number) => ({
    ref: (el: HTMLElement | null) => {
      if (el) cells.current.set(`${row},${col}`, el);
      else cells.current.delete(`${row},${col}`);
    },
    tabIndex: active[0] === row && active[1] === col ? 0 : -1,
    onKeyDown: (event: KeyboardEvent) => onKeyDown(event, row, col),
    onFocus: () => setActive([row, col]),
  });

  return { active, cellProps, focusCell };
}
