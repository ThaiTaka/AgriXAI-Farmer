/**
 * Taking a photo or video and keeping it safe on the phone.
 *
 * The picker hands back a file in the app's *cache*, which Android is free to
 * empty when storage runs low — possibly days before the farmer is back in
 * signal to upload it. So every file is moved at once into the documents
 * folder under its media id (domain/media.ts), and only then referenced from
 * a note. Sizes are kept modest for 3G: photos at most 1600 px, JPEG 70 %;
 * videos in the picker's low quality, at most one minute.
 */

import {DocumentDirectoryPath, copyFile, exists, mkdir, moveFile, unlink} from '@dr.pogodin/react-native-fs';
import type {Asset, CameraOptions, ImageLibraryOptions} from 'react-native-image-picker';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

import type {MediaKind, MediaRef} from '../domain/media';
import {localMediaPath, newMediaId} from '../domain/media';

export type CaptureSource = 'photo' | 'video' | 'library';

const PHOTO: Partial<CameraOptions> = {
  quality: 0.7,
  maxWidth: 1600,
  maxHeight: 1600,
  // iOS: hand over a JPEG, never HEIC (the server refuses what browsers cannot show).
  assetRepresentationMode: 'compatible',
};

export const MAX_VIDEO_SECONDS = 60;

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureError';
  }
}

/** Opens the camera or the gallery; resolves with the stored refs (empty if cancelled). */
export async function captureMedia(source: CaptureSource): Promise<MediaRef[]> {
  const response =
    source === 'photo'
      ? await launchCamera({...PHOTO, mediaType: 'photo', saveToPhotos: false} as CameraOptions)
      : source === 'video'
        ? await launchCamera({
            mediaType: 'video',
            videoQuality: 'low',
            durationLimit: MAX_VIDEO_SECONDS,
            formatAsMp4: true,
            saveToPhotos: false,
          })
        : await launchImageLibrary({
            ...PHOTO,
            mediaType: 'mixed',
            selectionLimit: 5,
            formatAsMp4: true,
          } as ImageLibraryOptions);

  if (response.didCancel) return [];
  if (response.errorCode) {
    // The farmer sees a plain sentence; the picker's own words go to the log
    // (and to error_logs through the error boundary) for whoever debugs it.
    console.warn('[media] picker failed', response.errorCode, response.errorMessage);
    throw new CaptureError(
      response.errorCode === 'camera_unavailable'
        ? 'Máy không có camera dùng được.'
        : response.errorCode === 'permission'
          ? 'Ứng dụng chưa được phép dùng camera/thư viện ảnh. Mở Cài đặt của máy để cho phép.'
          : 'Không lấy được ảnh/video. Thử lại.',
    );
  }
  const refs: MediaRef[] = [];
  for (const asset of response.assets ?? []) {
    refs.push(await keep(asset));
  }
  return refs;
}

function kindOf(asset: Asset): MediaKind {
  return asset.type?.startsWith('video') || asset.duration != null ? 'video' : 'image';
}

async function keep(asset: Asset): Promise<MediaRef> {
  if (!asset.uri) throw new CaptureError('Không lấy được ảnh/video. Thử lại.');
  const kind = kindOf(asset);
  const ref: MediaRef = {
    id: newMediaId(),
    kind,
    mime: asset.type ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
    uploaded: false,
  };
  await mkdir(`${DocumentDirectoryPath}/media`);
  const target = localMediaPath(DocumentDirectoryPath, ref);
  const from = asset.uri.replace(/^file:\/\//, '');
  try {
    await moveFile(from, target);
  } catch {
    // content:// or a file the picker still holds — copy instead.
    await copyFile(asset.uri, target);
  }
  return ref;
}

/** The file on this phone, or null (taken on another device, or deleted). */
export async function localFileFor(ref: MediaRef): Promise<string | null> {
  const path = localMediaPath(DocumentDirectoryPath, ref);
  return (await exists(path)) ? path : null;
}

export async function deleteLocalMedia(refs: readonly MediaRef[]): Promise<void> {
  for (const ref of refs) {
    const path = localMediaPath(DocumentDirectoryPath, ref);
    if (await exists(path)) await unlink(path).catch(() => {});
  }
}
