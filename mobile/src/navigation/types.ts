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

export type RootStackParamList = {
  Login: undefined;
  /** Trang chủ — the one screen a farmer lands on; everything else is pushed. */
  Home: undefined;
  /** Công cụ — the full grouped tool list, incl. the two not on the home grid. */
  Tools: undefined;
  Settings: undefined;
  PlotDetail: {plotId: string};
  /** "Chọn lô" — the list you pick a plot from before opening its detail. */
  PlotPicker: undefined;
  /**
   * SỬA một lô đã được giao. `plotId` là bắt buộc: lô đất do bên quản lý đất
   * chia và gán, nông hộ không tự lập lô mới, nên không còn chế độ "tạo".
   * `pickedVariety` được picker gộp vào params trên đường quay lại.
   */
  PlotForm: {plotId: string; pickedVariety?: PickedVariety};

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

  /**
   * V2.1 — one care task: done or not, the farmer's notes with photos/videos,
   * and the labour hired for it. Identified like a tasks_history row, because
   * the row itself may not exist yet (nothing recorded on the task so far).
   */
  TaskDetail: {
    protocolId: string;
    stageCode: string;
    taskKey: string;
    taskTitle: string;
    cropType: string;
    plotId: string | null;
  };
  /** V2.1 — care guides with video, for one crop or all. */
  CareGuides: {cropType?: string} | undefined;
  CareGuide: {guideId: string};
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
