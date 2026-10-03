/**
 * The admin's current fertiliser prices, in memory — kept apart from the
 * fetching and caching (live/prices.ts) so the catalogue (utils/staticData.ts)
 * can read it without pulling in the database.
 */

import {createStore, useStore} from './store';

export interface LivePrice {
  fertilizerId: string;
  pricePerKg: number;
  /** When the admin's price took effect, epoch ms. */
  effectiveFrom: number;
}

export interface LivePrices {
  fetchedAt: number;
  prices: LivePrice[];
}

/** One row of GET /fertilizer-prices/latest. id -1 marks a catalogue fallback. */
export interface LatestRow {
  id: number;
  fertilizer_id: string;
  price_per_kg: number;
  effective_from: number;
}

const store = createStore<LivePrices>({fetchedAt: 0, prices: []});
let index = new Map<string, LivePrice>();

export function publishLivePrices(next: LivePrices): void {
  index = new Map(next.prices.map(p => [p.fertilizerId, p]));
  store.set(next);
}

export const livePricesNow = (): LivePrices => store.get();

/** The admin's current price for a product, if they set one. */
export function livePrice(fertilizerId: string): LivePrice | undefined {
  return index.get(fertilizerId);
}

/** Rows the server holds a real price for (id > 0) that are already in effect. */
export function fromLatest(rows: readonly LatestRow[], now: number = Date.now()): LivePrice[] {
  return rows
    .filter(r => r.id > 0 && r.price_per_kg > 0 && r.effective_from <= now)
    .map(r => ({fertilizerId: r.fertilizer_id, pricePerKg: r.price_per_kg, effectiveFrom: r.effective_from}));
}

/** Re-renders a screen when the admin's prices change. */
export function useLivePrices(): LivePrices {
  return useStore(store);
}
