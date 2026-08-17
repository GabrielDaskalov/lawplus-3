/**
 * API Key Service - Manage API keys for third-party integrations
 * Provides secure key generation, rotation, and access control
 */

import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface APIKey {
  id: string;
  name: string;
  key: string;
  key_hash: string;
  created_by: string;
  last_used_at?: Date;
  expires_at?: Date;
  active: boolean;
  permissions: string[];
  rate_limit?: number;
  created_at: Date;
}

export class APIKeyService {
  /**
   * Generate a new API key
   */
  static async generateKey(
    name: string,
    createdBy: string,
    permissions: string[] = ['read'],
    expiresIn?: number,
    rateLimit?: number
  ): Promise<APIKey> {
    const id = uuidv4();
    const keyPrefix = 'pk_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    const key = keyPrefix + randomPart;
    const keyHash = this.hashKey(key);

    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    await db.none(
      `INSERT INTO api_keys (id, name, key_hash, created_by, permissions, rate_limit, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, name, keyHash, createdBy, JSON.stringify(permissions), rateLimit || null, expiresAt]
    );

    return {
      id,
      name,
      key,
      key_hash: keyHash,
      created_by: createdBy,
      active: true,
      permissions,
      rate_limit: rateLimit,
      created_at: new Date(),
    };
  }

  /**
   * Validate API key
   */
  static async validateKey(key: string): Promise<{ valid: boolean; keyId?: string; permissions?: string[] }> {
    if (!key.startsWith('pk_')) {
      return { valid: false };
    }

    const keyHash = this.hashKey(key);

    const apiKey = await db.oneOrNone<any>(
      `SELECT id, permissions, expires_at, active FROM api_keys WHERE key_hash = $1`,
      [keyHash]
    );

    if (!apiKey || !apiKey.active) {
      return { valid: false };
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return { valid: false };
    }

    // Update last used timestamp
    await db.none('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKey.id]);

    return {
      valid: true,
      keyId: apiKey.id,
      permissions: JSON.parse(apiKey.permissions),
    };
  }

  /**
   * Check if key has permission
   */
  static async hasPermission(keyId: string, permission: string): Promise<boolean> {
    const apiKey = await db.oneOrNone<any>(
      'SELECT permissions FROM api_keys WHERE id = $1 AND active = true',
      [keyId]
    );

    if (!apiKey) return false;

    const permissions = JSON.parse(apiKey.permissions);
    return permissions.includes(permission) || permissions.includes('admin');
  }

  /**
   * Get keys for user
   */
  static async getKeys(userId: string): Promise<Omit<APIKey, 'key'>[]> {
    const keys = await db.manyOrNone<any>(
      `SELECT id, name, created_by, last_used_at, expires_at, active, permissions, rate_limit, created_at
       FROM api_keys WHERE created_by = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return keys.map((k: any) => ({
      ...k,
      permissions: JSON.parse(k.permissions),
    }));
  }

  /**
   * Revoke API key
   */
  static async revokeKey(keyId: string): Promise<void> {
    await db.none('UPDATE api_keys SET active = false WHERE id = $1', [keyId]);
  }

  /**
   * Rotate API key (generate new, deactivate old)
   */
  static async rotateKey(keyId: string): Promise<APIKey> {
    const oldKey = await db.one<any>(
      'SELECT name, created_by, permissions, rate_limit FROM api_keys WHERE id = $1',
      [keyId]
    );

    // Deactivate old key
    await this.revokeKey(keyId);

    // Generate new key
    const newKey = await this.generateKey(
      `${oldKey.name} (rotated)`,
      oldKey.created_by,
      JSON.parse(oldKey.permissions),
      undefined,
      oldKey.rate_limit
    );

    return newKey;
  }

  /**
   * Update key permissions
   */
  static async updatePermissions(keyId: string, permissions: string[]): Promise<void> {
    await db.none('UPDATE api_keys SET permissions = $1 WHERE id = $2', [
      JSON.stringify(permissions),
      keyId,
    ]);
  }

  /**
   * Set rate limit for key
   */
  static async setRateLimit(keyId: string, rateLimit: number): Promise<void> {
    await db.none('UPDATE api_keys SET rate_limit = $1 WHERE id = $2', [rateLimit, keyId]);
  }

  /**
   * Get key usage statistics
   */
  static async getKeyStats(keyId: string): Promise<any> {
    const stats = await db.one<any>(
      `SELECT
        name, created_at, last_used_at, active,
        (SELECT COUNT(*) FROM api_key_logs WHERE key_id = $1) as total_requests,
        (SELECT COUNT(*) FROM api_key_logs WHERE key_id = $1 AND status = 'success') as successful_requests,
        (SELECT COUNT(*) FROM api_key_logs WHERE key_id = $1 AND status = 'error') as failed_requests
       FROM api_keys WHERE id = $1`,
      [keyId]
    );

    return {
      name: stats.name,
      created_at: stats.created_at,
      last_used_at: stats.last_used_at,
      active: stats.active,
      total_requests: parseInt(stats.total_requests),
      successful_requests: parseInt(stats.successful_requests),
      failed_requests: parseInt(stats.failed_requests),
      success_rate:
        stats.total_requests > 0
          ? Math.round((parseInt(stats.successful_requests) / parseInt(stats.total_requests)) * 100)
          : 0,
    };
  }

  /**
   * Log API key usage
   */
  static async logUsage(
    keyId: string,
    endpoint: string,
    method: string,
    status: number,
    responseTime: number
  ): Promise<void> {
    const logStatus = status >= 200 && status < 300 ? 'success' : 'error';

    await db.none(
      `INSERT INTO api_key_logs (id, key_id, endpoint, method, status, response_time, log_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uuidv4(), keyId, endpoint, method, status, responseTime, logStatus]
    );
  }

  /**
   * Get key logs
   */
  static async getKeyLogs(keyId: string, limit: number = 100): Promise<any[]> {
    const logs = await db.manyOrNone<any>(
      `SELECT * FROM api_key_logs WHERE key_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [keyId, limit]
    );

    return logs;
  }

  /**
   * Hash API key (one-way hashing)
   */
  private static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Clean up expired keys
   */
  static async cleanupExpiredKeys(): Promise<number> {
    const result = await db.result(
      'DELETE FROM api_keys WHERE expires_at < NOW() AND active = false'
    );

    return result.rowCount;
  }

  /**
   * Get active keys count
   */
  static async getActiveKeyCount(userId: string): Promise<number> {
    const result = await db.one<any>(
      'SELECT COUNT(*) as count FROM api_keys WHERE created_by = $1 AND active = true',
      [userId]
    );

    return parseInt(result.count);
  }
}
