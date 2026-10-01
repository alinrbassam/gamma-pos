import Database from 'better-sqlite3';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import { ApiResponse, HookahFlavorEntity } from '../../shared/types';
import { HookahService } from '../services/hookah.service';

export function registerHookahIpcHandlers(db: Database.Database): void {
  const hookahService = new HookahService(db);

  // 1. Get Hookah Flavors
  ipcMain.handle(
    IPC_CHANNELS.HOOKAH_GET_FLAVORS,
    async (_, onlyActive?: boolean): Promise<ApiResponse<HookahFlavorEntity[]>> => {
      try {
        const data = hookahService.getFlavors(onlyActive);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'HOOKAH_GET_FLAVORS_ERROR', message: err.message } };
      }
    },
  );

  // 2. Save Hookah Flavor (Create or Update)
  ipcMain.handle(
    IPC_CHANNELS.HOOKAH_SAVE_FLAVOR,
    async (_, payload: Partial<HookahFlavorEntity>): Promise<ApiResponse<HookahFlavorEntity>> => {
      try {
        const data = hookahService.saveFlavor(payload);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'HOOKAH_SAVE_FLAVOR_ERROR', message: err.message } };
      }
    },
  );

  // 3. Delete / Deactivate Flavor
  ipcMain.handle(
    IPC_CHANNELS.HOOKAH_DELETE_FLAVOR,
    async (_, id: string): Promise<ApiResponse> => {
      try {
        const data = hookahService.deleteFlavor(id);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'HOOKAH_DELETE_FLAVOR_ERROR', message: err.message } };
      }
    },
  );
}
