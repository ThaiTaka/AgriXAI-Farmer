import {Model, Q} from '@nozbe/watermelondb';
import {children, date, field, lazy, readonly, text} from '@nozbe/watermelondb/decorators';
import type {Associations} from '@nozbe/watermelondb/Model';

import type CropCycle from './CropCycle';
import type Diagnosis from './Diagnosis';

export type PlotStatus = 'active' | 'fallow' | 'harvested';

export default class Plot extends Model {
  static table = 'plots';

  static associations: Associations = {
    diagnoses: {type: 'has_many', foreignKey: 'plot_id'},
    crop_cycles: {type: 'has_many', foreignKey: 'plot_id'},
  };

  @text('code') code!: string;
  @text('name') name!: string;
  @text('region') region!: string | null;
  @field('area') area!: number;
  @text('area_unit') areaUnit!: string;
  @text('crop_type') cropType!: string;
  @text('variety_id') varietyId!: string | null;
  @text('variety_name') varietyName!: string | null;
  @field('planted_at') plantedAt!: number | null;
  @text('status') status!: PlotStatus;
  @text('notes') notes!: string | null;
  @text('owner_id') ownerId!: string;
  @text('updated_by') updatedBy!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('diagnoses') diagnoses!: Diagnosis[];
  @children('crop_cycles') cropCycles!: CropCycle[];

  /** Most recent diagnosis on this plot — drives the health badge on the home list. */
  @lazy
  latestDiagnosis = this.collections
    .get<Diagnosis>('diagnoses')
    .query(Q.where('plot_id', this.id), Q.sortBy('diagnosed_at', Q.desc), Q.take(1));

  @lazy
  diagnosisHistory = this.collections
    .get<Diagnosis>('diagnoses')
    .query(Q.where('plot_id', this.id), Q.sortBy('diagnosed_at', Q.desc));

  @lazy
  cycles = this.collections
    .get<CropCycle>('crop_cycles')
    .query(Q.where('plot_id', this.id), Q.sortBy('started_at', Q.desc));
}
