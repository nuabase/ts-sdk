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

export type ValueFnResult<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> =
  | NuabaseError
  | NuaApiResponse_CastValue<OutputZodSchema, OutputName>;

export type ValueFnQueuedResult = NuabaseError | NuaQueuedResponse;

// Base invocation returns queued SSE metadata; `.now` resolves with the final cast response.
export type ValueFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
  (data: unknown): Promise<ValueFnQueuedResult>;
  now: (data: unknown) => Promise<ValueFnResult<OutputZodSchema, OutputName>>;
};
