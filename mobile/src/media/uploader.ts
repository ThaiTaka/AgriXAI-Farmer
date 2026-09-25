/**
 * Background upload of photos and videos, run after every successful sync.
 *
 * Finds the task notes and crop cycles whose media list still has an entry
 * with `uploaded: false`, sends each file to POST /media under its own id, and
 * flips the flag in the row — which the next sync then carries to the server.
 * Order does not matter: a note may reach the server before its photo; the
 * web shows "đang chờ tải lên" until the file follows.
 *
 * A failed upload is simply left for the next pass. Nothing here throws to
 * the caller and nothing blocks a screen.
 */

import {Q} from '@nozbe/watermelondb';

import {uploadMedia} from '../api/media';
import {collections, database} from '../db';
import type CropCycle from '../db/models/CropCycle';
import type TaskNote from '../db/models/TaskNote';
import {fetchNotesWithPendingMedia} from '../db/repositories/taskNoteRepository';
import {markUploaded, pendingMedia} from '../domain/media';
import {localFileFor} from './mediaStore';

let inFlight: Promise<number> | null = null;

/** Uploads whatever is pending; resolves with the number of files sent. */
export function uploadPendingMedia(token: string, ownerId: string): Promise<number> {
  if (!inFlight) {
    inFlight = run(token, ownerId).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function run(token: string, ownerId: string): Promise<number> {
  const notes = await fetchNotesWithPendingMedia(ownerId);
  const cycles = await collections.cropCycles
    .query(Q.where('owner_id', ownerId), Q.where('media_json', Q.like('%"uploaded":false%')))
    .fetch();

  let sent = 0;
  for (const row of [...notes, ...cycles] as (TaskNote | CropCycle)[]) {
    let json = row.mediaJson;
    for (const ref of pendingMedia(json)) {
      const path = await localFileFor(ref);
      // Taken on another phone that has not uploaded it yet: that phone will.
      if (!path) continue;
      try {
        await uploadMedia(token, ref, path);
      } catch (error) {
        console.warn('[media] upload failed', ref.id, error);
        continue;
      }
      json = markUploaded(json, ref.id);
      sent += 1;
    }
    if (json !== row.mediaJson) {
      await database.write(async () => {
        await database.batch(
          row.prepareUpdate((r: TaskNote | CropCycle) => {
            r.mediaJson = json;
          }),
        );
      });
    }
  }
  return sent;
}
