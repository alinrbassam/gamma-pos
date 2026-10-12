import React, { useEffect, useState } from 'react';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { Alert } from '@components/ui/Alert';
import { useLanguageStore } from '../../../renderer/stores/useLanguageStore';
import { useConfigStore } from '../../../renderer/stores/useConfigStore';

export const ReceiptSettings: React.FC = () => {
  const { language } = useLanguageStore();
  const { config, loadConfig } = useConfigStore();
  const [header, setHeader] = useState('أهلاً وسهلاً بكم ✨');
  const [footer, setFooter] = useState('شكراً لزيارتكم! نتشرف بكم دائماً ✨');
  const [policy, setPolicy] = useState('البضاعة المباعة لا ترد ولا تستبدل بدون فاتورة');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAr = language === 'ar';

  useEffect(() => {
    if (window.api?.getSectionSettings) {
      window.api.getSectionSettings('receipt').then((res) => {
        if (res.success && res.data) {
          if (res.data.header) setHeader(res.data.header);
          if (res.data.footer) setFooter(res.data.footer);
          if (res.data.policy) setPolicy(res.data.policy);
        }
      });
    }
    if (config?.receiptFooter) setFooter(config.receiptFooter);
    if (config?.receiptHeader) setHeader(config.receiptHeader);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg(null);
    try {
      if (window.api?.updateSectionSettings) {
        await window.api.updateSectionSettings('receipt', {
          header,
          footer,
          policy,
        });
      }
      if (window.api?.updateConfig) {
        await window.api.updateConfig({
          receiptHeader: header,
          receiptFooter: footer,
        });
      }
      await loadConfig();
      setSuccessMsg(
        isAr
          ? 'تم حفظ إعدادات ونصوص الفاتورة بنجاح.'
          : 'Receipt template settings saved successfully.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {isAr ? 'نموذج الفاتورة والإيصال الحراري' : 'Receipt Template Defaults'}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAr
            ? 'تخصيص الرسائل الترحيبية والختامية المطبوعة في رأس وتذييل الإيصال الحراري.'
            : 'Customize greeting header, footer message, and policies printed on thermal receipts.'}
        </p>
      </div>

      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <div className="space-y-3">
        <Input
          label={isAr ? 'الرسالة الترحيبية (أعلى الفاتورة)' : 'Receipt Header Message'}
          placeholder={isAr ? 'مثال: أهلاً وسهلاً بكم في كافيه غاما' : 'Welcome to our store'}
          value={header}
          onChange={(e) => setHeader(e.target.value)}
        />
        <Input
          label={isAr ? 'رسالة تذييل الفاتورة (أسفل الإيصال)' : 'Receipt Footer Message'}
          placeholder={isAr ? 'مثال: شكراً لزيارتكم! نتشرف بكم دائماً' : 'Thank you for shopping with us!'}
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
        />
        <Input
          label={isAr ? 'ملاحظة السياسة / الإرجاع (اختياري)' : 'Return Policy / Notice (Optional)'}
          placeholder={isAr ? 'مثال: الإرجاع خلال يومين مع إحضار الفاتورة' : '30 Days Return Policy with Receipt'}
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
        />
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          isLoading={isLoading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
        >
          {isAr ? 'حفظ نصوص الفاتورة' : 'Save Receipt Settings'}
        </Button>
      </div>
    </form>
  );
};
