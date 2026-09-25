import { useSyncExternalStore } from 'react';
import type { GameSettings } from '@/domain/settings';
import { useServices } from './services';

export interface Subscribable<T> {
  subscribe: (listener: () => void) => () => void;
  getState: () => T;
}

/** Subscribe a component to a Store (UI state, session state, settings…). */
export function useStore<T>(store: Subscribable<T>): T {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useSettings(): GameSettings {
  return useStore(useServices().settings.store);
}
