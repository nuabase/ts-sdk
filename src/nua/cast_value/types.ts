import { NuabaseError } from '../../lib/error-response';
import { NuaApiResponse_CastValue } from './response-schema';
import { z } from 'zod';

export type ValueFnDef<OutputName extends string, OutputZodSchema extends z.ZodTypeAny> = {
  prompt: string;
  output: {
    name: OutputName;
    schema: OutputZodSchema;
  };
};

export type ValueFnResult<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> =
  | NuabaseError
  | NuaApiResponse_CastValue<OutputZodSchema, OutputName>;

// The generic constraint on `InputRecord` ensures every supplied row includes the primary key property.
export type ValueFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
  (data: unknown): Promise<ValueFnResult<OutputZodSchema, OutputName>>;
  now: (data: unknown) => Promise<ValueFnResult<OutputZodSchema, OutputName>>;
};
