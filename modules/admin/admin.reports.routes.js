import { Router } from 'express';
import {
  getOverview,
  getDailyRevenue,
  getMonthlyRevenue,
  getTopMerchants,
  getPaymentBreakdown,
  getLedgerSummary,
  getLedgerEntries,
  getRefundStats,
  getDeliveryStats,
  getAuditLogs,
} from './admin.reports.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

// All report routes require authentication + finance/admin permission
router.use(authenticate);
router.use(requirePermission('admin.reports.read'));

// ============================================================
// PLATFORM OVERVIEW
// ============================================================
router.get('/overview', getOverview);

// ============================================================
// REVENUE ANALYTICS
// ============================================================
router.get('/revenue/daily', getDailyRevenue);
router.get('/revenue/monthly', getMonthlyRevenue);

// ============================================================
// MERCHANT ANALYTICS
// ============================================================
router.get('/merchants/top', getTopMerchants);

// ============================================================
// PAYMENT ANALYTICS
// ============================================================
router.get('/payments/breakdown', getPaymentBreakdown);

// ============================================================
// LEDGER
// ============================================================
router.get('/ledger/summary', getLedgerSummary);
router.get('/ledger/entries', getLedgerEntries);

// ============================================================
// REFUNDS
// ============================================================
router.get('/refunds', getRefundStats);

// ============================================================
// DELIVERY PERFORMANCE
// ============================================================
router.get('/deliveries', getDeliveryStats);

// ============================================================
// AUDIT LOG
// ============================================================
router.get('/audit', getAuditLogs);

export default router;
