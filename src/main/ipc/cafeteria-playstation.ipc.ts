import Database from 'better-sqlite3';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import { ApiResponse } from '../../shared/types';
import { RatesService } from '../services/rates.service';
import { PlaystationService } from '../services/playstation.service';

export function registerCafeteriaAndPlaystationIpcHandlers(db: Database.Database): void {
  const ratesService = new RatesService(db);
  const playstationService = new PlaystationService(db, ratesService);

  // 1. Rates IPC
  ipcMain.handle(IPC_CHANNELS.RATES_GET, async (): Promise<ApiResponse> => {
    try {
      const data = ratesService.getRates();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'RATES_GET_ERROR', message: err.message } };
    }
  });

  ipcMain.handle(IPC_CHANNELS.RATES_UPDATE, async (_, payload: { usdToLbpRate?: number; ratePerPlayerHourLbp?: number }): Promise<ApiResponse> => {
    try {
      const data = ratesService.updateRates(payload);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'RATES_UPDATE_ERROR', message: err.message } };
    }
  });

  // 2. PlayStation IPC
  ipcMain.handle(IPC_CHANNELS.PLAYSTATION_GET_STATE, async (): Promise<ApiResponse> => {
    try {
      const data = playstationService.getStationsAndSessions();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'PS_STATE_ERROR', message: err.message } };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.PLAYSTATION_START_SESSION,
    async (_, payload: { stationId: string; playersCount: number; customHourlyRateLbp?: number; notes?: string }): Promise<ApiResponse> => {
      try {
        const data = playstationService.startSession(payload);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'PS_START_ERROR', message: err.message } };
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.PLAYSTATION_STOP_SESSION, async (_, sessionId: string): Promise<ApiResponse> => {
    try {
      const data = playstationService.stopSession(sessionId);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'PS_STOP_ERROR', message: err.message } };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.PLAYSTATION_ADD_ITEM,
    async (
      _,
      payload: { sessionId: string; productId: string; productName: string; quantity: number; unitPriceUsd: number },
    ): Promise<ApiResponse> => {
      try {
        const data = playstationService.addItemToSession(payload);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'PS_ADD_ITEM_ERROR', message: err.message } };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLAYSTATION_REMOVE_ITEM,
    async (_, itemId: string): Promise<ApiResponse> => {
      try {
        const data = playstationService.removeItemFromSession(itemId);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'PS_REMOVE_ITEM_ERROR', message: err.message } };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLAYSTATION_CHECKOUT,
    async (
      _,
      payload: { sessionId: string; paidUsd: number; paidLbp: number; changeUsd: number; changeLbp: number },
    ): Promise<ApiResponse> => {
      try {
        const data = playstationService.checkoutSession(payload);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'PS_CHECKOUT_ERROR', message: err.message } };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.PLAYSTATION_SEND_TO_TABLE,
    async (_, payload: { sessionId: string; tableId: string }): Promise<ApiResponse> => {
      try {
        const data = playstationService.sendSessionToTable(payload.sessionId, payload.tableId);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'PS_SEND_TO_TABLE_ERROR', message: err.message } };
      }
    },
  );
}
