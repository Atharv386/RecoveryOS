import pg from 'pg';

export interface RecoveryOverviewMetrics {
  totalCases: number;
  revenueAtRiskRupees: number;
  grossRecoveredRupees: number;
  netRecoveredRupees: number;
  recoveryRatePercent: number;
  doubleChargesPreventedCount: number;
  policyOverridesCount: number;
  aiFallbackCount: number;
  casesByState: Record<string, number>;
  casesByFailureClass: Record<string, { total: number; recovered: number; rate: number }>;
}

export class MetricsService {
  /**
   * Computes authoritative business metrics directly from PostgreSQL database truth.
   * INVARIANT: Never computes metrics from mutable cache counters.
   */
  public static async getOverview(
    pool: pg.Pool,
    merchantId: string
  ): Promise<RecoveryOverviewMetrics> {
    const client = await pool.connect();
    try {
      // 1. Core aggregates from recovery_cases and payments
      const coreResult = await client.query(
        `SELECT 
           COUNT(rc.id)::int AS total_cases,
           COALESCE(SUM(p.amount_in_paise), 0)::bigint AS revenue_at_risk_paise,
           COALESCE(SUM(rc.recovered_amount_in_paise), 0)::bigint AS gross_recovered_paise,
           COUNT(CASE WHEN rc.state = 'RECOVERED' THEN 1 END)::int AS recovered_cases_count
         FROM recovery_cases rc
         JOIN payments p ON rc.payment_id = p.id
         WHERE rc.merchant_id = $1`,
        [merchantId]
      );

      const core = coreResult.rows[0] || {
        total_cases: 0,
        revenue_at_risk_paise: 0,
        gross_recovered_paise: 0,
        recovered_cases_count: 0
      };

      const totalCases = Number(core.total_cases);
      const revenueAtRiskPaise = Number(core.revenue_at_risk_paise);
      const grossRecoveredPaise = Number(core.gross_recovered_paise);
      const recoveredCasesCount = Number(core.recovered_cases_count);

      // 2. Cases by state
      const stateResult = await client.query(
        `SELECT state, COUNT(*)::int AS count 
         FROM recovery_cases 
         WHERE merchant_id = $1 
         GROUP BY state`,
        [merchantId]
      );
      const casesByState: Record<string, number> = {};
      for (const row of stateResult.rows) {
        casesByState[row.state] = Number(row.count);
      }

      // 3. Cases by failure class
      const classResult = await client.query(
        `SELECT 
           COALESCE(failure_class, 'UNCLASSIFIED') AS failure_class,
           COUNT(*)::int AS total,
           COUNT(CASE WHEN state = 'RECOVERED' THEN 1 END)::int AS recovered
         FROM recovery_cases 
         WHERE merchant_id = $1 
         GROUP BY failure_class`,
        [merchantId]
      );
      const casesByFailureClass: Record<string, { total: number; recovered: number; rate: number }> = {};
      for (const row of classResult.rows) {
        const total = Number(row.total);
        const recovered = Number(row.recovered);
        const rate = total > 0 ? Number(((recovered / total) * 100).toFixed(2)) : 0;
        casesByFailureClass[row.failure_class] = { total, recovered, rate };
      }

      // 4. Double charges prevented (reconciliation events in audit log)
      const doubleChargeResult = await client.query(
        `SELECT COUNT(*)::int AS count 
         FROM audit_logs 
         WHERE merchant_id = $1 
           AND (action LIKE '%Reconciled%' OR metadata->>'prevention' LIKE '%Double charge prevented%')`,
        [merchantId]
      );
      const doubleChargesPreventedCount = Number(doubleChargeResult.rows[0]?.count || 0);

      // 5. Policy overrides (DOWNGRADED or REJECTED policy decisions)
      const policyOverrideResult = await client.query(
        `SELECT COUNT(pd.id)::int AS count 
         FROM policy_decisions pd
         JOIN recovery_cases rc ON pd.case_id = rc.id
         WHERE rc.merchant_id = $1 AND pd.verdict IN ('DOWNGRADED', 'REJECTED')`,
        [merchantId]
      );
      const policyOverridesCount = Number(policyOverrideResult.rows[0]?.count || 0);

      // 6. AI fallback count (diagnoses marked is_fallback = true)
      const fallbackResult = await client.query(
        `SELECT COUNT(d.id)::int AS count 
         FROM diagnoses d
         JOIN recovery_cases rc ON d.case_id = rc.id
         WHERE rc.merchant_id = $1 AND d.is_fallback = true`,
        [merchantId]
      );
      const aiFallbackCount = Number(fallbackResult.rows[0]?.count || 0);

      // Calculate Net Revenue (modeled ₹5 fee per recovery intervention)
      const modeledInterventionCostRupees = (recoveredCasesCount * 5);
      const grossRecoveredRupees = Number((grossRecoveredPaise / 100).toFixed(2));
      const netRecoveredRupees = Math.max(0, grossRecoveredRupees - modeledInterventionCostRupees);
      const recoveryRatePercent = totalCases > 0 ? Number(((recoveredCasesCount / totalCases) * 100).toFixed(2)) : 0;

      return {
        totalCases,
        revenueAtRiskRupees: Number((revenueAtRiskPaise / 100).toFixed(2)),
        grossRecoveredRupees,
        netRecoveredRupees: Number(netRecoveredRupees.toFixed(2)),
        recoveryRatePercent,
        doubleChargesPreventedCount,
        policyOverridesCount,
        aiFallbackCount,
        casesByState,
        casesByFailureClass
      };
    } finally {
      client.release();
    }
  }
}
