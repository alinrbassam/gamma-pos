import Database from 'better-sqlite3';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import { ApiResponse } from '../../shared/types';
import { RatesService } from '../services/rates.service';
import { TablesService } from '../services/tables.service';

export function registerTablesIpcHandlers(db: Database.Database): void {
  const ratesService = new RatesService(db);
  const tablesService = new TablesService(db, ratesService);

  // 1. Get Tables State
  ipcMain.handle(IPC_CHANNELS.TABLES_GET_STATE, async (): Promise<ApiResponse> => {
    try {
      const data = tablesService.getTablesAndTabs();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'TABLES_GET_STATE_ERROR', message: err.message } };
    }
  });

  // 2. Create Table (Manager only)
  ipcMain.handle(
    IPC_CHANNELS.TABLES_CREATE,
    async (_, payload: { name: string; capacity?: number }): Promise<ApiResponse> => {
      try {
        const data = tablesService.createTable(payload.name, payload.capacity);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_CREATE_ERROR', message: err.message } };
      }
    },
  );

  // 3. Update Table (Manager only)
  ipcMain.handle(
    IPC_CHANNELS.TABLES_UPDATE,
    async (_, payload: { id: string; name: string; capacity?: number }): Promise<ApiResponse> => {
      try {
        const data = tablesService.updateTable(payload.id, payload.name, payload.capacity);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_UPDATE_ERROR', message: err.message } };
      }
    },
  );

  // 4. Delete Table (Manager only)
  ipcMain.handle(IPC_CHANNELS.TABLES_DELETE, async (_, id: string): Promise<ApiResponse> => {
    try {
      const data = tablesService.deleteTable(id);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'TABLES_DELETE_ERROR', message: err.message } };
    }
  });

  // 5. Open Tab on Table
  ipcMain.handle(
    IPC_CHANNELS.TABLES_OPEN_TAB,
    async (
      _,
      payload: {
        tableId: string;
        customerName?: string;
        customerPhone?: string;
        notes?: string;
      },
    ): Promise<ApiResponse> => {
      try {
        const data = tablesService.openTab(payload);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_OPEN_TAB_ERROR', message: err.message } };
      }
    },
  );

  // 6. Add Item to Tab
  ipcMain.handle(
    IPC_CHANNELS.TABLES_ADD_ITEM,
    async (
      _,
      payload: {
        tabId: string;
        productId: string;
        productName: string;
        quantity: number;
        unitPriceUsd: number;
        notes?: string;
      },
    ): Promise<ApiResponse> => {
      try {
        const data = tablesService.addItemToTab(payload);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_ADD_ITEM_ERROR', message: err.message } };
      }
    },
  );

  // 7. Update Item Quantity
  ipcMain.handle(
    IPC_CHANNELS.TABLES_UPDATE_ITEM_QTY,
    async (_, payload: { itemId: string; quantity: number }): Promise<ApiResponse> => {
      try {
        const data = tablesService.updateItemQuantity(payload.itemId, payload.quantity);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_UPDATE_QTY_ERROR', message: err.message } };
      }
    },
  );

  // 8. Remove Item from Tab
  ipcMain.handle(IPC_CHANNELS.TABLES_REMOVE_ITEM, async (_, itemId: string): Promise<ApiResponse> => {
    try {
      const data = tablesService.removeItemFromTab(itemId);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'TABLES_REMOVE_ITEM_ERROR', message: err.message } };
    }
  });

  // 9. Transfer Table
  ipcMain.handle(
    IPC_CHANNELS.TABLES_TRANSFER,
    async (_, payload: { sourceTableId: string; targetTableId: string }): Promise<ApiResponse> => {
      try {
        const data = tablesService.transferTable(payload.sourceTableId, payload.targetTableId);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_TRANSFER_ERROR', message: err.message } };
      }
    },
  );

  // 10. Lookup Customer by Phone
  ipcMain.handle(IPC_CHANNELS.TABLES_CUSTOMER_LOOKUP, async (_, phone: string): Promise<ApiResponse> => {
    try {
      const data = tablesService.lookupCustomerByPhone(phone);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'TABLES_LOOKUP_ERROR', message: err.message } };
    }
  });

  // 11. Checkout Tab
  ipcMain.handle(IPC_CHANNELS.TABLES_CHECKOUT, async (_, payload: any): Promise<ApiResponse> => {
    try {
      const data = tablesService.checkoutTab(payload);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: { code: 'TABLES_CHECKOUT_ERROR', message: err.message } };
    }
  });

  // 12. Merge Tables
  ipcMain.handle(
    IPC_CHANNELS.TABLES_MERGE,
    async (_, payload: { sourceTableId: string; targetTableId: string }): Promise<ApiResponse> => {
      try {
        const data = tablesService.mergeTables(payload.sourceTableId, payload.targetTableId);
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: { code: 'TABLES_MERGE_ERROR', message: err.message } };
      }
    },
  );

  // 13. Transfer Table to PlayStation
  ipcMain.handle(
    IPC_CHANNELS.TABLES_TRANSFER_TO_PLAYSTATION,
    async (
      _,
      payload: { tableId: string; stationId: string; playersCount?: number },
    ): Promise<ApiResponse> => {
      try {
        const data = tablesService.transferTableToPlaystation(
          payload.tableId,
          payload.stationId,
          payload.playersCount || 2,
        );
        return { success: true, data };
      } catch (err: any) {
        return {
          success: false,
          error: { code: 'TABLES_TRANSFER_PS_ERROR', message: err.message },
        };
      }
    },
  );
}
