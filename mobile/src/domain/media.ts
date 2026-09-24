/**
 * Media refs — the JSON list a task note or a crop cycle keeps in its
 * `media_json` column (twin of backend/app/services/media_service.py):
 *
 *     [{"id": "b1f0…", "kind": "image", "mime": "image/jpeg", "uploaded": false}]
 *
 * The bytes never ride the sync. The phone stores each file under its id in
 * the app's documents folder (not the cache, which Android may empty while the
 * farmer is still out of signal), uploads it to POST /media when online, then
 * flips `uploaded`. Another device finds the file missing locally and loads it
 * from the server instead.
 */

export type MediaKind = 'image' | 'video';

export interface MediaRef {
  id: string;
  kind: MediaKind;
  mime: string;
  uploaded: boolean;
}

export function parseMediaRefs(raw: string | null | undefined): MediaRef[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && typeof (r as {id?: unknown}).id === 'string')
    .map(r => ({
      id: r.id as string,
      kind: r.kind === 'video' ? 'video' : 'image',
      mime: typeof r.mime === 'string' ? r.mime : r.kind === 'video' ? 'video/mp4' : 'image/jpeg',
      uploaded: r.uploaded === true,
    }));
}

export function serializeMediaRefs(refs: readonly MediaRef[]): string | null {
  return refs.length ? JSON.stringify(refs) : null;
}

export function markUploaded(raw: string | null | undefined, id: string): string | null {
  return serializeMediaRefs(parseMediaRefs(raw).map(r => (r.id === id ? {...r, uploaded: true} : r)));
}

export function pendingMedia(raw: string | null | undefined): MediaRef[] {
  return parseMediaRefs(raw).filter(r => !r.uploaded);
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
  'video/webm': 'webm',
};

export function extensionFor(mime: string, kind: MediaKind): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? (kind === 'video' ? 'mp4' : 'jpg');
}

/** Where a media file lives on this phone. `baseDir` is the documents folder. */
export function localMediaPath(baseDir: string, ref: Pick<MediaRef, 'id' | 'kind' | 'mime'>): string {
  return `${baseDir}/media/${ref.id}.${extensionFor(ref.mime, ref.kind)}`;
}

/** Random id for a new photo — hex, as the server's id pattern expects. */
export function newMediaId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < 32; i++) id += Math.floor(random() * 16).toString(16);
  return id;
}

/** "3 ảnh · 1 video" — the count under a note or a harvest. */
export function describeMedia(refs: readonly MediaRef[]): string | null {
  const images = refs.filter(r => r.kind === 'image').length;
  const videos = refs.length - images;
  const parts = [images ? `${images} ảnh` : null, videos ? `${videos} video` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
