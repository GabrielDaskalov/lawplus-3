import { Router } from 'express';
import { AuthService } from '../services/authService';
import { authenticate, asyncHandler } from '../middleware/auth';
import { InputValidator } from '../utils/validation';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    // Validate input
    InputValidator.validateEmail(email);
    InputValidator.validatePassword(password);
    InputValidator.validateName(name);

    const result = await AuthService.register(email, password, name);
    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully',
      timestamp: new Date().toISOString(),
    });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    InputValidator.validateEmail(email);
    if (!password) {
      throw new Error('Password is required');
    }

    const result = await AuthService.login(email, password);
    res.json({
      success: true,
      data: result,
      message: 'Login successful',
      timestamp: new Date().toISOString(),
    });
  })
);

// POST /api/auth/logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // Token invalidation would be implemented with a token blacklist
    res.json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
    });
  })
);

// GET /api/auth/user
router.get(
  '/user',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.user_id;
    const { db } = require('../db');

    const user = await db.oneOrNone(
      'SELECT id, email, name, avatar_url, theme, language FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    });
  })
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    InputValidator.validateEmail(email);

    // ПОПРАВКА НА СИГУРНОСТТА: токенът НИКОГА не се връща в отговора —
    // отива само по имейл. Иначе всеки може да смени чужда парола.
    await AuthService.requestPasswordReset(email);

    // Един и същ отговор независимо дали имейлът съществува
    // (не разкриваме кои имейли имат акаунт)
    res.json({
      success: true,
      message: 'Ако този имейл има акаунт, изпратихме линк за нова парола.',
      timestamp: new Date().toISOString(),
    });
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, new_password } = req.body;
    await AuthService.resetPassword(token, new_password);
    res.json({
      success: true,
      message: 'Password reset successfully',
      timestamp: new Date().toISOString(),
    });
  })
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.user_id;
    const { current_password, new_password } = req.body;

    // Validate input
    if (!current_password) {
      throw new Error('current_password is required');
    }
    InputValidator.validatePassword(new_password);

    await AuthService.changePassword(userId, current_password, new_password);
    res.json({
      success: true,
      message: 'Password changed successfully',
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
