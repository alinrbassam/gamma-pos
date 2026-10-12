import React, { useState } from 'react';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Alert } from '@components/ui/Alert';
import { Badge } from '@components/ui/Badge';
import { useLanguageStore } from '../../../renderer/stores/useLanguageStore';
import { useConfigStore } from '../../../renderer/stores/useConfigStore';
import { Printer, CheckCircle, Sliders, Info, Receipt, Sparkles } from 'lucide-react';
import { formatDateTime } from '@utils/date';

export const PrinterSettings: React.FC = () => {
  const { language } = useLanguageStore();
  const { config } = useConfigStore();
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [testPrintSuccess, setTestPrintSuccess] = useState<boolean>(false);

  const handleTestPrint = () => {
    setTestPrintSuccess(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const isAr = language === 'ar';

  return (
    <div className="space-y-6">
      {/* Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Printer className="h-5 w-5 text-amber-500" />
            <span>
              {isAr
                ? 'طابعات الإيصالات الحرارية (Thermal Receipt Printers)'
                : 'Thermal Receipt Printer Setup'}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'إعدادات وتوافق طابعات الفواتير والإيصالات الحرارية مع نظام غاما'
              : 'Configuration and compatibility for physical thermal receipt printers.'}
          </p>
        </div>
        <div>
          <Badge variant="success" className="flex items-center gap-1.5 px-3 py-1">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span>{isAr ? 'متوافق وجاهز للطباعة' : 'Ready & Compatible'}</span>
          </Badge>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-blue-500/10 via-amber-500/5 to-transparent border border-blue-500/20 rounded-2xl p-4.5 space-y-2.5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl shrink-0 mt-0.5">
            <Info className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed space-y-1.5 text-slate-700 dark:text-slate-300">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {isAr ? 'كيف تعمل طباعة الإيصالات في النظام؟' : 'How does thermal printing work?'}
            </h4>
            <p>
              {isAr
                ? 'نظام غاما يدعم الطباعة الفورية والتلقائية عبر محرك طابعات نظام Windows (Windows Print Spooler). هذا يعني أن أي طابعة إيصالات حرارية (80mm أو 58mm) مثل Xprinter، Epson، Sunmi، Bixolon، Rongta متصلة بجهازك (عبر USB أو كابل شبكة LAN أو Bluetooth) ستطبع الفواتير بضغطة زر واحدة دون الحاجة لأي برامج إضافية.'
                : 'Gamma POS prints directly through the standard Windows Print Spooler. Any thermal receipt printer (80mm or 58mm) such as Xprinter, Epson, Sunmi, Bixolon, Rongta connected via USB, LAN, or Bluetooth works immediately with one click.'}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Paper Width Selector */}
        <Card className="p-4 space-y-3 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
            <Sliders className="h-4 w-4 text-amber-500" />
            <span>{isAr ? 'عرض ورق الطباعة المفضل' : 'Preferred Paper Width'}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isAr
              ? 'اختر مقاس رول الورق المستخدم في طابعتك الحرارية لتنسيق الفاتورة بدقة:'
              : 'Select the thermal roll width loaded in your printer for proper formatting:'}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                paperWidth === '80mm'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="text-sm font-black">80 مم (80mm)</div>
              <div className="text-[10px] opacity-75 mt-0.5">
                {isAr ? 'القياسي لمعظم الطابعات' : 'Standard POS'}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                paperWidth === '58mm'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="text-sm font-black">58 مم (58mm)</div>
              <div className="text-[10px] opacity-75 mt-0.5">
                {isAr ? 'المدمج والصغير' : 'Compact POS'}
              </div>
            </button>
          </div>
        </Card>

        {/* Receipt Template Notice */}
        <Card className="p-4 space-y-3 bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
            <Receipt className="h-4 w-4 text-emerald-500" />
            <span>{isAr ? 'تخصيص نصوص الفاتورة' : 'Customize Receipt Text'}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {isAr
              ? 'لتعديل الترويسة، الرسالة الترحيبية أسفل الفاتورة، أو سياسة الإرجاع، انتقل إلى تبويب "نموذج الفاتورة" الموجود في القائمة الجانبية للإعدادات.'
              : 'To edit the header notes, receipt footer message, or return policy, open the "Receipt Template" tab in the settings menu.'}
          </p>
          <div className="pt-1">
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 font-mono inline-block">
              {isAr ? 'اسم المنشأة في الفاتورة:' : 'Receipt Store Name:'}{' '}
              <strong className="text-amber-500">
                {config?.businessName || (isAr ? 'غاما كافيه' : 'Gamma POS')}
              </strong>
            </span>
          </div>
        </Card>
      </div>

      {/* Test Print Action */}
      <Card className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800 text-white space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>{isAr ? 'اختبار الطابعة الحرارية' : 'Test Thermal Printer'}</span>
            </h4>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'اضغط هنا لطباعة إيصال تجريبي واختبار وضوح الخط ومحاذاة الورق وقاطع الطابعة.'
                : 'Click here to print a test receipt to verify printer alignment, text clarity, and auto-cutter.'}
            </p>
          </div>
          <Button
            onClick={handleTestPrint}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-black px-5 py-2.5 shadow-lg shadow-amber-500/20 shrink-0"
          >
            <Printer className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" />
            <span>{isAr ? 'طباعة إيصال تجريبي' : 'Print Test Receipt'}</span>
          </Button>
        </div>

        {testPrintSuccess && (
          <Alert variant="success" className="text-xs">
            {isAr
              ? 'تم إرسال أمر الطباعة إلى نظام Windows. إذا ظهر مربع اختيار الطابعة، اختر طابعتك واضغط طباعة.'
              : 'Print command sent to Windows spooler. Select your thermal printer from the dialog if prompted.'}
          </Alert>
        )}
      </Card>

      {/* Hidden printable receipt for test printing */}
      <div id="thermal-receipt" className="hidden print:block p-4 bg-white text-black font-mono text-[11px] leading-tight max-w-[80mm]">
        <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
          <h3 className="font-bold text-sm">{config?.businessName || 'GAMMA POS'}</h3>
          <p className="text-[10px]">{config?.address || 'Main Branch'}</p>
          <p className="text-[10px]">Tel: {config?.phone || '00000000'}</p>
          <p className="text-[11px] font-bold mt-1">*** TEST RECEIPT / إيصال تجريبي ***</p>
        </div>
        <div className="py-2 space-y-1 text-[10px] border-b border-dashed border-black">
          <div className="flex justify-between">
            <span>Date / التاريخ:</span>
            <span>{formatDateTime(new Date())}</span>
          </div>
          <div className="flex justify-between">
            <span>Width / المقاس:</span>
            <span>{paperWidth}</span>
          </div>
          <div className="flex justify-between">
            <span>Status / الحالة:</span>
            <span>OK / جاهز</span>
          </div>
        </div>
        <div className="py-2 space-y-1 text-[10px] border-b border-dashed border-black">
          <div className="flex justify-between font-bold">
            <span>Test Item 1</span>
            <span>$5.00</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Test Item 2</span>
            <span>$10.00</span>
          </div>
          <div className="flex justify-between font-black text-xs pt-1 border-t border-dotted border-black">
            <span>TOTAL / المجموع:</span>
            <span>$15.00</span>
          </div>
        </div>
        <div className="pt-2 text-center text-[10px] space-y-0.5">
          <p className="font-bold">Printer Test Successful! ✨</p>
          <p>نجاح اختبار الطابعة الحرارية</p>
          <p className="text-[9px]">Gamma POS System v{config?.appVersion || '1.0.9'}</p>
        </div>
      </div>
    </div>
  );
};
