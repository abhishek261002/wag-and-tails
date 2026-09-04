import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PartnerMode = 'grooming' | 'walking';

interface ModeState {
  mode: PartnerMode;
  isOnline: boolean;
  setMode: (mode: PartnerMode) => Promise<void>;
  setOnline: (online: boolean) => void;
}

const MODE_KEY = 'wag_partner_mode';

export const useModeStore = create<ModeState>((set, get) => ({
  mode: 'grooming',
  isOnline: false,

  setMode: async (mode) => {
    await AsyncStorage.setItem(MODE_KEY, mode);
    set({ mode });
  },

  setOnline: (online) => set({ isOnline: online }),
}));
