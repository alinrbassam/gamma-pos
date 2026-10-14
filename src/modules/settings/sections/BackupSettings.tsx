import React, { useEffect, useState } from 'react';
import { useCommercialStore } from '@stores/useCommercialStore';
import { useLanguageStore } from '@stores/useLanguageStore';
import { Card } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Alert } from '@components/ui/Alert';
import { Table, Column } from '@components/ui/Table';
import { Badge } from '@components/ui/Badge';
import { HardDrive, Cloud, RotateCcw, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDateTime } from '@utils/date';

interface PendingRestore {
  filePath: string;
  fileName: string;
}

export const BackupSettings: React.FC = () => {
  const {
    backups,
    loadBackups,
    createFullBackup,
    createAutoBackup,
    selectBackupFile,
    restoreBackup,
    isLoading,
    error,
  } = useCommercialStore();
  const { language } = useLanguageStore();

  const [folderPath, setFolderPath] = useState('C:\\POS Cloud Backups');
  const [retention, setRetention] = useState(7);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleCreateFull = async () => {
    setSuccessMsg(null);
    const ok = await createFullBackup(folderPath);
    if (ok) {
      setSuccessMsg(
        language === 'ar'
          ? `تم إنشاء نسخة احتياطية كاملة بنجاح في ${folderPath}`
          : `Full backup created successfully in ${folderPath}`,
      );
    }
  };

  const handleCreateAuto = async () => {
    setSuccessMsg(null);
    const ok = await createAutoBackup(folderPath, retention);
    if (ok) {
      setSuccessMsg(
        language === 'ar'
          ? `تم تصدير نسخة المزامنة السحابية بنجاح إلى ${folderPath}`
          : `Cloud-Sync database backup created in ${folderPath}`,
      );
    }
  };

  const handleSelectAndRestore = async () => {
    setSuccessMsg(null);
    const selectedPath = await selectBackupFile();
    if (selectedPath) {
      const parts = selectedPath.split(/[/\\]/);
      const name = parts[parts.length - 1] || 'backup.db';
      setPendingRestore({ filePath: selectedPath, fileName: name });
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    setSuccessMsg(null);

    try {
      const ok = await restoreBackup(pendingRestore.filePath);
      if (ok) {
        setPendingRestore(null);
        setSuccessMsg(
          language === 'ar'
            ? 'تمت استعادة قاعدة البيانات بنجاح! جاري تحديث الشاشة...'
            : 'Database restored successfully! Reloading system...',
        );
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'fileName',
      header: language === 'ar' ? 'ملف النسخة الاحتياطية' : 'Backup File',
      render: (r) => (
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200 block">
            {String(r.fileName)}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{String(r.filePath)}</span>
        </div>
      ),
    },
    {
      key: 'fileSize',
      header: language === 'ar' ? 'الحجم' : 'Size',
      render: (r) => <span>{(Number(r.fileSize) / 1024 / 1024).toFixed(2)} MB</span>,
    },
    {
      key: 'backupType',
      header: language === 'ar' ? 'النوع' : 'Type',
      render: (r) => {
        const typeStr = String(r.backupType);
        let variant: 'info' | 'success' | 'warning' = 'success';
        if (r.isAutomatic) variant = 'info';
        if (typeStr.includes('PreRestore')) variant = 'warning';
        return <Badge variant={variant}>{typeStr}</Badge>;
      },
    },
    {
      key: 'createdAt',
      header: language === 'ar' ? 'التاريخ والوقت' : 'Timestamp',
      render: (r) => <span>{formatDateTime(String(r.createdAt))}</span>,
    },
    {
      key: 'actions',
      header: language === 'ar' ? 'الإجراء' : 'Actions',
      render: (r) => (
        <button
          type="button"
          onClick={() =>
            setPendingRestore({
              filePath: String(r.filePath),
              fileName: String(r.fileName),
            })
          }
          className="inline-flex items-center space-x-1 rtl:space-x-reverse px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-colors"
          title={language === 'ar' ? 'استعادة هذه النسخة' : 'Restore this backup'}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{language === 'ar' ? 'استعادة' : 'Restore'}</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {language === 'ar' ? 'النسخ الاحتياطي واستعادة البيانات' : 'Backup & Disaster Recovery'}
        </h2>
        <p className="text-xs text-slate-500">
          {language === 'ar'
            ? 'إنشاء نسخ احتياطية لقاعدة البيانات، استيراد واستعادة النسخ السابقة، وإدارة المزامنة السحابية.'
            : 'Configure full system backups, cloud-sync folder exports, and restore previous database snapshots.'}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {successMsg && (
        <Alert variant="success" className="flex items-center space-x-2 rtl:space-x-reverse">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span>{successMsg}</span>
        </Alert>
      )}

      {/* Confirmation Modal for Restore */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start space-x-3 rtl:space-x-reverse">
              <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'ar' ? 'تأكيد استعادة النسخة الاحتياطية' : 'Confirm Database Restore'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'ar'
                    ? 'سيتم استبدال قاعدة البيانات النشطة بمحتوى هذه النسخة. سيقوم النظام تلقائياً بإنشاء نسخة أمان احتياطية لحفظ بياناتك الحالية قبل التبديل.'
                    : 'Restoring will replace the current active store database with the selected backup file. The system will automatically create an instant safety snapshot before restoring.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'الملف المحدد:' : 'Selected File:'}
              </div>
              <div className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                {pendingRestore.fileName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono break-all">
                {pendingRestore.filePath}
              </div>
            </div>

            <div className="flex justify-end space-x-2 rtl:space-x-reverse pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={isRestoring}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRestore}
                isLoading={isRestoring}
                className="bg-amber-600 hover:bg-amber-700 text-white flex items-center space-x-1.5 rtl:space-x-reverse"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{language === 'ar' ? 'نعم، استعادة النسخة' : 'Yes, Restore Database'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card
        title={
          language === 'ar'
            ? '1. النسخ الاحتياطي والاستيراد'
            : '1. Backup Destinations & Disaster Recovery'
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1 w-full">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'ar' ? 'مسار مجلد النسخ الاحتياطي' : 'Cloud-Sync / Backup Folder Path'}
              </label>
              <div className="flex space-x-2 rtl:space-x-reverse">
                <Input
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    if (window.api?.selectDirectory) {
                      const res = await window.api.selectDirectory();
                      if (res.success && res.data) {
                        setFolderPath(res.data);
                      }
                    }
                  }}
                  className="px-4 py-2 text-xs font-medium"
                >
                  {language === 'ar' ? 'استعراض...' : 'Browse...'}
                </Button>
              </div>
            </div>
            <Input
              label={
                language === 'ar'
                  ? 'عدد النسخ المحتفظ بها (Retention)'
                  : 'Retention Count (Keep N Backups)'
              }
              type="number"
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={handleCreateFull}
              isLoading={isLoading}
              className="flex items-center space-x-2 rtl:space-x-reverse"
            >
              <HardDrive className="h-4 w-4" />
              <span>
                {language === 'ar'
                  ? 'إنشاء نسخة احتياطية كاملة (.db)'
                  : 'Create Full System Backup (.db)'}
              </span>
            </Button>

            <Button
              variant="outline"
              onClick={handleCreateAuto}
              isLoading={isLoading}
              className="flex items-center space-x-2 rtl:space-x-reverse"
            >
              <Cloud className="h-4 w-4 text-sky-500" />
              <span>
                {language === 'ar'
                  ? 'تشغيل النسخ السحابي التلقائي'
                  : 'Run Automated Cloud-Sync Backup'}
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSelectAndRestore}
              disabled={isLoading || isRestoring}
              className="flex items-center space-x-2 rtl:space-x-reverse border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              <Upload className="h-4 w-4 text-amber-600" />
              <span>
                {language === 'ar'
                  ? 'استيراد واستعادة نسخة (.db)'
                  : 'Import & Restore Backup (.db)'}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title={
          language === 'ar' ? '2. سجل وتاريخ النسخ الاحتياطية' : '2. Recent Backup History Log'
        }
      >
        <Table
          columns={columns}
          data={backups as unknown as Record<string, unknown>[]}
          keyExtractor={(r) => String(r.id)}
        />
      </Card>
    </div>
  );
};
