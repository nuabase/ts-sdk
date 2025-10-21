import { NuabaseAPIClient } from '../../lib/api-client';
import { validateArrayRequestParams } from './request-validation';
import { zs_SuccessResponse_Array } from './response-schema';
import { ArrayFn, ArrayFnDef, ArrayFnResult } from './types';
import { z } from 'zod';

const buildArrayRequest = <
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends string,
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

  const makeRequest = async <
    InputRecord extends Record<string, unknown>,
    PrimaryKeyName extends keyof InputRecord & string,
  >(
    path: 'cast/array' | 'cast/array/now',
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
    validateArrayRequestParams(data, primaryKeyName);

    const response = await client.request(
      path,
      buildArrayRequest(fnDef.prompt, data, primaryKeyName, fnDef.output.name, outputJsonSchema)
    );

    if (response && typeof response === 'object' && 'error' in response)
      return { error: String(response.error), isError: true };

    const outputKey = fnDef.output.name;
    const successSchema = zs_SuccessResponse_Array<
      OutputZodSchema,
      OutputName,
      InputRecord,
      PrimaryKeyName
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
    InputRecord extends Record<string, unknown>,
    PrimaryKeyName extends keyof InputRecord & string,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
    return await makeRequest('cast/array', data, primaryKeyName);
  };

  const nowFn = async <
    InputRecord extends Record<string, unknown>,
    PrimaryKeyName extends keyof InputRecord & string,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
    return await makeRequest('cast/array/now', data, primaryKeyName);
  };

  return Object.assign(baseFn, {
    now: nowFn,
  });
};
