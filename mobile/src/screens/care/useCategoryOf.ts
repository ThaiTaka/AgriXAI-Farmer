import {useMemo} from 'react';

import {USER_CATEGORY_ID} from '../../db/repositories/varietyRepository';
import {seedVarietyCategory} from '../../utils/staticData';
import {useVarietyCatalogue} from '../variety/useVarietyCatalogue';

/**
 * The catalogue category (loại con) a variety belongs to — needed to pick the
 * right protocol (cà phê vối vs chè). Seeded varieties resolve from the
 * bundled catalogue; farmer-added rows from the database; "không rõ giống"
 * gives null, which means "any protocol of the crop".
 */
export function useCategoryOf(varietyId: string | null | undefined): string | null {
  const all = useVarietyCatalogue();
  return useMemo(() => {
    if (!varietyId) return null;
    const seeded = seedVarietyCategory(varietyId);
    if (seeded) return seeded;
    const row = all.find(v => v.id === varietyId);
    if (!row || row.categoryId === USER_CATEGORY_ID) return null;
    return row.categoryId;
  }, [varietyId, all]);
}
