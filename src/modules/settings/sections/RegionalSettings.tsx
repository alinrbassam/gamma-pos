import React, { useState, useEffect } from 'react';
import { Button } from '@components/ui/Button';
import { DollarSign, Gamepad2, Check, AlertCircle } from 'lucide-react';
import { useExchangeRateStore } from '../../../renderer/stores/useExchangeRateStore';
import { formatLBP } from '../../../renderer/utils/currency';
import { useLanguageStore } from '../../../renderer/stores/useLanguageStore';

export const RegionalSettings: React.FC = () => {
  const { language } = useLanguageStore();
  const { usdToLbpRate, ratePerPlayerHourLbp, updateRates, fetchRates } = useExchangeRateStore();

  const [dollarRate, setDollarRate] = useState<string>(String(usdToLbpRate));
  const [psRate, setPsRate] = useState<string>(String(ratePerPlayerHourLbp));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  useEffect(() => {
    setDollarRate(String(usdToLbpRate));
    setPsRate(String(ratePerPlayerHourLbp));
  }, [usdToLbpRate, ratePerPlayerHourLbp]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const parsedDollar = parseFloat(dollarRate);
    const parsedPs = parseFloat(psRate);

    if (isNaN(parsedDollar) || parsedDollar <= 0) {
      setError(
        language === 'ar'
          ? 'يرجى إدخال سعر صرف صحيح للدولار (مثال: 89500)'
          : 'Please enter a valid USD to LBP rate (e.g. 89500)',
      );
      return;
    }

    if (isNaN(parsedPs) || parsedPs <= 0) {
      setError(
        language === 'ar'
          ? 'يرجى إدخال تسعيرة بلايستيشن صحيحة لكل لاعب بالساعة (مثال: 200000)'
          : 'Please enter a valid PlayStation rate per player / hour (e.g. 200000)',
      );
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
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(language === 'ar' ? 'فشل حفظ الأسعار' : 'Failed to save rate settings.');
    }
  };

  const psRateNum = parseFloat(psRate) || 0;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#C83818]" />
          <span>{language === 'ar' ? 'أسعار الصرف وتسعيرة البلايستيشن' : 'Currency Exchange & PlayStation Rates'}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {language === 'ar'
            ? 'تعديل سعر صرف الليرة اللبنانية وتسعيرة ساعة ألعاب البلايستيشن في جميع أقسام النظام'
            : 'Configure market Lebanese Pound exchange rate and hourly PlayStation gaming prices'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 shrink-0" />
          <span>
            {language === 'ar'
              ? 'تم تحديث الأسعار وحفظها بنجاح!'
              : 'Rates successfully updated and saved!'}
          </span>
        </div>
      )}

      {/* 1. USD to LBP Rate Card */}
      <div className="p-4 bg-white dark:bg-[#141518] rounded-2xl border border-slate-200 dark:border-[#21242B] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {language === 'ar' ? 'سعر صرف الدولار مقابل الليرة اللبنانية' : 'USD to LBP Market Exchange Rate'}
            </h4>
            <span className="text-[10px] text-slate-400">
              {language === 'ar' ? 'المبلغ بالليرة لكل 1 دولار أمريكي' : 'L.L per 1.00 USD ($1)'}
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
            $1 =
          </div>
          <input
            type="number"
            step="any"
            value={dollarRate}
            onChange={(e) => setDollarRate(e.target.value)}
            placeholder="89500"
            className="w-full pl-12 pr-14 py-2.5 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-[#C83818] focus:border-[#C83818] focus:outline-none"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
            L.L
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          {language === 'ar'
            ? 'يستخدم لتحويل أسعار المنتجات في الكاشير والفواتير وحساب الدفع المجزأ (دولار / ليرة).'
            : 'Used automatically for dual currency product prices, POS checkout, and split cash payments.'}
        </p>
      </div>

      {/* 2. PlayStation Hourly Rate Card */}
      <div className="p-4 bg-white dark:bg-[#141518] rounded-2xl border border-slate-200 dark:border-[#21242B] shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#C83818]/10 text-[#C83818] rounded-lg">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {language === 'ar' ? 'تسعيرة ساعة البلايستيشن لكل لاعب' : 'PlayStation Rate per Player / Hour'}
            </h4>
            <span className="text-[10px] text-slate-400">
              {language === 'ar' ? 'التسعيرة المعتمدة للّاعب الواحد بالساعة' : 'Base rate per single player for 60 minutes'}
            </span>
          </div>
        </div>

        <div className="relative">
          <input
            type="number"
            step="1000"
            value={psRate}
            onChange={(e) => setPsRate(e.target.value)}
            placeholder="200000"
            className="w-full px-3 pr-20 py-2.5 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-[#C83818] focus:border-[#C83818] focus:outline-none"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
            L.L / hr
          </div>
        </div>

        {/* Live Calculation Preview */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
            {language === 'ar' ? 'المعاينة التلقائية حسب عدد اللاعبين:' : 'Automatic Player Tier Preview:'}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-[#1A1C21] rounded-xl border border-slate-200 dark:border-[#282C35] text-center">
              <span className="text-[10px] text-slate-400 block font-semibold">1 {language === 'ar' ? 'لاعب' : 'Player'}</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-100 font-mono text-xs">
                {formatLBP(psRateNum * 1)}/hr
              </span>
            </div>
            <div className="p-2.5 bg-[#C83818]/10 dark:bg-[#C83818]/15 rounded-xl border border-[#C83818]/30 text-center">
              <span className="text-[10px] text-[#C83818] dark:text-[#DF7E63] block font-bold">2 {language === 'ar' ? 'لاعبين' : 'Players'}</span>
              <span className="font-black text-[#C83818] dark:text-[#DF7E63] font-mono text-xs">
                {formatLBP(psRateNum * 2)}/hr
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-[#1A1C21] rounded-xl border border-slate-200 dark:border-[#282C35] text-center">
              <span className="text-[10px] text-slate-400 block font-semibold">3 {language === 'ar' ? 'لاعبين' : 'Players'}</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-100 font-mono text-xs">
                {formatLBP(psRateNum * 3)}/hr
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-[#1A1C21] rounded-xl border border-slate-200 dark:border-[#282C35] text-center">
              <span className="text-[10px] text-slate-400 block font-semibold">4 {language === 'ar' ? 'لاعبين (فيفا)' : 'Players (FIFA)'}</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-100 font-mono text-xs">
                {formatLBP(psRateNum * 4)}/hr
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-[#C83818] hover:bg-[#A82810] text-white px-6 font-bold"
        >
          {isSaving
            ? language === 'ar'
              ? 'جاري الحفظ...'
              : 'Saving...'
            : language === 'ar'
            ? 'حفظ الأسعار'
            : 'Save Rate Settings'}
        </Button>
      </div>
    </form>
  );
};
