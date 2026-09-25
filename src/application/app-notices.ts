/** App-wide notices shown on any screen (captions, updates, storage problems). */
export interface AppNotice {
  captions: Array<{ id: number; text: string }>;
  updateAvailable: boolean;
  offlineReady: boolean;
  storageWarning: string | null;
}
