import Database from 'better-sqlite3';
import { logger } from './logger.service';

export interface RatesConfig {
  usdToLbpRate: number;
  ratePerPlayerHourLbp: number;
}

export class RatesService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public getRates(): RatesConfig {
    let usdToLbpRate = 89500;
    let ratePerPlayerHourLbp = 200000;

    try {
      const exchangeRow = this.db
        .prepare("SELECT value FROM business_settings WHERE key = 'usd_to_lbp_rate' LIMIT 1")
        .get() as { value: string } | undefined;
      if (exchangeRow && exchangeRow.value) {
        const parsed = parseFloat(exchangeRow.value);
        if (!isNaN(parsed) && parsed > 0) {
          usdToLbpRate = parsed;
        }
      }

      const psRow = this.db
        .prepare("SELECT value FROM business_settings WHERE key = 'rate_per_player_hour_lbp' LIMIT 1")
        .get() as { value: string } | undefined;
      if (psRow && psRow.value) {
        const parsed = parseFloat(psRow.value);
        if (!isNaN(parsed) && parsed > 0) {
          ratePerPlayerHourLbp = parsed;
        }
      }
    } catch (err) {
      logger.error('RatesService', 'Failed retrieving rates from business_settings', err);
    }

    return {
      usdToLbpRate,
      ratePerPlayerHourLbp,
    };
  }

  public updateRates(rates: Partial<RatesConfig>): RatesConfig {
    const current = this.getRates();
    const updatedUsdToLbp = rates.usdToLbpRate !== undefined && rates.usdToLbpRate > 0 ? rates.usdToLbpRate : current.usdToLbpRate;
    const updatedPsRate = rates.ratePerPlayerHourLbp !== undefined && rates.ratePerPlayerHourLbp > 0 ? rates.ratePerPlayerHourLbp : current.ratePerPlayerHourLbp;

    try {
      this.db
        .prepare(`
          INSERT INTO business_settings (id, business_id, category, key, value, created_at, updated_at)
          VALUES (
            'rate-usd-lbp',
            (SELECT id FROM businesses LIMIT 1),
            'currency',
            'usd_to_lbp_rate',
            ?,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `)
        .run(String(updatedUsdToLbp));

      this.db
        .prepare(`
          INSERT INTO business_settings (id, business_id, category, key, value, created_at, updated_at)
          VALUES (
            'rate-ps-player-hour',
            (SELECT id FROM businesses LIMIT 1),
            'playstation',
            'rate_per_player_hour_lbp',
            ?,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `)
        .run(String(updatedPsRate));

      logger.info('RatesService', `Updated rates: USD/LBP=${updatedUsdToLbp}, PS/hr=${updatedPsRate}`);
    } catch (err) {
      logger.error('RatesService', 'Failed updating rates in business_settings', err);
    }

    return {
      usdToLbpRate: updatedUsdToLbp,
      ratePerPlayerHourLbp: updatedPsRate,
    };
  }
}
