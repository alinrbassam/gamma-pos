import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { LicensingService } from '../main/services/licensing.service';

describe('LicensingService & Device Activation', () => {
  let mockDb: Record<string, unknown>;
  let licensingService: LicensingService;

  beforeEach(() => {
    mockDb = {
      prepare: (sql: string) => {
        if (sql.includes('SELECT * FROM license_info')) {
          return {
            get: () => undefined,
          };
        }
        if (sql.includes('INSERT INTO license_info')) {
          return { run: vi.fn() };
        }
        return { get: () => undefined, all: () => [], run: vi.fn() };
      },
    };

    licensingService = new LicensingService(mockDb as unknown as Database.Database);
  });

  it('should generate a formatted alphanumeric device fingerprint', () => {
    const fingerprint = licensingService.getDeviceFingerprint();
    expect(fingerprint).toBeDefined();
    const normalized = licensingService.normalizeDeviceId(fingerprint);
    expect(normalized.length).toBe(16);
  });

  it('should activate a valid license payload', () => {
    const deviceId = licensingService.getDeviceFingerprint();
    const payload = JSON.stringify({
      customerName: 'Test Retail',
      businessName: 'Supermarket LLC',
      deviceId,
      licenseType: 'Lifetime',
      enabledModules: ['pos', 'inventory', 'reports'],
    });

    const activated = licensingService.activateLicensePayload(payload);
    expect(activated.customerName).toBe('Test Retail');
    expect(activated.status).toBe('Active');
  });

  it('should reject a license payload with mismatched device ID', () => {
    const payload = JSON.stringify({
      customerName: 'Fraudulent User',
      businessName: 'Fake LLC',
      deviceId: 'WRONG-DEVICE-9999',
      licenseType: 'Lifetime',
      enabledModules: ['pos'],
    });

    expect(() => licensingService.activateLicensePayload(payload)).toThrow(/Device ID mismatch/i);
  });

  it('should derive deterministic activation key from device fingerprint and activate successfully', () => {
    const deviceId = licensingService.getDeviceFingerprint();
    const key = licensingService.deriveActivationKey(deviceId);

    expect(key).toMatch(/^GMA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    const activated = licensingService.activateWithSecretKey(key);
    expect(activated.status).toBe('Active');
    expect(activated.licenseKey).toBe(key);
    expect(activated.customerName).toBe('Client Gamma');
  });

  it('should activate via universal master key', () => {
    const activated = licensingService.activateWithSecretKey('gamma-2026');
    expect(activated.status).toBe('Active');
    expect(activated.licenseType).toBe('Lifetime');
  });

  it('should reject an invalid activation code', () => {
    expect(() => licensingService.activateWithSecretKey('INVALID-CODE-9999')).toThrow(/Invalid activation code/i);
  });
});
