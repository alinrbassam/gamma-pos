import { create } from 'zustand';
import { formatUSD, formatLBP, convertUsdToLbp, convertLbpToUsd, DEFAULT_USD_TO_LBP_RATE } from '../utils/currency';

interface ExchangeRateState {
  usdToLbpRate: number;
  ratePerPlayerHourLbp: number;
  isLoading: boolean;
  error: string | null;

  fetchRates: () => Promise<void>;
  updateRates: (payload: { usdToLbpRate?: number; ratePerPlayerHourLbp?: number }) => Promise<boolean>;
  usdToLbp: (usd: number) => number;
  lbpToUsd: (lbp: number) => number;
  formatUsd: (usd: number) => string;
  formatLbp: (lbp: number) => string;
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  usdToLbpRate: DEFAULT_USD_TO_LBP_RATE,
  ratePerPlayerHourLbp: 200000,
  isLoading: false,
  error: null,

  fetchRates: async () => {
    set({ isLoading: true, error: null });
    try {
      if (window.api?.getRates) {
        const res = await window.api.getRates();
        if (res.success && res.data) {
          set({
            usdToLbpRate: Number(res.data.usdToLbpRate) || DEFAULT_USD_TO_LBP_RATE,
            ratePerPlayerHourLbp: Number(res.data.ratePerPlayerHourLbp) || 200000,
            isLoading: false,
          });
          return;
        }
      }
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to fetch rates' });
    }
  },

  updateRates: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      if (window.api?.updateRates) {
        const res = await window.api.updateRates(payload);
        if (res.success && res.data) {
          set({
            usdToLbpRate: Number(res.data.usdToLbpRate) || get().usdToLbpRate,
            ratePerPlayerHourLbp: Number(res.data.ratePerPlayerHourLbp) || get().ratePerPlayerHourLbp,
            isLoading: false,
          });
          return true;
        } else {
          set({ isLoading: false, error: res.error?.message || 'Failed to update rates' });
          return false;
        }
      }
      set({ isLoading: false });
      return false;
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to update rates' });
      return false;
    }
  },

  usdToLbp: (usd: number) => {
    return convertUsdToLbp(usd, get().usdToLbpRate);
  },

  lbpToUsd: (lbp: number) => {
    return convertLbpToUsd(lbp, get().usdToLbpRate);
  },

  formatUsd: (usd: number) => {
    return formatUSD(usd);
  },

  formatLbp: (lbp: number) => {
    return formatLBP(lbp);
  },
}));
