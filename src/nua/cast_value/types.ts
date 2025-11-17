import { NuabaseError } from '../../lib/error-response';
import { NuaQueuedResponse } from '../common/queued-response';
import { NuaApiResponse_CastValue } from './response-schema';
import { z } from 'zod';

export type ValueFnDef<OutputName extends string, OutputZodSchema extends z.ZodTypeAny> = {
  prompt: string;
  output: {
    name: OutputName;
    schema: OutputZodSchema;
  };
};

// Ensure we catch malformed definitions when the SDK is consumed from untyped JavaScript.
// Runtime schema mirroring `ValueFnDef`; keep these definitions touching so future updates stay in sync.
// We still rely on the generic TypeScript type for compile-time safety, so the runtime schema only guards shape.
const zs_ValueFnDef = z.object({
  prompt: z.string(),
  output: z.object({
    name: z.string(),
    schema: z.custom<z.ZodTypeAny>(
      (value) => value instanceof z.ZodType,
      'Expected a Zod schema for `output.schema`'
    ),
  }),
});

export const validateValueFnDef = <OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
  fnDef: ValueFnDef<OutputName, OutputZodSchema>
): ValueFnDef<OutputName, OutputZodSchema> => {
  const parsed = zs_ValueFnDef.safeParse(fnDef);
  if (!parsed.success) {
    const message = z.prettifyError(parsed.error);
    throw new TypeError(`Invalid value function definition: ${message}`);
  }
  return parsed.data as ValueFnDef<OutputName, OutputZodSchema>;
};

export type ValueFnResult<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> =
  | NuabaseError
  | NuaApiResponse_CastValue<OutputZodSchema, OutputName>;

export type ValueFnQueuedResult = NuabaseError | NuaQueuedResponse;

// Base invocation immediately runs and resolves with the final cast response; queue returns queued SSE metadata
export type ValueFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
  (data: unknown): Promise<ValueFnResult<OutputZodSchema, OutputName>>;
  queue: (data: unknown) => Promise<ValueFnQueuedResult>;
};
