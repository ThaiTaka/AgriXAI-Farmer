/**
 * "Video cách trồng" — one YouTube video per catalogue crop, and a category's
 * own video where that category is grown differently (ớt cay ngoài đồng vs ớt
 * ngọt trong nhà màng; cà phê chè vs cà phê vối). The videos live in
 * shared/data/crop_varieties.json with their title, channel and the date they
 * were checked; how they were chosen is in its `video_policy`.
 */

import {formatDuration} from './youtube';

/** Who made the video — shown with it so a farmer knows how much to trust it. */
export type VideoSourceKind = 'lam_dong' | 'official' | 'community';

export interface CropVideo {
  youtube_id: string;
  /** Title and channel exactly as on YouTube: they are the video's credit. */
  title: string;
  channel: string;
  channel_url: string;
  source_kind: VideoSourceKind;
  duration_s: number;
  published_at: string;
  /** When the video was last confirmed to play inside the app. */
  checked_at: string;
}

export const SOURCE_KIND_LABELS: Record<VideoSourceKind, string> = {
  lam_dong: 'Kênh chính thức ở Lâm Đồng',
  official: 'Kênh của cơ quan nhà nước',
  community: 'Kênh không chính thức',
};

/** Under every video: it shows how, the app's protocol says how much. */
export const VIDEO_DISCLAIMER =
  'Video để tham khảo cách làm. Liều lượng phân, thuốc và lịch bón theo quy trình của tỉnh trong ứng dụng.';

interface VideoCategory {
  category_id: string;
  category_name: string;
  video?: CropVideo;
}

interface VideoCrop {
  name: string;
  video?: CropVideo;
  categories: readonly VideoCategory[];
}

/**
 * The video for a crop, or for one of its categories when that category has
 * its own. Undefined for a crop a farmer added (it is not in the catalogue).
 */
export function videoFor(crop: VideoCrop | undefined, categoryId?: string | null): CropVideo | undefined {
  if (!crop) return undefined;
  const category = categoryId ? crop.categories.find(c => c.category_id === categoryId) : undefined;
  return category?.video ?? crop.video;
}

export interface VideoChoice {
  video: CropVideo;
  /** The crop name, or the categories the video covers when the crop has several. */
  label: string;
  categoryIds: string[];
}

/**
 * The distinct videos of one crop, the crop's own first. A crop with a single
 * video gets one choice named after the crop; Ớt gets "Ớt ngọt (ớt chuông)"
 * and "Ớt cay chỉ địa · Ớt cay chỉ thiên".
 */
export function videoChoices(crop: VideoCrop): VideoChoice[] {
  const byId = new Map<string, {video: CropVideo; names: string[]; categoryIds: string[]}>();
  if (crop.video) byId.set(crop.video.youtube_id, {video: crop.video, names: [], categoryIds: []});
  for (const category of crop.categories) {
    const video = category.video ?? crop.video;
    if (!video) continue;
    const entry = byId.get(video.youtube_id) ?? {video, names: [], categoryIds: []};
    entry.names.push(category.category_name);
    entry.categoryIds.push(category.category_id);
    byId.set(video.youtube_id, entry);
  }
  const entries = [...byId.values()];
  return entries.map(e => ({
    video: e.video,
    label: entries.length === 1 || e.names.length === 0 ? crop.name : e.names.join(' · '),
    categoryIds: e.categoryIds,
  }));
}

/** "Báo và Phát thanh, Truyền hình Lâm Đồng · 3:21". */
export function videoMeta(video: CropVideo): string {
  return `${video.channel} · ${formatDuration(video.duration_s)}`;
}

/** "2025-04-24" → "24/04/2025", read as written (no time zone to shift it a day). */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}
