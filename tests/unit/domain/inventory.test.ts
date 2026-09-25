import { describe, expect, it } from 'vitest';
import { addItem, countOf, listItems, removeItem, totalWeight } from '@/domain/inventory';

describe('inventory', () => {
  it('adds within stack limits', () => {
    expect(addItem({}, 'water', 5, 3)).toEqual({ inventory: { water: 3 }, added: 3 });
    expect(addItem({ water: 3 }, 'water', 1, 3).added).toBe(0);
    expect(addItem({}, 'water', 0, 3).added).toBe(0);
  });

  it('removes and never goes negative', () => {
    expect(removeItem({ coins: 2 }, 'coins', 5)).toEqual({ inventory: {}, removed: 2 });
    expect(removeItem({ coins: 5 }, 'coins', 2)).toEqual({ inventory: { coins: 3 }, removed: 2 });
    expect(removeItem({}, 'coins', 1).removed).toBe(0);
  });

  it('computes weight and lists items in stable order', () => {
    const weights: Record<string, number> = { water: 2, bread: 1, coins: 0 };
    const inv = { water: 2, bread: 1, coins: 9 };
    expect(totalWeight(inv, (id) => weights[id] ?? 0)).toBe(5);
    expect(listItems(inv).map((i) => i.itemId)).toEqual(['bread', 'coins', 'water']);
    expect(countOf(inv, 'bread')).toBe(1);
  });
});
