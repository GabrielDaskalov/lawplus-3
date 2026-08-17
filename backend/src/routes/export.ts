/**
 * Export Routes - Generate CSV/JSON exports of reports and data
 */

import { Router } from 'express';
import { authenticate, asyncHandler } from '../middleware/auth';
import { ExportService } from '../services/exportService';
import { InputValidator } from '../utils/validation';

const router = Router();

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required',
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

// ============================================================================
// USER PROGRESS EXPORTS
// ============================================================================

// GET /api/export/user/progress - Export current user's progress
router.get(
  '/user/progress',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.user_id;
    const format = (req.query.format as string) || 'json';

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format',
        message: 'Format must be json or csv',
        timestamp: new Date().toISOString(),
      });
    }

    if (format === 'csv') {
      const csv = await ExportService.exportUserProgressCSV(userId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="progress-${userId}.csv"`);
      res.send(csv);
    } else {
      const data = await ExportService.exportUserProgressJSON(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="progress-${userId}.json"`);
      res.json(data);
    }
  })
);

// GET /api/export/user/:user_id/progress - Export specific user's progress (admin)
router.get(
  '/user/:user_id/progress',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.params.user_id;
    const format = (req.query.format as string) || 'json';

    InputValidator.validateUUID(userId, 'user_id');

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format',
        message: 'Format must be json or csv',
        timestamp: new Date().toISOString(),
      });
    }

    if (format === 'csv') {
      const csv = await ExportService.exportUserProgressCSV(userId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="progress-${userId}.csv"`);
      res.send(csv);
    } else {
      const data = await ExportService.exportUserProgressJSON(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="progress-${userId}.json"`);
      res.json(data);
    }
  })
);

// ============================================================================
// QUIZ EXPORTS
// ============================================================================

// GET /api/export/quiz-results - Export quiz results
router.get(
  '/quiz-results',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.user_id;
    const format = (req.query.format as string) || 'csv';

    if (format === 'csv') {
      const csv = await ExportService.exportQuizResultsCSV(userId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="quiz-results-${userId}.csv"`);
      res.send(csv);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid format',
        message: 'Quiz results export only supports CSV format',
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// GET /api/export/quiz-results/all - Export all quiz results (admin)
router.get(
  '/quiz-results/all',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const format = (req.query.format as string) || 'csv';

    if (format === 'csv') {
      const csv = await ExportService.exportQuizResultsCSV();

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="quiz-results-all.csv"');
      res.send(csv);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid format',
        message: 'Quiz results export only supports CSV format',
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// STUDY PLAN EXPORTS
// ============================================================================

// GET /api/export/study-plan - Export current user's study plan
router.get(
  '/study-plan',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.user_id;

    const csv = await ExportService.exportStudyPlanCSV(userId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="study-plan-${userId}.csv"`);
    res.send(csv);
  })
);

// ============================================================================
// ANALYTICS EXPORTS (Admin Only)
// ============================================================================

// GET /api/export/analytics - Export platform analytics
router.get(
  '/analytics',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const format = (req.query.format as string) || 'json';
    const includeUsers = req.query.include_users === 'true';

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format',
        message: 'Format must be json or csv',
        timestamp: new Date().toISOString(),
      });
    }

    if (format === 'csv') {
      const csv = await ExportService.exportAnalyticsCSV(includeUsers);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
      res.send(csv);
    } else {
      const data = await ExportService.exportAnalyticsJSON(includeUsers);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.json"');
      res.json(data);
    }
  })
);

// ============================================================================
// CONTENT LIBRARY EXPORTS (Admin Only)
// ============================================================================

// GET /api/export/content-library - Export content library
router.get(
  '/content-library',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const subjectId = (req.query.subject_id as string) || undefined;

    if (subjectId) {
      InputValidator.validateUUID(subjectId, 'subject_id');
    }

    const data = await ExportService.exportContentLibraryJSON(subjectId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="content-library.json"');
    res.json(data);
  })
);

export default router;
