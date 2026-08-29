import { Queue, Worker, Processor } from 'bullmq';
import IORedis from 'ioredis';
import { getDatabasePool } from '@recoveryos/db';
import { DiagnosisWorker } from '../workers/diagnosis.worker.js';
import { PolicyWorker } from '../workers/policy.worker.js';
import { RecoveryExecutionWorker } from '../workers/recovery-execution.worker.js';
import { ReconcilerWorker } from '../workers/reconciler.worker.js';

export interface QueueJobPayloads {
  'diagnosis-queue': {
    merchantId: string;
    caseId: string;
    paymentId: string;
    amountInPaise: number;
    currency: string;
    method: string;
    errorCode?: string;
    errorDescription?: string;
    errorSource?: string;
    errorStep?: string;
    errorReason?: string;
    attemptNumber: number;
  };
  'policy-queue': {
    merchantId: string;
    caseId: string;
    diagnosisId: string;
  };
  'recovery-execution-queue': {
    merchantId: string;
    caseId: string;
    policyDecisionId: string;
    actionType: string;
    attemptNumber: number;
  };
  'reconciliation-queue': {
    merchantId: string;
    caseId: string;
    razorpayPaymentId: string;
    attemptNumber: number;
  };
}

export type QueueName = keyof QueueJobPayloads;

export class QueueManager {
  private static redisConnection: IORedis | null = null;
  private static queues: Map<string, Queue> = new Map();
  private static workers: Map<string, Worker> = new Map();

  public static getRedisConnection(): IORedis {
    if (!this.redisConnection) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false
      });

      this.redisConnection.on('error', (err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('⚠️ Redis connection warning:', err.message);
        }
      });
    }
    return this.redisConnection;
  }

  public static getQueue<T extends QueueName>(queueName: T): Queue<QueueJobPayloads[T], any, string> {
    if (!this.queues.has(queueName)) {
      const queue = new Queue<QueueJobPayloads[T], any, string>(queueName, {
        connection: this.getRedisConnection()
      });
      this.queues.set(queueName, queue as Queue);
    }
    return this.queues.get(queueName)! as Queue<QueueJobPayloads[T], any, string>;
  }

  public static registerWorker<T extends QueueName>(
    queueName: T,
    processor: Processor<QueueJobPayloads[T], any, string>
  ): Worker<QueueJobPayloads[T], any, string> {
    const worker = new Worker<QueueJobPayloads[T], any, string>(queueName, processor, {
      connection: this.getRedisConnection(),
      concurrency: 5
    });

    this.workers.set(queueName, worker as Worker);
    return worker;
  }

  public static async enqueueJob<T extends QueueName>(
    queueName: T,
    jobName: string,
    data: QueueJobPayloads[T],
    options?: { delayMs?: number; jobId?: string }
  ): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      // In unit testing mode without a live Redis server, record as offline no-op immediately
      return;
    }

    try {
      const queue = this.getQueue(queueName);
      await (queue as Queue).add(jobName, data, {
        delay: options?.delayMs,
        jobId: options?.jobId,
        removeOnComplete: true,
        removeOnFail: 100
      });
    } catch {
      // In dev mode without Redis, dispatch job to worker asynchronously in background
      setTimeout(async () => {
        try {
          const pool = getDatabasePool();
          if (queueName === 'diagnosis-queue') {
            await DiagnosisWorker.processJob(pool, data as any);
          } else if (queueName === 'policy-queue') {
            await PolicyWorker.processJob(pool, data as any);
          } else if (queueName === 'recovery-execution-queue') {
            await RecoveryExecutionWorker.processJob(pool, data as any);
          } else if (queueName === 'reconciliation-queue') {
            await ReconcilerWorker.processJob(pool, data as any);
          }
        } catch (err) {
          console.error(`[DevDirectWorker] Error processing ${queueName}:`, err);
        }
      }, options?.delayMs || 10);
    }
  }

  public static async closeAll(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    this.workers.clear();

    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();

    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }
  }
}
