import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { BackupService } from '../main/services/backup.service';

describe('BackupService & Automated Cloud-Sync', () => {
  let mockDb: Record<string, unknown>;
  let backupService: BackupService;

  beforeEach(() => {
    mockDb = {
      backup: vi.fn(),
      prepare: (sql: string) => {
        if (sql.includes('INSERT INTO backup_records')) {
          return { run: vi.fn() };
        }
        return { get: () => undefined, all: () => [], run: vi.fn() };
      },
    };

    backupService = new BackupService(mockDb as unknown as Database.Database);
  });

  it('should trigger SQLite database online backup', async () => {
    const res = await backupService.createFullBackup('./tmp_backups');
    expect(res.backupType).toBe('Full');
    expect(mockDb.backup).toHaveBeenCalled();
  });

  it('should create pre-restore safety backup', async () => {
    const res = await backupService.createPreRestoreBackup('./tmp_backups');
    expect(res.backupType).toBe('PreRestore');
    expect(res.fileName).toContain('PreRestore_Backup_');
  });

  it('should reject restore if file does not exist', async () => {
    await expect(backupService.restoreBackup('./non_existent_file.db')).rejects.toThrow(
      'Backup file not found',
    );
  });
});
