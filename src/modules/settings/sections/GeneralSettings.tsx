import React, { useEffect, useState } from 'react';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { Alert } from '@components/ui/Alert';
import { useLanguageStore } from '../../../renderer/stores/useLanguageStore';
import { useConfigStore } from '../../../renderer/stores/useConfigStore';

export const GeneralSettings: React.FC = () => {
  const { language } = useLanguageStore();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Cafeteria & Gaming Lounge',
    logo: '',
    taxNumber: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    country: '',
    currency: 'USD',
    timezone: 'UTC',
    dateFormat: 'DD-MM-YYYY',
    timeFormat: '24h',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (window.api?.getSectionSettings) {
      window.api.getSectionSettings('general').then((res) => {
        if (res.success && res.data) {
          const data = res.data;
          const cfg = useConfigStore.getState().config;
          setFormData((prev) => ({
            ...prev,
            ...data,
            name: data.name || cfg?.businessName || prev.name,
          }));
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg(null);
    try {
      if (window.api?.updateSectionSettings) {
        await window.api.updateSectionSettings('general', formData);
      }
      if (window.api?.updateConfig) {
        await window.api.updateConfig({
          businessName: formData.name,
          phone: formData.phone,
          address: formData.address,
        });
      }
      await useConfigStore.getState().loadConfig();
      setSuccessMsg(
        language === 'ar'
          ? 'تم حفظ وتحديث بيانات المتجر بنجاح! سيظهر الاسم الجديد فوراً في القائمة والفواتير.'
          : 'General business information updated successfully! The new name reflects across the app.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {language === 'ar' ? 'بيانات المتجر والنشاط التجاري' : 'General & Business Info'}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'ar'
            ? 'يمكنك هنا تعديل اسم محلك التجاري أو الكافيه، والذي سيظهر في الشريط الجانبي وشاشة الدخول وفواتير الطباعة.'
            : 'Configure your store branding, business name, and contact details shown across the app and receipts.'}
        </p>
      </div>

      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={language === 'ar' ? 'اسم المتجر / الكافيه (يظهر في القائمة والفواتير)' : 'Business / Store Name'}
          placeholder={language === 'ar' ? 'مثال: غاما كافيه ولاونج' : 'e.g. Gamma Lounge'}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          label={language === 'ar' ? 'نوع النشاط التجاري' : 'Business Type'}
          placeholder={language === 'ar' ? 'كافيه وصالة ألعاب' : 'Café & Gaming Lounge'}
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        />
        <Input
          label={language === 'ar' ? 'رقم الهاتف / للتواصل' : 'Phone Number'}
          placeholder="03 000 000"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <Input
          label={language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
          placeholder="contact@store.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <Input
          label={language === 'ar' ? 'الرقم الضريبي (إن وجد)' : 'Tax Registration #'}
          placeholder="VAT-000000"
          value={formData.taxNumber}
          onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
        />
        <Input
          label={language === 'ar' ? 'العملة الأساسية' : 'Base Currency'}
          value={formData.currency}
          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
        />
      </div>

      <Input
        label={language === 'ar' ? 'عنوان المحل / الفرع (يظهر في الفاتورة)' : 'Store Address'}
        placeholder={language === 'ar' ? 'بيروت - الحمرا' : 'Store branch address'}
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
      />

      <div className="pt-2 flex justify-end">
        <Button type="submit" isLoading={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
          {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};
