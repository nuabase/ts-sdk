import { NuabaseError } from '../../lib/error-response';
import type { SuccessResponse_Array } from './response-schema';
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

export type ArrayFnResult<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = NuabaseError | SuccessResponse_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>;

export type ArrayFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
  <InputRecord extends Record<string, unknown>, PrimaryKeyName extends keyof InputRecord & string>(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>>;
  now: <
    InputRecord extends Record<string, unknown>,
    PrimaryKeyName extends keyof InputRecord & string,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ) => Promise<ArrayFnResult<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>>;
};
