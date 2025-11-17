import { z } from 'zod';

export type NormalizedUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export const zs_NormalizedUsage: z.ZodType<NormalizedUsage> = z
  .object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  })
  .strict();
