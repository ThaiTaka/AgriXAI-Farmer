import type {DiagnosisResult} from '../db/repositories/diagnosisRepository';
import {API_BASE_URL, ApiError, NetworkError} from './client';

/** How long a single upload may take before we treat it as "no signal". */
const UPLOAD_TIMEOUT_MS = 30_000;

export interface UploadInput {
  photoPath: string;
  photoMime: string;
  plotId: string;
  /** Client-generated id, so a retry overwrites the same stored file. */
  clientId: string;
  token: string;
}

/**
 * Uploads one leaf photo and returns the model's answer.
 *
 * Multipart rather than base64 JSON: a 600×600 JPEG is ~80 KB of binary, and
 * base64 would inflate it by a third over the exact connection this feature is
 * most likely to run on.
 *
 * **Retries once on a connection-level failure.** A multipart body is a one-shot
 * stream, so OkHttp cannot replay it — if the pooled connection it picked has
 * gone stale (a server keep-alive expiring is enough), the request fails
 * immediately with "Network request failed" even though the network is fine.
 * Treating that as "the farmer has no signal" would queue a photo that could
 * have been analysed on the spot. One immediate retry on a fresh connection
 * separates a hiccup from an actual outage; a real outage still fails twice and
 * lands in the queue where it belongs.
 */
export async function analysePhoto(input: UploadInput): Promise<DiagnosisResult> {
  try {
    return await uploadOnce(input);
  } catch (error) {
    if (error instanceof NetworkError) return uploadOnce(input);
    throw error;
  }
}

async function uploadOnce(input: UploadInput): Promise<DiagnosisResult> {
  const form = new FormData();
  form.append('image', {
    uri: input.photoPath,
    type: input.photoMime,
    name: `leaf${extensionFor(input.photoMime)}`,
  } as unknown as Blob);
  form.append('plot_id', input.plotId);
  form.append('client_id', input.clientId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/diagnoses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        // Content-Type is left unset on purpose: fetch adds the multipart
        // boundary itself, and setting it by hand produces a body the server
        // cannot parse.
        Accept: 'application/json',
      },
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      detailOf(payload) ?? `Máy chủ trả lỗi ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as DiagnosisResult;
}

function extensionFor(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function detailOf(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as {detail: unknown}).detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}
