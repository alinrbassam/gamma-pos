import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Minus,
  Search,
  X,
  ArrowRightLeft,
  Receipt,
  Phone,
  User,
  Clock,
  Settings,
  Coffee,
  Trash2,
  Edit2,
  Sparkles,
  ShoppingBag,
  Users,
  Gamepad2,
  Zap,
} from 'lucide-react';
import { useLanguageStore } from '../../renderer/stores/useLanguageStore';
import { useAuthStore } from '../../renderer/stores/useAuthStore';
import { useExchangeRateStore } from '../../renderer/stores/useExchangeRateStore';
import { useProductStore } from '../../renderer/stores/useProductStore';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';
import { Button } from '../../renderer/components/ui/Button';
import { ThermalReceiptModal } from '../pos/ThermalReceiptModal';
import { ExchangeRateModal } from '../../renderer/components/rates/ExchangeRateModal';
import { HookahFlavorEntity } from '../../shared/types';

interface DineInTable {
  id: string;
  name: string;
  capacity: number;
  display_order: number;
  is_active: number;
}

interface DineInTabItem {
  id: string;
  tab_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  line_total_usd: number;
  notes?: string;
  created_at?: string;
}

interface DineInTab {
  id: string;
  table_id: string;
  table_name: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  opened_at: string;
  closed_at?: string | null;
  status: string;
  notes?: string | null;
  items: DineInTabItem[];
  total_usd: number;
  total_lbp: number;
  elapsed_seconds: number;
}

interface TableWithTab {
  table: DineInTable;
  activeTab: DineInTab | null;
}

export const TablesPage: React.FC = () => {
  const { language } = useLanguageStore();
  const { activeRoleMode, setManagerUnlockModalOpen } = useAuthStore();
  const { usdToLbpRate } = useExchangeRateStore();
  const { products, loadProducts, categories: dbCategories, loadMetadata } = useProductStore();

  const [tablesWithTabs, setTablesWithTabs] = useState<TableWithTab[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

  // Filter / Search for tables
  const [tableFilter, setTableFilter] = useState<'all' | 'occupied' | 'available'>('all');
  const [tableSearch, setTableSearch] = useState('');

  // 1. Open Table Modal State
  const [openingTable, setOpeningTable] = useState<DineInTable | null>(null);
  const [openCustomerPhone, setOpenCustomerPhone] = useState('');
  const [openCustomerName, setOpenCustomerName] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [phoneLookupMessage, setPhoneLookupMessage] = useState<string | null>(null);
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  // 2. Add Items Modal State
  const [addingToTab, setAddingToTab] = useState<DineInTab | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // 3. Transfer Table Modal State
  const [transferringTab, setTransferringTab] = useState<DineInTab | null>(null);
  const [transferDestType, setTransferDestType] = useState<'table' | 'playstation'>('table');
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [targetPsConsoleId, setTargetPsConsoleId] = useState<string>('ps-1');

  // 3b. Merge Tables Modal State
  const [mergingTab, setMergingTab] = useState<DineInTab | null>(null);
  const [mergeTargetTableId, setMergeTargetTableId] = useState<string>('');

  // 4. Settle / Checkout Modal State
  const [checkingOutTab, setCheckingOutTab] = useState<DineInTab | null>(null);
  const [checkoutPaidUsd, setCheckoutPaidUsd] = useState<string>('');
  const [checkoutPaidLbp, setCheckoutPaidLbp] = useState<string>('');
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // 5. Manager "Manage Tables" Modal State
  const [isManageTablesOpen, setIsManageTablesOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editTableName, setEditTableName] = useState('');

  // 6. Hookah / Shisha Order Modal State
  const [hookahFlavors, setHookahFlavors] = useState<HookahFlavorEntity[]>([]);
  const [hookahModalTab, setHookahModalTab] = useState<DineInTab | null>(null);
  const [hookahSearch, setHookahSearch] = useState('');
  const [hookahNotice, setHookahNotice] = useState<string | null>(null);

  // Live timer tick (paused while managing tables so typing is never interrupted)
  useEffect(() => {
    if (isManageTablesOpen) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isManageTablesOpen]);

  const loadHookahFlavors = useCallback(async () => {
    try {
      if (window.api?.getHookahFlavors) {
        const res = await window.api.getHookahFlavors(true);
        if (res.success && res.data) {
          setHookahFlavors(res.data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  const loadState = useCallback(async () => {
    try {
      if (window.api?.getTablesState) {
        const res = await window.api.getTablesState();
        if (res.success && res.data) {
          setTablesWithTabs(res.data.tablesWithTabs);
        }
      }
    } catch (err) {
      console.error('Failed to load tables state', err);
    }
  }, []);

  useEffect(() => {
    loadState();
    loadHookahFlavors();
    loadProducts('');
    loadMetadata();
  }, [loadState, loadHookahFlavors, loadProducts, loadMetadata]);

  // Hookah Order Handler
  const handleOrderHookah = async (flavor: HookahFlavorEntity, type: 'full' | 'refill') => {
    if (!hookahModalTab) return;
    const prodId = `hookah-${flavor.id}-${type}`;
    const title =
      language === 'ar'
        ? `💨 ${flavor.name_ar} (${type === 'full' ? 'نفس كامل' : 'تغيير راس'})`
        : `💨 ${flavor.name_en} (${type === 'full' ? 'Full' : 'Refill'})`;
    const price = type === 'full' ? flavor.price_usd : flavor.refill_price_usd;

    try {
      if (window.api?.addTableItem) {
        const res = await window.api.addTableItem({
          tabId: hookahModalTab.id,
          productId: prodId,
          productName: title,
          quantity: 1,
          unitPriceUsd: price,
        });

        if (res.success) {
          await loadState();
          setHookahNotice(
            language === 'ar'
              ? `تمت إضافة "${title}" بنجاح!`
              : `Added "${title}" successfully!`,
          );
          setTimeout(() => setHookahNotice(null), 3000);

          setTablesWithTabs((prev) => {
            const found = prev.find((t) => t.activeTab?.id === hookahModalTab.id);
            if (found && found.activeTab) {
              setHookahModalTab(found.activeTab);
            }
            return prev;
          });
        } else {
          alert(res.error?.message || 'Error ordering hookah');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error ordering hookah');
    }
  };

  // Phone number lookup debounce for autofilling customer name
  useEffect(() => {
    const clean = openCustomerPhone.trim().replace(/[\s-]/g, '');
    if (clean.length < 3) {
      setPhoneLookupMessage(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingPhone(true);
        if (window.api?.lookupCustomerByPhone) {
          const res = await window.api.lookupCustomerByPhone(clean);
          if (res.success && res.data && res.data.found && res.data.name) {
            setOpenCustomerName(res.data.name);
            setPhoneLookupMessage(
              language === 'ar'
                ? `✨ تم العثور على العميل: ${res.data.name}`
                : `✨ Customer found: ${res.data.name}`,
            );
          } else {
            setPhoneLookupMessage(null);
          }
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingPhone(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [openCustomerPhone, language]);

  // Format Elapsed Stopwatch
  const formatStopwatch = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}h ${m.toString().padStart(2, '0')}m`;
    }
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  // 1. OPEN TABLE HANDLER
  const handleOpenTable = async () => {
    if (!openingTable) return;
    setIsLoading(true);
    try {
      if (window.api?.openTableTab) {
        const res = await window.api.openTableTab({
          tableId: openingTable.id,
          customerName: openCustomerName.trim() || undefined,
          customerPhone: openCustomerPhone.trim() || undefined,
          notes: openNotes.trim() || undefined,
        });

        if (res.success) {
          setOpeningTable(null);
          setOpenCustomerName('');
          setOpenCustomerPhone('');
          setOpenNotes('');
          setPhoneLookupMessage(null);
          await loadState();
        } else {
          alert(res.error?.message || 'Failed to open table tab');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error opening table');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. ADD ITEM TO TAB HANDLER
  const handleAddItemToTab = async (product: any) => {
    if (!addingToTab) return;
    const qty = itemQuantities[product.id] || 1;
    try {
      if (window.api?.addTableItem) {
        const res = await window.api.addTableItem({
          tabId: addingToTab.id,
          productId: product.id,
          productName: product.name_en || product.name_ar || 'Product',
          quantity: qty,
          unitPriceUsd: product.selling_price || 0,
        });

        if (res.success) {
          await loadState();
          setItemQuantities((prev) => ({ ...prev, [product.id]: 1 }));
          // Update the local addingToTab state with newly added item
          setTablesWithTabs((prev) => {
            const found = prev.find((t) => t.activeTab?.id === addingToTab.id);
            if (found && found.activeTab) {
              setAddingToTab(found.activeTab);
            }
            return prev;
          });
        } else {
          alert(res.error?.message || 'Error adding item to tab');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error adding item');
    }
  };

  // Stepper quantity update for active tab items
  const handleUpdateItemQty = async (itemId: string, newQty: number) => {
    try {
      if (window.api?.updateTableItemQty) {
        await window.api.updateTableItemQty({ itemId, quantity: newQty });
        await loadState();
      }
    } catch (err: any) {
      alert(err.message || 'Error updating quantity');
    }
  };

  // Remove item
  const handleRemoveItem = async (itemId: string) => {
    try {
      if (window.api?.removeTableItem) {
        await window.api.removeTableItem(itemId);
        await loadState();
      }
    } catch (err: any) {
      alert(err.message || 'Error removing item');
    }
  };

  // 3. TRANSFER TABLE HANDLER
  const handleConfirmTransfer = async () => {
    if (!transferringTab) return;
    setIsLoading(true);
    try {
      if (transferDestType === 'playstation') {
        if (!targetPsConsoleId) return;
        if (window.api?.transferTableToPlaystation) {
          const res = await window.api.transferTableToPlaystation({
            tableId: transferringTab.table_id,
            stationId: targetPsConsoleId,
            playersCount: 2,
          });

          if (res.success) {
            setTransferringTab(null);
            setTargetTableId('');
            await loadState();
          } else {
            alert(res.error?.message || 'Failed to transfer table to PlayStation');
          }
        }
      } else {
        if (!targetTableId) return;
        if (window.api?.transferTable) {
          const res = await window.api.transferTable({
            sourceTableId: transferringTab.table_id,
            targetTableId: targetTableId,
          });

          if (res.success) {
            setTransferringTab(null);
            setTargetTableId('');
            await loadState();
          } else {
            alert(res.error?.message || 'Failed to transfer table');
          }
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error transferring table');
    } finally {
      setIsLoading(false);
    }
  };

  // 3b. MERGE TABLES HANDLER
  const handleConfirmMerge = async () => {
    if (!mergingTab || !mergeTargetTableId) return;
    setIsLoading(true);
    try {
      if (window.api?.mergeTables) {
        const res = await window.api.mergeTables({
          sourceTableId: mergingTab.table_id,
          targetTableId: mergeTargetTableId,
        });

        if (res.success) {
          setMergingTab(null);
          setMergeTargetTableId('');
          await loadState();
        } else {
          alert(res.error?.message || 'Failed to merge tables');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error merging tables');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. CHECKOUT / SETTLE TAB HANDLER
  const handleOpenCheckout = (tab: DineInTab) => {
    setCheckingOutTab(tab);
    setCheckoutPaidUsd(tab.total_usd > 0 ? tab.total_usd.toFixed(2) : '0');
    setCheckoutPaidLbp('');
  };

  const handleConfirmCheckout = async () => {
    if (!checkingOutTab) return;
    const grandTotalUsd = checkingOutTab.total_usd;
    const numPaidUsd = parseFloat(checkoutPaidUsd) || 0;
    const numPaidLbp = parseFloat(checkoutPaidLbp) || 0;
    const totalPaidUsd = numPaidUsd + (usdToLbpRate > 0 ? numPaidLbp / usdToLbpRate : 0);

    if (totalPaidUsd < grandTotalUsd - 0.01) {
      alert(
        language === 'ar'
          ? `المبلغ المدفوع ($${totalPaidUsd.toFixed(2)}) أقل من الحساب الإجمالي ($${grandTotalUsd.toFixed(2)})!`
          : `Amount paid ($${totalPaidUsd.toFixed(2)}) is less than total ($${grandTotalUsd.toFixed(2)})!`,
      );
      return;
    }

    const changeUsd = Math.max(0, Math.round((totalPaidUsd - grandTotalUsd) * 100) / 100);
    const changeLbp = Math.round(changeUsd * usdToLbpRate);

    const payments: any[] = [];
    if (numPaidUsd > 0) {
      payments.push({ paymentMethod: 'Cash USD', amount: numPaidUsd });
    }
    if (numPaidLbp > 0) {
      payments.push({
        paymentMethod: 'Cash LBP',
        amount: Math.round((numPaidLbp / usdToLbpRate) * 100) / 100,
      });
    }
    if (payments.length === 0) {
      payments.push({ paymentMethod: 'Cash', amount: grandTotalUsd });
    }

    setIsLoading(true);
    try {
      if (window.api?.checkoutTableTab) {
        const res = await window.api.checkoutTableTab({
          tabId: checkingOutTab.id,
          payments,
          exchangeRate: usdToLbpRate,
          paidUsd: numPaidUsd,
          paidLbp: numPaidLbp,
          changeUsd,
          changeLbp,
          customerName: checkingOutTab.customer_name || undefined,
          customerPhone: checkingOutTab.customer_phone || undefined,
        });

        if (res.success && res.data) {
          setCheckingOutTab(null);
          setCompletedSale(res.data);
          setIsReceiptOpen(true);
          await loadState();
        } else {
          alert(res.error?.message || 'Checkout failed');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error completing checkout');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. MANAGER TABLES CRUD
  const handleAddTable = async () => {
    if (!newTableName.trim()) return;
    try {
      if (window.api?.createTable) {
        const cap = parseInt(newTableCapacity, 10) || 4;
        const res = await window.api.createTable({ name: newTableName.trim(), capacity: cap });
        if (res.success) {
          setNewTableName('');
          setNewTableCapacity('4');
          await loadState();
        } else {
          alert(res.error?.message || 'Error creating table');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error creating table');
    }
  };

  const handleUpdateTable = async (id: string) => {
    if (!editTableName.trim()) return;
    try {
      if (window.api?.updateTable) {
        const res = await window.api.updateTable({ id, name: editTableName.trim() });
        if (res.success) {
          setEditingTableId(null);
          setEditTableName('');
          await loadState();
        } else {
          alert(res.error?.message || 'Error updating table');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error updating table');
    }
  };

  const handleDeleteTable = async (id: string, name: string) => {
    if (
      !confirm(
        language === 'ar'
          ? `هل أنت متأكد من حذف ${name}؟`
          : `Are you sure you want to delete ${name}?`,
      )
    ) {
      return;
    }

    try {
      if (window.api?.deleteTable) {
        const res = await window.api.deleteTable(id);
        if (res.success) {
          await loadState();
        } else {
          alert(res.error?.message || 'Cannot delete table');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting table');
    }
  };

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tablesWithTabs.filter((item) => {
      const isOccupied = !!item.activeTab;
      if (tableFilter === 'occupied' && !isOccupied) return false;
      if (tableFilter === 'available' && isOccupied) return false;

      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesName = item.table.name.toLowerCase().includes(q);
        const matchesCustomer =
          item.activeTab?.customer_name?.toLowerCase().includes(q) || false;
        const matchesPhone = item.activeTab?.customer_phone?.includes(q) || false;
        return matchesName || matchesCustomer || matchesPhone;
      }
      return true;
    });
  }, [tablesWithTabs, tableFilter, tableSearch]);

  // Overall Statistics
  const totalTables = tablesWithTabs.length;
  const occupiedCount = tablesWithTabs.filter((t) => !!t.activeTab).length;
  const availableCount = totalTables - occupiedCount;
  const totalRunningRevenueUsd = tablesWithTabs.reduce(
    (sum, t) => sum + (t.activeTab?.total_usd || 0),
    0,
  );
  const totalRunningRevenueLbp = Math.round(totalRunningRevenueUsd * usdToLbpRate);

  // Available tables for transfer destination
  const availableTargetTables = tablesWithTabs.filter((t) => !t.activeTab);

  // Occupied tables for merge destination (all occupied except the source table)
  const occupiedTargetTables = tablesWithTabs.filter(
    (t) => !!t.activeTab && t.activeTab.id !== mergingTab?.id,
  );

  const psStations = [
    { id: 'ps-1', name: 'PS5 - Console 1' },
    { id: 'ps-2', name: 'PS5 - Console 2' },
  ];

  return (
    <div className="h-full flex-1 flex flex-col p-4 sm:p-6 space-y-6 bg-[#F8F9FA] dark:bg-[#0E0F12] text-slate-900 dark:text-slate-100 font-sans overflow-y-auto select-none">
      {/* Top Banner / Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl p-5 shadow-xs">
        <div className="flex items-center space-x-3.5 rtl:space-x-reverse">
          <div className="p-3 bg-[#C83818] text-white rounded-2xl shadow-md shadow-[#C83818]/30">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {language === 'ar' ? 'طاولات الصالة والطلبات المفتوحة' : 'Dine-In Tables & Running Tabs'}
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#C83818]/10 dark:bg-[#C83818]/20 text-[#C83818] dark:text-[#DF7E63] font-bold border border-[#C83818]/30">
                {totalTables} {language === 'ar' ? 'طاولة' : 'Tables'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'ar'
                ? 'إدارة جلسات الزبائن، فتح الطاولات، ترحيل الزبائن، والتحصيل عند المغادرة'
                : 'Manage customer dine-in tabs, add items over time, transfer tables, and end-of-night checkout'}
            </p>
          </div>
        </div>

        {/* Action Controls & Rate Display */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Rate Button */}
          <button
            onClick={() => setIsRatesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-[#1C1F26] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:border-[#C83818] transition-colors"
          >
            <span>💵 $1 =</span>
            <span className="text-[#C83818] font-black">{formatLBP(usdToLbpRate)}</span>
          </button>

          {/* Manager: Manage Tables Button */}
          <button
            onClick={() => {
              if (activeRoleMode === 'cashier') {
                setManagerUnlockModalOpen(true);
              } else {
                setIsManageTablesOpen(true);
              }
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-[#1A1C22] hover:bg-slate-200 dark:hover:bg-[#252833] text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-300 dark:border-[#2C303B] transition-all"
          >
            <Settings className="w-4 h-4 text-[#C83818]" />
            <span>{language === 'ar' ? 'إعدادات الطاولات (المدير)' : 'Manage Tables (Manager)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#141518] p-4 rounded-2xl border border-slate-200 dark:border-[#21242B] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400">
              {language === 'ar' ? 'إجمالي الطاولات' : 'Total Tables'}
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{totalTables}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1E2028] flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
            {totalTables}
          </div>
        </div>

        <div className="bg-white dark:bg-[#141518] p-4 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {language === 'ar' ? 'طاولات فارغة (متاحة)' : 'Available Tables'}
            </p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{availableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            🟢
          </div>
        </div>

        <div className="bg-white dark:bg-[#141518] p-4 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {language === 'ar' ? 'طاولات مشغولة (نشطة)' : 'Occupied Tables'}
            </p>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{occupiedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            🔴
          </div>
        </div>

        <div className="bg-white dark:bg-[#141518] p-4 rounded-2xl border border-[#C83818]/20 dark:border-[#C83818]/30 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#DF7E63]">
              {language === 'ar' ? 'إجمالي الحسابات المفتوحة' : 'Open Running Tabs'}
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {formatUSD(totalRunningRevenueUsd)}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              ({formatLBP(totalRunningRevenueLbp)})
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#C83818]/10 text-[#C83818] flex items-center justify-center font-bold">
            ☕
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#141518] p-3 rounded-2xl border border-slate-200 dark:border-[#21242B]">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setTableFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tableFilter === 'all'
                ? 'bg-[#C83818] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1C1E24]'
            }`}
          >
            {language === 'ar' ? 'الكل' : 'All'} ({totalTables})
          </button>
          <button
            onClick={() => setTableFilter('occupied')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tableFilter === 'occupied'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1C1E24]'
            }`}
          >
            {language === 'ar' ? 'المشغولة' : 'Occupied'} ({occupiedCount})
          </button>
          <button
            onClick={() => setTableFilter('available')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              tableFilter === 'available'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1C1E24]'
            }`}
          >
            {language === 'ar' ? 'المتاحة' : 'Available'} ({availableCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder={
              language === 'ar'
                ? 'بحث باسم الطاولة، الزبون، أو الهاتف...'
                : 'Search table, customer name, phone...'
            }
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C83818]"
          />
          {tableSearch && (
            <button
              onClick={() => setTableSearch('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* GRID OF TABLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {filteredTables.map(({ table, activeTab }) => {
          const isOccupied = !!activeTab;
          const elapsedSec = activeTab
            ? Math.max(0, Math.floor((now - new Date(activeTab.opened_at).getTime()) / 1000))
            : 0;

          return (
            <div
              key={table.id}
              className={`rounded-3xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                isOccupied
                  ? 'bg-white dark:bg-[#141518] border-amber-500/40 dark:border-amber-500/40 hover:border-amber-500 shadow-amber-500/5'
                  : 'bg-white dark:bg-[#141518] border-slate-200 dark:border-[#21242B] hover:border-emerald-500/50'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-100 dark:border-[#1E2028]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isOccupied ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {table.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOccupied
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}
                  >
                    {isOccupied
                      ? language === 'ar'
                        ? 'مشغولة'
                        : 'Occupied'
                      : language === 'ar'
                      ? 'متاحة'
                      : 'Available'}
                  </span>
                </div>

                {/* Subheader: Capacity or Elapsed Timer */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>👥 {table.capacity} {language === 'ar' ? 'كراسي' : 'seats'}</span>
                  {isOccupied && (
                    <span className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
                      <Clock className="w-3 h-3" />
                      {formatStopwatch(elapsedSec)}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                {isOccupied && activeTab ? (
                  <>
                    {/* Customer Info */}
                    <div className="bg-slate-50 dark:bg-[#191B22] p-2.5 rounded-xl border border-slate-200/80 dark:border-[#252833] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <User className="w-3.5 h-3.5 text-[#C83818]" />
                        <span className="truncate">
                          {activeTab.customer_name || (language === 'ar' ? 'زبون صالة' : 'Dine-In Guest')}
                        </span>
                      </div>
                      {activeTab.customer_phone && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{activeTab.customer_phone}</span>
                        </div>
                      )}
                      {activeTab.notes && (
                        <p className="text-[10px] text-slate-400 italic truncate">
                          &quot;{activeTab.notes}&quot;
                        </p>
                      )}
                    </div>

                    {/* Ordered Items Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span>{language === 'ar' ? 'الطلبات' : 'Orders'} ({activeTab.items.length})</span>
                        <span className="font-mono text-[#DF7E63] font-bold">
                          {formatUSD(activeTab.total_usd)}
                        </span>
                      </div>

                      {/* Items mini scroll list */}
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-xs">
                        {activeTab.items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic text-center py-2">
                            {language === 'ar' ? 'لا توجد أصناف بعد' : 'No items added yet'}
                          </p>
                        ) : (
                          activeTab.items.map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center justify-between gap-1 py-1 px-2 bg-slate-50 dark:bg-[#1A1C22] rounded-lg border border-slate-200/60 dark:border-[#242730]"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="font-bold text-[11px] truncate block text-slate-800 dark:text-slate-200">
                                  {it.product_name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatUSD(it.unit_price_usd)} ea
                                </span>
                              </div>

                              {/* Quantity Stepper Buttons */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(it.id, it.quantity - 1)}
                                  className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-[#282B35] hover:bg-slate-300 dark:hover:bg-[#343845] rounded text-slate-700 dark:text-slate-200"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="w-5 text-center font-bold font-mono text-xs">
                                  {it.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQty(it.id, it.quantity + 1)}
                                  className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-[#282B35] hover:bg-slate-300 dark:hover:bg-[#343845] rounded text-slate-700 dark:text-slate-200"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(it.id)}
                                  className="w-5 h-5 flex items-center justify-center text-rose-500 hover:text-rose-700 ml-0.5"
                                  title="Remove item"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Total Running Due */}
                    <div className="p-2.5 bg-[#C83818]/5 dark:bg-[#C83818]/10 rounded-xl border border-[#C83818]/20 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {language === 'ar' ? 'الحساب الحالي:' : 'Running Total:'}
                      </span>
                      <div className="text-right">
                        <span className="font-extrabold text-sm text-[#C83818] dark:text-[#DF7E63] font-mono block">
                          {formatUSD(activeTab.total_usd)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          ({formatLBP(activeTab.total_lbp)})
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Available Table Empty State */
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
                        {language === 'ar' ? 'طاولة متاحة' : 'Table is Available'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {language === 'ar' ? 'اضغط لفتح طلب للزبون' : 'Ready for customer order'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="pt-2">
                  {isOccupied && activeTab ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-4 gap-1">
                        <button
                          type="button"
                          onClick={() => setAddingToTab(activeTab)}
                          className="flex items-center justify-center gap-1 py-2 px-1 bg-[#C83818] hover:bg-[#A72B11] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>{language === 'ar' ? 'إضافة' : '+ Add'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setHookahModalTab(activeTab);
                            setHookahSearch('');
                            loadHookahFlavors();
                          }}
                          className="flex items-center justify-center gap-1 py-2 px-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold border border-amber-300 dark:border-amber-800/60 active:scale-95 transition-all"
                          title={language === 'ar' ? 'طلب أركيلة أو تغيير راس' : 'Hookah / Head Refill'}
                        >
                          <span className="text-xs">💨</span>
                          <span>{language === 'ar' ? 'أركيلة' : 'Shisha'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTransferringTab(activeTab);
                            setTransferDestType('table');
                            setTargetTableId('');
                          }}
                          className="flex items-center justify-center gap-1 py-2 px-1 bg-slate-100 dark:bg-[#1E2028] hover:bg-slate-200 dark:hover:bg-[#282B36] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-[#2C303B] active:scale-95 transition-all"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{language === 'ar' ? 'ترحيل' : 'Move'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMergingTab(activeTab);
                            setMergeTargetTableId('');
                          }}
                          className="flex items-center justify-center gap-1 py-2 px-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold border border-purple-300 dark:border-purple-800 active:scale-95 transition-all"
                        >
                          <Users className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span>{language === 'ar' ? 'دمج' : 'Merge'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCheckout(activeTab)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>{language === 'ar' ? '💳 دفع وحساب الطاولة' : '💳 Settle & Checkout'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpeningTable(table);
                        setOpenCustomerName('');
                        setOpenCustomerPhone('');
                        setOpenNotes('');
                        setPhoneLookupMessage(null);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{language === 'ar' ? 'فتح الطاولة للزبون' : 'Open Table Tab'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: OPEN TABLE / RUNNING TAB */}
      {openingTable && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#C83818]" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar'
                    ? `فتح جلسة: ${openingTable.name}`
                    : `Open Tab: ${openingTable.name}`}
                </h3>
              </div>
              <button
                onClick={() => setOpeningTable(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'ar'
                ? 'يمكنك إدخال رقم هاتف الزبون أو اسمه. إذا دخل الرقم سابقاً سيتم ملء اسمه تلقائياً.'
                : 'Enter customer phone or name. If they visited before, phone number will autofill their name.'}
            </p>

            <div className="space-y-4">
              {/* Phone Input with Autofill */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#C83818]" />
                  <span>{language === 'ar' ? 'رقم الهاتف (اختياري / للتعرف التلقائي):' : 'Phone Number (Autofills Customer):'}</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={openCustomerPhone}
                    onChange={(e) => setOpenCustomerPhone(e.target.value)}
                    placeholder="e.g. 70 123 456"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                    autoFocus
                  />
                  {isSearchingPhone && (
                    <span className="absolute right-3 top-2.5 text-[10px] text-amber-500 animate-pulse font-mono">
                      Searching...
                    </span>
                  )}
                </div>
                {phoneLookupMessage && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{phoneLookupMessage}</span>
                  </p>
                )}
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'ar' ? 'اسم الزبون (اختياري):' : 'Customer Name (Optional):'}</span>
                </label>
                <input
                  type="text"
                  value={openCustomerName}
                  onChange={(e) => setOpenCustomerName(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: علي بسام' : 'e.g. Ali Bassam'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ar' ? 'ملاحظات (اختياري):' : 'Table Notes (Optional):'}
                </label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: بجانب النافذة' : 'e.g. Near window'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpeningTable(null)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleOpenTable}
                isLoading={isLoading}
              >
                {language === 'ar' ? 'فتح الطاولة الآن' : 'Open Table Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ITEMS TO ACTIVE TAB */}
      {addingToTab && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#C83818]" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {language === 'ar'
                      ? `إضافة طلبات إلى: ${addingToTab.table_name}`
                      : `Add Items to: ${addingToTab.table_name}`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {addingToTab.customer_name || addingToTab.customer_phone || 'Guest'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddingToTab(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Category Pills & Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder={
                    language === 'ar'
                      ? 'بحث عن مشروبات، سناكس، أراكيل، حلويات...'
                      : 'Search drinks, snacks, shisha, desserts...'
                  }
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                  autoFocus
                />
              </div>

              {/* Categories Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-[#C83818] text-white'
                      : 'bg-slate-100 dark:bg-[#1A1C22] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {language === 'ar' ? '🏷️ الكل' : '🏷️ All'}
                </button>
                {dbCategories
                  ?.filter((c) => c.id !== 'cat-playstation')
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-colors ${
                        selectedCategory === c.id
                          ? 'bg-[#C83818] text-white'
                          : 'bg-slate-100 dark:bg-[#1A1C22] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {c.icon ? `${c.icon} ` : ''}
                      {language === 'ar' ? c.name_ar || c.name_en : c.name_en}
                    </button>
                  ))}
              </div>
            </div>

            {/* Hookah / Shisha Selector Banner */}
            {(selectedCategory === 'cat-shisha' || selectedCategory === 'all') && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💨</span>
                  <div>
                    <div className="font-bold text-xs text-amber-800 dark:text-amber-300">
                      {language === 'ar' ? 'أراكيل ونكهات وتغيير راس' : 'Hookah Flavors & Refills'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {language === 'ar'
                        ? 'اختر النكهة مع خيار نفس كامل أو تغيير راس'
                        : 'Pick flavor with Full Shisha or Head Refill options'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHookahModalTab(addingToTab);
                    setHookahSearch('');
                    loadHookahFlavors();
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>💨</span>
                  <span>{language === 'ar' ? 'طلب أركيلة' : 'Order Shisha'}</span>
                </button>
              </div>
            )}

            {/* Quick Favorites Bar (Suggestion #2) */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2.5">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{language === 'ar' ? 'الأكثر طلباً (إضافة سريعة بنقرة واحدة):' : 'Quick Favorites (1-Tap Fast Add):'}</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {products
                  .filter((p) => {
                    const name = (p.name_en || '').toLowerCase();
                    const nameAr = p.name_ar || '';
                    return (
                      name.includes('turkish') ||
                      name.includes('coffee') ||
                      name.includes('espresso') ||
                      name.includes('water') ||
                      name.includes('red bull') ||
                      name.includes('tea') ||
                      name.includes('shisha') ||
                      nameAr.includes('قهوة') ||
                      nameAr.includes('اسبريسو') ||
                      nameAr.includes('مياه') ||
                      nameAr.includes('ماء') ||
                      nameAr.includes('شاي') ||
                      nameAr.includes('شيشة') ||
                      nameAr.includes('أركيلة')
                    );
                  })
                  .slice(0, 8)
                  .map((fav) => (
                    <button
                      key={fav.id}
                      type="button"
                      onClick={() => handleAddItemToTab(fav)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E2028] border border-amber-500/30 text-slate-800 dark:text-slate-200 text-xs font-bold hover:border-amber-500 hover:bg-amber-500/15 shrink-0 shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>{language === 'ar' ? fav.name_ar || fav.name_en : fav.name_en}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ${(fav.selling_price || 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Products List with Quantity Stepper */}
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {products
                .filter((p) => {
                  // Exclude PlayStation items
                  const isPlaystation =
                    p.id === 'ps5-gaming-time' ||
                    p.id === 'ps5-gaming-service' ||
                    p.sku === 'PS5-TIME' ||
                    p.sku === 'PS5-SRV' ||
                    p.product_type === 'Service' ||
                    p.category_id === 'cat-playstation' ||
                    p.name_en?.toLowerCase().includes('playstation') ||
                    p.name_ar?.includes('بلايستيشن');
                  if (isPlaystation) return false;

                  if (selectedCategory !== 'all' && p.category_id !== selectedCategory) {
                    return false;
                  }

                  if (!itemSearch) return true;
                  const q = itemSearch.toLowerCase();
                  return (
                    p.name_en?.toLowerCase().includes(q) ||
                    p.name_ar?.includes(itemSearch) ||
                    p.sku?.toLowerCase().includes(q)
                  );
                })
                .map((p) => {
                  const qty = itemQuantities[p.id] || 1;
                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 dark:bg-[#1A1C21]/70 rounded-xl border border-slate-200 dark:border-[#282C35] flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-[#383D4A] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate">
                          {p.name_en || p.name_ar}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-extrabold text-xs text-[#DF7E63] font-mono">
                            {formatUSD(p.selling_price || 0)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({formatLBP(Math.round((p.selling_price || 0) * usdToLbpRate))})
                          </span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Add Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center bg-white dark:bg-[#121316] border border-slate-300 dark:border-[#2C303B] rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setItemQuantities((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, (prev[p.id] || 1) - 1),
                              }))
                            }
                            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252833] transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1;
                              setItemQuantities((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, Math.min(99, val)),
                              }));
                            }}
                            className="w-8 text-center text-xs font-bold font-mono bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItemQuantities((prev) => ({
                                ...prev,
                                [p.id]: (prev[p.id] || 1) + 1,
                              }))
                            }
                            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252833] transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddItemToTab(p)}
                          className="px-3 py-1.5 bg-[#C83818] hover:bg-[#A72B11] text-white text-xs font-bold rounded-lg shadow-xs active:scale-95 transition-all"
                        >
                          {language === 'ar' ? `+ أضف (${qty})` : `+ Add (${qty})`}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[#21242B]">
              <Button onClick={() => setAddingToTab(null)}>
                {language === 'ar' ? 'تم / إغلاق' : 'Done / Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFER TABLE / PLAYSTATION */}
      {transferringTab && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'ترحيل الطاولة / نقل الزبون' : 'Transfer / Move Table or Customer'}
                </h3>
              </div>
              <button
                onClick={() => setTransferringTab(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Tab Details */}
            <div className="p-3 bg-slate-50 dark:bg-[#1A1C22] rounded-xl border border-slate-200 dark:border-[#282C35] space-y-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {language === 'ar' ? 'نقل الحساب من:' : 'Move Tab From:'}{' '}
                <strong className="text-amber-500">{transferringTab.table_name}</strong>
              </span>
              <p className="text-xs text-slate-500">
                {language === 'ar' ? 'الزبون:' : 'Customer:'}{' '}
                {transferringTab.customer_name || transferringTab.customer_phone || 'Guest'}
              </p>
              <p className="text-xs font-mono font-bold text-[#DF7E63]">
                {transferringTab.items.length} {language === 'ar' ? 'أصناف' : 'items'} | Total:{' '}
                {formatUSD(transferringTab.total_usd)}
              </p>
            </div>

            {/* Destination Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#1A1C22] rounded-xl">
              <button
                type="button"
                onClick={() => setTransferDestType('table')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  transferDestType === 'table'
                    ? 'bg-white dark:bg-[#282C35] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'إلى طاولة أخرى' : 'To Another Table'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTransferDestType('playstation')}
                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  transferDestType === 'playstation'
                    ? 'bg-white dark:bg-[#282C35] text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'إلى منصة بلايستيشن' : 'To PlayStation'}</span>
              </button>
            </div>

            {/* Destination Selection */}
            {transferDestType === 'table' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'ar' ? 'اختر الطاولة الجديدة (المتاحة):' : 'Select Destination Table (Available):'}
                </label>

                {availableTargetTables.length === 0 ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                    {language === 'ar'
                      ? 'لا توجد طاولات فارغة متاحة حالياً للترحيل إليها!'
                      : 'No available tables right now to transfer to!'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableTargetTables.map((t) => (
                      <button
                        key={t.table.id}
                        type="button"
                        onClick={() => setTargetTableId(t.table.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                          targetTableId === t.table.id
                            ? 'bg-[#C83818] text-white border-[#C83818] shadow-sm'
                            : 'bg-slate-50 dark:bg-[#1A1C22] border-slate-200 dark:border-[#282C35] text-slate-800 dark:text-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {t.table.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'ar' ? 'اختر منصة البلايستيشن:' : 'Select PlayStation Console:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {psStations.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setTargetPsConsoleId(st.id)}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        targetPsConsoleId === st.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#1A1C22] border-slate-200 dark:border-[#282C35] text-slate-800 dark:text-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <Gamepad2 className="w-5 h-5" />
                      <span>{st.name}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {language === 'ar'
                    ? '💡 سيتم تحويل كافة طلبات الطاولة إلى حساب جلسة البلايستيشن وإفراغ هذه الطاولة فوراً.'
                    : '💡 All orders from this table will be moved to the PlayStation console tab, freeing this table.'}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setTransferringTab(null)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleConfirmTransfer}
                disabled={transferDestType === 'table' ? !targetTableId : !targetPsConsoleId}
                isLoading={isLoading}
              >
                {language === 'ar' ? 'تأكيد النقل' : 'Confirm Transfer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3b: MERGE OCCUPIED TABLES */}
      {mergingTab && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'دمج طاولتين معاً' : 'Merge Tables Together'}
                </h3>
              </div>
              <button
                onClick={() => setMergingTab(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Source Tab */}
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 space-y-1">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">
                {language === 'ar' ? 'طاولة المصدر (المراد دمجها وإفراغها):' : 'Source Table (to be merged & freed):'}
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {mergingTab.table_name} ({mergingTab.customer_name || 'Guest'})
              </p>
              <p className="text-xs font-mono font-bold text-[#DF7E63]">
                {mergingTab.items.length} {language === 'ar' ? 'أصناف' : 'items'} | Total:{' '}
                {formatUSD(mergingTab.total_usd)}
              </p>
            </div>

            {/* Target Occupied Table Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'ar'
                  ? 'اختر الطاولة المشغولة لضم الحساب إليها:'
                  : 'Select Occupied Table to Merge Into:'}
              </label>

              {occupiedTargetTables.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                  {language === 'ar'
                    ? 'لا توجد طاولات أخرى مشغولة لدمج الحساب معها!'
                    : 'No other occupied tables available to merge with!'}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {occupiedTargetTables.map((t) => (
                    <button
                      key={t.table.id}
                      type="button"
                      onClick={() => setMergeTargetTableId(t.table.id)}
                      className={`p-3 rounded-xl border text-xs font-bold text-left rtl:text-right transition-all ${
                        mergeTargetTableId === t.table.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-[#1A1C22] border-slate-200 dark:border-[#282C35] text-slate-800 dark:text-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-bold">{t.table.name}</div>
                      <div className="text-[10px] opacity-80">
                        {t.activeTab?.customer_name || 'Guest'} · {formatUSD(t.activeTab?.total_usd || 0)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              {language === 'ar'
                ? 'ℹ️ سيتم تجميع كافة الأصناف وحساب الطاولتين معاً تحت الطاولة المختارة وإفراغ طاولة المصدر.'
                : 'ℹ️ All items from both tables will combine under the target table, and the source table will be freed.'}
            </p>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMergingTab(null)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleConfirmMerge}
                disabled={!mergeTargetTableId}
                isLoading={isLoading}
              >
                {language === 'ar' ? 'تأكيد الدمج' : 'Confirm Merge'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CHECKOUT & SETTLE RUNNING TAB */}
      {checkingOutTab && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar'
                    ? `حساب الطاولة: ${checkingOutTab.table_name}`
                    : `Checkout: ${checkingOutTab.table_name}`}
                </h3>
              </div>
              <button
                onClick={() => setCheckingOutTab(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Customer & Time Summary */}
            <div className="p-3 bg-slate-50 dark:bg-[#191B22] rounded-xl border border-slate-200 dark:border-[#252833] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  {checkingOutTab.customer_name || 'Guest Customer'}
                </span>
                {checkingOutTab.customer_phone && (
                  <span className="text-slate-400 font-mono text-[11px]">
                    {checkingOutTab.customer_phone}
                  </span>
                )}
              </div>
              <div className="text-right font-mono text-slate-400 text-[11px]">
                <span>⏱️ {formatStopwatch(checkingOutTab.elapsed_seconds)}</span>
              </div>
            </div>

            {/* Items Summary Table */}
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-xs">
              {checkingOutTab.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50 dark:bg-[#181A20] rounded-lg"
                >
                  <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                    {it.quantity}x {it.product_name}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {formatUSD(it.line_total_usd)}
                  </span>
                </div>
              ))}
            </div>

            {/* Grand Total Highlight */}
            <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                  {language === 'ar' ? 'المبلغ المطلوب للدفع:' : 'Total Amount Due:'}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Rate: 1 USD = {formatLBP(usdToLbpRate)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                  {formatUSD(checkingOutTab.total_usd)}
                </span>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono block">
                  {formatLBP(checkingOutTab.total_lbp)}
                </span>
              </div>
            </div>

            {/* Dual Currency Cash Payments */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'طريقة الدفع (نقداً بالدولار / الليرة):' : 'Payment (Split USD / L.L):'}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">💵 Paid USD ($)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={checkoutPaidUsd}
                    onChange={(e) => setCheckoutPaidUsd(e.target.value.replace(',', '.'))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">🇱🇧 Paid L.L</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={checkoutPaidLbp}
                    onChange={(e) => setCheckoutPaidLbp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Live Change Calculation */}
              {(() => {
                const pUsd = parseFloat(checkoutPaidUsd) || 0;
                const pLbp = parseFloat(checkoutPaidLbp) || 0;
                const totalPaid = pUsd + (usdToLbpRate > 0 ? pLbp / usdToLbpRate : 0);
                const diffUsd = totalPaid - checkingOutTab.total_usd;
                const changeLbp = Math.round(Math.max(0, diffUsd) * usdToLbpRate);

                return (
                  <div className="p-3 bg-slate-100 dark:bg-[#1E2028] rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">
                      {language === 'ar' ? 'الباقي للزبون (Change):' : 'Change Due:'}
                    </span>
                    <div className="text-right font-mono font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {diffUsd >= 0 ? `${formatUSD(diffUsd)} (${formatLBP(changeLbp)})` : '$0.00'}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCheckingOutTab(null)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmCheckout}
                isLoading={isLoading}
              >
                {language === 'ar' ? 'تأكيد الدفع وطباعة الإيصال' : 'Confirm & Print Receipt'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: MANAGER "MANAGE TABLES" (Add / Edit / Remove) */}
      {isManageTablesOpen && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#C83818]" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'إدارة الطاولات (صلاحية المدير)' : 'Manage Tables (Manager Mode)'}
                </h3>
              </div>
              <button
                onClick={() => setIsManageTablesOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Helpful Rename Guide */}
            <div className="text-[11px] text-blue-700 dark:text-blue-300 bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span>
                {language === 'ar'
                  ? 'لتعديل اسم طاولة موجودة، اضغط على أيقونة القلم ✏️ بجانبها في القائمة أدناه، واضغط Enter للحفظ.'
                  : 'To rename an existing table, click the ✏️ pencil icon next to it in the list below, and press Enter to save.'}
              </span>
            </div>

            {/* Add New Table Section */}
            <div className="p-3 bg-slate-50 dark:bg-[#191B22] rounded-2xl border border-slate-200 dark:border-[#252833] space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {language === 'ar' ? '+ إضافة طاولة جديدة:' : '+ Add New Table:'}
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTable();
                  }}
                  placeholder={language === 'ar' ? 'اسم الطاولة (مثال: Table 6 أو تراس 1)' : 'Table name (e.g. Table 6)'}
                  className="flex-1 px-3 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs select-text focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                />
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(e.target.value)}
                  placeholder="Seats"
                  className="w-20 px-2 py-2 bg-white dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs font-mono text-center select-text focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTable}
                  disabled={!newTableName.trim()}
                  className="px-4 py-2 bg-[#C83818] hover:bg-[#A72B11] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                  {language === 'ar' ? 'إضافة' : 'Add'}
                </button>
              </div>
            </div>

            {/* Existing Tables List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {language === 'ar' ? 'قائمة الطاولات الحالية:' : 'Existing Tables List:'} ({tablesWithTabs.length})
              </span>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {tablesWithTabs.map(({ table, activeTab }) => {
                  const isEditing = editingTableId === table.id;
                  const isOccupied = !!activeTab;

                  return (
                    <div
                      key={table.id}
                      className="p-2.5 bg-slate-50 dark:bg-[#1A1C22] rounded-xl border border-slate-200 dark:border-[#282C35] flex items-center justify-between gap-2"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editTableName}
                            onChange={(e) => setEditTableName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateTable(table.id);
                              if (e.key === 'Escape') setEditingTableId(null);
                            }}
                            className="flex-1 px-3 py-1.5 bg-white dark:bg-[#0E0F12] border-2 border-emerald-500 rounded-xl text-xs font-bold select-text focus:outline-none"
                            placeholder={language === 'ar' ? 'الاسم الجديد...' : 'New name...'}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateTable(table.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                          >
                            {language === 'ar' ? 'حفظ' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTableId(null)}
                            className="px-2.5 py-1.5 bg-slate-200 dark:bg-[#2C303B] hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                              {table.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              ({table.capacity} seats)
                            </span>
                            {isOccupied && (
                              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Occupied
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTableId(table.id);
                                setEditTableName(table.name);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#282B35] rounded-lg transition-colors"
                              title="Rename Table"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              disabled={isOccupied}
                              onClick={() => handleDeleteTable(table.id, table.name)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                              title={
                                isOccupied
                                  ? 'Cannot delete an occupied table'
                                  : 'Delete Table'
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[#21242B]">
              <Button onClick={() => setIsManageTablesOpen(false)}>
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: HOOKAH / SHISHA ORDER MODAL */}
      {hookahModalTab && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xl">
                  💨
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {language === 'ar'
                      ? `طلب أراكيل ونكهات: ${hookahModalTab.table_name}`
                      : `Hookah & Shisha Order: ${hookahModalTab.table_name}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {hookahModalTab.customer_name || hookahModalTab.customer_phone || 'Guest'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setHookahModalTab(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Notification Toast */}
            {hookahNotice && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                <span>✓</span>
                <span>{hookahNotice}</span>
              </div>
            )}

            {/* Free Coal Policy Banner */}
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold flex items-center gap-1.5">
                <span>🔥</span>
                <span>{language === 'ar' ? 'تبديل الفحم مجاني دائمًا للزبائن' : 'Coal changes (فحم) are always free of charge'}</span>
              </span>
              <span className="text-[11px] opacity-75 font-mono">
                {language === 'ar' ? 'نفس كامل أو تجديد رأس' : 'Full Pipe or Head Refill'}
              </span>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={hookahSearch}
                onChange={(e) => setHookahSearch(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'بحث عن نكهة (تفاحتين، عنب، نعنع، لوف 66...)'
                    : 'Search flavor (Two Apples, Grape, Love 66...)'
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                autoFocus
              />
            </div>

            {/* Flavors Grid */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {hookahFlavors
                .filter((flv) => {
                  if (!hookahSearch) return true;
                  const q = hookahSearch.toLowerCase();
                  return (
                    flv.name_en.toLowerCase().includes(q) ||
                    flv.name_ar.includes(hookahSearch)
                  );
                })
                .map((flv) => (
                  <div
                    key={flv.id}
                    className="p-3 bg-slate-50 dark:bg-[#1A1C22] border border-slate-200 dark:border-[#282C35] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition-all shadow-2xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💨</span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                            {language === 'ar' ? flv.name_ar : flv.name_en}
                          </h4>
                          <span className="text-xs text-slate-400 font-normal">
                            {language === 'ar' ? flv.name_en : flv.name_ar}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for this flavor: Full vs Refill */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Full Hookah Button */}
                      <button
                        type="button"
                        onClick={() => handleOrderHookah(flv, 'full')}
                        className="flex-1 sm:flex-none flex flex-col items-center justify-center px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                      >
                        <span className="flex items-center gap-1">
                          <span>💨</span>
                          <span>{language === 'ar' ? 'نفس كامل' : 'Full Shisha'}</span>
                        </span>
                        <span className="text-[10px] opacity-90 font-mono mt-0.5">
                          ${Number(flv.price_usd).toFixed(2)} • {new Intl.NumberFormat('en-US').format(flv.price_lbp)} LBP
                        </span>
                      </button>

                      {/* Head Refill Button */}
                      <button
                        type="button"
                        onClick={() => handleOrderHookah(flv, 'refill')}
                        className="flex-1 sm:flex-none flex flex-col items-center justify-center px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                      >
                        <span className="flex items-center gap-1">
                          <span>🔄</span>
                          <span>{language === 'ar' ? 'تغيير راس' : 'Head Refill'}</span>
                        </span>
                        <span className="text-[10px] opacity-90 font-mono mt-0.5">
                          ${Number(flv.refill_price_usd).toFixed(2)} • {new Intl.NumberFormat('en-US').format(flv.refill_price_lbp)} LBP
                        </span>
                      </button>
                    </div>
                  </div>
                ))}

              {hookahFlavors.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {language === 'ar'
                    ? 'لا توجد نكهات مضافة. يمكنك إضافتها من قائمة الإعدادات.'
                    : 'No flavors configured. Add them in Settings.'}
                </div>
              )}
            </div>

            {/* Current Table Items Summary */}
            {hookahModalTab.items.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-[#21242B]">
                <div className="text-xs font-bold text-slate-500 mb-1.5 flex justify-between">
                  <span>{language === 'ar' ? 'طلبات الطاولة الحالية:' : 'Current Table Tab Items:'}</span>
                  <span className="font-mono text-emerald-600 font-bold">
                    ${hookahModalTab.total_usd.toFixed(2)} ({new Intl.NumberFormat('en-US').format(hookahModalTab.total_lbp)} LBP)
                  </span>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {hookahModalTab.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-[#1A1C22]"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {it.quantity}x {it.product_name}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                        ${it.line_total_usd.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#21242B]">
              <span className="text-[11px] text-slate-400">
                {language === 'ar'
                  ? 'يمكنك إضافة عدة أراكيل أو روس متتالية'
                  : 'You can tap multiple times to add multiple items'}
              </span>
              <Button onClick={() => setHookahModalTab(null)}>
                {language === 'ar' ? 'تم / إغلاق' : 'Done / Close'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT MODAL */}
      <ThermalReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setCompletedSale(null);
        }}
        sale={completedSale}
      />

      {/* RATES MODAL */}
      <ExchangeRateModal
        isOpen={isRatesModalOpen}
        onClose={() => setIsRatesModalOpen(false)}
      />
    </div>
  );
};
