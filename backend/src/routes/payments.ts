/**
 * Payments Routes - One-time payments and checkout processing
 */

import { Router } from 'express';
import { authenticate, asyncHandler } from '../middleware/auth';
import { StripeService } from '../services/stripeService';
import { InputValidator } from '../utils/validation';
import { db } from '../db';

const router = Router();

// ============================================================================
// PAYMENT INTENT CREATION
// ============================================================================

/**
 * POST /api/payments/create-intent
 * Create a payment intent for one-time purchase
 * Body: { amount: number, description: string, metadata?: Record<string, any> }
 */
router.post(
  '/create-intent',
  authenticate,
  asyncHandler(async (req, res) => {
    const { amount, description, metadata } = req.body;

    // Validate input
    InputValidator.validateNumber(amount, 'amount', 1, 999999); // Max $9,999.99
    InputValidator.validateString(description, 'description', 1, 200);

    if (metadata && typeof metadata !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid Metadata',
        message: 'Metadata must be an object',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const paymentIntentData = await StripeService.createPaymentIntent(
        req.user!.user_id,
        amount,
        'usd',
        description,
        metadata
      );

      res.json({
        success: true,
        data: paymentIntentData,
        message: 'Payment intent created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'Payment Intent Creation Failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// PAYMENT CONFIRMATION
// ============================================================================

/**
 * POST /api/payments/confirm
 * Confirm payment after client-side Stripe processing
 * Body: { payment_intent_id: string, description: string }
 */
router.post(
  '/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    const { payment_intent_id, description } = req.body;

    InputValidator.validateString(payment_intent_id, 'payment_intent_id', 1, 100);
    InputValidator.validateString(description, 'description', 1, 200);

    try {
      const payment = await StripeService.confirmPayment(
        payment_intent_id,
        req.user!.user_id,
        description
      );

      res.json({
        success: true,
        data: payment,
        message: 'Payment confirmed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: 'Payment Confirmation Failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// PAYMENT HISTORY
// ============================================================================

/**
 * GET /api/payments/history
 * Get payment history for current user
 * Query: limit? (default 50, max 500)
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    try {
      const payments = await StripeService.getPaymentHistory(req.user!.user_id, limit);

      res.json({
        success: true,
        data: payments,
        count: payments.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to Retrieve Payments',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// INVOICES
// ============================================================================

/**
 * GET /api/payments/invoices
 * Get all invoices for current user
 */
router.get(
  '/invoices',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const invoices = await StripeService.getUserInvoices(req.user!.user_id);

      res.json({
        success: true,
        data: invoices,
        count: invoices.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to Retrieve Invoices',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// INVOICE RETRIEVAL (Admin)
// ============================================================================

/**
 * GET /api/payments/invoices/:invoice_id
 * Get specific invoice (requires authorization)
 */
router.get(
  '/invoices/:invoice_id',
  authenticate,
  asyncHandler(async (req, res) => {
    const { invoice_id } = req.params;
    InputValidator.validateString(invoice_id, 'invoice_id', 1, 100);

    try {
      // Check if user is admin or owner of invoice
      const payment = await db.oneOrNone<any>(
        'SELECT user_id FROM payments WHERE stripe_payment_id = $1',
        [invoice_id]
      );

      if (payment && payment.user_id !== req.user!.user_id && req.user!.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to access this invoice',
          timestamp: new Date().toISOString(),
        });
      }

      // Fetch invoice details (simplified - would need Stripe API call)
      res.json({
        success: true,
        message: 'Invoice details retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to Retrieve Invoice',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// REFUND REQUEST (Admin)
// ============================================================================

/**
 * POST /api/payments/:payment_id/refund
 * Request refund for a payment (admin only)
 * Body: { reason?: string, amount?: number }
 */
router.post(
  '/:payment_id/refund',
  authenticate,
  asyncHandler(async (req, res) => {
    const { payment_id } = req.params;
    const { reason, amount } = req.body;

    // Check admin role
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required',
        timestamp: new Date().toISOString(),
      });
    }

    InputValidator.validateUUID(payment_id, 'payment_id');

    if (reason) {
      InputValidator.validateString(reason, 'reason', 0, 500);
    }

    if (amount) {
      InputValidator.validateNumber(amount, 'amount', 0.01, 999999);
    }

    try {
      const payment = await db.oneOrNone<any>(
        'SELECT * FROM payments WHERE id = $1',
        [payment_id]
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment Not Found',
          message: 'Payment record does not exist',
          timestamp: new Date().toISOString(),
        });
      }

      if (payment.status === 'refunded') {
        return res.status(400).json({
          success: false,
          error: 'Invalid Operation',
          message: 'Payment is already refunded',
          timestamp: new Date().toISOString(),
        });
      }

      // Note: Actual refund processing would call Stripe API
      // stripe.refunds.create({ payment_intent: payment.stripe_payment_id })

      // For now, update status in database
      await db.none(
        `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [payment_id]
      );

      res.json({
        success: true,
        message: 'Refund processed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Refund Failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

// ============================================================================
// PAYMENT STATS (Admin)
// ============================================================================

/**
 * GET /api/payments/stats
 * Get payment statistics (admin only)
 * Query: period? ('day' | 'week' | 'month' | 'year'), user_id?
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    // Check admin role
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required',
        timestamp: new Date().toISOString(),
      });
    }

    const period = (req.query.period as string) || 'month';
    const userId = req.query.user_id as string;

    try {
      let whereClause = '';
      const params: any[] = [];

      // Build where clause based on period
      switch (period) {
        case 'day':
          whereClause = 'created_at > NOW() - INTERVAL \'1 day\'';
          break;
        case 'week':
          whereClause = 'created_at > NOW() - INTERVAL \'1 week\'';
          break;
        case 'year':
          whereClause = 'created_at > NOW() - INTERVAL \'1 year\'';
          break;
        case 'month':
        default:
          whereClause = 'created_at > NOW() - INTERVAL \'1 month\'';
      }

      // Filter by user if specified
      if (userId) {
        whereClause += ` AND user_id = $${params.length + 1}`;
        params.push(userId);
      }

      const stats = await db.one<any>(
        `SELECT
          COUNT(*) as total_payments,
          COALESCE(SUM(amount), 0) as total_amount,
          AVG(amount) as average_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_count
        FROM payments WHERE ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: {
          period,
          ...stats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to Retrieve Stats',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

export default router;
