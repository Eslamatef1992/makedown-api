// Safety net for the duplicate-pending-orders fix
// (claude/duplicate-pending-orders-findings.md). orders.controller.js
// #checkout's idempotent-reuse logic stops a *retry* from creating a new
// row, but a genuinely abandoned checkout (closed the app, never retried)
// still needs cleaning up eventually so pending/unpaid orders don't
// accumulate forever. No new dependency: the API runs as a single PM2
// fork instance (not cluster mode), so a plain setInterval in-process is
// safe here - there's only ever one of these running.
const repo = require('../modules/orders/orders.repository');
const { cancelPendingOrder } = require('../modules/orders/orders.service');
const env = require('../config/env');

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function sweepOnce() {
  try {
    const stale = await repo.findStalePending(env.pendingOrderExpiryMinutes);
    for (const row of stale) {
      await cancelPendingOrder(row);
    }
    if (stale.length) {
      console.log(`[expireStaleOrders] cancelled ${stale.length} stale pending order(s)`);
    }
  } catch (err) {
    console.error('[expireStaleOrders] sweep failed:', err.message);
  }
}

function start() {
  sweepOnce();
  setInterval(sweepOnce, SWEEP_INTERVAL_MS);
}

module.exports = { start, sweepOnce };
