import React, { useEffect } from 'react';
import { useReportsStore } from '@stores/useReportsStore';
import { useAuthStore } from '@stores/useAuthStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Card } from '@components/ui/Card';
import { Input } from '@components/ui/Input';
import { Alert } from '@components/ui/Alert';
import { Button } from '@components/ui/Button';
import { Layers, Lock } from 'lucide-react';
import { formatCurrency } from '../../renderer/utils/currency';

export const FinancialReportPage: React.FC = () => {
  const { startDate, endDate, setDateRange, financialMetrics, loadFinancialReport, error } =
    useReportsStore();
  const { role, activeRoleMode, setManagerUnlockModalOpen } = useAuthStore();
  const { language } = useLanguageStore();

  const isManagerOrOwner =
    activeRoleMode === 'manager' ||
    role?.name === 'Owner' ||
    role?.name === 'Manager' ||
    role?.name === 'admin' ||
    role?.name === 'super_admin' ||
    !role;

  useEffect(() => {
    if (isManagerOrOwner) {
      loadFinancialReport('Owner');
    }
  }, [startDate, endDate, role, activeRoleMode, isManagerOrOwner, loadFinancialReport]);

  if (!isManagerOrOwner) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {language === 'ar' ? 'يلزم تفعيل وضع المدير' : 'Manager Mode Required'}
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          {language === 'ar'
            ? 'تقارير الأرباح والخسائر المالية مخصصة للمدير وصاحب العمل. يرجى تفعيل وضع المدير لعرض الإيرادات والتكاليف والأرباح.'
            : 'Financial Profit & Loss statements are restricted to Managers & Business Owners. Please unlock Manager Mode to view revenue, COGS, and profit metrics.'}
        </p>
        <div className="pt-2">
          <Button
            onClick={() => setManagerUnlockModalOpen(true)}
            className="bg-[#C83818] hover:bg-[#A72B11] text-white font-bold px-6 py-2.5 rounded-xl shadow-md"
          >
            {language === 'ar' ? 'تفعيل وضع المدير (الرمز: 1234)' : 'Unlock Manager Mode (PIN: 1234)'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <Layers className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {language === 'ar' ? 'تقرير الأرباح والخسائر المالية (P&L)' : 'Financial Profit & Loss (P&L)'}
            </h1>
            <p className="text-xs text-slate-500">
              {language === 'ar'
                ? 'إجمالي الإيرادات، تكلفة البضاعة المباعة (COGS)، المصاريف التشغيلية، وصافي الربح.'
                : 'Gross revenue, Cost of Goods Sold (COGS), operating expenses, and Net Profit.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
          <Input
            type="date"
            lang="en-US"
            value={startDate}
            onChange={(e) => setDateRange(e.target.value, endDate)}
            className="text-xs border-none p-1"
          />
          <span className="text-slate-400 text-xs">{language === 'ar' ? 'إلى' : 'to'}</span>
          <Input
            type="date"
            lang="en-US"
            value={endDate}
            onChange={(e) => setDateRange(startDate, e.target.value)}
            className="text-xs border-none p-1"
          />
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 rtl:border-l-0 rtl:border-r-4 border-l-sky-500 rtl:border-r-sky-500 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'ar' ? 'إجمالي الإيرادات (المبيعات)' : 'Total Revenue'}
          </span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {formatCurrency(financialMetrics?.revenue || 0)}
          </h3>
        </Card>

        <Card className="border-l-4 rtl:border-l-0 rtl:border-r-4 border-l-amber-500 rtl:border-r-amber-500 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'ar' ? 'تكلفة البضاعة المباعة (COGS)' : 'Cost of Goods Sold (COGS)'}
          </span>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(financialMetrics?.cogs || 0)}
          </h3>
        </Card>

        <Card className="border-l-4 rtl:border-l-0 rtl:border-r-4 border-l-emerald-500 rtl:border-r-emerald-500 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {language === 'ar' ? 'صافي الربح' : 'Net Profit'}
          </span>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(financialMetrics?.netProfit || 0)}
          </h3>
          <span className="text-[10px] text-slate-500">
            {language === 'ar' ? `الهامش: ${financialMetrics?.profitMarginPercent || 0}%` : `Margin: ${financialMetrics?.profitMarginPercent || 0}%`}
          </span>
        </Card>
      </div>

      <Card title={language === 'ar' ? 'كشف تفاصيل الأرباح والخسائر' : 'P&L Breakdown Statement'}>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'إجمالي إيرادات المبيعات:' : 'Gross Sales Revenue:'}
            </span>
            <span className="font-bold font-mono">{formatCurrency(financialMetrics?.revenue || 0)}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'يطرح: تكلفة البضاعة المباعة (COGS):' : 'Less: Cost of Goods Sold (COGS):'}
            </span>
            <span className="font-bold text-rose-500 font-mono">-{formatCurrency(financialMetrics?.cogs || 0)}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-2 rounded font-bold text-emerald-600">
            <span>{language === 'ar' ? 'إجمالي الربح (مجمل الربح):' : 'Gross Profit:'}</span>
            <span className="font-mono">{formatCurrency(financialMetrics?.grossProfit || 0)}</span>
          </div>

          <div className="flex justify-between py-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'يطرح: المصاريف التشغيلية (كهرباء، ماء، شحن، صيانة...):' : 'Less: Operating Expenses (Electricity, Water, Ice, etc.):'}
            </span>
            <span className="font-bold text-rose-500 font-mono">-{formatCurrency(financialMetrics?.expenses || 0)}</span>
          </div>

          <div className="flex justify-between py-3 border-t-2 border-slate-900 dark:border-slate-100 text-base font-black text-emerald-600">
            <span>{language === 'ar' ? 'صافي الربح التشغيلي:' : 'Net Operating Profit:'}</span>
            <span className="font-mono">{formatCurrency(financialMetrics?.netProfit || 0)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
