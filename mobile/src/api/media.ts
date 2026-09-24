/**
 * Media over HTTP: uploading a photo/video the phone already stored, and the
 * short-lived token that lets <Image> / the video WebView load a private file
 * from the server (neither can send an Authorization header).
 *
 * Nothing here is on a screen's critical path: a note with a photo is saved
 * the moment the farmer taps "Lưu"; the upload happens later, in the
 * background, whenever the phone is online (media/uploader.ts).
 */

import type {MediaRef} from '../domain/media';
import {API_BASE_URL, ApiError, NetworkError, request} from './client';

export function mediaUrl(id: string, token?: string | null): string {
  return `${API_BASE_URL}/media/${encodeURIComponent(id)}${token ? `?t=${encodeURIComponent(token)}` : ''}`;
}

/**
 * Sends one stored file. The server keys it by `ref.id`, so sending the same
 * file twice (a retry after a dropped response) is harmless.
 */
export async function uploadMedia(token: string, ref: MediaRef, localPath: string, timeoutMs = 120_000): Promise<void> {
  const form = new FormData();
  form.append('id', ref.id);
  // React Native's FormData streams a file:// URI straight from disk.
  form.append('file', {
    uri: localPath.startsWith('file://') ? localPath : `file://${localPath}`,
    type: ref.mime,
    name: localPath.split('/').pop() ?? `${ref.id}`,
  } as unknown as Blob);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}/media`, {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`},
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = `Lỗi máy chủ (${response.status})`;
      try {
        const body = await response.json();
        if (typeof body?.detail === 'string') detail = body.detail;
      } catch {
        // not JSON — keep the status line
      }
      throw new ApiError(detail, response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

let cached: {forToken: string; token: string; expiresAt: number} | null = null;

/**
 * A media token for `?t=` URLs, reused until 10 minutes before it expires.
 * Null when offline — the caller then shows the placeholder instead.
 */
export async function mediaToken(loginToken: string, now: number = Date.now()): Promise<string | null> {
  if (cached && cached.forToken === loginToken && cached.expiresAt - now > 600_000) return cached.token;
  try {
    const body = await request<{token: string; expires_at: number}>('/media/token', {method: 'POST', token: loginToken});
    cached = {forToken: loginToken, token: body.token, expiresAt: body.expires_at};
    return body.token;
  } catch {
    return null;
  }
}

/** Test hook: forget the cached token. */
export function resetMediaTokenCache(): void {
  cached = null;
}
