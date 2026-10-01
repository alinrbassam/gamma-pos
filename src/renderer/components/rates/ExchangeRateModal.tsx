import React, { useState, useEffect } from 'react';
import { DollarSign, Gamepad2, X, Check, AlertCircle } from 'lucide-react';
import { useExchangeRateStore } from '../../stores/useExchangeRateStore';
import { formatLBP } from '../../utils/currency';

interface ExchangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExchangeRateModal: React.FC<ExchangeRateModalProps> = ({ isOpen, onClose }) => {
  const { usdToLbpRate, ratePerPlayerHourLbp, updateRates, fetchRates } = useExchangeRateStore();
  const [dollarRate, setDollarRate] = useState<string>(String(usdToLbpRate));
  const [psRate, setPsRate] = useState<string>(String(ratePerPlayerHourLbp));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRates();
      setDollarRate(String(usdToLbpRate));
      setPsRate(String(ratePerPlayerHourLbp));
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, usdToLbpRate, ratePerPlayerHourLbp, fetchRates]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedDollar = parseFloat(dollarRate);
    const parsedPs = parseFloat(psRate);

    if (isNaN(parsedDollar) || parsedDollar <= 0) {
      setError('Please enter a valid USD to LBP exchange rate (e.g. 89500).');
      return;
    }

    if (isNaN(parsedPs) || parsedPs <= 0) {
      setError('Please enter a valid PlayStation rate per player per hour (e.g. 200000).');
      return;
    }

    setIsSaving(true);
    const ok = await updateRates({
      usdToLbpRate: parsedDollar,
      ratePerPlayerHourLbp: parsedPs,
    });
    setIsSaving(false);

    if (ok) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setError('Failed to update rates. Please try again.');
    }
  };

  const psRateNum = parseFloat(psRate) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#21242B] bg-slate-50/50 dark:bg-[#1A1C21]/60">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#C83818]/10 dark:bg-[#C83818]/20 text-[#C83818] dark:text-[#DF7E63] rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Manager Rate Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure USD exchange rate and PlayStation hourly rates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <Check className="w-4 h-4 shrink-0" />
              <span>Rates updated successfully!</span>
            </div>
          )}

          {/* USD to LBP Rate */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              USD to LBP Exchange Rate (1 $ = ? L.L)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
                $1 =
              </div>
              <input
                type="number"
                step="any"
                value={dollarRate}
                onChange={(e) => setDollarRate(e.target.value)}
                placeholder="89500"
                className="w-full pl-12 pr-14 py-2.5 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#C83818] focus:border-[#C83818] focus:outline-none"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                L.L
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Used automatically for dual currency display and split payments at checkout.
            </p>
          </div>

          {/* PlayStation Hourly Rate */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-[#C83818]" />
              <span>PlayStation Rate per Player / Hour</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="1000"
                value={psRate}
                onChange={(e) => setPsRate(e.target.value)}
                placeholder="200000"
                className="w-full px-3 pr-14 py-2.5 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-[#C83818] focus:border-[#C83818] focus:outline-none"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-semibold">
                L.L / hr
              </div>
            </div>

            {/* Live Tier Preview */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="p-2 bg-slate-100 dark:bg-[#1A1C21] rounded-lg border border-transparent dark:border-[#282C35]">
                <span className="text-slate-500 text-[10px] block">1 Player:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {formatLBP(psRateNum * 1)}/hr
                </span>
              </div>
              <div className="p-2 bg-slate-100 dark:bg-[#1A1C21] rounded-lg border border-transparent dark:border-[#282C35]">
                <span className="text-slate-500 text-[10px] block">2 Players:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {formatLBP(psRateNum * 2)}/hr
                </span>
              </div>
              <div className="p-2 bg-slate-100 dark:bg-[#1A1C21] rounded-lg border border-transparent dark:border-[#282C35]">
                <span className="text-slate-500 text-[10px] block">3 Players:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {formatLBP(psRateNum * 3)}/hr
                </span>
              </div>
              <div className="p-2 bg-[#C83818]/10 dark:bg-[#C83818]/15 rounded-lg border border-[#C83818]/30">
                <span className="text-[#C83818] dark:text-[#DF7E63] text-[10px] block font-semibold">
                  4 Players (FIFA):
                </span>
                <span className="font-bold text-[#C83818] dark:text-[#DF7E63]">
                  {formatLBP(psRateNum * 4)}/hr
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C21] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-[#C83818] hover:bg-[#A72B11] disabled:opacity-50 rounded-xl transition-colors shadow-xs flex items-center gap-1.5"
            >
              {isSaving ? 'Saving...' : 'Save Rates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
