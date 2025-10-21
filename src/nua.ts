import { NuabaseAPIClient, NuabaseConfig } from './lib/api-client';
import { NuabaseError } from './lib/error-response';
import { z } from 'zod';

// Generic glossary:
// - OutputZodSchema: the concrete schema that validates each mapped value.
// - OutputName: a descriptive name of the mapped output value, usually the type name of OutputZodSchema.
// - InputRecord: caller-supplied row shape containing the primary key.
// - PrimaryKeyName: literal key on InputRecord that identifies a row.

type ArrayFnDef<OutputName extends string, OutputZodSchema extends z.ZodTypeAny> = {
  prompt: string;
  output: {
    name: OutputName;
    schema: OutputZodSchema;
  };
};

// NOTE: this type definition must match the equivalent zod schema we manually create (used for validation)
// see the zodSchema below
type ArrayResponseRecord<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = {
  [Key in PrimaryKeyName | OutputName]: Key extends PrimaryKeyName
    ? InputRecord[PrimaryKeyName]
    : z.infer<OutputZodSchema>;
};

const zs_ArrayResponseRecord = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
): z.ZodType<ArrayResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
  const primaryKeySchema = z.any() as z.ZodType<InputRecord[PrimaryKeyName]>;

  return z
    .object({
      [primaryKeyName]: primaryKeySchema,
      [outputKey]: outputSchema,
    } as Record<PrimaryKeyName | OutputName, z.ZodTypeAny>)
    .strict() as z.ZodType<
    ArrayResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>
  >;
};

// NOTE: this type definition must match the equivalent zod schema we manually create (used for validation)
// see the zodSchema below
type SuccessData_Array<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = Array<ArrayResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>>;

const zs_SuccessData_Array = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
): z.ZodType<SuccessData_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
  const recordSchema = zs_ArrayResponseRecord<
    OutputZodSchema,
    OutputName,
    InputRecord,
    PrimaryKeyName
  >(primaryKeyName, outputKey, outputSchema);

  return z.array(recordSchema) as z.ZodType<
    SuccessData_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>
  >;
};

// NOTE: this type definition must match the equivalent zod schema we manually create (used for validation)
// see the zodSchema below
type SuccessResponse_Array<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = {
  data: SuccessData_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>;
  cacheHits: number;
  llmRequestId: string;
  kind: 'cast/array';
  rowsWithNoResults: string[];
  isSuccess: true;
  isError?: false;
};

const zs_SuccessResponse_Array = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
): z.ZodType<SuccessResponse_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
  const dataSchema = zs_SuccessData_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>(
    primaryKeyName,
    outputKey,
    outputSchema
  );

  return z
    .object({
      llmRequestId: z.string(),
      kind: z.literal('cast/array'),
      data: dataSchema,
      cacheHits: z.number(),
      rowsWithNoResults: z.array(z.string()),
      isSuccess: z.literal(true),
      isError: z.optional(z.literal(false)),
    })
    .strict() as z.ZodType<
    SuccessResponse_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>
  >;
};

type ArrayFnResult<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = NuabaseError | SuccessResponse_Array<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>;

type ArrayFn<OutputZodSchema extends z.ZodTypeAny, OutputName extends string> = {
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

export class Nua {
  apiClient: NuabaseAPIClient;

  constructor(config?: NuabaseConfig) {
    this.apiClient = new NuabaseAPIClient(config);
  }

  // Some of the checks here mirror type validation, but since our code could be run from
  // untyped JavaScript, we still want runtime checks
  static validateArrayRequestParams(data: unknown, primaryKeyName: unknown) {
    if (!Array.isArray(data)) {
      throw new Error('`data` must be an array of objects.');
    }

    if (!primaryKeyName || typeof primaryKeyName !== 'string') {
      throw new Error('`primaryKeyName` must be a non-empty string.');
    }

    data.forEach((item, index) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(`data[${index}] must be a non-null object.`);
      }

      if (!(primaryKeyName in item)) {
        throw new Error(`data[${index}] must contain property '${primaryKeyName}'.`);
      }
    });
  }

  createArrayFn<OutputName extends string, OutputZodSchema extends z.ZodTypeAny>(
    fnDef: ArrayFnDef<OutputName, OutputZodSchema>
  ): ArrayFn<OutputZodSchema, OutputName> {
    const client = this.apiClient;
    const outputJsonSchema = z.toJSONSchema(fnDef.output.schema);

    const makeRequest = async <
      InputRecord extends Record<string, unknown>,
      PrimaryKeyName extends keyof InputRecord & string,
    >(
      path: 'cast/array' | 'cast/array/now',
      data: InputRecord[],
      primaryKeyName: PrimaryKeyName
    ): Promise<ArrayFnResult<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
      // This will throw errors in case of validation failures
      Nua.validateArrayRequestParams(data, primaryKeyName);

      const response = await client.request(path, {
        input: {
          prompt: fnDef.prompt,
          data: data,
          primaryKey: primaryKeyName,
        },
        output: {
          schema: outputJsonSchema,
          name: fnDef.output.name,
        },
      });

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

    const fnReturnValue: ArrayFn<OutputZodSchema, OutputName> = Object.assign(baseFn, {
      now: nowFn,
    });

    return fnReturnValue;
  }
}
