/**
 * The village forecast on the phone: fetched from the server (which asks
 * Open-Meteo at most every 30 minutes for everyone), kept in local storage
 * so the card still shows the last forecast — with its age — out in a field
 * without signal.
 */

import {request} from '../api/client';
import {database} from '../db';
import type {Forecast} from './weatherIndex';
import {forecastNow, publishForecast} from './weatherIndex';

const KEY = 'village_forecast';
/** The server refreshes every 30 minutes; asking more often gains nothing. */
const REFRESH_MS = 30 * 60 * 1000;

let lastAttempt = 0;

export async function loadCachedForecast(): Promise<void> {
  try {
    const cached = await database.localStorage.get<Forecast>(KEY);
    if (cached?.daily) publishForecast(cached);
  } catch (error) {
    console.warn('[weather] cache read failed', error);
  }
}

/** Fetches a newer forecast when the one on the phone is old. Never throws. */
export async function refreshForecast(token: string, {force = false}: {force?: boolean} = {}): Promise<boolean> {
  const current = forecastNow();
  const now = Date.now();
  if (!force && current && now - current.fetched_at < REFRESH_MS) return false;
  // One try per minute at most, so a screen focusing repeatedly offline does not hammer the radio.
  if (!force && now - lastAttempt < 60_000) return false;
  lastAttempt = now;
  try {
    const next = await request<Forecast>('/weather', {token, timeoutMs: 10_000});
    publishForecast(next);
    await database.localStorage.set(KEY, next);
    return true;
  } catch (error) {
    console.warn('[weather] refresh failed', error);
    return false;
  }
}
