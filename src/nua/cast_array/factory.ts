import { NuabaseAPIClient } from '../../lib/api-client';
import { zs_NuaQueuedResponse } from '../common/queued-response';
import { validateArrayRequestParams } from './request-validation';
import { PrimaryKeyedInputRecord, zs_NuaApiResponse_CastArray } from './response-schema';
import { ArrayFn, ArrayFnDef, ArrayFnQueuedResult, ArrayFnResult } from './types';
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

// TODO: We must parse incoming fnDef using Zod, at runtime, because this library can be used from untyped JavaScript.
// Currently we're doing validation of only input data (checking if its array and has primary key in all row),
// but we need to check the whole shape of the incoming data.
export const createArrayFn = <OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
  client: NuabaseAPIClient,
  fnDef: ArrayFnDef<OutputName, OutputZodSchema>
): ArrayFn<OutputZodSchema, OutputName> => {
  const outputJsonSchema = z.toJSONSchema(fnDef.output.schema);

  const toNuabaseError = (response: unknown) => {
    if (response && typeof response === 'object' && 'error' in response)
      return { error: String((response as { error: unknown }).error), isError: true as const };
    return undefined;
  };

  const baseFn = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnQueuedResult> => {
    validateArrayRequestParams(data, primaryKeyName);

    const response = await client.request(
      'cast/array',
      toCastArrayApiRequest<PrimaryKeyName, InputRecord>(
        fnDef.prompt,
        data,
        primaryKeyName,
        fnDef.output.name,
        outputJsonSchema
      )
    );

    const error = toNuabaseError(response);
    if (error) return error;

    const parsedResponse = zs_NuaQueuedResponse.safeParse(response);
    if (!parsedResponse.success) {
      const emsg = z.prettifyError(parsedResponse.error);
      return { error: `Invalid queued response received from Nuabase API: ${emsg}`, isError: true };
    }

    return parsedResponse.data;
  };

  const nowFn = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>> => {
    validateArrayRequestParams(data, primaryKeyName);

    const response = await client.request(
      'cast/array/now',
      toCastArrayApiRequest<PrimaryKeyName, InputRecord>(
        fnDef.prompt,
        data,
        primaryKeyName,
        fnDef.output.name,
        outputJsonSchema
      )
    );

    const error = toNuabaseError(response);
    if (error) return error;

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

  return Object.assign(baseFn, {
    now: nowFn,
  });
};
