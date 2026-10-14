import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StockAdjustmentSchema, StockAdjustmentInput } from '@shared/validation';
import { useProductStore } from '@stores/useProductStore';
import { useInventoryStore } from '@stores/useInventoryStore';
import { useAuthStore } from '@stores/useAuthStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { Card } from '@components/ui/Card';
import { Alert } from '@components/ui/Alert';
import { Table, Column } from '@components/ui/Table';
import { InventoryMovementEntity } from '@shared/types';
import { Sliders, Calendar, Search, RotateCcw } from 'lucide-react';
import { formatDateTime } from '@utils/date';

export const StockAdjustmentsPage: React.FC = () => {
  const { products, loadProducts } = useProductStore();
  const { createAdjustment, movements, loadMovements, isLoading, error } = useInventoryStore();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Date and movement ledger filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activePreset, setActivePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StockAdjustmentInput>({
    resolver: zodResolver(StockAdjustmentSchema),
    defaultValues: {
      productId: '',
      movementType: 'Manual addition',
      quantityChange: 1,
      reason: 'Physical Count Adjustment',
      notes: '',
    },
  });

  const selectedProductId = watch('productId');
  const selectedMovementType = watch('movementType');
  const selectedQtyChange = watch('quantityChange');

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentStock = selectedProduct?.quantity_on_hand ?? 0;
  const unit = selectedProduct?.unit_symbol || '';

  const isDeduction = [
    'Manual deduction',
    'Damaged stock',
    'Expired stock',
    'Lost stock',
  ].includes(selectedMovementType);

  const delta = isDeduction
    ? -Math.abs(Number(selectedQtyChange) || 0)
    : Math.abs(Number(selectedQtyChange) || 0);

  const newStock = currentStock + delta;

  useEffect(() => {
    loadProducts('');
    loadMovements();
  }, [loadProducts, loadMovements]);

  const onSubmit = async (data: StockAdjustmentInput) => {
    setSuccessMsg(null);
    const ok = await createAdjustment(data, user?.id);
    if (ok) {
      setSuccessMsg('Stock adjustment recorded successfully in movement ledger!');
      await loadProducts('');
      await loadMovements();
      reset({
        productId: '',
        movementType: 'Manual addition',
        quantityChange: 1,
        reason: 'Physical Count Adjustment',
        notes: '',
      });
    }
  };

  const setPreset = (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    setActivePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYMD(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setStartDate(toYMD(weekAgo));
      setEndDate(toYMD(now));
    } else if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(startOfMonth));
      setEndDate(toYMD(now));
    }
  };

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // 1. Date filter
      if (startDate || endDate) {
        const movementDate = new Date(m.created_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        const movementYMD = !isNaN(movementDate.getTime())
          ? `${movementDate.getFullYear()}-${pad(movementDate.getMonth() + 1)}-${pad(movementDate.getDate())}`
          : (m.created_at || '').slice(0, 10);

        if (startDate && movementYMD < startDate) return false;
        if (endDate && movementYMD > endDate) return false;
      }

      // 2. Movement Type filter
      if (selectedTypeFilter !== 'all' && m.movement_type !== selectedTypeFilter) {
        return false;
      }

      // 3. Search term filter
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        const prodName = (m.product_name || '').toLowerCase();
        const sku = (m.sku || '').toLowerCase();
        const reason = (m.reason || '').toLowerCase();
        const notes = (m.notes || '').toLowerCase();
        const type = (m.movement_type || '').toLowerCase();
        if (
          !prodName.includes(q) &&
          !sku.includes(q) &&
          !reason.includes(q) &&
          !notes.includes(q) &&
          !type.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [movements, startDate, endDate, selectedTypeFilter, searchFilter]);

  const historyColumns: Column<InventoryMovementEntity>[] = [
    {
      key: 'created_at',
      header: language === 'ar' ? 'الوقت والتاريخ' : 'Timestamp',
      render: (m) => (
        <span className="font-mono text-slate-500 text-[11px]">
          {formatDateTime(m.created_at)}
        </span>
      ),
    },
    {
      key: 'product_name' as keyof InventoryMovementEntity,
      header: language === 'ar' ? 'المنتج' : 'Product',
      render: (m) => (
        <div>
          <span className="font-bold text-slate-900 dark:text-slate-100 block">
            {m.product_name || 'Product'}
          </span>
          {m.sku && <span className="text-[10px] font-mono text-slate-400">[{m.sku}]</span>}
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: language === 'ar' ? 'نوع الحركة' : 'Type',
      render: (m) => (
        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
          {m.movement_type}
        </span>
      ),
    },
    {
      key: 'quantity_change',
      header: language === 'ar' ? 'الكمية' : 'Qty Change',
      render: (m) => {
        const isPos = m.quantity_change > 0;
        return (
          <span className={`font-black ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isPos ? `+${m.quantity_change}` : m.quantity_change} {m.unit_symbol || ''}
          </span>
        );
      },
    },
    {
      key: 'quantity_after',
      header: language === 'ar' ? 'قبل ➔ بعد' : 'Before ➔ After',
      render: (m) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {m.quantity_before} ➔{' '}
          <span className="font-bold text-slate-900 dark:text-slate-100">{m.quantity_after}</span>{' '}
          {m.unit_symbol || ''}
        </span>
      ),
    },
    {
      key: 'reason',
      header: language === 'ar' ? 'السبب' : 'Reason',
      render: (m) => <span className="text-slate-500 text-xs">{m.reason || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3">
        <Sliders className="h-6 w-6 text-sky-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Manual Stock Adjustment
          </h1>
          <p className="text-xs text-slate-500">
            Record manual stock additions, corrections, damaged, or lost inventory entries.
          </p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Product *
            </label>
            <select
              {...register('productId')}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="">Choose a product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name_en} ({p.sku}) [Stock: {p.quantity_on_hand ?? 0} {p.unit_symbol || ''}]
                </option>
              ))}
            </select>
            {errors.productId && (
              <span className="text-xs text-rose-500">{errors.productId.message}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Adjustment Type *
              </label>
              <select
                {...register('movementType')}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="Manual addition">Manual Addition (+)</option>
                <option value="Manual deduction">Manual Deduction (-)</option>
                <option value="Stock correction">Stock Correction</option>
                <option value="Damaged stock">Damaged Stock (-)</option>
                <option value="Expired stock">Expired Stock (-)</option>
                <option value="Lost stock">Lost Stock (-)</option>
              </select>
            </div>

            <Input
              label="Quantity Change *"
              type="number"
              step="0.01"
              {...register('quantityChange', { valueAsNumber: true })}
              error={errors.quantityChange?.message}
            />
          </div>
          {selectedProduct && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Adjustment Impact Preview
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px] block">Current Stock</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {currentStock} {unit}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 text-[10px] block">Adjustment</span>
                  <span
                    className={`font-black text-sm ${
                      delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta} {unit}
                  </span>
                </div>
                <div className="p-2 bg-sky-50 dark:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-800">
                  <span className="text-sky-600 dark:text-sky-400 text-[10px] block font-semibold">New Stock After</span>
                  <span className="font-black text-sky-700 dark:text-sky-300 text-sm">
                    {newStock} {unit}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Input label="Reason *" {...register('reason')} error={errors.reason?.message} />
          <Input label="Additional Notes" {...register('notes')} />

          <div className="pt-2 flex justify-end">
            <Button type="submit" isLoading={isLoading} size="lg">
              Confirm Stock Adjustment →
            </Button>
          </div>
        </form>
      </Card>

      {/* Adjustments History Table */}
      <Card
        title={language === 'ar' ? 'سجل حركات وتعديلات المخزون' : 'Recent Stock Adjustments History'}
        subtitle={
          language === 'ar'
            ? 'سجل حي لكافة الإضافات، الخصومات، المبيعات، والتصحيحات'
            : 'Live ledger of all additions, deductions, corrections, and damage entries'
        }
      >
        {/* Filters Header Bar */}
        <div className="p-3.5 bg-slate-50 dark:bg-[#121316] border border-slate-200 dark:border-[#21242B] rounded-2xl mb-4 space-y-3">
          {/* Presets and Count Badge */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                <Calendar className="h-3.5 w-3.5 text-[#C83818]" />
                {language === 'ar' ? 'الفترة:' : 'Period:'}
              </span>
              {[
                { id: 'all', labelEn: 'All Time', labelAr: 'الكل' },
                { id: 'today', labelEn: 'Today', labelAr: 'اليوم' },
                { id: 'yesterday', labelEn: 'Yesterday', labelAr: 'أمس' },
                { id: 'week', labelEn: 'Last 7 Days', labelAr: 'آخر 7 أيام' },
                { id: 'month', labelEn: 'This Month', labelAr: 'هذا الشهر' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setPreset(btn.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    activePreset === btn.id
                      ? 'bg-[#C83818] text-white shadow-xs'
                      : 'bg-white dark:bg-[#1A1C21] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#252830] border border-slate-200 dark:border-[#282C35]'
                  }`}
                >
                  {language === 'ar' ? btn.labelAr : btn.labelEn}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {(startDate || endDate || selectedTypeFilter !== 'all' || searchFilter || activePreset !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setPreset('all');
                    setSelectedTypeFilter('all');
                    setSearchFilter('');
                  }}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline px-2 py-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{language === 'ar' ? 'إعادة ضبط' : 'Reset'}</span>
                </button>
              )}
              <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1A1C21] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs">
                {language === 'ar'
                  ? `عرض ${filteredMovements.length} من أصل ${movements.length}`
                  : `Showing ${filteredMovements.length} of ${movements.length}`}
              </span>
            </div>
          </div>

          {/* Date Range Inputs & Search Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-200/80 dark:border-[#21242B]">
            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'ar' ? 'من تاريخ:' : 'From Date:'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1A1C21] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-[#C83818] shadow-xs"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'ar' ? 'إلى تاريخ:' : 'To Date:'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1A1C21] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-[#C83818] shadow-xs"
              />
            </div>

            {/* Movement Type Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'ar' ? 'نوع الحركة:' : 'Movement Type:'}
              </label>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1A1C21] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C83818] shadow-xs cursor-pointer"
              >
                <option value="all">{language === 'ar' ? 'جميع الحركات (الكل)' : 'All Movement Types'}</option>
                <option value="Manual addition">{language === 'ar' ? 'إضافة يدوية (+)' : 'Manual addition (+)'}</option>
                <option value="Manual deduction">{language === 'ar' ? 'خصم يدوي (-)' : 'Manual deduction (-)'}</option>
                <option value="Stock correction">{language === 'ar' ? 'تصحيح رصيد' : 'Stock correction'}</option>
                <option value="Opening stock">{language === 'ar' ? 'رصيد افتتاحي' : 'Opening stock'}</option>
                <option value="Customer sale">{language === 'ar' ? 'بيع زبون (-)' : 'Customer sale (-)'}</option>
                <option value="Purchase receipt">{language === 'ar' ? 'توريد مشتريات (+)' : 'Purchase receipt (+)'}</option>
                <option value="Damaged stock">{language === 'ar' ? 'بضاعة تالفة (-)' : 'Damaged stock (-)'}</option>
                <option value="Expired stock">{language === 'ar' ? 'منتهي الصلاحية (-)' : 'Expired stock (-)'}</option>
                <option value="Lost stock">{language === 'ar' ? 'بضاعة مفقودة (-)' : 'Lost stock (-)'}</option>
                <option value="Sale refund">{language === 'ar' ? 'إرجاع مبيعات (+)' : 'Sale refund (+)'}</option>
              </select>
            </div>

            {/* Text Search */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                {language === 'ar' ? 'بحث بالاسم أو الكود:' : 'Search Product / Code:'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={language === 'ar' ? 'ابحث عن اسم أو كود أو سبب...' : 'Search product, SKU, reason...'}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#1A1C21] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C83818] shadow-xs"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <Table
          columns={historyColumns}
          data={filteredMovements}
          keyExtractor={(m) => m.id}
        />
      </Card>
    </div>
  );
};
