import type { PetApi } from '../preload/preload';

declare global {
  interface Window {
    petApi: PetApi;
  }
}

export const api = window.petApi;
