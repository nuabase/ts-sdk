import { NuabaseError } from '../../lib/error-response';
import { NuaQueuedResponse } from '../common/queued-response';
import type { NuaApiResponse_CastArray, PrimaryKeyedInputRecord } from './response-schema';
import { z } from 'zod';

// Generic glossary:
// - OutputZodSchema: the concrete schema that validates each mapped value.
// - OutputName: a descriptive name of the mapped output value, usually the type name of OutputZodSchema.
// - InputRecord: caller-supplied row shape containing the primary key.
// - PrimaryKeyName: literal key on InputRecord that identifies a row.

export type ArrayFnDef<OutputName extends string, OutputZodSchema extends z.ZodTypeAny> = {
  prompt: string;
  output: {
    name: OutputName;
    schema: OutputZodSchema;
  };
};

// Ensure we catch malformed definitions when the SDK is consumed from untyped JavaScript.
// Runtime schema mirroring `ArrayFnDef`; keep these definitions touching so future updates stay in sync.
// We still rely on the generic TypeScript type for compile-time safety, so the runtime schema only guards shape.
const zs_ArrayFnDef = z.object({
  prompt: z.string(),
  output: z.object({
    name: z.string(),
    schema: z.custom<z.ZodTypeAny>(
      (value): value is z.ZodTypeAny => value instanceof z.ZodType,
      'Expected a Zod schema'
    ),
  }),
});

export const validateArrayFnDef = <OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
  fnDef: ArrayFnDef<OutputName, OutputZodSchema>
): ArrayFnDef<OutputName, OutputZodSchema> => {
  const parsed = zs_ArrayFnDef.safeParse(fnDef);
  if (!parsed.success) {
    const message = z.prettifyError(parsed.error);
    throw new TypeError(`Invalid array function definition: ${message}`);
  }
  return parsed.data as ArrayFnDef<OutputName, OutputZodSchema>;
};

export type ArrayFnResult<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
> =
  | NuabaseError
  | NuaApiResponse_CastArray<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>;

export type ArrayFnQueuedResult = NuabaseError | NuaQueuedResponse;

// Base invocation returns queued SSE metadata; `.now` resolves with the final cast response.
export type ArrayFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
  <PrimaryKeyName extends string, InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>>(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnQueuedResult>;
  now: <PrimaryKeyName extends string, InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>>(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ) => Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>>;
};
