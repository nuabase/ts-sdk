import { z } from 'zod';

export const zs_NuaQueuedResponse = z
  .object({
    id: z.string(),
    sseUrl: z.string().min(1),
  })
  .strict();

export type NuaQueuedResponse = z.infer<typeof zs_NuaQueuedResponse>;
