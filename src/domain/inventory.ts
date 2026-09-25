import { z } from 'zod';

/**
 * A deliberately small inventory. Items exist because they matter to a
 * decision, a puzzle or the story — never as loot. Capacity is measured in
 * satchel "weight" so packing is a real trade-off (see the satchel puzzle).
 */
export const ITEM_KINDS = [
  'mission',
  'medicine',
  'food',
  'water',
  'supply',
  'letter',
  'map',
  'tool',
  'currency',
  'clothing',
] as const;

export const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(ITEM_KINDS),
  /** Satchel weight units. 0 = flat/small things (letters, maps, coins). */
  weight: z.number().int().nonnegative(),
  maxStack: z.number().int().positive(),
  /** Mission items cannot be dropped, given away or left behind. */
  essential: z.boolean().default(false),
  /** Short glyph shown next to the name (never the only indicator). */
  icon: z.string().min(1).max(2),
});
/** @public Domain-model type (chapter-authoring API). */
export type Item = z.infer<typeof ItemSchema>;

export type InventoryState = Readonly<Record<string, number>>;

export function addItem(
  inventory: InventoryState,
  itemId: string,
  quantity: number,
  maxStack: number,
): { inventory: Record<string, number>; added: number } {
  if (quantity <= 0) return { inventory: { ...inventory }, added: 0 };
  const current = inventory[itemId] ?? 0;
  const next = Math.min(maxStack, current + quantity);
  return { inventory: { ...inventory, [itemId]: next }, added: next - current };
}

export function removeItem(
  inventory: InventoryState,
  itemId: string,
  quantity: number,
): { inventory: Record<string, number>; removed: number } {
  const current = inventory[itemId] ?? 0;
  const removed = Math.min(current, Math.max(0, quantity));
  const remaining = current - removed;
  const next = Object.fromEntries(Object.entries(inventory).filter(([id]) => id !== itemId));
  if (remaining > 0) next[itemId] = remaining;
  return { inventory: next, removed };
}

export function countOf(inventory: InventoryState, itemId: string): number {
  return inventory[itemId] ?? 0;
}

/** Total satchel weight of an inventory (or a proposed packing). */
export function totalWeight(
  inventory: InventoryState,
  weightOf: (itemId: string) => number,
): number {
  return Object.entries(inventory).reduce((sum, [itemId, qty]) => sum + weightOf(itemId) * qty, 0);
}

/** Non-empty entries in a stable display order. */
export function listItems(inventory: InventoryState): Array<{ itemId: string; quantity: number }> {
  return Object.entries(inventory)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}
