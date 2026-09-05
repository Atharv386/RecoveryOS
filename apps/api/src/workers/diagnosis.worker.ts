import pg from 'pg';
import { AIDiagnosisService } from '@recoveryos/ai-diagnosis';
import {
  RecoveryCaseRepository,
  DiagnosisRepository,
  withTransaction
} from '@recoveryos/db';
import { QueueJobPayloads, QueueManager } from '../queues/queue-manager.js';

export class DiagnosisWorker {
  private static aiService = new AIDiagnosisService({
    enabled: process.env.AI_ENABLED !== 'false',
    apiKey: process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.AI_API_KEY,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 6000,
    modelName: process.env.AI_MODEL_NAME || 'meta-llama/llama-3.3-70b-instruct'
  });

  public static async processJob(
    pool: pg.Pool,
    data: QueueJobPayloads['diagnosis-queue']
  ): Promise<void> {
    const { merchantId, caseId, amountInPaise, currency, method, errorCode, errorDescription, errorSource, errorStep, errorReason, attemptNumber } = data;

    // 1. Run isolated AI / fallback diagnosis
    const diagnosisResult = await this.aiService.diagnose({
      merchantId,
      paymentId: data.paymentId,
      amountInPaise,
      currency,
      method,
      errorCode,
      errorDescription,
      errorSource,
      errorStep,
      errorReason,
      attemptNumber
    });

    // 2. Transactionally save diagnosis and advance case state DETECTED -> DIAGNOSED
    const savedDiagnosis = await withTransaction(pool, async (client) => {
      // Transition state
      await RecoveryCaseRepository.transitionState(client, {
        merchantId,
        caseId,
        targetState: 'DIAGNOSED',
        actor: 'WORKER:DiagnosisWorker',
        failureClass: diagnosisResult.diagnosis.failure_class,
        auditMetadata: {
          modelName: diagnosisResult.modelName,
          isFallback: diagnosisResult.isFallback,
          confidence: diagnosisResult.diagnosis.confidence
        }
      });

      // Save immutable diagnosis record
      return await DiagnosisRepository.create(client, {
        case_id: caseId,
        is_fallback: diagnosisResult.isFallback,
        model_name: diagnosisResult.modelName,
        input_hash: diagnosisResult.inputHash,
        failure_class: diagnosisResult.diagnosis.failure_class,
        confidence: diagnosisResult.diagnosis.confidence,
        reasoning: diagnosisResult.diagnosis.reasoning,
        recommended_action: diagnosisResult.diagnosis.recommended_action,
        recommended_delay_minutes: diagnosisResult.diagnosis.recommended_delay_minutes
      });
    });

    // 3. Dispatch to policy queue
    await QueueManager.enqueueJob(
      'policy-queue',
      `policy-${caseId}`,
      {
        merchantId,
        caseId,
        diagnosisId: savedDiagnosis.id
      },
      { jobId: `pol_${caseId}_${Date.now()}` }
    );
  }
}
