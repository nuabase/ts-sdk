import { NuabaseAPIClient } from '../../lib/api-client';
import { validateArrayRequestParams } from './request-validation';
import { PrimaryKeyedInputRecord, zs_NuaApiResponse_CastArray } from './response-schema';
import { ArrayFn, ArrayFnDef, ArrayFnResult } from './types';
import { z } from 'zod';

// Keep the request payload typed so every record includes the primary key we send to the API.
const toCastArrayApiRequest = <
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
>(
  prompt: string,
  data: InputRecord[],
  primaryKeyName: PrimaryKeyName,
  outputName: string,
  outputSchema: unknown
) => ({
  input: {
    prompt,
    data,
    primaryKey: primaryKeyName,
  },
  output: {
    schema: outputSchema,
    name: outputName,
  },
});

export const createArrayFn = <OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
  client: NuabaseAPIClient,
  fnDef: ArrayFnDef<OutputName, OutputZodSchema>
): ArrayFn<OutputZodSchema, OutputName> => {
  const outputJsonSchema = z.toJSONSchema(fnDef.output.schema);

  // The generic bounds ensure the TS compiler enforces that every row includes the named primary key.
  const makeRequest = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    path: 'cast/array' | 'cast/array/now',
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>> => {
    validateArrayRequestParams(data, primaryKeyName);

    const response = await client.request(
      path,
      toCastArrayApiRequest(fnDef.prompt, data, primaryKeyName, fnDef.output.name, outputJsonSchema)
    );

    if (response && typeof response === 'object' && 'error' in response)
      return { error: String(response.error), isError: true };

    const outputKey = fnDef.output.name;
    const successSchema = zs_NuaApiResponse_CastArray<
      OutputZodSchema,
      OutputName,
      PrimaryKeyName,
      InputRecord
    >(primaryKeyName, outputKey, fnDef.output.schema);

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
      rowsWithNoResults: parsedResponse.data.rowsWithNoResults,
      cacheHits: parsedResponse.data.cacheHits,
    };
  };

  const baseFn = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>> => {
    return await makeRequest('cast/array', data, primaryKeyName);
  };

  const nowFn = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>> => {
    return await makeRequest('cast/array/now', data, primaryKeyName);
  };

  return Object.assign(baseFn, {
    now: nowFn,
  });
};
