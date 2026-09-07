import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, relation, text} from '@nozbe/watermelondb/decorators';
import type {Associations} from '@nozbe/watermelondb/Model';

import type Plot from './Plot';

export type SeverityKey = 'none' | 'mild' | 'moderate' | 'severe';

export default class Diagnosis extends Model {
  static table = 'diagnoses';

  static associations: Associations = {
    plots: {type: 'belongs_to', key: 'plot_id'},
  };

  @text('plot_id') plotId!: string;
  @text('disease_key') diseaseKey!: string;
  @text('disease_name') diseaseName!: string;
  @text('severity') severity!: SeverityKey;
  @field('confidence') confidence!: number;
  @field('affected_ratio') affectedRatio!: number | null;
  @text('image_path') imagePath!: string | null;
  @text('model_version') modelVersion!: string | null;
  @text('explanation') explanation!: string | null;
  /** JSON: the three predictions the model returned, best first. */
  @text('top3_json') top3Json!: string | null;
  /** JSON heatmap, or null when the model produced none — never faked. */
  @text('heatmap_json') heatmapJson!: string | null;
  /** True while the photo is waiting for a network connection (Điều 3). */
  @field('queued') queued!: boolean;
  @field('diagnosed_at') diagnosedAt!: number;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('plots', 'plot_id') plot!: Plot;
}
