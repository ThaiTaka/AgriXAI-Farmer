/** What the three-step variety picker hands back to the screen that opened it. */
export interface PickedVariety {
  cropType: string;
  cropName: string;
  /** Catalogue category (loại con); null for a farmer-added crop. */
  categoryId: string | null;
  /** Null when the farmer chose "không rõ giống" — only the crop is recorded. */
  varietyId: string | null;
  varietyName: string | null;
}

/** Screens the picker can return to. Each accepts `pickedVariety` in its params. */
export type PickerReturnRoute = 'PlotForm' | 'FertilizerCalculator' | 'CareProtocol';

export type WarehouseTab = 'in' | 'out' | 'stock';
export type FinanceTab = 'income' | 'expense' | 'report';

/** Bottom tabs inside the signed-in stack. */
export type MainTabParamList = {
  Home: undefined;
  Tools: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  /** The tab bar (Trang chủ · Công cụ · Cài đặt). */
  Main: {screen?: keyof MainTabParamList} | undefined;
  PlotDetail: {plotId: string};
  /** "Chọn lô" — the list you pick a plot from before opening its detail. */
  PlotPicker: undefined;
  /**
   * No `plotId` => create mode; with one => edit mode with the fields pre-filled.
   * `pickedVariety` is merged in by the picker screens on the way back.
   */
  PlotForm: {plotId?: string; pickedVariety?: PickedVariety} | undefined;

  /** Variety picker, one route per step so the native back gesture steps back. */
  VarietyCropType: {selectedId: string | null; returnTo?: PickerReturnRoute};
  VarietyCategory: {cropTypeId: string; selectedId: string | null; returnTo?: PickerReturnRoute};
  VarietyPick: {
    cropTypeId: string;
    categoryId: string;
    selectedId: string | null;
    returnTo?: PickerReturnRoute;
  };

  /** Fertiliser catalogue: 6 groups, then the products of one group. */
  FertilizerGroups: undefined;
  FertilizerProducts: {categoryCode: string};

  /** F1 — quantity calculator. Opens blank, from a plot, or with a picked variety. */
  FertilizerCalculator: {plotId?: string; pickedVariety?: PickedVariety} | undefined;
  /** F3 — every product across the three budget tiers. */
  FertilizerBudget: undefined;
  /** F4 — enough in the shed for one application? */
  StockCheck: {fertilizerId?: string; plotId?: string; neededKg?: number} | undefined;
  /** F5–F6 — the four-stage protocol with tick-off history. */
  CareProtocol: {plotId?: string; pickedVariety?: PickedVariety; protocolId?: string} | undefined;
  /** Kho — nhập / xuất / tồn. */
  Warehouse: {tab?: WarehouseTab; prefill?: {fertilizerId: string; quantityKg?: number}} | undefined;
  /** Thu – chi và báo cáo lãi/lỗ. */
  Finance: {tab?: FinanceTab} | undefined;
  /** Báo cáo tháng/quý → PDF. */
  ReportExport: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
