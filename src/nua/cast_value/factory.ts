import { NuabaseAPIClient } from '../../lib/api-client';
import { zs_NuaApiResponse_CastValue } from './response-schema';
import { ValueFn, ValueFnDef, ValueFnResult } from './types';
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

export const createValueFn = <OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
  client: NuabaseAPIClient,
  fnDef: ValueFnDef<OutputName, OutputZodSchema>
): ValueFn<OutputZodSchema, OutputName> => {
  const outputJsonSchema = z.toJSONSchema(fnDef.output.schema);

  // The generic bounds ensure the TS compiler enforces that every row includes the named primary key.
  const makeRequest = async (
    path: 'cast/value' | 'cast/value/now',
    data: unknown
  ): Promise<ValueFnResult<OutputZodSchema, OutputName>> => {
    const response = await client.request(
      path,
      toCastValueApiRequest(fnDef.prompt, data, fnDef.output.name, outputJsonSchema)
    );

    if (response && typeof response === 'object' && 'error' in response)
      return { error: String(response.error), isError: true };

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

  const baseFn = async (data: unknown): Promise<ValueFnResult<OutputZodSchema, OutputName>> => {
    return await makeRequest('cast/value', data);
  };

  const nowFn = async (data: unknown): Promise<ValueFnResult<OutputZodSchema, OutputName>> => {
    return await makeRequest('cast/value/now', data);
  };

  return Object.assign(baseFn, {
    now: nowFn,
  });
};
