import { NuabaseAPIClient } from '../../lib/api-client';
import { zs_NuaQueuedResponse } from '../common/queued-response';
import { validateArrayRequestParams } from './request-validation';
import { PrimaryKeyedInputRecord, zs_NuaApiResponse_CastArray } from './response-schema';
import {
  ArrayFn,
  ArrayFnDef,
  ArrayFnQueuedResult,
  ArrayFnResult,
  validateArrayFnDef,
} from './types';
import { z } from 'zod';

type CastArrayResponseRow<
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  OutputName extends string,
  OutputValue,
> = Pick<InputRecord, PrimaryKeyName> & Record<OutputName, OutputValue>;

// This helper re-attaches the original row to each generated output so callers can
// inspect both the primary key and the full source payload side-by-side.
//
// Note that this is only available in arrayFn.now, and not in the queued function, or any
// webhook or SSE callback. We're doing it for arrayFn.now because it only takes some computation
// and memory for the object references. Everywhere else we'll have to materialize the input data
// which adds latency and storage overhead.
function addOriginalInputRows<
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  OutputName extends string,
  OutputValue,
>(
  inputRows: InputRecord[],
  outputRows: Array<CastArrayResponseRow<PrimaryKeyName, InputRecord, OutputName, OutputValue>>,
  primaryKeyName: PrimaryKeyName
): Array<
  CastArrayResponseRow<PrimaryKeyName, InputRecord, OutputName, OutputValue> & {
    sourceRow: InputRecord;
  }
> {
  type PrimaryKeyValue = InputRecord[PrimaryKeyName];

  const lookup = new Map<PrimaryKeyValue, InputRecord>();
  for (const row of inputRows) {
    lookup.set(row[primaryKeyName], row);
  }

  return outputRows.map((row) => {
    const primaryKeyValue = row[primaryKeyName] as PrimaryKeyValue;
    const sourceRow = lookup.get(primaryKeyValue);

    if (!sourceRow) {
      // This should never happen because the server would've already ensured these ids match input
      // rows, and those that don't would be added to rowsWithNoResults.
      throw new Error(
        `Unable to locate source row for primary key "${String(primaryKeyValue)}" in cast array response.`
      );
    }

    return {
      ...row,
      sourceRow,
    };
  });
}

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
  inputFnDef: ArrayFnDef<OutputName, OutputZodSchema>
): ArrayFn<OutputZodSchema, OutputName> => {
  // Validate at runtime to guard JavaScript consumers; remember to keep this aligned with the TS type definition.
  const fnDef = validateArrayFnDef(inputFnDef);

  const outputJsonSchema = z.toJSONSchema(fnDef.output.schema);

  const toNuabaseError = (response: unknown) => {
    if (response && typeof response === 'object' && 'error' in response)
      return { error: String((response as { error: unknown }).error), isError: true as const };
    return undefined;
  };

  const queueFn = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnQueuedResult> => {
    validateArrayRequestParams(data, primaryKeyName);

    const response = await client.request(
      'POST',
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

  const baseNowFn = async <
    PrimaryKeyName extends string,
    InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
  >(
    data: InputRecord[],
    primaryKeyName: PrimaryKeyName
  ): Promise<ArrayFnResult<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>> => {
    validateArrayRequestParams(data, primaryKeyName);

    const response = await client.request(
      'POST',
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
      data: addOriginalInputRows<PrimaryKeyName, InputRecord, OutputName, z.infer<OutputZodSchema>>(
        data,
        parsedResponse.data.data,
        primaryKeyName
      ),
      rowsWithNoResults: parsedResponse.data.rowsWithNoResults,
      cacheHits: parsedResponse.data.cacheHits,
      usage: parsedResponse.data.usage,
    };
  };

  return Object.assign(baseNowFn, {
    queue: queueFn,
  });
};
