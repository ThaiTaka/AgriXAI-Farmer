/**
 * Thin HTTP client for the AgriLog backend.
 *
 * Deliberately small: nothing in the farmer-facing screens is allowed to block
 * on it (Điều 1). Callers treat every failure here as "not now" and carry on
 * against the local database.
 */

import {Platform} from 'react-native';

/**
 * 10.0.2.2 is the host machine as seen from the Android emulator. On a real
 * device set the LAN address instead — or run `adb reverse tcp:8000 tcp:8000`
 * and keep localhost.
 */
export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://127.0.0.1:8000',
  default: 'http://127.0.0.1:8000',
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Không kết nối được máy chủ') {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Farmer-facing screens must never hang; 12s is already generous on 3G. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {method = 'GET', body, token, timeoutMs = 12_000, signal} = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      throw new ApiError(extractDetail(payload) ?? `Lỗi máy chủ (${response.status})`, response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // fetch rejects with a TypeError when there is no route to the host, and
    // with an AbortError when our own timeout fires. Both mean "offline" to the
    // caller, and neither should ever surface as a raw JS error to the farmer.
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractDetail(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as {detail: unknown}).detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}
