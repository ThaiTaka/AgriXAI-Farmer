export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  PlotDetail: {plotId: string};
  /** No `plotId` => create mode; with one => edit mode with the fields pre-filled. */
  PlotForm: {plotId?: string} | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
