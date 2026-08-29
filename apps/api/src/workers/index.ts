import pg from 'pg';
import { QueueManager } from '../queues/queue-manager.js';
import { DiagnosisWorker } from './diagnosis.worker.js';
import { PolicyWorker } from './policy.worker.js';
import { RecoveryExecutionWorker } from './recovery-execution.worker.js';
import { ReconcilerWorker } from './reconciler.worker.js';

export * from './diagnosis.worker.js';
export * from './policy.worker.js';
export * from './recovery-execution.worker.js';
export * from './reconciler.worker.js';

export function initializeWorkers(pool: pg.Pool): void {
  // 1. Diagnosis Worker
  QueueManager.registerWorker('diagnosis-queue', async (job) => {
    await DiagnosisWorker.processJob(pool, job.data);
  });

  // 2. Policy Worker
  QueueManager.registerWorker('policy-queue', async (job) => {
    await PolicyWorker.processJob(pool, job.data);
  });

  // 3. Recovery Execution Worker
  QueueManager.registerWorker('recovery-execution-queue', async (job) => {
    await RecoveryExecutionWorker.processJob(pool, job.data);
  });

  // 4. Reconciler Worker
  QueueManager.registerWorker('reconciliation-queue', async (job) => {
    await ReconcilerWorker.processJob(pool, job.data);
  });

  console.log('✓ All 4 BullMQ RecoveryOS background workers initialized.');
}
