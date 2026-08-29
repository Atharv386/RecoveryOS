import { FailureContext } from './types.js';
import { DiagnosisOutput, DiagnosisOutputSchema } from './schema.js';
import { buildSanitizedPrompt } from './prompt.js';
import { classifyWithFallback } from './fallback.js';
import { DiagnosisCache } from './cache.js';

export interface AIDiagnosisConfig {
  enabled: boolean;
  apiKey?: string;
  timeoutMs?: number;
  modelName?: string;
  dailyBudgetLimit?: number;
}

export interface DiagnosisResult {
  diagnosis: DiagnosisOutput;
  inputHash: string;
  isFallback: boolean;
  isCacheHit: boolean;
  modelName: string;
  durationMs: number;
}

export class AIDiagnosisService {
  private readonly config: AIDiagnosisConfig;
  private static dailyCallCount = 0;
  private static lastResetDay = new Date().getUTCDate();

  constructor(config: AIDiagnosisConfig) {
    this.config = {
      enabled: config.enabled,
      apiKey: config.apiKey || process.env.GROQ_API_KEY,
      timeoutMs: config.timeoutMs ?? 3000,
      modelName: config.modelName ?? process.env.AI_MODEL_NAME ?? 'llama-3.3-70b-versatile',
      dailyBudgetLimit: config.dailyBudgetLimit ?? 10000
    };
  }

  public async diagnose(context: FailureContext): Promise<DiagnosisResult> {
    const startTime = Date.now();
    const { prompt, inputHash } = buildSanitizedPrompt(context);

    // 1. Check Diagnosis Cache first (Zero-Cost Optimization from Section 14.2)
    const cached = DiagnosisCache.get(context);
    if (cached) {
      return {
        diagnosis: cached,
        inputHash,
        isFallback: false,
        isCacheHit: true,
        modelName: 'diagnosis_cache_v1',
        durationMs: Date.now() - startTime
      };
    }

    // 2. Daily call quota limiter (Quota exhaustion degrades to rules, never downtime)
    this.checkDailyBudgetReset();
    if (AIDiagnosisService.dailyCallCount >= (this.config.dailyBudgetLimit || 10000)) {
      const fallbackDiagnosis = classifyWithFallback(context);
      DiagnosisCache.set(context, fallbackDiagnosis);
      return {
        diagnosis: fallbackDiagnosis,
        inputHash,
        isFallback: true,
        isCacheHit: false,
        modelName: 'quota_exhausted_fallback',
        durationMs: Date.now() - startTime
      };
    }

    // 3. If AI is disabled or Groq API key is missing, execute deterministic fallback immediately
    if (!this.config.enabled || !this.config.apiKey) {
      const fallbackDiagnosis = classifyWithFallback(context);
      DiagnosisCache.set(context, fallbackDiagnosis);
      return {
        diagnosis: fallbackDiagnosis,
        inputHash,
        isFallback: true,
        isCacheHit: false,
        modelName: 'deterministic_fallback_v1',
        durationMs: Date.now() - startTime
      };
    }

    try {
      AIDiagnosisService.dailyCallCount++;
      
      // Call Groq Free Tier
      const rawJsonText = await this.callGroq(prompt);
      
      // Clean possible markdown code fences (e.g. ```json ... ```)
      const cleanJsonText = rawJsonText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsedRaw = JSON.parse(cleanJsonText);

      if (!parsedRaw || typeof parsedRaw !== 'object' || (!parsedRaw.failure_class && !parsedRaw.root_cause && !parsedRaw.class)) {
        throw new Error('Malformed AI output: missing failure_class');
      }

      let rawClass = String(parsedRaw.failure_class || parsedRaw.root_cause || parsedRaw.class || '').toUpperCase().trim();
      if (rawClass.includes('INSUFFICIENT') || rawClass.includes('BALANCE')) rawClass = 'INSUFFICIENT_FUNDS';
      else if (rawClass.includes('TIMEOUT') || rawClass.includes('NETWORK')) rawClass = 'NETWORK_TIMEOUT';
      else if (rawClass.includes('AUTH') || rawClass.includes('OTP') || rawClass.includes('3DS')) rawClass = 'AUTHENTICATION_FAILED';
      else if (rawClass.includes('EXPIRED') || rawClass.includes('INSTRUMENT') || rawClass.includes('CARD')) rawClass = 'EXPIRED_INSTRUMENT';
      else if (rawClass.includes('FRAUD') || rawClass.includes('RISK') || rawClass.includes('SUSPECT') || rawClass.includes('VELOCITY')) rawClass = 'SUSPECTED_FRAUD';
      else if (rawClass.includes('GATEWAY') || rawClass.includes('ACQUIRER') || rawClass.includes('BANK')) rawClass = 'GATEWAY_ERROR';
      else if (rawClass.includes('LIMIT')) rawClass = 'LIMIT_EXCEEDED';
      else rawClass = 'UNKNOWN_ERROR';

      let rawAction = String(parsedRaw.recommended_action || parsedRaw.action || '').toUpperCase().trim();
      if (rawAction.includes('LINK') || rawAction.includes('PAYMENT_LINK')) rawAction = 'PAYMENT_LINK';
      else if (rawAction.includes('NOTIF')) rawAction = 'CUSTOMER_NOTIFICATION';
      else if (rawAction.includes('ESCALAT') || rawAction.includes('MANUAL')) rawAction = 'MANUAL_ESCALATION';
      else if (rawAction.includes('NONE') || rawAction.includes('NO_ACTION') || rawAction.includes('BLOCK') || rawAction.includes('HALT')) rawAction = 'NO_ACTION';
      else rawAction = 'DELAYED_RETRY';

      // Normalize synonyms
      const normalizedJson = {
        failure_class: rawClass,
        confidence: Math.min(1.0, Math.max(0.0, Number(parsedRaw.confidence ?? parsedRaw.confidence_score ?? 0.85))),
        recommended_action: rawAction,
        recommended_delay_minutes: Math.max(0, Number(parsedRaw.recommended_delay_minutes ?? parsedRaw.delay_minutes ?? 0)),
        reasoning: String(parsedRaw.reasoning || 'Diagnosed by Groq AI')
      };

      const validatedDiagnosis = DiagnosisOutputSchema.parse(normalizedJson);

      // Cache validated output to save future API calls
      DiagnosisCache.set(context, validatedDiagnosis);

      return {
        diagnosis: validatedDiagnosis,
        inputHash,
        isFallback: false,
        isCacheHit: false,
        modelName: this.config.modelName!,
        durationMs: Date.now() - startTime
      };
    } catch (err) {
      // On any AI failure (timeout, rate limit, parse error), degrade gracefully to rules
      const fallbackDiagnosis = classifyWithFallback(context);
      DiagnosisCache.set(context, fallbackDiagnosis);

      return {
        diagnosis: fallbackDiagnosis,
        inputHash,
        isFallback: true,
        isCacheHit: false,
        modelName: `fallback_after_error:${(err as Error).message.slice(0, 30)}`,
        durationMs: Date.now() - startTime
      };
    }
  }

  /**
   * Directly queries the Groq API for ultra-fast Llama 3.3 70B inference.
   */
  public async callGroq(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.modelName || 'openai/gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: 'You are the RecoveryOS AI diagnostic engine. You must analyze payment failures and respond ONLY with a valid JSON object matching the requested schema without markdown fences.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 350,
          temperature: 0.1
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Groq API returned HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json() as { choices: Array<{ message: { content: string } }> };
      return data.choices[0]?.message?.content || '{}';
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private checkDailyBudgetReset(): void {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== AIDiagnosisService.lastResetDay) {
      AIDiagnosisService.dailyCallCount = 0;
      AIDiagnosisService.lastResetDay = currentDay;
    }
  }
}
