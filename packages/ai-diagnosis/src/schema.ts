import { z } from 'zod';
import { FailureClassEnum, RecommendedActionEnum } from './types.js';

export const DiagnosisOutputSchema = z.object({
  failure_class: FailureClassEnum,
  confidence: z.number().min(0.0).max(1.0),
  recommended_action: RecommendedActionEnum,
  recommended_delay_minutes: z.number().int().min(0).max(10080),
  reasoning: z.string().min(5).max(500),
  metadata_signals: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
});

export type DiagnosisOutput = z.infer<typeof DiagnosisOutputSchema>;
