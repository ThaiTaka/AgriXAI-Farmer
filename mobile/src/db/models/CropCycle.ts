import {Model} from '@nozbe/watermelondb';
import {date, field, readonly, relation, text} from '@nozbe/watermelondb/decorators';
import type {Associations} from '@nozbe/watermelondb/Model';

import type Plot from './Plot';

/** Growth stages, matching the stage codes in shared/data/care_protocols.json. */
export type GrowthStage =
  | 'seedling'
  | 'vegetative'
  | 'flowering'
  | 'fruiting'
  | 'harvesting'
  | 'finished';

export default class CropCycle extends Model {
  static table = 'crop_cycles';

  static associations: Associations = {
    plots: {type: 'belongs_to', key: 'plot_id'},
  };

  @text('plot_id') plotId!: string;
  @text('name') name!: string;
  @text('crop_type') cropType!: string;
  @text('variety_id') varietyId!: string | null;
  @text('variety_name') varietyName!: string | null;
  @text('stage') stage!: GrowthStage;
  @field('started_at') startedAt!: number;
  @field('ended_at') endedAt!: number | null;
  @field('yield_kg') yieldKg!: number | null;
  @text('notes') notes!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('plots', 'plot_id') plot!: Plot;
}
