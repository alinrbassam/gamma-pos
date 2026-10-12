import React, { useEffect, useState } from 'react';
import { useProductStore } from '@stores/useProductStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Table, Column } from '@components/ui/Table';
import { Button } from '@components/ui/Button';
import { Dialog } from '@components/ui/Dialog';
import { Input } from '@components/ui/Input';
import { Card } from '@components/ui/Card';
import { SupplierEntity } from '@shared/types';
import { Truck, Plus, Trash2 } from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const { suppliers, loadMetadata } = useProductStore();
  const { language } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState('');
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (window.api?.createSupplier) {
      await window.api.createSupplier({
        code: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
        name,
        phone,
        contactPerson: contact,
        isActive: true,
      });
      setIsOpen(false);
      setName('');
      setPhone('');
      setContact('');
      loadMetadata();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return;
    setIsDeleting(true);
    try {
      if ((window as any).api?.deleteSupplier) {
        await (window as any).api.deleteSupplier(supplierToDelete.id);
        await loadMetadata();
      }
      setSupplierToDelete(null);
    } catch (err) {
      console.error('Failed to delete supplier', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<SupplierEntity>[] = [
    {
      key: 'name',
      header: language === 'ar' ? 'اسم المورد' : 'Supplier Name',
      render: (s) => (
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200 block">{s.name}</span>
          <span className="text-[10px] text-slate-500">
            {language === 'ar' ? 'الكود:' : 'Code:'} {s.code}
          </span>
        </div>
      ),
    },
    {
      key: 'contact_person',
      header: language === 'ar' ? 'الشخص المسؤول' : 'Contact Person',
      render: (s) => (
        <span className="text-slate-600 dark:text-slate-400 text-xs">
          {s.contact_person || '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: language === 'ar' ? 'الهاتف' : 'Phone',
      render: (s) => <span className="text-slate-500 font-mono text-xs">{s.phone || '—'}</span>,
    },
    {
      key: 'actions',
      header: language === 'ar' ? 'إجراءات' : 'Actions',
      render: (s) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSupplierToDelete(s)}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-1.5 h-8 w-8"
            title={language === 'ar' ? 'حذف المورد' : 'Delete Supplier'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <Truck className="h-6 w-6 text-sky-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {language === 'ar' ? 'دليل الموردين' : 'Supplier Profiles'}
            </h1>
            <p className="text-xs text-slate-500">
              {language === 'ar'
                ? 'إدارة بيانات الاتصال بالموردين والشركات الموردة للمتجر.'
                : 'Manage vendor contact details and supplier associations.'}
            </p>
          </div>
        </div>

        <Button onClick={() => setIsOpen(true)} size="md" className="flex items-center space-x-2 rtl:space-x-reverse">
          <Plus className="h-4 w-4" />
          <span>{language === 'ar' ? 'مورد جديد' : 'New Supplier'}</span>
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={suppliers} keyExtractor={(s) => s.id} />
      </Card>

      <Dialog
        isOpen={isOpen}
        title={language === 'ar' ? 'إنشاء ملف مورد جديد' : 'Create Supplier Profile'}
        onClose={() => setIsOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label={language === 'ar' ? 'اسم المورد / الشركة *' : 'Supplier / Vendor Name *'}
            placeholder={
              language === 'ar'
                ? 'مثال: شركة التوزيع العامة، مؤسسة السلام...'
                : 'e.g. General Distribution Co, Prime Supplies...'
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
            placeholder="03 / 70 / 71 / 76..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label={language === 'ar' ? 'الشخص المسؤول (اختياري)' : 'Contact Person (Optional)'}
            placeholder={language === 'ar' ? 'مثال: سامر، رامي...' : 'e.g. John Smith'}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <div className="pt-2 flex justify-end space-x-2 rtl:space-x-reverse">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" className="bg-sky-600 hover:bg-sky-500 font-bold">
              {language === 'ar' ? 'حفظ المورد ✓' : 'Save Supplier ✓'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={Boolean(supplierToDelete)}
        title={language === 'ar' ? 'تأكيد حذف المورد' : 'Delete Supplier Confirmation'}
        onClose={() => setSupplierToDelete(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {language === 'ar' ? (
              <>
                هل أنت متأكد من حذف المورد{' '}
                <strong className="text-slate-900 dark:text-white font-bold">"{supplierToDelete?.name}"</strong>؟
              </>
            ) : (
              <>
                Are you sure you want to delete supplier{' '}
                <strong className="text-slate-900 dark:text-white font-bold">"{supplierToDelete?.name}"</strong>?
              </>
            )}
          </p>
          <div className="pt-2 flex justify-end space-x-2 rtl:space-x-reverse">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSupplierToDelete(null)}
              disabled={isDeleting}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting
                ? language === 'ar' ? 'جاري الحذف...' : 'Deleting...'
                : language === 'ar' ? 'حذف المورد' : 'Delete Supplier'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
