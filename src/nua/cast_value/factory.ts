import { NuabaseAPIClient } from '../../lib/api-client';
import { zs_NuaQueuedResponse } from '../common/queued-response';
import { zs_NuaApiResponse_CastValue } from './response-schema';
import { ValueFn, ValueFnDef, ValueFnQueuedResult, ValueFnResult } from './types';
import { z } from 'zod';

// Keep the request payload typed so every record includes the primary key we send to the API.
const toCastValueApiRequest = (
  prompt: string,
  data: unknown,
  outputName: string,
  outputSchema: unknown
) => ({
  input: {
    prompt,
    data,
  },
  output: {
    schema: outputSchema,
    name: outputName,
  },
});

// TODO: We must parse incoming fnDef using Zod, at runtime, because this library can be used from untyped JavaScript.
export const createValueFn = <OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
  client: NuabaseAPIClient,
  fnDef: ValueFnDef<OutputName, OutputZodSchema>
): ValueFn<OutputZodSchema, OutputName> => {
  const outputJsonSchema = z.toJSONSchema(fnDef.output.schema);

  const toNuabaseError = (response: unknown) => {
    if (response && typeof response === 'object' && 'error' in response)
      return { error: String((response as { error: unknown }).error), isError: true as const };
    return undefined;
  };

  const sendRequest = async (path: 'cast/value' | 'cast/value/now', data: unknown) =>
    client.request(
      path,
      toCastValueApiRequest(fnDef.prompt, data, fnDef.output.name, outputJsonSchema)
    );

  const baseFn = async (data: unknown): Promise<ValueFnQueuedResult> => {
    const response = await sendRequest('cast/value', data);
    const error = toNuabaseError(response);
    if (error) return error;

    const parsedResponse = zs_NuaQueuedResponse.safeParse(response);
    if (!parsedResponse.success) {
      const emsg = z.prettifyError(parsedResponse.error);
      return { error: `Invalid queued response received from Nuabase API: ${emsg}`, isError: true };
    }

    return parsedResponse.data;
  };

  const nowFn = async (data: unknown): Promise<ValueFnResult<OutputZodSchema, OutputName>> => {
    const response = await sendRequest('cast/value/now', data);
    const error = toNuabaseError(response);
    if (error) return error;

    const outputKey = fnDef.output.name;
    const successSchema = zs_NuaApiResponse_CastValue<OutputZodSchema, OutputName>(
      outputKey,
      fnDef.output.schema
    );

    const parsedResponse = successSchema.safeParse(response);
    if (!parsedResponse.success) {
      const emsg = z.prettifyError(parsedResponse.error);
      return { error: `Invalid data received from Nuabase API: ${emsg}`, isError: true };
    }

    return {
      isSuccess: true,
      llmRequestId: parsedResponse.data.llmRequestId,
      kind: parsedResponse.data.kind,
      data: parsedResponse.data.data,
      isCacheHit: parsedResponse.data.isCacheHit,
    };
  };

  return Object.assign(baseFn, {
    now: nowFn,
  });
};
