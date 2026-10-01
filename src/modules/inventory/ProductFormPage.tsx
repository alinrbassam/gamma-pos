import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ProductSchema, ProductInput } from '@shared/validation';
import { useProductStore } from '@stores/useProductStore';
import { useAuthStore } from '@stores/useAuthStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { useExchangeRateStore } from '../../renderer/stores/useExchangeRateStore';
import { ProductEntity } from '@shared/types';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { Card } from '@components/ui/Card';
import { Alert } from '@components/ui/Alert';
import { Trash2, Coins } from 'lucide-react';

export const ProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, units, loadMetadata, createProduct, updateProduct, deleteProduct, isLoading, error } =
    useProductStore();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const { usdToLbpRate } = useExchangeRateStore();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pricingCurrency, setPricingCurrency] = useState<'LBP' | 'USD'>('LBP');
  const [sellingPriceLbp, setSellingPriceLbp] = useState<string>('');
  const [purchaseCostLbp, setPurchaseCostLbp] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      nameEn: '',
      nameAr: '',
      productType: 'Standard stock item',
      categoryId: '',
      baseUnitId: '',
      purchaseCost: 0,
      sellingPrice: 0,
      minSellingPrice: 0,
      wholesalePrice: 0,
      taxRate: 0,
      allowDecimalQty: true,
      qtyPrecision: 2,
      trackInventory: true,
      minStock: 0,
      maxStock: 1000,
      reorderLevel: 10,
      defaultReorderQty: 20,
      trackBatches: false,
      trackExpiry: false,
      isActive: true,
      openingStockQty: 0,
    },
  });

  const sellingPrice = watch('sellingPrice') || 0;

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (categories.length > 0) setValue('categoryId', categories[0].id);
    const defaultUnit = units.find((u) => u.code === 'pcs' || u.code === 'piece' || u.name_en === 'Piece') || units[0];
    if (defaultUnit) setValue('baseUnitId', defaultUnit.id);
  }, [categories, units, setValue]);

  useEffect(() => {
    if (id && window.api?.getProductById) {
      window.api.getProductById(id).then((res) => {
        if (res.success && res.data) {
          const p = res.data as ProductEntity & { quantity_on_hand?: number };
          setValue('sku', p.sku);
          setValue('nameEn', p.name_en);
          setValue('nameAr', p.name_ar || p.name_en);
          setValue('categoryId', p.category_id);
          setValue('baseUnitId', p.base_unit_id);
          setValue('purchaseCost', p.purchase_cost);
          setValue('sellingPrice', p.selling_price);
          const effectiveRate = usdToLbpRate || 89500;
          if (p.selling_price) {
            setSellingPriceLbp(String(Math.round(p.selling_price * effectiveRate)));
          }
          if (p.purchase_cost) {
            setPurchaseCostLbp(String(Math.round(p.purchase_cost * effectiveRate)));
          }
          setValue('minSellingPrice', p.min_selling_price || 0);
          setValue('trackInventory', p.track_inventory === 1);
          setValue('reorderLevel', p.reorder_level ?? 10);
          setValue('openingStockQty', p.quantity_on_hand ?? 0);
        }
      });
    }
  }, [id, setValue]);

  const onSubmit = async (data: ProductInput) => {
    setSuccessMsg(null);
    // Ensure nameAr mirrors nameEn if not explicitly set
    if (!data.nameAr) data.nameAr = data.nameEn;

    // Ensure a valid baseUnitId is always assigned
    if (!data.baseUnitId && units.length > 0) {
      const defaultUnit = units.find((u) => u.code === 'pcs' || u.name_en === 'Piece') || units[0];
      data.baseUnitId = defaultUnit.id;
    }

    let ok = false;
    if (id) {
      ok = await updateProduct(id, data, user?.id);
    } else {
      ok = Boolean(await createProduct(data, user?.id));
    }

    if (ok) {
      setSuccessMsg(language === 'ar' ? 'تم حفظ المنتج بنجاح!' : 'Product saved successfully!');
      setTimeout(() => navigate('/inventory/products'), 1000);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {id ? (language === 'ar' ? 'تعديل المنتج' : 'Edit Product') : (language === 'ar' ? 'إضافة منتج جديد' : 'Create New Product')}
          </h1>
          <p className="text-xs text-slate-500">
            {language === 'ar'
              ? 'إضافة عنصر جديد لمنيو الكافتيريا مع السعر بالدولار والليرة اللبنانية'
              : 'Add a new cafeteria menu item with USD and Lebanese Pound pricing.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/inventory/products')}>
          {language === 'ar' ? 'إلغاء' : 'Cancel'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Section 1: Product Name */}
        <Card title={language === 'ar' ? '1. تفاصيل المنتج' : '1. Product Details'}>
          <Input
            label={language === 'ar' ? 'اسم المنتج *' : 'Product Name *'}
            placeholder={
              language === 'ar'
                ? 'مثال: قهوة تركية، آيس كوفي، أركيلة تفاحتين، كلوب ساندويش...'
                : 'e.g. Turkish Coffee, Ice Coffee, Shisha Double Apple, Club Sandwich...'
            }
            {...register('nameEn')}
            error={errors.nameEn?.message}
            autoFocus
          />
        </Card>

        {/* Section 2: Category (Menu Section) */}
        <Card title={language === 'ar' ? '2. قسم المنيو' : '2. Menu Category'}>
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'اختر القسم *' : 'Category *'}
            </label>
            <select
              {...register('categoryId')}
              className="px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#C83818] shadow-xs cursor-pointer"
            >
              {categories
                .filter((c) => c.id !== 'cat-playstation')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{language === 'ar' ? (c.name_ar || c.name_en) : c.name_en}
                  </option>
                ))}
            </select>
          </div>
        </Card>

        {/* Section 3: Pricing & Cost (USD & LBP) */}
        <Card
          title={
            language === 'ar'
              ? '3. السعر والتكلفة (بالليرة اللبنانية أو بالدولار)'
              : '3. Pricing & Cost (Lebanese L.L or $ USD)'
          }
        >
          <div className="space-y-4">
            {/* Currency Mode Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-[#1A1C21]/60 rounded-2xl border border-slate-200 dark:border-[#282C35]">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#C83818]" />
                <div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                    {language === 'ar' ? 'عملة إدخال السعر المباشر:' : 'Direct Price Entry Currency:'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ar'
                      ? 'يمكنك وضع السعر بالليرة اللبنانية مباشرة أو بالدولار'
                      : 'You can enter the price directly in Lebanese L.L or US Dollars'}
                  </span>
                </div>
              </div>

              <div className="flex bg-white dark:bg-[#121316] p-1 rounded-xl border border-slate-200 dark:border-[#282C35] shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPricingCurrency('LBP');
                    if (sellingPrice > 0 && !sellingPriceLbp) {
                      setSellingPriceLbp(String(Math.round(sellingPrice * (usdToLbpRate || 89500))));
                    }
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pricingCurrency === 'LBP'
                      ? 'bg-[#C83818] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🇱🇧</span>
                  <span>{language === 'ar' ? 'بالليرة اللبنانية (L.L)' : 'Lebanese Pounds (L.L)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPricingCurrency('USD')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    pricingCurrency === 'USD'
                      ? 'bg-[#C83818] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>💵</span>
                  <span>{language === 'ar' ? 'بالدولار ($ USD)' : 'US Dollars ($ USD)'}</span>
                </button>
              </div>
            </div>

            {/* Inputs based on pricingCurrency */}
            {pricingCurrency === 'LBP' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Selling Price in LBP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ar' ? 'سعر البيع بالليرة اللبنانية (L.L) *' : 'Selling Price in Lebanese (L.L) *'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      placeholder="e.g. 200000"
                      value={sellingPriceLbp}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSellingPriceLbp(val);
                        const num = parseFloat(val) || 0;
                        const effectiveRate = usdToLbpRate || 89500;
                        const usd = effectiveRate > 0 ? Math.round((num / effectiveRate) * 100) / 100 : 0;
                        setValue('sellingPrice', usd, { shouldValidate: true });
                      }}
                      className={`w-full px-3 pr-14 py-2.5 bg-slate-50 dark:bg-[#0E0F12] border ${
                        errors.sellingPrice ? 'border-rose-500' : 'border-slate-300 dark:border-[#282C35]'
                      } rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-[#C83818] focus:border-[#C83818] focus:outline-none`}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                      L.L
                    </div>
                  </div>
                  {errors.sellingPrice && (
                    <span className="text-[11px] text-rose-500 mt-1 block">
                      {errors.sellingPrice.message}
                    </span>
                  )}
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    ≈ ${sellingPrice.toFixed(2)} USD
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ($1 = {(usdToLbpRate || 89500).toLocaleString('en-US')} L.L)
                    </span>
                  </p>
                </div>

                {/* Purchase Cost in LBP */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'ar' ? 'تكلفة التجهيز / الشراء بالليرة (L.L)' : 'Purchase / Cost per Item (L.L)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      placeholder="e.g. 100000"
                      value={purchaseCostLbp}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPurchaseCostLbp(val);
                        const num = parseFloat(val) || 0;
                        const effectiveRate = usdToLbpRate || 89500;
                        const usd = effectiveRate > 0 ? Math.round((num / effectiveRate) * 100) / 100 : 0;
                        setValue('purchaseCost', usd);
                      }}
                      className="w-full px-3 pr-14 py-2.5 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-slate-900 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-[#C83818] focus:border-[#C83818] focus:outline-none"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">
                      L.L
                    </div>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                    ≈ ${((watch('purchaseCost') || 0)).toFixed(2)} USD
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ({language === 'ar' ? 'اختياري لتقارير الأرباح' : 'Optional: profit margins'})
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Selling Price in USD */}
                <div>
                  <Input
                    label={language === 'ar' ? 'سعر البيع ($) *' : 'Selling Price ($ USD) *'}
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...register('sellingPrice', {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const usd = parseFloat(e.target.value) || 0;
                        setSellingPriceLbp(usd > 0 ? String(Math.round(usd * (usdToLbpRate || 89500))) : '');
                      },
                    })}
                    error={errors.sellingPrice?.message}
                  />
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    ≈ {Math.round(sellingPrice * (usdToLbpRate || 89500)).toLocaleString('en-US')} L.L
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      ($1 = {(usdToLbpRate || 89500).toLocaleString('en-US')} L.L)
                    </span>
                  </p>
                </div>

                {/* Purchase Cost in USD */}
                <div>
                  <Input
                    label={language === 'ar' ? 'تكلفة التجهيز / الشراء ($)' : 'Purchase / Cost per Item ($ USD)'}
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...register('purchaseCost', {
                      valueAsNumber: true,
                      onChange: (e) => {
                        const usd = parseFloat(e.target.value) || 0;
                        setPurchaseCostLbp(usd > 0 ? String(Math.round(usd * (usdToLbpRate || 89500))) : '');
                      },
                    })}
                    error={errors.purchaseCost?.message}
                    helperText={
                      language === 'ar'
                        ? `≈ ${Math.round((watch('purchaseCost') || 0) * (usdToLbpRate || 89500)).toLocaleString('en-US')} L.L`
                        : `≈ ${Math.round((watch('purchaseCost') || 0) * (usdToLbpRate || 89500)).toLocaleString('en-US')} L.L`
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Section 4: Initial Stock & Restock Alert */}
        <Card title={language === 'ar' ? '4. المخزون والتنبيهات' : '4. Stock & Restock Alert'}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === 'ar' ? 'الكمية الافتتاحية المتوفرة' : 'Opening Stock Quantity in Store'}
              type="number"
              step="any"
              placeholder="0"
              {...register('openingStockQty', { valueAsNumber: true })}
              helperText={
                language === 'ar'
                  ? 'الكمية الحالية المتوفرة في الكافتيريا (اتركه 0 إذا غير محدد)'
                  : 'Current quantity available in stock right now'
              }
            />
            <Input
              label={language === 'ar' ? 'حد التنبيه عند النقصان' : 'Restock Alert Level'}
              type="number"
              step="any"
              placeholder="10"
              {...register('reorderLevel', { valueAsNumber: true })}
              helperText={
                language === 'ar'
                  ? 'يظهر باللون الأحمر عند هبوط المخزون دون هذا الحد'
                  : 'Turns RED when stock falls below this quantity'
              }
            />
          </div>
        </Card>

        <div className="flex justify-between items-center pt-2">
          {id ? (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const confirmed = window.confirm(
                  language === 'ar'
                    ? 'هل أنت متأكد من حذف هذا المنتج؟'
                    : 'Are you sure you want to delete this product?'
                );
                if (confirmed) {
                  const ok = await deleteProduct(id, user?.id);
                  if (ok) {
                    navigate('/inventory/products');
                  } else {
                    alert(language === 'ar' ? 'تعذر حذف المنتج.' : 'Could not delete product.');
                  }
                }
              }}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 dark:hover:bg-rose-950/40 flex items-center space-x-1.5 font-semibold cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>{language === 'ar' ? 'حذف المنتج' : 'Delete Product'}</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-3">
            <Button type="button" variant="outline" onClick={() => navigate('/inventory/products')}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              size="lg"
              className="bg-[#C83818] hover:bg-[#A72B11] text-white font-bold cursor-pointer shadow-md"
            >
              {language === 'ar' ? 'حفظ المنتج ✓' : 'Save Product ✓'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

