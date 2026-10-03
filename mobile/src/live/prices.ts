/**
 * Fertiliser prices the admin entered on the server, laid over the surveyed
 * catalogue (shared/data/fertilizer_recommendations.json).
 *
 * The catalogue's prices are a published market survey with a date; the
 * admin's are what the dealer charges now. After a successful sync the phone
 * fetches GET /fertilizer-prices/latest (at most hourly, or at once when a
 * price notification arrives) and keeps the answer in local storage, so the
 * calculator, the budget tiers and the stock value use the newer price even
 * offline. A product the admin never priced keeps the survey's price.
 */

import {request} from '../api/client';
import {database} from '../db';
import type {LatestRow, LivePrices} from './priceIndex';
import {fromLatest, livePricesNow, publishLivePrices} from './priceIndex';

const KEY = 'live_fertilizer_prices';
const REFRESH_MS = 60 * 60 * 1000;

/** Reads the last fetched prices — call once at start-up. */
export async function loadCachedPrices(): Promise<void> {
  try {
    const cached = await database.localStorage.get<LivePrices>(KEY);
    if (cached?.prices) publishLivePrices(cached);
  } catch (error) {
    console.warn('[prices] cache read failed', error);
  }
}

/** Fetches the admin's prices when the cache is old (or `force`). Never throws. */
export async function refreshPrices(token: string, {force = false}: {force?: boolean} = {}): Promise<boolean> {
  if (!force && Date.now() - livePricesNow().fetchedAt < REFRESH_MS) return false;
  try {
    const rows = await request<LatestRow[]>('/fertilizer-prices/latest', {token});
    const next = {fetchedAt: Date.now(), prices: fromLatest(rows)};
    publishLivePrices(next);
    await database.localStorage.set(KEY, next);
    return true;
  } catch (error) {
    console.warn('[prices] refresh failed', error);
    return false;
  }
}
