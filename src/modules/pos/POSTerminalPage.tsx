import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePOSStore } from '@stores/usePOSStore';
import { useProductStore } from '@stores/useProductStore';
import { useAuthStore } from '@stores/useAuthStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { useZoomStore } from '@stores/useZoomStore';
import { useExchangeRateStore } from '@stores/useExchangeRateStore';
import { SalesOrderEntity, ProductEntity, HookahFlavorEntity } from '@shared/types';
import { POSPaymentModal } from './POSPaymentModal';
import { POSHoldResumeModal } from './POSHoldResumeModal';
import { POSHoldSaveModal } from './POSHoldSaveModal';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { POSTouchNumpad } from './POSTouchNumpad';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Tag,
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Bike,
} from 'lucide-react';

export const POSTerminalPage: React.FC = () => {
  const {
    cart,
    orderDiscount,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    setOrderDiscount,
    setAmountTendered,
    checkout,
    holdCurrentSale,
    resumeSale,
    isLoading,
  } = usePOSStore();

  const { products, categories: dbCategories, loadProducts, loadMetadata } = useProductStore();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const { zoom, zoomIn, zoomOut, resetZoom } = useZoomStore();
  const { usdToLbpRate } = useExchangeRateStore();

  // Cafeteria Order Type state
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>('Table 1');
  const [deliveryCustomerName, setDeliveryCustomerName] = useState<string>('');
  const [deliveryPhone, setDeliveryPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [dynamicTables, setDynamicTables] = useState<string[]>([
    'Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5',
    'Table 6', 'Table 7', 'Table 8', 'Table 9', 'Table 10',
    'Table 11', 'Table 12', 'Table 13', 'Table 14', 'Table 15',
  ]);

  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showHoldSaveModal, setShowHoldSaveModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<SalesOrderEntity | null>(null);
  const [selectedCartIdx, setSelectedCartIdx] = useState<number | null>(null);

  // Keep selected cart item in sync with cart changes
  useEffect(() => {
    if (cart.length > 0) {
      if (selectedCartIdx === null || selectedCartIdx >= cart.length) {
        setSelectedCartIdx(cart.length - 1);
      }
    } else {
      setSelectedCartIdx(null);
    }
  }, [cart.length, selectedCartIdx]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleAddToCart = (product: ProductEntity, qty = 1.0) => {
    const existingIdx = cart.findIndex((item) => item.product.id === product.id);
    addToCart(product, qty);
    if (existingIdx >= 0) {
      setSelectedCartIdx(existingIdx);
    } else {
      setSelectedCartIdx(cart.length);
    }
  };

  useEffect(() => {
    loadProducts('');
    loadMetadata();

    // Load tables dynamically from DB
    if (window.api?.getTablesState) {
      window.api.getTablesState().then((res) => {
        if (res.success && res.data?.tablesWithTabs) {
          const names = res.data.tablesWithTabs.map((t: any) => t.table.name);
          if (names.length > 0) {
            setDynamicTables(names);
          }
        }
      }).catch(() => {});
    }

    const handleFocus = () => {
      loadProducts('');
      loadMetadata();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadProducts, loadMetadata]);

  const [hookahFlavors, setHookahFlavors] = useState<HookahFlavorEntity[]>([]);

  useEffect(() => {
    if (window.api?.getHookahFlavors) {
      window.api.getHookahFlavors(true).then((res) => {
        if (res.success && res.data) setHookahFlavors(res.data);
      }).catch(() => {});
    }
  }, []);

  const handleAddHookahToCart = (flavor: HookahFlavorEntity, type: 'full' | 'refill') => {
    const prodId = `hookah-${flavor.id}-${type}`;
    const prodName =
      language === 'ar'
        ? `💨 ${flavor.name_ar} (${type === 'full' ? 'نفس كامل' : 'تغيير راس'})`
        : `💨 ${flavor.name_en} (${type === 'full' ? 'Full' : 'Refill'})`;
    const price = type === 'full' ? flavor.price_usd : flavor.refill_price_usd;

    const mockProduct: ProductEntity = {
      id: prodId,
      sku: `HK-${flavor.id.slice(-6).toUpperCase()}-${type[0].toUpperCase()}`,
      primary_barcode: `HK-${flavor.id.slice(-6).toUpperCase()}-${type[0].toUpperCase()}`,
      name_en: prodName,
      name_ar: prodName,
      selling_price: price,
      purchase_cost: 0,
      category_id: 'cat-shisha',
      base_unit_id: 'unit-piece',
      product_type: 'Service',
      is_active: 1,
      tax_rate: 0,
    } as any;

    handleAddToCart(mockProduct, 1.0);
  };

  useEffect(() => {
    if (productSearch.length > 1) {
      loadProducts(productSearch);
    }
  }, [productSearch, loadProducts]);

  const handleHoldSale = useCallback(() => {
    if (cart.length === 0) {
      alert(language === 'ar' ? 'السلة فارغة! أضف أصنافاً أولاً للتعليق.' : 'Cart is empty! Add items first to hold.');
      return;
    }
    setShowHoldSaveModal(true);
  }, [cart.length, language]);

  const handleHoldSaveConfirm = async (refName: string) => {
    const success = await holdCurrentSale(refName, user?.id);
    if (success) {
      setShowHoldSaveModal(false);
    }
  };

  // Keyboard Shortcuts (F4 = Hold, F5 = Resume, F2 = Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === 'F5') {
        e.preventDefault();
        setShowHoldModal(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleHoldSale]);

  const categories = useMemo(() => {
    const hasDbCategories = dbCategories && dbCategories.length > 0;
    const allChip = {
      id: 'all',
      labelEn: '🏷️ All Items',
      labelAr: '🏷️ جميع الأصناف',
    };

    if (hasDbCategories) {
      const dynamicList = dbCategories
        .filter((c) => c.id !== 'cat-playstation')
        .map((c) => {
          const symbol = c.icon ? `${c.icon} ` : '';
          return {
            id: c.id,
            labelEn: `${symbol}${c.name_en}`,
            labelAr: `${symbol}${c.name_ar || c.name_en}`,
          };
        });
      return [allChip, ...dynamicList];
    }

    return [
      allChip,
      { id: 'hot_drinks', labelEn: '☕ Hot Drinks', labelAr: '☕ مشروبات ساخنة' },
      { id: 'cold_drinks', labelEn: '🥤 Cold Drinks', labelAr: '🥤 مشروبات باردة' },
      { id: 'food', labelEn: '🥪 Snacks & Sandwiches', labelAr: '🥪 سندويشات وسناكس' },
      { id: 'shisha', labelEn: '🏺 Shisha / Argileh', labelAr: '🏺 أراكيل' },
      { id: 'desserts', labelEn: '🍰 Desserts', labelAr: '🍰 حلويات' },
    ];
  }, [dbCategories]);

  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categories, selectedCategory]);

  const selectedCatObj = categories.find((c) => c.id === selectedCategory);

  // Products from database (Exclude services like PlayStation)
  const displayProducts: ProductEntity[] = products.filter((p) => {
    if (
      p.id === 'ps5-gaming-time' ||
      p.id === 'ps5-gaming-service' ||
      p.sku === 'PS5-TIME' ||
      p.sku === 'PS5-SRV' ||
      p.product_type === 'Service' ||
      p.category_id === 'cat-playstation'
    ) {
      return false;
    }
    const matchesSearch =
      !productSearch ||
      (p.name_en && p.name_en.toLowerCase().includes(productSearch.toLowerCase())) ||
      (p.name_ar && p.name_ar.includes(productSearch)) ||
      (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      p.category_id === selectedCategory ||
      p.subcategory_id === selectedCategory ||
      (selectedCatObj && (
        (p.category_id && p.category_id.toLowerCase() === selectedCatObj.labelEn.toLowerCase()) ||
        (p.category_id && p.category_id.toLowerCase() === selectedCatObj.labelAr.toLowerCase())
      ));

    return matchesSearch && matchesCategory;
  });

  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;

    cart.forEach((item) => {
      const lineSub = Math.round(item.quantity * item.unitPrice * 100) / 100;
      // Per user instruction: discount is ONLY on total receipt, not on item
      const lineDisc = 0;
      const taxable = Math.max(0, lineSub - lineDisc);
      const tax = Math.round(taxable * (item.taxRate / 100) * 100) / 100;

      subtotal += lineSub;
      taxTotal += tax;
    });

    const grandTotal = Math.max(0, Math.round((subtotal - orderDiscount + taxTotal) * 100) / 100);
    const grandTotalLbp = Math.round(grandTotal * usdToLbpRate);
    return { subtotal, taxTotal, grandTotal, grandTotalLbp };
  };

  const totals = calculateTotals();

  const handlePaymentConfirm = async (
    payments: {
      paymentMethod: 'Cash' | 'Card' | 'Digital Wallet' | 'Store Credit' | 'Borrow' | 'Credit' | string;
      amount: number;
      referenceNumber?: string;
    }[],
    tendered: number,
    borrowDetails?: {
      customerName: string;
      customerPhone?: string;
      dueDate?: string;
      notes?: string;
    },
    splitCurrencyDetails?: {
      paidUsd: number;
      paidLbp: number;
      changeUsd: number;
      changeLbp: number;
      exchangeRate: number;
    },
  ) => {
    setAmountTendered(tendered);

    const customerInfo = borrowDetails || (orderType === 'delivery' ? {
      customerName: deliveryCustomerName || 'Delivery Customer',
      customerPhone: deliveryPhone,
    } : undefined);

    const cafeteriaInfo = {
      orderType,
      tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
      exchangeRate: splitCurrencyDetails?.exchangeRate || usdToLbpRate,
      paidUsd: splitCurrencyDetails?.paidUsd || 0,
      paidLbp: splitCurrencyDetails?.paidLbp || 0,
      changeUsd: splitCurrencyDetails?.changeUsd || 0,
      changeLbp: splitCurrencyDetails?.changeLbp || 0,
    };

    const sale = await checkout(payments, user?.id, customerInfo, cafeteriaInfo);
    if (sale) {
      setShowPaymentModal(false);
      setLastCompletedSale(sale);
    } else {
      const err = usePOSStore.getState().error;
      if (err) {
        alert(language === 'ar' ? `خطأ أثناء الدفع: ${err}` : `Payment error: ${err}`);
      }
    }
  };

  const handleFastPayAndPrint = async (
    paidUsd: number,
    paidLbp: number,
    changeUsd: number,
    changeLbp: number,
  ) => {
    if (cart.length === 0 || isLoading) return;

    const paymentList = [
      {
        paymentMethod: 'Cash',
        amount: totals.grandTotal,
      },
    ];

    const customerInfo = orderType === 'delivery' ? {
      customerName: deliveryCustomerName || 'Delivery Customer',
      customerPhone: deliveryPhone,
    } : undefined;

    const cafeteriaInfo = {
      orderType,
      tableNumber: orderType === 'dine_in' ? tableNumber : undefined,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
      exchangeRate: usdToLbpRate,
      paidUsd,
      paidLbp,
      changeUsd,
      changeLbp,
    };

    const sale = await checkout(paymentList, user?.id, customerInfo, cafeteriaInfo);
    if (sale) {
      setLastCompletedSale(sale);
    } else {
      const err = usePOSStore.getState().error;
      if (err) {
        alert(language === 'ar' ? `خطأ أثناء الدفع: ${err}` : `Payment error: ${err}`);
      }
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col md:flex-row gap-3 bg-[#F8F9FA] dark:bg-[#0E0F12] text-slate-900 dark:text-slate-100 font-sans overflow-hidden select-none">
      {/* LEFT PANEL: Cafeteria Catalog Grid & Category Filter */}
      <div className="flex-1 flex flex-col min-w-0 space-y-3">
        {/* Cafeteria Order Mode Selector Bar */}
        <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center space-x-1 rtl:space-x-reverse">
            <button
              onClick={() => setOrderType('dine_in')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                orderType === 'dine_in'
                  ? 'bg-[#C83818] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C21]'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'صالة (Dine In)' : 'Dine In'}</span>
            </button>

            <button
              onClick={() => setOrderType('takeaway')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                orderType === 'takeaway'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C21]'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'سفري (Takeaway)' : 'Takeaway'}</span>
            </button>

            <button
              onClick={() => setOrderType('delivery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                orderType === 'delivery'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C21]'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'توصيل (Delivery)' : 'Delivery'}</span>
            </button>
          </div>

          {/* Dine In Table Selector */}
          {orderType === 'dine_in' && (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'رقم الطاولة:' : 'Table #:'}
              </span>
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-[#1A1C21] border border-slate-300 dark:border-[#282C35] rounded-lg text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-[#C83818]"
              >
                {dynamicTables.map((t) => (
                  <option key={t} value={t}>
                    {language === 'ar' ? t.replace('Table', 'طاولة') : t}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/tables';
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg text-xs font-bold transition-colors"
                title="Manage Running Tabs & Tables"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'طاولات الصالة ☕' : 'Tables ☕'}</span>
              </button>
            </div>
          )}

          {/* Delivery Details Inputs */}
          {orderType === 'delivery' && (
            <div className="flex items-center gap-2 text-xs flex-1 max-w-md">
              <input
                type="text"
                value={deliveryCustomerName}
                onChange={(e) => setDeliveryCustomerName(e.target.value)}
                placeholder={language === 'ar' ? 'اسم العميل' : 'Customer Name'}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs w-28 focus:outline-none"
              />
              <input
                type="text"
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                placeholder={language === 'ar' ? 'الهاتف' : 'Phone'}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs w-24 focus:outline-none"
              />
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={language === 'ar' ? 'العنوان' : 'Address'}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs flex-1 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Search Bar & Quick Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="flex items-center space-x-2 rtl:space-x-reverse bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] focus-within:border-[#C83818] focus-within:ring-2 focus-within:ring-[#C83818]/20 shadow-xs px-3.5 py-2 rounded-2xl transition-all">
              <Search className="h-4 w-4 text-[#C83818] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'بحث سريع عن منتج (قهوة، ساندويش، عصير، كولا)...'
                    : 'Quick search by name or code (Coffee, Sandwich, Juice, Cola)...'
                }
                className="w-full bg-transparent text-xs sm:text-sm focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Zoom on POS Screen */}
          <div className="hidden sm:flex items-center bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-2xl px-2 py-1 shadow-xs space-x-0.5 rtl:space-x-reverse text-xs select-none">
            <span className="text-[11px] font-semibold text-slate-400 px-1">Zoom:</span>
            <button
              onClick={zoomOut}
              className="p-1 hover:bg-slate-100 dark:hover:bg-[#1A1C21] rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Zoom - (Ctrl -)"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={resetZoom}
              className="px-1.5 py-0.5 font-mono font-bold text-[#C83818] hover:bg-[#C83818]/10 dark:hover:bg-[#C83818]/20 rounded-lg text-xs transition-colors"
              title="Reset 100% (Ctrl 0)"
            >
              {zoom}%
            </button>
            <button
              onClick={zoomIn}
              className="p-1 hover:bg-slate-100 dark:hover:bg-[#1A1C21] rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
              title="Zoom + (Ctrl +)"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Category Chips Bar */}
        <div className="flex space-x-2 rtl:space-x-reverse overflow-x-auto pb-1 select-none scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#C83818] text-white shadow-xs border border-[#C83818]'
                  : 'bg-white dark:bg-[#141518] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C21] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#21242B] shadow-xs'
              }`}
            >
              {language === 'ar' ? cat.labelAr : cat.labelEn}
            </button>
          ))}
        </div>

        {/* Product Catalog Cards Grid */}
        {selectedCategory === 'cat-shisha' ? (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold flex items-center gap-1.5">
                <span>🔥</span>
                <span>{language === 'ar' ? 'تبديل الفحم مجاني دائمًا للزبائن' : 'Coal changes (فحم) are always free of charge'}</span>
              </span>
              <span className="text-[11px] opacity-75 font-mono">
                {language === 'ar' ? 'اختر نفس كامل أو تجديد رأس' : 'Select Full Shisha or Head Refill'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {hookahFlavors
                .filter((flv) => {
                  if (!productSearch) return true;
                  const q = productSearch.toLowerCase();
                  return flv.name_en.toLowerCase().includes(q) || flv.name_ar.includes(productSearch);
                })
                .map((flv) => (
                  <div
                    key={flv.id}
                    className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] p-3.5 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs hover:border-amber-500/50 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-lg">
                        💨
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {language === 'ar' ? flv.name_ar : flv.name_en}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {language === 'ar' ? flv.name_en : flv.name_ar}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-[#21242B]">
                      <button
                        type="button"
                        onClick={() => handleAddHookahToCart(flv, 'full')}
                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                      >
                        <span className="text-[11px]">{language === 'ar' ? '💨 نفس كامل' : '💨 Full'}</span>
                        <span className="text-[9px] opacity-90 font-mono mt-0.5">
                          ${Number(flv.price_usd).toFixed(2)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddHookahToCart(flv, 'refill')}
                        className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                      >
                        <span className="text-[11px]">{language === 'ar' ? '🔄 تغيير راس' : '🔄 Refill'}</span>
                        <span className="text-[9px] opacity-90 font-mono mt-0.5">
                          ${Number(flv.refill_price_usd).toFixed(2)}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : displayProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl">
            <div className="p-4 bg-slate-50 dark:bg-[#1A1C21] text-slate-400 rounded-2xl mb-3">
              <Coffee className="h-8 w-8 text-[#DF7E63]" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {language === 'ar'
                ? 'لا توجد منتجات مضافة بعد في الكتالوج'
                : 'No cafeteria products in catalog yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {language === 'ar'
                ? 'يمكنك إضافة المشروبات والوجبات وتحديد أسعارها بالدولار من شاشة إدارة المخزون.'
                : 'You can add cafeteria beverages and food items in the Inventory section.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pr-1">
            {displayProducts.map((p) => {
              const priceUsd = p.selling_price || 0;
              const priceLbp = Math.round(priceUsd * usdToLbpRate);

              return (
                <div
                  key={p.id}
                  onClick={() => handleAddToCart(p, 1.0)}
                  className="group relative bg-white dark:bg-[#141518] hover:bg-[#C83818]/5 dark:hover:bg-[#1A1C21] border border-slate-200 dark:border-[#21242B] hover:border-[#C83818]/60 dark:hover:border-[#C83818]/60 p-3.5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-2.5 select-none active:scale-[0.98] shadow-xs hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div className="rounded-xl bg-[#C83818]/10 dark:bg-[#C83818]/20 p-2 text-[#C83818] dark:text-[#DF7E63] group-hover:bg-[#C83818] group-hover:text-white transition-all shadow-xs">
                        <Tag className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1C21] border border-slate-200 dark:border-[#282C35] text-slate-600 dark:text-slate-300 font-semibold font-mono">
                        {p.base_unit_id === 'Kg'
                          ? language === 'ar'
                            ? 'بالكيلو'
                            : '/Kg'
                          : language === 'ar'
                          ? 'بالقطعة'
                          : '/Pc'}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#C83818] dark:group-hover:text-[#DF7E63] leading-snug">
                      {language === 'ar' ? p.name_ar || p.name_en : p.name_en}
                    </h4>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#21242B] flex flex-col items-baseline">
                    <span className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      {formatUSD(priceUsd)}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 font-mono">
                      {formatLBP(priceLbp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Shopping Cart & Direct Checkout */}
      <div className="w-full md:w-[380px] lg:w-[420px] xl:w-[460px] bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl flex flex-col min-w-0 shadow-xs overflow-hidden">
        {/* Cart Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-[#21242B] flex justify-between items-center bg-slate-50/80 dark:bg-[#1A1C21]/60">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <div className="p-1.5 rounded-lg bg-[#C83818]/10 dark:bg-[#C83818]/20 text-[#C83818] dark:text-[#DF7E63]">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {language === 'ar' ? `الطلب (${cart.length})` : `Order Cart (${cart.length})`}
              </h2>
              <span className="text-[10px] text-slate-400 block font-medium">
                {orderType === 'dine_in'
                  ? `🍽️ ${tableNumber}`
                  : orderType === 'takeaway'
                  ? '🥡 Takeaway'
                  : '🛵 Delivery'}
              </span>
            </div>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center space-x-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{language === 'ar' ? 'مسح' : 'Clear'}</span>
            </button>
          )}
        </div>

        {/* Cart Line Items (Click to select for Touch Numpad) */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-[140px]">
          {cart.map((item, idx) => {
            const lineSubUsd = item.quantity * item.unitPrice;
            const lineSubLbp = Math.round(lineSubUsd * usdToLbpRate);
            const isSelected = selectedCartIdx === idx;

            return (
              <div
                key={idx}
                onClick={() => setSelectedCartIdx(idx)}
                className={`p-2.5 rounded-2xl space-y-1.5 text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-500 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-[#1A1C21]/60 hover:bg-slate-50 dark:hover:bg-[#1A1C21] border border-slate-200 dark:border-[#282C35]'
                }`}
              >
                <div className="flex justify-between items-center font-bold gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                    )}
                    <span className="truncate text-slate-900 dark:text-slate-100 font-bold">
                      {language === 'ar' ? item.product.name_ar || item.product.name_en : item.product.name_en}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs sm:text-sm font-bold block">
                      {formatUSD(lineSubUsd)}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono font-medium block">
                      {formatLBP(lineSubLbp)}
                    </span>
                  </div>
                </div>

                {/* Quantity & Unit Price Controls */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center space-x-0.5 rtl:space-x-reverse bg-white dark:bg-[#0E0F12] rounded-xl p-0.5 border border-slate-200 dark:border-[#282C35] shadow-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isKg = item.product.base_unit_id === 'Kg' && item.product.allow_decimal_qty === 1;
                        const min = isKg ? 0.05 : 1;
                        updateCartItem(idx, 'quantity', Math.max(min, Math.round((item.quantity - 1) * 100) / 100));
                        setSelectedCartIdx(idx);
                      }}
                      className="p-1 hover:text-[#C83818] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1A1C21] rounded-lg transition-colors"
                      title="-1"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <div className="flex items-center">
                      <input
                        type="number"
                        step={item.product.base_unit_id === 'Kg' ? 'any' : '1'}
                        min={item.product.base_unit_id === 'Kg' ? '0.05' : '1'}
                        value={item.quantity}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateCartItem(idx, 'quantity', isNaN(val) ? 0 : val);
                          setSelectedCartIdx(idx);
                        }}
                        className="w-11 text-center bg-transparent font-bold font-mono focus:outline-none text-slate-900 dark:text-slate-100 text-[11px]"
                      />
                      <span className="text-[9px] text-slate-500 font-semibold pr-0.5 rtl:pr-0 rtl:pl-0.5">
                        {item.product.base_unit_id === 'Kg' ? (language === 'ar' ? 'كجم' : 'Kg') : (language === 'ar' ? 'قطعة' : 'Pc')}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCartItem(idx, 'quantity', Math.round((item.quantity + 1) * 100) / 100);
                        setSelectedCartIdx(idx);
                      }}
                      className="p-1 hover:text-[#C83818] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1A1C21] rounded-lg transition-colors"
                      title="+1"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Price per Unit in USD ($) */}
                  <div
                    className="flex items-center space-x-0.5 rtl:space-x-reverse bg-white dark:bg-[#0E0F12] rounded-xl px-1.5 py-1 border border-slate-200 dark:border-[#282C35] hover:border-emerald-500 transition-colors shadow-xs"
                    title={language === 'ar' ? 'سعر الوحدة ($)' : 'Unit price in USD ($)'}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateCartItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-12 text-center bg-transparent font-bold font-mono focus:outline-none text-emerald-600 dark:text-emerald-400 text-[11px]"
                    />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromCart(idx);
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <div className="p-4 rounded-3xl bg-slate-100 dark:bg-[#1A1C21] border border-slate-200 dark:border-[#282C35] mb-3">
                <Coffee className="h-10 w-10 text-[#DF7E63]" />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'اختر من القائمة لإضافة أصناف للطلب'
                  : 'Select cafeteria items to start order'}
              </p>
            </div>
          )}
        </div>

        {/* Compact Discount & Hold/Resume Row */}
        <div className="px-3 py-1.5 bg-slate-50/90 dark:bg-[#14161A] border-t border-slate-200 dark:border-[#21242B] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-semibold">{language === 'ar' ? 'خصم ($):' : 'Disc ($):'}</span>
            <input
              type="number"
              min="0"
              step="any"
              value={orderDiscount}
              onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-14 px-1.5 py-0.5 text-center bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-lg text-xs text-amber-600 font-mono font-bold focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={cart.length === 0}
              onClick={handleHoldSale}
              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 disabled:opacity-40"
              title={language === 'ar' ? 'تعليق الطلب الحالي' : 'Hold Current Order'}
            >
              <PauseCircle className="h-3.5 w-3.5 inline mr-1 rtl:mr-0 rtl:ml-1" />
              <span>{language === 'ar' ? 'تعليق' : 'Hold'}</span>
            </button>
            <button
              onClick={() => setShowHoldModal(true)}
              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-slate-300 dark:border-[#282C35] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C21]"
              title={language === 'ar' ? 'استئناف الطلبات المعلقة' : 'Resume Held Orders'}
            >
              <PlayCircle className="h-3.5 w-3.5 inline mr-1 rtl:mr-0 rtl:ml-1" />
              <span>{language === 'ar' ? 'استئناف' : 'Resume'}</span>
            </button>
          </div>
        </div>

        {/* Touchpad Numpad, Dual-Currency Display, and 1-Tap Checkout */}
        <POSTouchNumpad
          selectedItem={selectedCartIdx !== null ? cart[selectedCartIdx] || null : null}
          selectedItemIndex={selectedCartIdx}
          onUpdateQuantity={(newQty) => {
            if (selectedCartIdx !== null && cart[selectedCartIdx]) {
              updateCartItem(selectedCartIdx, 'quantity', newQty);
            }
          }}
          onIncrement={() => {
            if (selectedCartIdx !== null && cart[selectedCartIdx]) {
              const current = cart[selectedCartIdx].quantity;
              updateCartItem(selectedCartIdx, 'quantity', current + 1);
            }
          }}
          onDecrement={() => {
            if (selectedCartIdx !== null && cart[selectedCartIdx]) {
              const current = cart[selectedCartIdx].quantity;
              const isKg = cart[selectedCartIdx].product.base_unit_id === 'Kg';
              const min = isKg ? 0.05 : 1;
              updateCartItem(selectedCartIdx, 'quantity', Math.max(min, current - 1));
            }
          }}
          onRemoveItem={() => {
            if (selectedCartIdx !== null) {
              removeFromCart(selectedCartIdx);
            }
          }}
          grandTotalUsd={totals.grandTotal}
          grandTotalLbp={totals.grandTotalLbp}
          usdToLbpRate={usdToLbpRate}
          onFastPayAndPrint={handleFastPayAndPrint}
          onOpenDetailedPayment={() => setShowPaymentModal(true)}
          cartEmpty={cart.length === 0}
          isLoading={isLoading}
        />
      </div>

      {/* Modals */}
      <POSPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        grandTotal={totals.grandTotal}
        onConfirm={handlePaymentConfirm}
      />

      <POSHoldSaveModal
        isOpen={showHoldSaveModal}
        onClose={() => setShowHoldSaveModal(false)}
        onConfirm={handleHoldSaveConfirm}
      />

      <POSHoldResumeModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onSelect={resumeSale}
      />

      <ThermalReceiptModal
        isOpen={!!lastCompletedSale}
        onClose={() => setLastCompletedSale(null)}
        sale={lastCompletedSale}
      />
    </div>
  );
};
