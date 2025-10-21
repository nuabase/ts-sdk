import { NuabaseError } from '../../lib/error-response';
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

export type ArrayFnResult<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
> =
  | NuabaseError
  | NuaApiResponse_CastArray<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>;

// The generic constraint on `InputRecord` ensures every supplied row includes the primary key property.
export type ArrayFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
  <PrimaryKeyName extends string, InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>>(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>>;
  now: <PrimaryKeyName extends string, InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>>(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ) => Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>>;
};
