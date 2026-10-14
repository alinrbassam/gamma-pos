import React, { useState, useEffect } from 'react';
import { useCommercialStore } from '@stores/useCommercialStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { RefreshCw, CheckCircle2, Download, Sparkles, ShieldCheck } from 'lucide-react';

const VERSION_CHANGELOG: Record<string, { en: string[]; ar: string[] }> = {
  '1.0.16': {
    en: [
      'Exact Product LBP Pricing: Fixed cent-truncation so entered LBP prices (e.g. 30,000 L.L) never lose 300 L.L ($0.33 vs $0.333333).',
      'Automatic Price Healing: Existing catalog items with fractional truncation are automatically corrected on startup and in POS.',
      'POS & Cart Perfect Match: Menu cards, cart items, and line subtotals display and charge exact round LBP amounts.',
    ],
    ar: [
      'دقة تامة لأسعار المنتجات بالليرة: معالجة تقريب السنتات لضمان عدم ضياع أي ليرة (مثل 30,000 ل.ل تظهر 30,000 ل.ل بدقة تامة دون نقص 300 ليرة).',
      'تصحيح تلقائي للمنتجات الحالية: معالجة تلقائية لأي منتج تم حفظه مسبقاً بفارق تقريب السنتات عند بدء التشغيل وشاشة البيع.',
      'تطابق تام في نقطة البيع والسلة: بطاقات الأصناف والسلة ومجاميع الفواتير متطابقة بالليرة دون أي كسور.',
    ],
  },
  '1.0.15': {
    en: [
      'Live Version Synchronization: Sidebar top header badge now always displays the exact active version installed.',
      'Config Persistence Fix: Runtime app version is decoupled from static store configuration.',
    ],
    ar: [
      'مزامنة شارة الإصدار: يعرض الشعار في أعلى القائمة الجانبية رقم الإصدار المثبت الفعلي بدقة.',
      'فصل إعدادات المتجر عن رقم الإصدار: منع ثبات رقم الإصدار على قيم سابقة في ملف الإعدادات.',
    ],
  },
  '1.0.14': {
    en: [
      'PS5 1-Hour Round Up: Automatic full hour billing with a 5-minute grace period buffer.',
      'Editable PS5 Gaming Price: Override and adjust gaming time cost directly at checkout with 1-click hour presets.',
      'Table Transfers: Customize gaming charges before transferring active console sessions to dine-in tables.',
    ],
    ar: [
      'احتساب ساعة كاملة للبلايستيشن: احتساب الساعة كاملة تلقائياً مع مهلة سماح 5 دقائق.',
      'تعديل سعر وقت اللعب: إمكانية تعديل سعر الجلسة مباشرة عند الدفع أو بضغطة زر لساعة أو ساعتين.',
      'تحويل مرن للطاولات: إمكانية تعديل سعر وقت اللعب قبل تحويل الحساب لطاولة الصالة.',
    ],
  },
  '1.0.13': {
    en: [
      'Zero Input Latency: Fixed keyboard typing delay and click freezing on modal dialogs.',
      'Smooth Background Updates: Throttled download event stream to eliminate Chromium thread starvation.',
      'Real-time Counter Optimization: Stopwatch ticks pause cleanly during active modals to protect focus.',
    ],
    ar: [
      'سرعة واستجابة فورية للكتابة: معالجة التأخير والتعليق عند إدخال البيانات في النوافذ المنبثقة.',
      'تحديثات خلفية انسيابية: ضبط تحميل التحديثات دون أي استهلاك زائد لمعالج الواجهة.',
      'تحسين العدادات الحية: إيقاف تحديثات المؤقت مؤقتاً أثناء فتح النوافذ لمنع إعادة تحميل الصفحة.',
    ],
  },
  '1.0.12': {
    en: [
      'Exact LBP Precision: Fixed rounding discrepancy so typed LBP amounts (e.g. 100,000 L.L) match Grand Total exactly.',
      'Synchronized Payment Modal: Exact integer LBP due amount and payment validation.',
    ],
    ar: [
      'دقة احتساب الليرة اللبنانية: إصلاح تقريب المجموع ليطابق سعر الصنف بالليرة بدقة تامة (مثل 100,000 ل.ل دون أي نقص).',
      'مزامنة شاشة الدفع: تطابق دقيق للمبلغ المطلوب والدفع بالليرة اللبنانية.',
    ],
  },
  '1.0.11': {
    en: [
      'LBP Cart Price Editing: Edit cart item prices directly in Lebanese Pounds (e.g. 135,000 L.L) with automatic USD calculation ($1.50).',
      'Clean Release Notes: Human-readable changelog display with private OTA channel.',
      'Discount LBP Conversion: Real-time Lebanese Pound equivalent for order discounts.',
    ],
    ar: [
      'تعديل سعر الصنف بالسلة بالليرة اللبنانية: إمكانية كتابة السعر مباشرة بالليرة (مثل 135,000 ل.ل) مع التحويل التلقائي للدولار ($1.50).',
      'ملاحظات إصدار نظيفة ومبوبة: عرض المزايا والتحسينات بنقاط واضحة دون إظهار أي روابط خارجية.',
      'معادل الخصم بالليرة: إظهار قيمة الخصم بالليرة اللبنانية فوراً إلى جانب الدولار.',
    ],
  },
  '1.0.10': {
    en: [
      'Editable Business Branding: Change your store name in Settings to update Sidebar, Login, and Receipts in real time.',
      'LBP Cart Price Editing: Change cart item prices directly in Lebanese Pounds (L.L) with automatic USD conversion.',
      'Thermal Receipt Printer: Full Windows print spooler integration with instant 1-click Test Print tool.',
      'Arabic Product Name: Dedicated Arabic naming field with full RTL support in inventory master records.',
      'Terminology Updates: Localized customer labels to "زبون" and generalized shipping/transport expenses.',
      'Safe Table Management: Soft-deletion prevents Foreign Key errors on tables with order history.',
    ],
    ar: [
      'اسم وهوية المتجر: إمكانية تعديل اسم المنشأة بالكامل من الإعدادات ليظهر فوراً في القائمة والشاشات والإيصالات.',
      'التركيز على الليرة بالسلة: إمكانية تعديل سعر الصنف في السلة مباشرة بالليرة اللبنانية مع التحويل التلقائي للدولار.',
      'طابعة الإيصالات الحرارية: توافق فوري مع طابعات ويندوز مع زر طباعة إيصال تجريبي بضغطة واحدة.',
      'اسم الصنف بالعربية: حقل مخصص لاسم المنتج باللغة العربية في شاشة المخزون وبطاقة الصنف.',
      'تعميم المصطلحات: اعتماد مسمى "زبون" و"زبون صالة"، وتعديل المصاريف إلى "نقل وشحن".',
      'حذف الطاولات الآمن: معالجة حذف الطاولات دون التأثير على الطلبات والفواتير السابقة.',
    ],
  },
  '1.0.9': {
    en: [
      'LBP Currency Formatting: Formatted Lebanese Pound with thousand separators (e.g. 2,025,000 L.L).',
      'Customer Debts: Added support for down payments in Lebanese Pounds (L.L).',
      'Enhanced cashier receipt previews and dual currency payment breakdown.',
    ],
    ar: [
      'تنسيق أرقام الليرة اللبنانية بفواصل الآلاف لسهولة القراءة (مثل: 2,025,000 ل.ل).',
      'ديون الزبائن: إمكانية تسجيل دفعة أولى بالليرة اللبنانية عند تسجيل الدين.',
      'تحسين معاينة إيصالات الكاشير وتفصيل الدفع بالعملتين.',
    ],
  },
  '1.0.8': {
    en: [
      'Security: Restricted dollar exchange rate and PlayStation rate modifications to Manager PIN mode.',
      'Enhanced cashier permissions and access safeguards.',
    ],
    ar: [
      'أمان النظام: قصر تعديل سعر صرف الدولار وأسعار البلايستيشن على وضع المدير بكلمة مرور.',
      'حماية صلاحيات الكاشير ومنع التعديلات غير المصرح بها.',
    ],
  },
  '1.0.7': {
    en: [
      'Hookah lounge catalog cleanup and expanded POS shopping cart layout.',
    ],
    ar: [
      'تنظيم وإصلاح قائمة الأراكيل وتوسيع مساحة سلة المشتريات لشاشات الكاشير.',
    ],
  },
};

const getCleanReleaseNotes = (
  version: string,
  rawNotes: string | undefined | null,
  isAr: boolean,
): string[] => {
  const normalizedVer = version.replace(/^v/, '');
  if (VERSION_CHANGELOG[normalizedVer]) {
    return isAr ? VERSION_CHANGELOG[normalizedVer].ar : VERSION_CHANGELOG[normalizedVer].en;
  }

  if (rawNotes) {
    const sanitized = rawNotes
      .replace(/<[^>]*>/g, ' ')
      .replace(/https?:\/\/[^\s]+/gi, '')
      .replace(/github[^\s]*/gi, '')
      .replace(/compare\/[^\s]*/gi, '')
      .replace(/Full Changelog:?/gi, '')
      .trim();

    const lines = sanitized
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !l.toLowerCase().includes('commit') && !l.toLowerCase().includes('github'));

    if (lines.length > 0) return lines;
  }

  return isAr ? VERSION_CHANGELOG['1.0.10'].ar : VERSION_CHANGELOG['1.0.10'].en;
};

export const UpdateSettings: React.FC = () => {
  const { language } = useLanguageStore();
  const {
    updateStatus,
    updateEvent,
    isInstallingUpdate,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    initUpdateListeners,
    isLoading,
  } = useCommercialStore();

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = initUpdateListeners();
    checkForUpdates()
      .then(() => setChecked(true))
      .catch(() => {});
    return () => unsub();
  }, [initUpdateListeners, checkForUpdates]);

  const handleCheck = async () => {
    await checkForUpdates();
    setChecked(true);
  };

  const handleInstall = async () => {
    await installUpdate();
  };

  const isDownloaded = updateEvent?.status === 'downloaded';
  const isDownloading = updateEvent?.status === 'downloading';
  const hasUpdate = Boolean(updateStatus?.hasUpdate || updateEvent?.status === 'available' || isDownloaded);
  const activeVersion = updateStatus?.currentVersion || '1.0.10';
  const targetVersion = updateEvent?.version || updateStatus?.latestVersion || activeVersion;
  const progressPercent = updateEvent?.progress?.percent ?? 0;

  useEffect(() => {
    if (updateStatus?.hasUpdate && !isDownloaded && !isDownloading && !isLoading) {
      downloadUpdate().catch(() => {});
    }
  }, [updateStatus?.hasUpdate, isDownloaded, isDownloading, isLoading, downloadUpdate]);

  const isAr = language === 'ar';
  const releaseNotesList = getCleanReleaseNotes(
    hasUpdate ? targetVersion : activeVersion,
    updateEvent?.releaseNotes || updateStatus?.releaseNotes,
    isAr,
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isAr ? 'تحديثات البرنامج' : 'Application Updates'}
        </h2>
        <p className="text-xs text-slate-500">
          {isAr
            ? 'تحديث البرنامج تلقائياً بضغطة زر واحدة دون انقطاع العمل أو إغلاق المبيعات.'
            : 'Update the application directly in 1 click without interrupting operations or closing sales.'}
        </p>
      </div>

      <Card title={isAr ? 'مدير التحديثات التلقائية' : 'Integrated Update Manager'}>
        <div className="space-y-5">
          {/* Version status card */}
          <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block">
                {isAr ? 'الإصدار المثبت حالياً:' : 'Currently Installed Version:'}
              </span>
              <span className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {updateStatus?.currentVersion ? (
                  `v${updateStatus.currentVersion}`
                ) : isLoading ? (
                  <span className="inline-flex items-center text-xs text-slate-400 font-normal">
                    <RefreshCw className="h-3 w-3 animate-spin mr-1.5" />
                    {isAr ? 'جاري التحقق...' : 'Checking...'}
                  </span>
                ) : (
                  `v${activeVersion}`
                )}
              </span>
            </div>

            <div>
              {isDownloaded ? (
                <Badge variant="success" className="px-3 py-1 text-xs">
                  {isAr ? `جاهز للتثبيت: v${targetVersion}` : `Ready to install: v${targetVersion}`}
                </Badge>
              ) : isDownloading ? (
                <Badge variant="info" className="px-3 py-1 text-xs animate-pulse">
                  {isAr ? `جاري التحميل (${progressPercent}%)` : `Downloading (${progressPercent}%)`}
                </Badge>
              ) : hasUpdate ? (
                <Badge variant="warning" className="px-3 py-1 text-xs">
                  {isAr ? `تحديث متوفر: v${targetVersion}` : `Update available: v${targetVersion}`}
                </Badge>
              ) : checked ? (
                <Badge variant="success" className="px-3 py-1 text-xs">
                  {isAr ? 'البرنامج محدث لآخر إصدار ✓' : 'Software is up to date ✓'}
                </Badge>
              ) : null}
            </div>
          </div>

          {/* Downloaded and Ready banner */}
          {isDownloaded && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-4">
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                    {isAr
                      ? `تم تحميل التحديث v${targetVersion} بنجاح!`
                      : `Update v${targetVersion} downloaded successfully!`}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {isAr
                      ? 'انقر على الزر لإعادة تشغيل البرنامج وتثبيت التحديث الآن. جميع بياناتك ومبيعاتك محفوظة بالكامل.'
                      : 'Click restart to apply the update immediately. All your data, sales history, and tables are preserved.'}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleInstall}
                isLoading={isInstallingUpdate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 shrink-0 flex items-center space-x-2 rtl:space-x-reverse shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{isAr ? 'إعادة التشغيل والتثبيت' : 'Restart & Install'}</span>
              </Button>
            </div>
          )}

          {/* Downloading Progress Bar */}
          {isDownloading && (
            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl space-y-2">
              <div className="flex justify-between text-xs font-semibold text-sky-900 dark:text-sky-200">
                <span>{isAr ? 'جاري تحميل الإصدار الجديد...' : 'Downloading new version in background...'}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-sky-200 dark:bg-sky-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-sky-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-sky-700 dark:text-sky-400">
                {isAr
                  ? 'يتم التحميل في الخلفية. يمكنك متابعة عمليات البيع كالمعتاد.'
                  : 'Download runs in the background. You can continue taking orders normally.'}
              </p>
            </div>
          )}

          {/* Clean User-Friendly Release Notes */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>
                  {isAr
                    ? `ملاحظات ومميزات الإصدار (v${hasUpdate ? targetVersion : activeVersion}):`
                    : `Release Notes (v${hasUpdate ? targetVersion : activeVersion}):`}
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {isAr ? 'أحدث المزايا والتحسينات' : 'Latest Features & Improvements'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl">
              <ul className="space-y-2">
                {releaseNotesList.map((note, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"
                  >
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Actions footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>{isAr ? 'القناة:' : 'Channel:'}</span>
              <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                {isAr ? 'تحديث سحابي فوري وآمن (Cloud OTA)' : 'Secure Cloud OTA'}
              </strong>
            </span>
            <div className="flex gap-2">
              {hasUpdate && !isDownloaded && !isDownloading && (
                <Button
                  onClick={downloadUpdate}
                  isLoading={isLoading}
                  className="bg-primary-600 hover:bg-primary-700 text-white flex items-center space-x-2 rtl:space-x-reverse"
                >
                  <Download className="h-4 w-4" />
                  <span>{isAr ? 'تحميل التحديث' : 'Download Update'}</span>
                </Button>
              )}

              <Button
                onClick={handleCheck}
                isLoading={isLoading}
                variant="outline"
                className="flex items-center space-x-2 rtl:space-x-reverse"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{isAr ? 'التحقق من وجود تحديثات' : 'Check for Updates'}</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
