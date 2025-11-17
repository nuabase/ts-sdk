import { NormalizedUsage, zs_NormalizedUsage } from '../common/normalized-usage';
import { z } from 'zod';

type NuaApiResponseShape<OutputZodSchema extends z.ZodTypeAny> = {
  llmRequestId: string;
  kind: 'cast/value';
  data: z.infer<OutputZodSchema>;
  isCacheHit: boolean;
  isSuccess: true;
  isError?: false;
  usage: NormalizedUsage;
};

type NuaApiResponseCastValueBuilder = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
>(
  outputKey: OutputName,
  outputSchema: OutputZodSchema
) => z.ZodType<NuaApiResponseShape<OutputZodSchema>>;

const createNuaApiResponseCastValue: NuaApiResponseCastValueBuilder = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
>(
  outputKey: OutputName,
  outputSchema: OutputZodSchema
) => {
  // Retain the call signature parity with the array builder; the runtime schema only needs the inferred type.
  void outputKey;

  return z
    .object({
      llmRequestId: z.string(),
      kind: z.literal('cast/value'),
      data: outputSchema as z.ZodType<z.infer<OutputZodSchema>>,
      isCacheHit: z.boolean(),
      isSuccess: z.literal(true),
      isError: z.optional(z.literal(false)),
      usage: zs_NormalizedUsage,
    })
    .strict() as z.ZodType<NuaApiResponseShape<OutputZodSchema>>;
};

export const zs_NuaApiResponse_CastValue = createNuaApiResponseCastValue;

export type NuaApiResponse_CastValue<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
> = z.infer<ReturnType<typeof zs_NuaApiResponse_CastValue<OutputZodSchema, OutputName>>>;
