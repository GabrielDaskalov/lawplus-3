import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { config } from '../config';
import { User, AuthResponse, AuthError, ValidationError } from '../types';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';

export class AuthService {
  static async register(email: string, password: string, name: string): Promise<AuthResponse> {
    // Validate input
    if (!validator.isEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (name.length < 2 || name.length > 100) {
      throw new ValidationError('Name must be between 2 and 100 characters');
    }

    // Check if user exists
    const existing = await db.oneOrNone(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing) {
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Create user
    await db.none(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)`,
      [userId, email, passwordHash, name]
    );

    // Generate token
    return this.generateAuthResponse(userId, email, 'student');
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    // Validate input
    if (!validator.isEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Find user
    const user = await db.oneOrNone<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash || '');

    if (!passwordMatch) {
      throw new AuthError('Invalid email or password');
    }

    // Update last login
    await db.none(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate token — ролята идва от базата (поправка: беше хардкодната 'student')
    return this.generateAuthResponse(user.id, user.email, (user as any).role || 'student');
  }

  static async validateToken(token: string): Promise<{ user_id: string; email: string; role: string }> {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as any;
      return {
        user_id: payload.user_id,
        email: payload.email,
        role: payload.role,
      };
    } catch (error) {
      throw new AuthError('Invalid or expired token');
    }
  }

  static async requestPasswordReset(email: string): Promise<string> {
    const user = await db.oneOrNone<User>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // Don't reveal if email exists for security
      return 'If email exists, reset link has been sent';
    }

    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.none(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    // Изпрати имейла с линка (не блокира отговора при грешка)
    const { EmailService } = await import('./emailService');
    EmailService.sendPasswordResetEmail(email, resetToken).catch((e: any) =>
      console.error('[email] password reset:', e)
    );
    // For now, return the token (in production, this would be in the email)
    return resetToken;
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate password
    if (newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Find token
    const resetRecord = await db.oneOrNone(
      `SELECT user_id FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW() AND used = false`,
      [token]
    );

    if (!resetRecord) {
      throw new AuthError('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.none(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, resetRecord.user_id]
    );

    // Mark token as used
    await db.none(
      'UPDATE password_reset_tokens SET used = true WHERE token = $1',
      [token]
    );
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Find user
    const user = await db.oneOrNone<User>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      throw new AuthError('User not found');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash || '');

    if (!passwordMatch) {
      throw new AuthError('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.none(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );
  }

  private static generateAuthResponse(
    userId: string,
    email: string,
    role: string
  ): AuthResponse {
    const expiresIn = '24h';
    const token = jwt.sign(
      {
        user_id: userId,
        email,
        role,
      },
      config.jwt.secret,
      { expiresIn }
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      user_id: userId,
      token,
      expires_at: expiresAt,
    };
  }
}
