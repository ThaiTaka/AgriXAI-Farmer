import type {DiagnosisResult} from '../db/repositories/diagnosisRepository';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  PlotDetail: {plotId: string};
  /** No `plotId` => create mode; with one => edit mode with the fields pre-filled. */
  PlotForm: {plotId?: string} | undefined;

  /** Giai đoạn 2 — the image diagnosis flow. */
  CaptureImage: {plotId?: string} | undefined;
  Analyzing: {plotId: string; photoUri: string; photoMime: string};
  /**
   * Three ways in:
   *   fresh   — analysed online, not written to the database yet
   *   pending — queued while offline, no answer yet
   *   saved   — opened from the history list
   */
  DiagnosisResult:
    | {
        mode: 'fresh';
        plotId: string;
        photoUri: string;
        result: DiagnosisResult;
        /** Decided before the upload, so saving is idempotent. */
        diagnosisId: string;
      }
    | {mode: 'pending'; pendingId: string; plotId: string; photoUri: string}
    | {mode: 'saved'; diagnosisId: string; plotId?: string; photoUri?: string};
  Treatment: {diseaseKey: string; plotId?: string};
  DiagnosisHistory: {plotId: string};
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
