import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { DatabaseConnection } from './database/connection';
import { DatabaseMigrator } from './database/migrator';
import { migrationV2 } from './database/migrations/v2_auth_and_settings';
import { migrationV3 } from './database/migrations/v3_inventory';
import { migrationV4 } from './database/migrations/v4_purchasing';
import { migrationV5 } from './database/migrations/v5_pos';
import { migrationV6 } from './database/migrations/v6_reports';
import { migrationV7 } from './database/migrations/v7_commercial';
import { migrationV8, ensureBorrowColumns } from './database/migrations/v8_expenses_and_borrow';
import { migrationV9, ensureCafeteriaAndPlaystationColumns } from './database/migrations/v9_cafeteria_and_playstation';
import { migrationV10, ensureDineInTables } from './database/migrations/v10_dine_in_tables';
import { migrationV11, ensureHookahLounge } from './database/migrations/v11_hookah_lounge';
import path from 'path';
import { logger } from './services/logger.service';

import { IPC_CHANNELS } from '../shared/ipc/channels';

app.setName('Gamma POS');
try {
  app.commandLine.appendSwitch('lang', 'en-US');
  const appData = app.getPath('appData');
  app.setPath('userData', path.join(appData, 'Gamma POS'));
} catch {
  // non-electron or test runner fallback
}

app.whenReady().then(() => {
  logger.info('App', 'Starting Gamma POS Desktop Application');

  try {
    const db = DatabaseConnection.getInstance().getDatabase();
    const migrator = new DatabaseMigrator(db);
    migrator.initMigrationTable();
    migrator.runMigrations([
      migrationV2,
      migrationV3,
      migrationV4,
      migrationV5,
      migrationV6,
      migrationV7,
      migrationV8,
      migrationV9,
      migrationV10,
      migrationV11,
    ]);
    ensureBorrowColumns(db);
    ensureCafeteriaAndPlaystationColumns(db);
    ensureDineInTables(db);
    ensureHookahLounge(db);

    logger.info('App', 'Database migrations v2 through v11 executed successfully');
  } catch (err) {
    logger.error('App', 'Failed initializing database migrations', err);
  }

  registerIpcHandlers();
  const mainWindow = createMainWindow();

  // Check for auto-updates when running packaged app
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      logger.info('AutoUpdater', 'Checking for update...');
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_STATUS_EVENT, {
        status: 'checking',
      });
    });

    autoUpdater.on('update-available', (info) => {
      logger.info('AutoUpdater', `Update available: ${info.version}`);
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_STATUS_EVENT, {
        status: 'available',
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('AutoUpdater', 'Update not available');
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_STATUS_EVENT, {
        status: 'not-available',
        version: info.version,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_STATUS_EVENT, {
        status: 'downloading',
        progress: {
          percent: Math.round(progress.percent),
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('AutoUpdater', `Update downloaded: ${info.version}`);
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_STATUS_EVENT, {
        status: 'downloaded',
        version: info.version,
      });

      dialog
        .showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: `A new version (v${info.version}) of Eben Khalti has been downloaded successfully.`,
          detail: 'Would you like to restart the application now to replace the current version? All your sales, tables, and settings will remain completely intact.',
          buttons: ['Restart and Replace Now', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall(false, true);
          }
        });
    });

    autoUpdater.on('error', (err) => {
      logger.warn('AutoUpdater', 'Check for updates failed or errored', err);
      mainWindow.webContents.send(IPC_CHANNELS.UPDATER_STATUS_EVENT, {
        status: 'error',
        error: err?.message || 'Erreur lors de la vérification de mise à jour',
      });
    });

    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logger.warn('AutoUpdater', 'Check for updates failed', err);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('App', 'All windows closed, quitting application');
  DatabaseConnection.getInstance().close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  logger.error('App', 'Uncaught Exception detected', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('App', 'Unhandled Promise Rejection detected', reason);
});
