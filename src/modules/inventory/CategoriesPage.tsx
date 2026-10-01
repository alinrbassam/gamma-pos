import React, { useEffect, useState } from 'react';
import { useProductStore } from '@stores/useProductStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Table, Column } from '@components/ui/Table';
import { Button } from '@components/ui/Button';
import { Dialog } from '@components/ui/Dialog';
import { Input } from '@components/ui/Input';
import { Card } from '@components/ui/Card';
import { Alert } from '@components/ui/Alert';
import { CategoryEntity } from '@shared/types';
import { FolderTree, Plus, Trash2, Edit2, Smile } from 'lucide-react';

const CATEGORY_SYMBOLS = [
  '☕', '🍵', '🥤', '🧃', '🍹', '💧', '🧋', '🥛',
  '🏺', '💨', '🌬️', '🔥', '🫧', '🚬', '🪈', '🏷️',
  '🥪', '🍔', '🍕', '🍟', '🌭', '🥐', '🍰', '🍩',
  '🍪', '🍦', '🍫', '🍿', '🥗', '🍽️', '🎮', '🎲',
];

export const CategoriesPage: React.FC = () => {
  const { categories, loadMetadata } = useProductStore();
  const { language } = useLanguageStore();

  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryEntity | null>(null);

  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [icon, setIcon] = useState('☕');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setNameEn('');
    setNameAr('');
    setIcon('☕');
    setError(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (c: CategoryEntity) => {
    setEditingCategory(c);
    setNameEn(c.name_en);
    setNameAr(c.name_ar || '');
    setIcon(c.icon || '☕');
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingCategory) {
        if (window.api?.updateCategory) {
          const res = await window.api.updateCategory({
            id: editingCategory.id,
            nameEn,
            nameAr: nameAr || nameEn,
            icon,
          });
          if (res.success) {
            setIsOpen(false);
            loadMetadata();
          } else {
            setError(res.error?.message || 'Failed updating category');
          }
        }
      } else {
        if (window.api?.createCategory) {
          const res = await window.api.createCategory({
            nameEn,
            nameAr: nameAr || nameEn,
            icon,
            isActive: true,
            displayOrder: 0,
          });
          if (res.success) {
            setIsOpen(false);
            setNameEn('');
            setNameAr('');
            loadMetadata();
          } else {
            setError(res.error?.message || 'Failed creating category');
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, force = false) => {
    try {
      if (window.api?.deleteCategory) {
        const res = await window.api.deleteCategory(id, force);
        if (res.success) {
          loadMetadata();
        } else {
          const msg = res.error?.message || '';
          if (msg.toLowerCase().includes('contains') && msg.toLowerCase().includes('product')) {
            const confirmed = window.confirm(
              language === 'ar'
                ? 'هذا القسم يحتوي على أصناف مرتبطة. هل تريد حذف هذا القسم مع جميع أصنافه؟'
                : 'This category contains products. Do you want to delete this category along with all its products?'
            );
            if (confirmed) {
              await handleDelete(id, true);
            }
          } else {
            alert(msg || 'Cannot delete category');
          }
        }
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const columns: Column<CategoryEntity>[] = [
    {
      key: 'icon',
      header: language === 'ar' ? 'الرمز' : 'Symbol',
      render: (c) => (
        <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1E2025] border border-slate-200 dark:border-[#2E323B] flex items-center justify-center text-xl shadow-xs">
          {c.icon || '🏷️'}
        </span>
      ),
    },
    {
      key: 'name_en',
      header: language === 'ar' ? 'اسم القسم (إنجليزي)' : 'Category Name (EN)',
      render: (c) => (
        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
          {c.name_en}
        </span>
      ),
    },
    {
      key: 'name_ar',
      header: language === 'ar' ? 'اسم القسم (عربي)' : 'Category Name (AR)',
      render: (c) => (
        <span className="font-medium text-slate-600 dark:text-slate-300 text-sm">
          {c.name_ar || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: language === 'ar' ? 'إجراءات' : 'Actions',
      render: (c) => (
        <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(c)}
            title={language === 'ar' ? 'تعديل القسم' : 'Edit Category'}
            className="hover:bg-[#C83818]/10 text-slate-600 hover:text-[#C83818] rounded-lg p-1.5"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(c.id)}
            title={language === 'ar' ? 'حذف القسم' : 'Delete Category'}
            className="hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg p-1.5"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-[#C83818]/10 border border-[#C83818]/20 flex items-center justify-center text-[#C83818] dark:text-[#DF7E63]">
            <FolderTree className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {language === 'ar' ? 'أقسام الكافتيريا والمنتجات' : 'Product Categories'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'ar'
                ? 'إدارة أقسام المنيو وتعيين رموز تعبيرية لكل فئة تظهر في شاشة البيع'
                : 'Organize cafeteria menu categories and assign icons for POS category chips'}
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenCreate}
          size="md"
          className="flex items-center space-x-2 rtl:space-x-reverse bg-[#C83818] hover:bg-[#A72B11] text-white font-bold rounded-xl shadow-md cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{language === 'ar' ? '+ قسم جديد' : 'New Category'}</span>
        </Button>
      </div>

      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-[#21242B] rounded-2xl">
        <Table columns={columns} data={categories.filter((c) => c.id !== 'cat-playstation')} keyExtractor={(c) => c.id} />
      </Card>

      {/* CREATE & EDIT CATEGORY MODAL */}
      <Dialog
        isOpen={isOpen}
        title={editingCategory ? (language === 'ar' ? 'تعديل القسم' : 'Edit Category') : (language === 'ar' ? 'إضافة قسم جديد' : 'Create Category')}
        onClose={() => setIsOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}

          {/* Symbol / Emoji Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smile className="w-4 h-4 text-[#C83818]" />
                {language === 'ar' ? 'اختر رمزاً للقسم (Symbol / Icon) *' : 'Choose Category Symbol *'}
              </span>
              <span className="text-2xl">{icon}</span>
            </label>

            {/* Dedicated Shisha & Hookah Quick Row */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-xl">
              <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 mr-1 rtl:mr-0 rtl:ml-1">
                {language === 'ar' ? '💨 رموز الشيشة والأراكيل:' : '💨 Shisha & Hookah:'}
              </span>
              {[
                { sym: '🏺', label: language === 'ar' ? 'أركيلة (Hookah)' : 'Hookah / Argileh' },
                { sym: '💨', label: language === 'ar' ? 'دخان (Smoke)' : 'Smoke' },
                { sym: '🌬️', label: language === 'ar' ? 'سحبة (Puff)' : 'Puff / Exhale' },
                { sym: '🔥', label: language === 'ar' ? 'فحم (Coals)' : 'Coals / Fire' },
                { sym: '🫧', label: language === 'ar' ? 'ماء (Bubbles)' : 'Water Bubbles' },
                { sym: '🪈', label: language === 'ar' ? 'خرطوم (Pipe)' : 'Pipe / Hose' },
              ].map((item) => (
                <button
                  key={item.sym}
                  type="button"
                  onClick={() => setIcon(item.sym)}
                  className={`px-2 py-1 text-xs rounded-lg border font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    icon === item.sym
                      ? 'bg-[#C83818] text-white border-[#C83818] shadow-xs scale-105'
                      : 'bg-white dark:bg-[#1C1F26] text-slate-800 dark:text-slate-200 border-amber-300/80 dark:border-amber-800/50 hover:border-[#C83818]'
                  }`}
                >
                  <span className="text-base">{item.sym}</span>
                  <span className="text-[10px]">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-3 bg-slate-50 dark:bg-[#141518] rounded-2xl border border-slate-200 dark:border-[#21242B] max-h-40 overflow-y-auto">
              {CATEGORY_SYMBOLS.map((sym) => {
                const isSelected = icon === sym;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setIcon(sym)}
                    className={`h-10 text-xl rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#C83818]/15 border-[#C83818] scale-110 shadow-xs'
                        : 'bg-white dark:bg-[#1C1F26] border-slate-200 dark:border-[#282C35] hover:border-[#C83818]/50'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>

            {/* Custom Emoji / Symbol input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                {language === 'ar' ? 'أو اكتب رمزاً خاصاً:' : 'Or custom symbol:'}
              </span>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-16 px-2 py-1 text-center text-base rounded-lg border border-slate-300 dark:border-[#2E323B] bg-white dark:bg-[#1A1C21] font-bold"
              />
            </div>
          </div>

          <Input
            label={language === 'ar' ? 'اسم القسم بالإنجليزي *' : 'Category Name (English) *'}
            placeholder="e.g. Hot Drinks, Cold Drinks, Shisha..."
            value={nameEn}
            onChange={(e) => {
              const val = e.target.value;
              setNameEn(val);
              const lower = val.toLowerCase();
              if ((lower.includes('shisha') || lower.includes('hookah') || lower.includes('argileh')) && (icon === '☕' || icon === '🏷️')) {
                setIcon('🏺');
              }
            }}
            required
            autoFocus
          />

          <Input
            label={language === 'ar' ? 'اسم القسم بالعربي' : 'Category Name (Arabic)'}
            placeholder="مثال: مشروبات ساخنة، أراكيل، سندويشات..."
            value={nameAr}
            onChange={(e) => {
              const val = e.target.value;
              setNameAr(val);
              if ((val.includes('شيشة') || val.includes('أركيل') || val.includes('اركيل') || val.includes('معسل')) && (icon === '☕' || icon === '🏷️')) {
                setIcon('🏺');
              }
            }}
          />

          <div className="pt-3 flex justify-end space-x-2 rtl:space-x-reverse border-t border-slate-100 dark:border-[#21242B]">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              className="bg-[#C83818] hover:bg-[#A72B11] text-white font-bold px-5 rounded-xl shadow-md cursor-pointer"
            >
              {editingCategory ? (language === 'ar' ? 'حفظ التعديلات' : 'Update Category') : (language === 'ar' ? 'إنشاء القسم' : 'Save Category')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
