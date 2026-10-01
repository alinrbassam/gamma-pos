import { ipcMain, dialog, app } from 'electron';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { autoUpdater } from 'electron-updater';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import { ApiResponse } from '../../shared/types';
import { LicensingService } from '../services/licensing.service';
import { BackupService } from '../services/backup.service';
import { MaintenanceService } from '../services/maintenance.service';
import { UpdaterService } from '../services/updater.service';
import { logger } from '../services/logger.service';

export function registerCommercialIpcHandlers(db: Database.Database): void {
  const licensingService = new LicensingService(db);
  const backupService = new BackupService(db);
  const maintenanceService = new MaintenanceService(db);
  const updaterService = new UpdaterService();

  // Licensing
  ipcMain.handle(IPC_CHANNELS.LICENSING_GET_DEVICE_ID, async (): Promise<ApiResponse<string>> => {
    return { success: true, data: licensingService.getDeviceFingerprint() };
  });

  ipcMain.handle(IPC_CHANNELS.LICENSING_GET_INFO, async (): Promise<ApiResponse> => {
    try {
      return { success: true, data: licensingService.getActiveLicense() };
    } catch (err) {
      logger.error('CommercialIPC', 'Failed to get active license', err);
      return { success: false, error: { code: 'LICENSING_GET_INFO_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSING_ACTIVATE_FILE, async (_, payloadStr: string): Promise<ApiResponse> => {
    try {
      const res = licensingService.activateLicensePayload(payloadStr);
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: { code: 'LICENSE_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSING_ACTIVATE_SECRET, async (_, secretKey: string): Promise<ApiResponse> => {
    try {
      const res = licensingService.activateWithSecretKey(secretKey);
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: { code: 'SECRET_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LICENSING_SELECT_FILE, async (): Promise<ApiResponse<string | null>> => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Sélectionner le fichier de licence Gamma (.gamma)',
        filters: [
          { name: 'Licence Gamma (*.gamma, *.zabad)', extensions: ['gamma', 'zabad'] },
          { name: 'Fichiers JSON (*.json, *.rms)', extensions: ['json', 'rms'] },
          { name: 'Tous les fichiers', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (canceled || filePaths.length === 0) {
        return { success: true, data: null };
      }

      const content = fs.readFileSync(filePaths[0], 'utf8');
      return { success: true, data: content };
    } catch (err) {
      return { success: false, error: { code: 'FILE_READ_ERROR', message: (err as Error).message } };
    }
  });

  // Backup
  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, async (): Promise<ApiResponse> => {
    return { success: true, data: backupService.listBackups() };
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE_FULL, async (_, folder: string): Promise<ApiResponse> => {
    try {
      const res = await backupService.createFullBackup(folder);
      return { success: true, data: res };
    } catch (err) {
      logger.error('CommercialIPC', 'Full backup failed', err);
      return { success: false, error: { code: 'BACKUP_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE_AUTO, async (_, folder: string, retention?: number): Promise<ApiResponse> => {
    try {
      const res = await backupService.createAutoBackup(folder, retention || 7);
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: { code: 'AUTO_BACKUP_ERROR', message: (err as Error).message } };
    }
  });

  // Maintenance
  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_VACUUM, async (): Promise<ApiResponse> => {
    try {
      maintenanceService.runVacuum();
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'VACUUM_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_INTEGRITY_CHECK, async (): Promise<ApiResponse> => {
    try {
      const res = maintenanceService.runIntegrityCheck();
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: { code: 'INTEGRITY_CHECK_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MAINTENANCE_DIAGNOSTICS, async (): Promise<ApiResponse> => {
    return { success: true, data: maintenanceService.getDiagnostics() };
  });

  // Updates
  ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK_GITHUB, async (): Promise<ApiResponse> => {
    try {
      if (app.isPackaged) {
        autoUpdater.checkForUpdates().catch(() => {});
      }
      const res = await updaterService.checkForUpdates();
      return { success: true, data: res };
    } catch (err) {
      return { success: false, error: { code: 'UPDATER_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_DOWNLOAD, async (): Promise<ApiResponse<boolean>> => {
    try {
      if (app.isPackaged) {
        logger.info('Updater', 'Starting autoUpdater.downloadUpdate() via IPC');
        await autoUpdater.downloadUpdate();
        return { success: true, data: true };
      } else {
        return { success: false, error: { code: 'DEV_MODE', message: 'In-app update is only supported in installed production builds' } };
      }
    } catch (err) {
      logger.error('Updater', 'Failed to download update', err);
      return { success: false, error: { code: 'UPDATER_DOWNLOAD_ERROR', message: (err as Error).message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, async (): Promise<ApiResponse<boolean>> => {
    try {
      if (app.isPackaged) {
        logger.info('Updater', 'Executing autoUpdater.quitAndInstall() via IPC');
        autoUpdater.quitAndInstall(false, true);
        return { success: true, data: true };
      } else {
        return { success: false, error: { code: 'DEV_MODE', message: 'In-app update is only supported in installed production builds' } };
      }
    } catch (err) {
      logger.error('Updater', 'Failed to quit and install', err);
      return { success: false, error: { code: 'UPDATER_INSTALL_ERROR', message: (err as Error).message } };
    }
  });

  // Offline Standalone Mode - Cloud Sync Disabled
  ipcMain.handle(IPC_CHANNELS.CLOUD_GET_CONFIG, async (): Promise<ApiResponse> => {
    return { success: true, data: { enabled: false, syncUrl: '', syncKey: '', lastSyncAt: null, lastStatus: 'disabled' } };
  });

  ipcMain.handle(IPC_CHANNELS.CLOUD_UPDATE_CONFIG, async (): Promise<ApiResponse> => {
    return { success: true, data: false };
  });

  ipcMain.handle(IPC_CHANNELS.CLOUD_SYNC_NOW, async (): Promise<ApiResponse> => {
    return { success: false, error: { code: 'OFFLINE_STANDALONE', message: 'Cloud sync is permanently disabled in standalone offline mode.' } };
  });

  ipcMain.handle(IPC_CHANNELS.CLOUD_GET_SNAPSHOT, async (): Promise<ApiResponse> => {
    return { success: false, error: { code: 'OFFLINE_STANDALONE', message: 'Cloud snapshot disabled.' } };
  });

  // Supabase Multi-Device Cloud Sync - Disabled
  ipcMain.handle(IPC_CHANNELS.SUPABASE_SYNC_GET_CONFIG, async (): Promise<ApiResponse> => {
    return { success: true, data: { enabled: false, role: 'store', supabaseUrl: '', supabaseKey: '', autoSyncIntervalMinutes: 0, lastSyncAt: null, lastStatus: 'disabled' } };
  });

  ipcMain.handle(IPC_CHANNELS.SUPABASE_SYNC_UPDATE_CONFIG, async (): Promise<ApiResponse> => {
    return { success: true, data: { enabled: false } };
  });

  ipcMain.handle(IPC_CHANNELS.SUPABASE_SYNC_NOW, async (): Promise<ApiResponse> => {
    return { success: false, error: { code: 'OFFLINE_STANDALONE', message: 'Cloud sync is permanently disabled in standalone offline mode.' } };
  });

  ipcMain.handle(IPC_CHANNELS.SUPABASE_SYNC_GET_REMOTE_META, async (): Promise<ApiResponse> => {
    return { success: false, error: { code: 'OFFLINE_STANDALONE', message: 'Cloud sync disabled.' } };
  });
}

