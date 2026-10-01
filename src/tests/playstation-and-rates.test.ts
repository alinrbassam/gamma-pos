import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { RatesService } from '../main/services/rates.service';
import { PlaystationService } from '../main/services/playstation.service';

describe('RatesService & PlaystationService', () => {
  let mockDb: Record<string, unknown>;
  let ratesService: RatesService;
  let playstationService: PlaystationService;

  let settingsStore: Record<string, string>;
  let stationsStore: any[];
  let sessionsStore: any[];
  let sessionItemsStore: any[];

  beforeEach(() => {
    settingsStore = {};
    stationsStore = [
      { id: 'ps-1', name: 'PS 1', status: 'available', hourly_rate_lbp: 400000, current_session_id: null },
      { id: 'ps-2', name: 'PS 2', status: 'available', hourly_rate_lbp: 400000, current_session_id: null },
    ];
    sessionsStore = [];
    sessionItemsStore = [];

    mockDb = {
      prepare: (sql: string) => {
        // Business settings queries
        if (sql.includes("key = 'usd_to_lbp_rate'")) {
          return {
            get: () => {
              if (settingsStore['usd_to_lbp_rate']) {
                return { value: settingsStore['usd_to_lbp_rate'] };
              }
              return undefined;
            },
          };
        }

        if (sql.includes("key = 'rate_per_player_hour_lbp'")) {
          return {
            get: () => {
              if (settingsStore['rate_per_player_hour_lbp']) {
                return { value: settingsStore['rate_per_player_hour_lbp'] };
              }
              return undefined;
            },
          };
        }

        if (sql.includes('INSERT INTO business_settings') && sql.includes('rate-usd-lbp')) {
          return {
            run: (...args: any[]) => {
              settingsStore['usd_to_lbp_rate'] = String(args[0] || '89500');
            },
          };
        }

        if (sql.includes('INSERT INTO business_settings') && sql.includes('rate-ps-player-hour')) {
          return {
            run: (...args: any[]) => {
              settingsStore['rate_per_player_hour_lbp'] = String(args[0] || '200000');
            },
          };
        }

        // PlayStation Stations queries
        if (sql.includes('SELECT * FROM playstation_stations WHERE id = ?')) {
          return {
            get: (id: string) => stationsStore.find((s) => s.id === id),
          };
        }

        if (sql.includes('SELECT * FROM playstation_stations ORDER BY name ASC')) {
          return {
            all: () => stationsStore,
          };
        }

        // PlayStation Sessions queries
        if (sql.includes('FROM playstation_sessions WHERE station_id = ? AND status =')) {
          return {
            get: (stationId: string) => sessionsStore.find((s) => s.station_id === stationId && s.status === 'Active'),
          };
        }

        if (sql.includes('SELECT * FROM playstation_sessions WHERE status = ?')) {
          return {
            all: (status: string) => sessionsStore.filter((s) => s.status === status),
          };
        }

        if (sql.includes('SELECT * FROM playstation_sessions WHERE id = ?')) {
          return {
            get: (id: string) => sessionsStore.find((s) => s.id === id),
          };
        }

        if (sql.includes('SELECT * FROM playstation_session_items WHERE session_id = ?')) {
          return {
            all: (sessionId: string) => sessionItemsStore.filter((i) => i.session_id === sessionId),
          };
        }

        if (sql.includes('INSERT INTO playstation_sessions')) {
          return {
            run: (...args: any[]) => {
              const session = {
                id: args[0],
                station_id: args[1],
                station_name: args[2],
                players_count: args[3],
                hourly_rate_lbp: args[4],
                hourly_rate_usd: args[5],
                start_time: args[6],
                notes: args[7],
                status: 'Active',
                created_at: args[8],
              };
              sessionsStore.push(session);
            },
          };
        }

        if (sql.includes('UPDATE playstation_stations SET status = ?, current_session_id = ? WHERE id = ?')) {
          return {
            run: (status: string, sessionId: string | null, stationId: string) => {
              const st = stationsStore.find((s) => s.id === stationId);
              if (st) {
                st.status = status;
                st.current_session_id = sessionId;
              }
            },
          };
        }

        if (sql.includes('INSERT INTO playstation_session_items')) {
          return {
            run: (...args: any[]) => {
              const item = {
                id: args[0],
                session_id: args[1],
                product_id: args[2],
                product_name: args[3],
                quantity: args[4],
                unit_price_usd: args[5],
                line_total_usd: args[6],
                created_at: args[7],
              };
              sessionItemsStore.push(item);
            },
          };
        }

        if (sql.includes('INSERT INTO sales_orders')) {
          return {
            run: vi.fn(),
          };
        }

        if (sql.includes('INSERT INTO sales_payments')) {
          return {
            run: vi.fn(),
          };
        }

        if (sql.includes("UPDATE playstation_sessions SET status = 'Completed'")) {
          return {
            run: (sessionId: string) => {
              const sess = sessionsStore.find((s) => s.id === sessionId);
              if (sess) {
                sess.status = 'Completed';
              }
            },
          };
        }

        if (sql.includes('UPDATE playstation_sessions SET')) {
          return {
            run: vi.fn(),
          };
        }

        return {
          get: () => undefined,
          all: () => [],
          run: vi.fn(),
        };
      },
      transaction: (fn: () => void) => () => fn(),
    };

    ratesService = new RatesService(mockDb as unknown as Database.Database);
    playstationService = new PlaystationService(mockDb as unknown as Database.Database, ratesService);
  });

  it('should return default rates of 89500 LBP and 200000 LBP/hr when unset', () => {
    const rates = ratesService.getRates();
    expect(rates.usdToLbpRate).toBe(89500);
    expect(rates.ratePerPlayerHourLbp).toBe(200000);
  });

  it('should allow manager to update exchange rate and PlayStation rate', () => {
    ratesService.updateRates({
      usdToLbpRate: 90000,
      ratePerPlayerHourLbp: 500000,
    });

    const rates = ratesService.getRates();
    expect(rates.usdToLbpRate).toBe(90000);
    expect(rates.ratePerPlayerHourLbp).toBe(500000);
  });

  it('should start a playstation session for 4 players (FIFA)', () => {
    const session = playstationService.startSession({
      stationId: 'ps-1',
      playersCount: 4,
      customHourlyRateLbp: 1600000,
      notes: 'FIFA tournament',
    });

    expect(session).toBeDefined();
    expect(session.stationId).toBe('ps-1');
    expect(session.playersCount).toBe(4);
    expect(session.hourlyRateLbp).toBe(1600000);

    const state = playstationService.getStationsAndSessions();
    const station = state.stations.find((s: any) => s.id === 'ps-1');
    expect(station!.activeSession).not.toBeNull();
  });

  it('should add drinks and snacks to an active session', () => {
    const session = playstationService.startSession({
      stationId: 'ps-2',
      playersCount: 2,
    });

    const item = playstationService.addItemToSession({
      sessionId: session.id,
      productId: 'prod-cola',
      productName: 'Coca Cola Can',
      quantity: 2,
      unitPriceUsd: 1.5,
    });

    expect(item).toBeDefined();
    expect(item.quantity).toBe(2);
    expect(item.lineTotalUsd).toBe(3.0);

    const state = playstationService.getStationsAndSessions();
    const station = state.stations.find((s: any) => s.id === 'ps-2');
    expect(station!.activeSession?.items.length).toBe(1);
    expect(station!.activeSession?.items[0].productName).toBe('Coca Cola Can');
  });

  it('should stop and checkout session, releasing the station to available', () => {
    const session = playstationService.startSession({
      stationId: 'ps-1',
      playersCount: 1,
    });

    const result = playstationService.checkoutSession({
      sessionId: session.id,
      paidUsd: 10,
      paidLbp: 0,
      changeUsd: 5,
      changeLbp: 0,
    });

    expect(result).toBeDefined();
    expect(result.invoiceNumber).toContain('INV-PS-');

    const state = playstationService.getStationsAndSessions();
    const station = state.stations.find((s: any) => s.id === 'ps-1');
    expect(station!.activeSession).toBeNull();
  });
});
