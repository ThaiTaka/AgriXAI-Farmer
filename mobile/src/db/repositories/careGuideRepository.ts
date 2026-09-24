import {Q} from '@nozbe/watermelondb';

import {collections} from '..';

const WATCHED = ['title', 'summary', 'youtube_id', 'steps_json', 'images_json', 'published', 'sort_order', 'stage_code'];

/**
 * Published guides, optionally for one crop. Drafts sync to the phone too (the
 * table is shared) but are never shown — an admin is still writing them.
 */
export function observeCareGuides(cropType?: string | null) {
  const clauses = [Q.where('published', true)];
  if (cropType) clauses.push(Q.where('crop_type', cropType));
  return collections.careGuides
    .query(...clauses, Q.sortBy('crop_type', Q.asc), Q.sortBy('sort_order', Q.asc))
    .observeWithColumns(WATCHED);
}

export function observeCareGuide(id: string) {
  return collections.careGuides.findAndObserve(id);
}
