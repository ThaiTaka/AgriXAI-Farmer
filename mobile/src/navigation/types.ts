/** What the three-step variety picker hands back to the plot form. */
export interface PickedVariety {
  cropType: string;
  cropName: string;
  /** Null when the farmer chose "không rõ giống" — only the crop is recorded. */
  varietyId: string | null;
  varietyName: string | null;
}

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  PlotDetail: {plotId: string};
  /**
   * No `plotId` => create mode; with one => edit mode with the fields pre-filled.
   * `pickedVariety` is merged in by the picker screens on the way back.
   */
  PlotForm: {plotId?: string; pickedVariety?: PickedVariety} | undefined;

  /** Variety picker, one route per step so the native back gesture steps back. */
  VarietyCropType: {selectedId: string | null};
  VarietyCategory: {cropTypeId: string; selectedId: string | null};
  VarietyPick: {cropTypeId: string; categoryId: string; selectedId: string | null};

  /** Fertiliser catalogue: 6 groups, then the products of one group. */
  FertilizerGroups: undefined;
  FertilizerProducts: {categoryCode: string};
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
