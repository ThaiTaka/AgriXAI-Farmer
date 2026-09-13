import {useMemo} from 'react';

import type CropVariety from '../../db/models/CropVariety';
import type {VarietyOption} from '../../db/repositories/varietyRepository';
import {mergeAllVarieties, observeAllVarieties} from '../../db/repositories/varietyRepository';
import {useObservable} from '../../db/useObservable';

/**
 * The full variety catalogue as the three picker steps see it: bundled seed
 * entries merged with every row in the local database. Re-renders the moment a
 * farmer adds a variety, with or without network.
 */
export function useVarietyCatalogue(): VarietyOption[] {
  const rows = useObservable<CropVariety[]>(() => observeAllVarieties(), [], []);
  return useMemo(() => mergeAllVarieties(rows), [rows]);
}
