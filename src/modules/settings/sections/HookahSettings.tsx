import React, { useState, useEffect } from 'react';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Dialog } from '@components/ui/Dialog';
import { useLanguageStore } from '../../../renderer/stores/useLanguageStore';
import { HookahFlavorEntity } from '../../../shared/types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const HookahSettings: React.FC = () => {
  const { language } = useLanguageStore();
  const [flavors, setFlavors] = useState<HookahFlavorEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNameEn, setFormNameEn] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formPriceUsd, setFormPriceUsd] = useState('5.00');
  const [formPriceLbp, setFormPriceLbp] = useState('450000');
  const [formRefillPriceUsd, setFormRefillPriceUsd] = useState('3.00');
  const [formRefillPriceLbp, setFormRefillPriceLbp] = useState('270000');
  const [formOrder, setFormOrder] = useState('1');

  const fetchFlavors = async () => {
    setLoading(true);
    try {
      if (window.api?.getHookahFlavors) {
        const res = await window.api.getHookahFlavors(false);
        if (res.success && res.data) {
          setFlavors(res.data);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch flavors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlavors();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormNameEn('');
    setFormNameAr('');
    setFormPriceUsd('5.00');
    setFormPriceLbp('450000');
    setFormRefillPriceUsd('3.00');
    setFormRefillPriceLbp('270000');
    setFormOrder(String(flavors.length + 1));
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (flv: HookahFlavorEntity) => {
    setEditingId(flv.id);
    setFormNameEn(flv.name_en);
    setFormNameAr(flv.name_ar);
    setFormPriceUsd(String(flv.price_usd));
    setFormPriceLbp(String(flv.price_lbp));
    setFormRefillPriceUsd(String(flv.refill_price_usd));
    setFormRefillPriceLbp(String(flv.refill_price_lbp));
    setFormOrder(String(flv.display_order || 1));
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNameEn.trim() && !formNameAr.trim()) {
      setErrorMsg(language === 'ar' ? 'يرجى إدخال اسم النكهة' : 'Flavor name is required');
      return;
    }

    try {
      if (window.api?.saveHookahFlavor) {
        const payload: Partial<HookahFlavorEntity> = {
          id: editingId || undefined,
          name_en: formNameEn.trim() || formNameAr.trim(),
          name_ar: formNameAr.trim() || formNameEn.trim(),
          price_usd: parseFloat(formPriceUsd) || 0,
          price_lbp: parseFloat(formPriceLbp) || 0,
          refill_price_usd: parseFloat(formRefillPriceUsd) || 0,
          refill_price_lbp: parseFloat(formRefillPriceLbp) || 0,
          display_order: parseInt(formOrder, 10) || 1,
          is_active: 1,
        };

        const res = await window.api.saveHookahFlavor(payload);
        if (res.success) {
          setSuccessMsg(language === 'ar' ? 'تم حفظ النكهة والأسعار بنجاح' : 'Flavor saved successfully');
          setIsModalOpen(false);
          fetchFlavors();
          setTimeout(() => setSuccessMsg(null), 3500);
        } else {
          setErrorMsg(res.error?.message || 'Failed to save flavor');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving flavor');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmMsg =
      language === 'ar'
        ? `هل أنت متأكد من إلغاء تفعيل نكهة "${name}"؟`
        : `Are you sure you want to deactivate "${name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (window.api?.deleteHookahFlavor) {
        const res = await window.api.deleteHookahFlavor(id);
        if (res.success) {
          setSuccessMsg(language === 'ar' ? 'تم إلغاء تفعيل النكهة' : 'Flavor deactivated');
          fetchFlavors();
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete');
    }
  };

  const formatLbp = (val: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(val)) + ' LBP';
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="text-2xl">💨</span>
              {language === 'ar' ? 'إعدادات الأراكيل والنكهات والأسعار' : 'Hookah & Shisha Flavors & Pricing'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {language === 'ar'
                ? 'إدارة نكهات الأراكيل وأسعار النفس الكامل وتغيير الراس بالدولار والليرة اللبنانية. (تبديل الفحم مجاني دائمًا).'
                : 'Manage hookah flavors, full shisha rates, and head refill rates in USD and LBP. (Coal changes are free).'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFlavors}
              disabled={loading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {language === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'إضافة نكهة جديدة' : 'Add Flavor'}
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex items-center gap-2 text-rose-800 dark:text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </Card>

      {/* Flavors Table */}
      <Card className="p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">{language === 'ar' ? 'النكهة (عربي / English)' : 'Flavor Name'}</th>
                <th className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span>💨</span>
                    {language === 'ar' ? 'سعر الأركيلة كاملة' : 'Full Shisha Price'}
                  </span>
                </th>
                <th className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1">
                    <span>🔄</span>
                    {language === 'ar' ? 'سعر تغيير الراس' : 'Head Refill Price'}
                  </span>
                </th>
                <th className="py-3 px-4 text-center">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {flavors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    {language === 'ar' ? 'لا توجد نكهات مضافة حاليًا' : 'No hookah flavors configured'}
                  </td>
                </tr>
              ) : (
                flavors.map((flv) => (
                  <tr
                    key={flv.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      !flv.is_active ? 'opacity-50 bg-slate-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span className="text-lg">💨</span>
                        <div>
                          <div>{flv.name_ar}</div>
                          <div className="text-xs text-slate-400 font-normal">{flv.name_en}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(flv.price_usd).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {formatLbp(flv.price_lbp)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="font-bold text-amber-600 dark:text-amber-400">
                        ${Number(flv.refill_price_usd).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {formatLbp(flv.refill_price_lbp)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          flv.is_active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {flv.is_active
                          ? language === 'ar'
                            ? 'مفعل'
                            : 'Active'
                          : language === 'ar'
                          ? 'غير مفعل'
                          : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(flv)}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {flv.is_active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(flv.id, flv.name_ar || flv.name_en)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                            title="Deactivate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingId
            ? language === 'ar'
              ? 'تعديل نكهة وأسعار الأركيلة'
              : 'Edit Hookah Flavor & Pricing'
            : language === 'ar'
            ? 'إضافة نكهة أركيلة جديدة'
            : 'Add New Hookah Flavor'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'ar' ? 'اسم النكهة (عربي) *' : 'Flavor Name (Arabic) *'}
              </label>
              <Input
                value={formNameAr}
                onChange={(e) => setFormNameAr(e.target.value)}
                placeholder="مثال: تفاحتين فاخر"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {language === 'ar' ? 'اسم النكهة (English) *' : 'Flavor Name (English) *'}
              </label>
              <Input
                value={formNameEn}
                onChange={(e) => setFormNameEn(e.target.value)}
                placeholder="e.g. Two Apples"
                required
              />
            </div>
          </div>

          {/* Pricing Box: Full Shisha */}
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-3">
            <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <span>💨</span>
              {language === 'ar' ? 'سعر الأركيلة كاملة (نفس كامل)' : 'Full Shisha Pricing'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'بالدولار ($ USD)' : 'Price USD ($)'}
                </label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={formPriceUsd}
                  onChange={(e) => setFormPriceUsd(e.target.value)}
                  placeholder="5.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'بالليرة اللبنانية (LBP)' : 'Price LBP (ليرة)'}
                </label>
                <Input
                  type="number"
                  step="10000"
                  min="0"
                  value={formPriceLbp}
                  onChange={(e) => setFormPriceLbp(e.target.value)}
                  placeholder="450000"
                  required
                />
              </div>
            </div>
          </div>

          {/* Pricing Box: Head Refill */}
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-3">
            <div className="font-semibold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <span>🔄</span>
              {language === 'ar' ? 'سعر تغيير الراس (تجديد رأس)' : 'Head Refill Pricing'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'بالدولار ($ USD)' : 'Refill USD ($)'}
                </label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={formRefillPriceUsd}
                  onChange={(e) => setFormRefillPriceUsd(e.target.value)}
                  placeholder="3.00"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'بالليرة اللبنانية (LBP)' : 'Refill LBP (ليرة)'}
                </label>
                <Input
                  type="number"
                  step="10000"
                  min="0"
                  value={formRefillPriceLbp}
                  onChange={(e) => setFormRefillPriceLbp(e.target.value)}
                  placeholder="270000"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" variant="primary" className="bg-orange-600 hover:bg-orange-700 text-white">
              {language === 'ar' ? 'حفظ النكهة' : 'Save Flavor'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
