import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Play,
  Square,
  Plus,
  Minus,
  Coffee,
  CheckCircle2,
  Receipt,
  Search,
  X,
  Sliders,
  UtensilsCrossed,
} from 'lucide-react';
import { ExchangeRateModal } from '../../renderer/components/rates/ExchangeRateModal';
import { useLanguageStore } from '../../renderer/stores/useLanguageStore';
import { useExchangeRateStore } from '../../renderer/stores/useExchangeRateStore';
import { useProductStore } from '../../renderer/stores/useProductStore';
import { formatUSD, formatLBP } from '../../renderer/utils/currency';
import { Button } from '../../renderer/components/ui/Button';

interface Station {
  id: string;
  name: string;
  status: 'available' | 'in_use' | 'maintenance';
}

interface SessionItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
}

interface ActiveSession {
  id: string;
  station_id: string;
  start_time: string;
  end_time?: string;
  players_count: number;
  hourly_rate_lbp: number;
  elapsed_seconds?: number;
  time_cost_lbp?: number;
  time_cost_usd?: number;
  items_cost_usd?: number;
  items_cost_lbp?: number;
  total_cost_usd?: number;
  total_cost_lbp?: number;
  items?: SessionItem[];
}

export const PlaystationPage: React.FC = () => {
  const { language } = useLanguageStore();
  const { usdToLbpRate, ratePerPlayerHourLbp } = useExchangeRateStore();
  const { products, loadProducts } = useProductStore();

  const [stations, setStations] = useState<Station[]>([
    { id: 'ps-1', name: 'PS5 - Console 1', status: 'available' },
    { id: 'ps-2', name: 'PS5 - Console 2', status: 'available' },
  ]);
  const [activeSessions, setActiveSessions] = useState<Record<string, ActiveSession>>({});
  const [now, setNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);

  const [stationPlayerCounts, setStationPlayerCounts] = useState<Record<string, number>>({
    'ps-1': 2,
    'ps-2': 2,
  });

  // Add Item to Session Modal
  const [addingItemSessionId, setAddingItemSessionId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

  // Checkout Session Modal
  const [checkingOutSession, setCheckingOutSession] = useState<{
    session: ActiveSession;
    station: Station;
    timeCostUsd: number;
    timeCostLbp: number;
    itemsCostUsd: number;
    itemsCostLbp: number;
    grandTotalUsd: number;
    grandTotalLbp: number;
    elapsedFormatted: string;
  } | null>(null);

  // Send Session to Table Modal
  const [sendingToTableSession, setSendingToTableSession] = useState<{
    session: ActiveSession;
    station: Station;
    timeCostUsd: number;
    timeCostLbp: number;
    itemsCostUsd: number;
    itemsCostLbp: number;
    grandTotalUsd: number;
    grandTotalLbp: number;
    elapsedFormatted: string;
  } | null>(null);
  const [dineInTables, setDineInTables] = useState<any[]>([]);
  const [selectedTargetTableId, setSelectedTargetTableId] = useState<string>('');

  const [checkoutPaidUsd, setCheckoutPaidUsd] = useState<string>('');
  const [checkoutPaidLbp, setCheckoutPaidLbp] = useState<string>('');
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

  const mapSessionData = (raw: any): ActiveSession => {
    return {
      id: raw.id,
      station_id: raw.stationId || raw.station_id,
      start_time: raw.startTime || raw.start_time,
      end_time: raw.endTime || raw.end_time,
      players_count: raw.playersCount || raw.players_count || 1,
      hourly_rate_lbp:
        raw.hourlyRateLbp ||
        raw.hourly_rate_lbp ||
        (raw.playersCount || raw.players_count || 1) * 200000,
      time_cost_lbp: raw.gamingTotalLbp || raw.time_cost_lbp || 0,
      time_cost_usd: raw.gamingTotalUsd || raw.time_cost_usd || 0,
      items_cost_usd: raw.ordersTotalUsd || raw.items_cost_usd || 0,
      items_cost_lbp: raw.ordersTotalLbp || raw.items_cost_lbp || 0,
      total_cost_usd: raw.grandTotalUsd || raw.total_cost_usd || 0,
      total_cost_lbp: raw.grandTotalLbp || raw.total_cost_lbp || 0,
      items: (raw.items || []).map((it: any) => ({
        id: it.id,
        product_name: it.productName || it.product_name,
        quantity: it.quantity,
        unit_price_usd: it.unitPriceUsd || it.unit_price_usd,
        total_price_usd: it.lineTotalUsd || it.total_price_usd,
      })),
    };
  };

  // Fetch live state from backend
  const loadState = async () => {
    try {
      if (window.api?.getPlaystationState) {
        const res = await window.api.getPlaystationState();
        if (res.success && res.data) {
          if (res.data.stations && res.data.stations.length > 0) {
            setStations(res.data.stations);
          }
          const sessionMap: Record<string, ActiveSession> = {};

          // Check both stations[].activeSession and activeSessions[]
          if (res.data.stations) {
            res.data.stations.forEach((st: any) => {
              if (st.activeSession) {
                sessionMap[st.id] = mapSessionData(st.activeSession);
              }
            });
          }

          if (res.data.activeSessions) {
            res.data.activeSessions.forEach((s: any) => {
              const stId = s.stationId || s.station_id;
              if (stId) {
                sessionMap[stId] = mapSessionData(s);
              }
            });
          }

          setActiveSessions(sessionMap);
        }
      }
    } catch (err) {
      console.error('Failed to load playstation state', err);
    }
  };

  useEffect(() => {
    loadState();
    loadProducts('');
  }, []);

  // Live timer tick every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds to HH:MM:SS
  const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // Calculate live financial figures for an active session
  const calculateLiveFigures = (session: ActiveSession) => {
    const startMs = new Date(session.start_time).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000));

    // LBP hourly rate is dynamic: players_count * ratePerPlayerHourLbp
    const hourlyRateLbp = session.hourly_rate_lbp || (session.players_count * ratePerPlayerHourLbp);
    const timeCostLbp = Math.round((elapsedSeconds / 3600) * hourlyRateLbp);
    const timeCostUsd = usdToLbpRate > 0 ? timeCostLbp / usdToLbpRate : 0;

    let itemsCostUsd = 0;
    if (session.items && session.items.length > 0) {
      itemsCostUsd = session.items.reduce((sum, item) => sum + (item.total_price_usd || 0), 0);
    }
    const itemsCostLbp = Math.round(itemsCostUsd * usdToLbpRate);

    const totalCostUsd = Math.round((timeCostUsd + itemsCostUsd) * 100) / 100;
    const totalCostLbp = timeCostLbp + itemsCostLbp;

    return {
      elapsedSeconds,
      elapsedFormatted: formatStopwatch(elapsedSeconds),
      hourlyRateLbp,
      timeCostLbp,
      timeCostUsd,
      itemsCostUsd,
      itemsCostLbp,
      totalCostUsd,
      totalCostLbp,
    };
  };

  // Handle Start Session
  const handleStartSession = async (station: Station) => {
    setIsLoading(true);
    try {
      if (window.api?.startPlaystationSession) {
        const players = stationPlayerCounts[station.id] || 2;
        const hourlyLbp = players * ratePerPlayerHourLbp;
        const res = await window.api.startPlaystationSession({
          stationId: station.id,
          playersCount: players,
          customHourlyRateLbp: hourlyLbp,
        });
        if (res.success) {
          await loadState();
        } else {
          alert(res.error?.message || 'Failed to start session');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error starting session');
    } finally {
      setIsLoading(false);
    }
  };

  // Open Checkout Modal
  const handleOpenCheckout = (session: ActiveSession, station: Station) => {
    const live = calculateLiveFigures(session);
    setCheckingOutSession({
      session,
      station,
      timeCostUsd: live.timeCostUsd,
      timeCostLbp: live.timeCostLbp,
      itemsCostUsd: live.itemsCostUsd,
      itemsCostLbp: live.itemsCostLbp,
      grandTotalUsd: live.totalCostUsd,
      grandTotalLbp: live.totalCostLbp,
      elapsedFormatted: live.elapsedFormatted,
    });
    setCheckoutPaidUsd(live.totalCostUsd.toFixed(2));
    setCheckoutPaidLbp('');
  };

  // Confirm Checkout & Stop
  const handleConfirmCheckout = async () => {
    if (!checkingOutSession) return;

    const numPaidUsd = parseFloat(checkoutPaidUsd) || 0;
    const numPaidLbp = parseFloat(checkoutPaidLbp) || 0;
    const totalPaidUsd = numPaidUsd + (numPaidLbp / usdToLbpRate);

    if (totalPaidUsd < checkingOutSession.grandTotalUsd - 0.01) {
      alert('The paid amount is less than the total due!');
      return;
    }

    const changeUsd = Math.max(0, totalPaidUsd - checkingOutSession.grandTotalUsd);
    const changeLbp = Math.round(changeUsd * usdToLbpRate);

    setIsLoading(true);
    try {
      if (window.api?.checkoutPlaystationSession) {
        const res = await window.api.checkoutPlaystationSession({
          sessionId: checkingOutSession.session.id,
          paidUsd: numPaidUsd,
          paidLbp: numPaidLbp,
          changeUsd: Math.round(changeUsd * 100) / 100,
          changeLbp,
        });

        if (res.success) {
          setTimeout(async () => {
            setCheckingOutSession(null);
            await loadState();
          }, 400);
        } else {
          alert(res.error?.message || 'Checkout failed');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error during checkout');
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm Send to Table
  const handleConfirmSendToTable = async () => {
    if (!sendingToTableSession || !selectedTargetTableId) return;
    setIsLoading(true);
    try {
      if (window.api?.sendPlaystationSessionToTable) {
        const res = await window.api.sendPlaystationSessionToTable({
          sessionId: sendingToTableSession.session.id,
          tableId: selectedTargetTableId,
        });

        if (res.success) {
          setSendingToTableSession(null);
          setSelectedTargetTableId('');
          await loadState();
        } else {
          alert(res.error?.message || 'Failed to send to table');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error sending session to table');
    } finally {
      setIsLoading(false);
    }
  };

  // Add Item to Session
  const handleAddItemToSession = async (product: any, qty = 1) => {
    if (!addingItemSessionId) return;
    const finalQty = Math.max(1, qty);
    try {
      if (window.api?.addPlaystationItem) {
        const res = await window.api.addPlaystationItem({
          sessionId: addingItemSessionId,
          productId: product.id,
          productName: product.name_en || product.name_ar || 'Snack',
          quantity: finalQty,
          unitPriceUsd: product.selling_price || 0,
        });
        if (res.success) {
          await loadState();
          setItemQuantities((prev) => ({ ...prev, [product.id]: 1 }));
          setAddingItemSessionId(null);
        } else {
          alert(res.error?.message || 'Error adding item');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error adding item');
    }
  };

  // Remove Item from Session
  const handleRemoveItem = async (itemId: string) => {
    try {
      if (window.api?.removePlaystationItem) {
        const res = await window.api.removePlaystationItem(itemId);
        if (res.success) {
          await loadState();
        } else {
          alert(res.error?.message || 'Could not remove item');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error removing item');
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col p-4 sm:p-6 space-y-6 bg-[#F8F9FA] dark:bg-[#0E0F12] text-slate-900 dark:text-slate-100 font-sans overflow-y-auto select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl p-5 shadow-xs">
        <div className="flex items-center space-x-3.5 rtl:space-x-reverse">
          <div className="p-3 bg-[#C83818] text-white rounded-2xl shadow-md shadow-[#C83818]/30">
            <Gamepad2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{language === 'ar' ? 'صالة ألعاب البلايستيشن' : 'PlayStation Gaming Lounge'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#C83818]/10 dark:bg-[#C83818]/20 text-[#C83818] dark:text-[#DF7E63] font-bold border border-[#C83818]/30">
                2 Consoles
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {language === 'ar'
                ? 'عدادات توقيت دقيقة، ألعاب فردية وجماعية (فيفا حتى 4 لاعبين)، وطلب المشروبات مباشرة'
                : 'Live session stopwatch, 1-4 players (FIFA multiplayer), and cafeteria snack ordering'}
            </p>
          </div>
        </div>

        {/* Dynamic Rate Info Badge */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 bg-[#C83818]/10 dark:bg-[#C83818]/15 border border-[#C83818]/30 rounded-2xl text-xs">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
              {language === 'ar' ? 'تسعيرة الساعة لكل لاعب:' : 'Hourly Rate / Player:'}
            </span>
            <span className="font-extrabold text-[#C83818] dark:text-[#DF7E63] font-mono text-sm">
              {formatLBP(ratePerPlayerHourLbp)} / hr
            </span>
          </div>

          <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
              {language === 'ar' ? 'سعر صرف الدولار:' : 'USD Exchange Rate:'}
            </span>
            <span className="font-extrabold text-emerald-700 dark:text-emerald-300 font-mono text-sm">
              $1 = {usdToLbpRate.toLocaleString('en-US')} L.L
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsRatesModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-[#1A1C21] hover:bg-slate-100 dark:hover:bg-[#252833] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#282C35] rounded-2xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
            title={language === 'ar' ? 'تعديل أسعار البلايستيشن وسعر الصرف' : 'Edit PlayStation & Exchange Rates'}
          >
            <Sliders className="w-4 h-4 text-[#C83818]" />
            <span>{language === 'ar' ? 'تعديل الأسعار' : 'Edit Rates'}</span>
          </button>
        </div>
      </div>

      {/* STATIONS GRID (PS 1 and PS 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stations.map((st) => {
          const session = activeSessions[st.id];
          const isBusy = !!session;
          const live = session ? calculateLiveFigures(session) : null;

          return (
            <div
              key={st.id}
              className={`rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-sm ${
                isBusy
                  ? 'bg-white dark:bg-[#141518] border-[#C83818]/60 ring-2 ring-[#C83818]/20 shadow-md'
                  : 'bg-white dark:bg-[#141518] border-slate-200 dark:border-[#21242B] hover:border-slate-300 dark:hover:border-[#282C35]'
              }`}
            >
              {/* Station Card Header */}
              <div
                className={`p-5 flex items-center justify-between border-b ${
                  isBusy
                    ? 'bg-[#C83818]/10 dark:bg-[#C83818]/15 border-[#C83818]/20'
                    : 'bg-slate-50/70 dark:bg-[#1A1C21]/60 border-slate-100 dark:border-[#21242B]'
                }`}
              >
                <div className="flex items-center space-x-3 rtl:space-x-reverse">
                  <div
                    className={`p-3 rounded-2xl ${
                      isBusy
                        ? 'bg-[#C83818] text-white shadow-md shadow-[#C83818]/30'
                        : 'bg-slate-200 dark:bg-[#282C35] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Gamepad2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{st.name}</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {isBusy ? `Started at ${new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Console is ready for play'}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {isBusy ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>{language === 'ar' ? 'جارٍ اللعب' : 'Playing Now'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{language === 'ar' ? 'متاح للعب' : 'Available'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Station Card Body */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                {isBusy && live ? (
                  /* BUSY / ACTIVE PLAYING VIEW */
                  <div className="space-y-5">
                    {/* Live Stopwatch & Players Banner */}
                    <div className="p-4 bg-[#0E0F12] border border-[#21242B] text-white rounded-2xl flex items-center justify-between shadow-inner">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                          {language === 'ar' ? 'وقت اللعب المنقضي:' : 'Elapsed Play Time:'}
                        </span>
                        <div className="text-3xl font-black font-mono tracking-wider text-[#DF7E63]">
                          {live.elapsedFormatted}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">
                          {language === 'ar' ? 'عدد اللاعبين:' : 'Players:'}
                        </span>
                        <span className="inline-block mt-0.5 px-2.5 py-1 bg-[#C83818]/20 border border-[#C83818]/50 rounded-lg text-xs font-bold text-[#DF7E63]">
                          🎮 {session.players_count} {session.players_count === 4 ? '(FIFA 4P)' : 'Players'}
                        </span>
                      </div>
                    </div>

                    {/* Financial Figures */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {/* Gaming Time Cost */}
                      <div className="p-3 bg-slate-50 dark:bg-[#1A1C21]/60 rounded-xl border border-slate-200 dark:border-[#282C35]">
                        <span className="text-slate-500 dark:text-slate-400 block font-semibold text-[11px]">
                          {language === 'ar' ? 'تكلفة وقت اللعب:' : 'Time Cost:'}
                        </span>
                        <div className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                          {formatLBP(live.timeCostLbp)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ~ {formatUSD(live.timeCostUsd)}
                        </span>
                      </div>

                      {/* Attached Items / Drinks */}
                      <div className="p-3 bg-slate-50 dark:bg-[#1A1C21]/60 rounded-xl border border-slate-200 dark:border-[#282C35]">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                            {language === 'ar' ? 'مشروبات وسناكس:' : 'Drinks & Snacks:'}
                          </span>
                          <button
                            onClick={() => setAddingItemSessionId(session.id)}
                            className="p-1 hover:bg-[#C83818]/10 text-[#C83818] dark:text-[#DF7E63] rounded-md transition-colors"
                            title="Add item"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                          {formatUSD(live.itemsCostUsd)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatLBP(live.itemsCostLbp)}
                        </span>
                      </div>
                    </div>

                    {/* Attached Items List if any */}
                    {session.items && session.items.length > 0 && (
                      <div className="p-3 bg-slate-50 dark:bg-[#1A1C21]/40 rounded-xl border border-slate-200 dark:border-[#282C35] space-y-1.5 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {language === 'ar' ? `الطلبات والوجبات (${session.items.length}):` : `Ordered Items (${session.items.length}):`}
                        </span>
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                          {session.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-[11px] py-0.5 border-b border-slate-200/50 dark:border-slate-800/50 last:border-none">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {item.quantity}× {item.product_name}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold font-mono text-[#DF7E63]">
                                  {formatUSD(item.total_price_usd)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors"
                                  title={language === 'ar' ? 'حذف هذا الصنف' : 'Remove this item'}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Live Grand Total Due */}
                    <div className="p-4 bg-[#C83818]/10 dark:bg-[#C83818]/15 rounded-2xl border border-[#C83818]/30 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-[#C83818] dark:text-[#DF7E63] font-bold uppercase tracking-wider block">
                          {language === 'ar' ? 'الإجمالي الحالي للجلسة:' : 'Current Total Due:'}
                        </span>
                        <div className="text-xl font-black text-[#C83818] dark:text-[#DF7E63] font-mono">
                          {formatUSD(live.totalCostUsd)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono">
                          {formatLBP(live.totalCostLbp)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons for Active Session */}
                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setAddingItemSessionId(session.id)}
                          className="text-xs border-[#C83818]/30 text-[#C83818] dark:text-[#DF7E63] bg-[#C83818]/10 hover:bg-[#C83818]/20 rounded-xl flex items-center justify-center gap-1.5"
                        >
                          <Coffee className="w-4 h-4" />
                          <span>{language === 'ar' ? '+ إضافة مشروب' : '+ Add Drink'}</span>
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            const liveData = calculateLiveFigures(session);
                            setSendingToTableSession({
                              session,
                              station: st,
                              timeCostUsd: liveData.timeCostUsd,
                              timeCostLbp: liveData.timeCostLbp,
                              itemsCostUsd: liveData.itemsCostUsd,
                              itemsCostLbp: liveData.itemsCostLbp,
                              grandTotalUsd: liveData.totalCostUsd,
                              grandTotalLbp: liveData.totalCostLbp,
                              elapsedFormatted: liveData.elapsedFormatted,
                            });
                            if (window.api?.getTablesState) {
                              window.api.getTablesState().then((r) => {
                                if (r.success && r.data?.tablesWithTabs) {
                                  setDineInTables(r.data.tablesWithTabs);
                                }
                              });
                            }
                          }}
                          className="text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl flex items-center justify-center gap-1.5 font-bold"
                        >
                          <UtensilsCrossed className="w-4 h-4" />
                          <span>{language === 'ar' ? '☕ إرسال لطاولة' : '☕ Send to Table'}</span>
                        </Button>
                      </div>

                      <Button
                        onClick={() => handleOpenCheckout(session, st)}
                        className="w-full text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 py-2.5"
                      >
                        <Square className="w-4 h-4" />
                        <span>{language === 'ar' ? 'إنهاء وحساب الكاشير' : 'Stop & Checkout'}</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* IDLE / AVAILABLE STATION VIEW */
                  <div className="space-y-6 py-2">
                    <div className="text-center space-y-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {language === 'ar' ? 'الجهاز جاهز لاستقبال اللاعبين' : 'Ready for New Players'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {language === 'ar'
                          ? 'اختر عدد اللاعبين للبدء بحساب الوقت تلقائياً'
                          : 'Select player count to begin time tracking'}
                      </p>
                    </div>

                    {/* Players Selector (1 to 4) */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                        {language === 'ar' ? 'عدد اللاعبين:' : 'Select Players Count:'}
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((p) => {
                          const currentPlayers = stationPlayerCounts[st.id] || 2;
                          const isSel = currentPlayers === p;
                          const hourly = p * ratePerPlayerHourLbp;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setStationPlayerCounts((prev) => ({ ...prev, [st.id]: p }));
                              }}
                              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-[#C83818] text-white border-[#C83818] shadow-md shadow-[#C83818]/25 scale-[1.02]'
                                  : 'bg-slate-50 dark:bg-[#1A1C21] border-slate-200 dark:border-[#282C35] hover:border-[#C83818]/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="text-base font-black">
                                {p} {p === 1 ? 'Player' : 'Players'}
                              </div>
                              <div className={`text-[10px] font-semibold mt-1 ${isSel ? 'text-white/90' : 'text-slate-400'}`}>
                                {formatLBP(hourly)}/hr
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Estimated Hourly Rate preview */}
                    <div className="p-3 bg-[#C83818]/10 dark:bg-[#C83818]/15 rounded-xl border border-[#C83818]/30 flex justify-between items-center text-xs">
                      <span className="text-[#C83818] dark:text-[#DF7E63] font-semibold">
                        {language === 'ar' ? 'تسعيرة الساعة لهذه الجلسة:' : 'Hourly Rate for this session:'}
                      </span>
                      <span className="font-extrabold text-[#C83818] dark:text-[#DF7E63] font-mono text-sm">
                        {formatLBP((stationPlayerCounts[st.id] || 2) * ratePerPlayerHourLbp)} / hr
                      </span>
                    </div>

                    {/* Start Button */}
                    <Button
                      onClick={() => handleStartSession(st)}
                      disabled={isLoading}
                      className="w-full py-3.5 bg-[#C83818] hover:bg-[#A72B11] text-white font-black text-sm rounded-2xl shadow-lg shadow-[#C83818]/20 flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>
                        {language === 'ar'
                          ? `بدء اللعب (${stationPlayerCounts[st.id] || 2} لاعبين)`
                          : `Start Session (${stationPlayerCounts[st.id] || 2} Players)`}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: ADD DRINK / SNACK TO ACTIVE SESSION */}
      {addingItemSessionId && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#C83818]" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'إضافة مشروب أو سناك للجلسة' : 'Add Drink / Snack to Session'}
                </h3>
              </div>
              <button
                onClick={() => setAddingItemSessionId(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search cafeteria items..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                autoFocus
              />
            </div>

            {/* Products List */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {products
                .filter((p) => {
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
                  if (!itemSearch) return true;
                  return (
                    p.name_en?.toLowerCase().includes(itemSearch.toLowerCase()) ||
                    p.name_ar?.includes(itemSearch)
                  );
                })
                .map((p) => {
                  const qty = itemQuantities[p.id] || 1;
                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 dark:bg-[#1A1C21]/60 rounded-xl border border-slate-200 dark:border-[#282C35] flex items-center justify-between gap-3 transition-colors"
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
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setItemQuantities((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, val),
                              }));
                            }}
                            className="w-9 h-7 text-center font-bold text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                          onClick={() => handleAddItemToSession(p, qty)}
                          className="px-3 py-1.5 bg-[#C83818] hover:bg-[#A82810] text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{language === 'ar' ? `إضافة (${qty})` : `Add (${qty})`}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              {products.filter((p) => {
                const isPlaystation =
                  p.id === 'ps5-gaming-time' ||
                  p.id === 'ps5-gaming-service' ||
                  p.sku === 'PS5-TIME' ||
                  p.sku === 'PS5-SRV' ||
                  p.product_type === 'Service' ||
                  p.category_id === 'cat-playstation' ||
                  p.name_en?.toLowerCase().includes('playstation') ||
                  p.name_ar?.includes('بلايستيشن');
                return !isPlaystation;
              }).length === 0 && (
                <p className="text-center text-xs text-slate-400 py-6">
                  {language === 'ar'
                    ? 'لا توجد منتجات كافتيريا مطابقة'
                    : 'No cafeteria products available.'}
                </p>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setAddingItemSessionId(null)}
              className="w-full text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT & FINISH PLAYSTATION SESSION */}
      {checkingOutSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#C83818]" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {checkingOutSession.station.name} - Checkout
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Duration: {checkingOutSession.elapsedFormatted} • {checkingOutSession.session.players_count} Players
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCheckingOutSession(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Bill Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-[#1A1C21]/60 rounded-2xl border border-slate-200 dark:border-[#282C35] space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Gaming Time ({checkingOutSession.elapsedFormatted}):</span>
                <span className="font-mono font-bold">
                  {formatUSD(checkingOutSession.timeCostUsd)} ({formatLBP(checkingOutSession.timeCostLbp)})
                </span>
              </div>
              {checkingOutSession.itemsCostUsd > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Drinks & Snacks:</span>
                  <span className="font-mono font-bold">
                    {formatUSD(checkingOutSession.itemsCostUsd)} ({formatLBP(checkingOutSession.itemsCostLbp)})
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-[#282C35] flex justify-between items-baseline font-black">
                <span className="text-sm">Total Due:</span>
                <div className="text-right">
                  <span className="text-xl text-[#DF7E63] font-mono block">
                    {formatUSD(checkingOutSession.grandTotalUsd)}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {formatLBP(checkingOutSession.grandTotalLbp)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dual Currency Split Payment Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Paid USD ($):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={checkoutPaidUsd}
                  onChange={(e) => setCheckoutPaidUsd(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-base font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Paid LBP (L.L):
                </label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={checkoutPaidLbp}
                  onChange={(e) => setCheckoutPaidLbp(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0E0F12] border border-slate-300 dark:border-[#282C35] rounded-xl text-base font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#C83818]"
                />
              </div>
            </div>

            {/* Confirm Checkout Button */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCheckingOutSession(null)}
                className="w-1/3 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCheckout}
                disabled={isLoading}
                className="w-2/3 py-3 bg-[#C83818] hover:bg-[#A72B11] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish & Collect Payment</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT RATES & PLAYSTATION PRICING */}
      <ExchangeRateModal
        isOpen={isRatesModalOpen}
        onClose={() => setIsRatesModalOpen(false)}
      />

      {/* MODAL: SEND PLAYSTATION SESSION TO DINE-IN TABLE */}
      {sendingToTableSession && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141518] border border-slate-200 dark:border-[#21242B] rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#21242B]">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {language === 'ar'
                      ? `تحويل حساب ${sendingToTableSession.station.name} إلى طاولة`
                      : `Transfer ${sendingToTableSession.station.name} to Table`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {sendingToTableSession.elapsedFormatted} • {sendingToTableSession.session.players_count} {language === 'ar' ? 'لاعبين' : 'Players'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSendingToTableSession(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Session Amount Summary */}
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-blue-900 dark:text-blue-300 block">
                  {language === 'ar' ? 'المبلغ المحول للحساب:' : 'Amount to Transfer:'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {language === 'ar' ? 'وقت اللعب + جميع المشروبات والطلبات' : 'Gaming fee + drinks & snacks'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-blue-600 dark:text-blue-400 font-mono block">
                  {formatUSD(sendingToTableSession.grandTotalUsd)}
                </span>
                <span className="text-[11px] font-bold text-slate-500 font-mono block">
                  ({formatLBP(sendingToTableSession.grandTotalLbp)})
                </span>
              </div>
            </div>

            {/* Table Selection Grid */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'ar'
                  ? 'اختر الطاولة لتحويل الحساب إليها (طاولة جالسين عليها أو طاولة جديدة):'
                  : 'Select Destination Table (Current or New table):'}
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                {dineInTables.map(({ table, activeTab }) => {
                  const isSelected = selectedTargetTableId === table.id;
                  const isOccupied = !!activeTab;

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => setSelectedTargetTableId(table.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-[#C83818] text-white border-[#C83818] shadow-md scale-[1.02]'
                          : isOccupied
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:border-amber-500'
                          : 'bg-slate-50 dark:bg-[#1A1C22] border-slate-200 dark:border-[#282C35] text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-extrabold text-xs truncate">{table.name}</div>
                      <div className="text-[10px] mt-0.5 truncate font-semibold">
                        {isOccupied
                          ? activeTab.customer_name || (language === 'ar' ? 'جلسة مفتوحة' : 'Occupied')
                          : language === 'ar'
                          ? 'متاحة (جديدة)'
                          : 'Available'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              {language === 'ar'
                ? '💡 سيتم إضافة وقت اللعب والمشروبات فوراً إلى فاتورة الطاولة، وسيصبح جهاز البلايستيشن متاحاً للاعبين الجدد.'
                : '💡 Gaming time & drinks will be added to the table bill, and this PS5 console will immediately become free for new players.'}
            </p>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-[#21242B]">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSendingToTableSession(null)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                onClick={handleConfirmSendToTable}
                disabled={!selectedTargetTableId || isLoading}
                isLoading={isLoading}
              >
                {language === 'ar' ? 'تأكيد وتحرير الجهاز' : 'Confirm & Free Console'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PlaystationPage;
