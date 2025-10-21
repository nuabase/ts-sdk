import { z } from 'zod';

// NOTE: this type definition must match the equivalent zod schema we manually create (used for validation)
// see the zodSchema below
type ResponseRecord<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = {
  [Key in PrimaryKeyName | OutputName]: Key extends PrimaryKeyName
    ? InputRecord[PrimaryKeyName]
    : z.infer<OutputZodSchema>;
};

const zs_ResponseRecord = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
): z.ZodType<ResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>> => {
  const primaryKeySchema = z.any() as z.ZodType<InputRecord[PrimaryKeyName]>;

  return z
    .object({
      [primaryKeyName]: primaryKeySchema,
      [outputKey]: outputSchema,
    } as Record<PrimaryKeyName | OutputName, z.ZodTypeAny>)
    .strict() as z.ZodType<
    ResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>
  >;
};

// NOTE: this type definition must match the equivalent zod schema we manually create (used for validation)
// see the zodSchema below
export type NuaApiResponse_CastArray<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
> = {
  data: Array<ResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>>;
  cacheHits: number;
  llmRequestId: string;
  kind: 'cast/array';
  rowsWithNoResults: string[];
  isSuccess: true;
  isError?: false;
};

export const zs_NuaApiResponse_CastArray = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  InputRecord extends Record<string, unknown>,
  PrimaryKeyName extends keyof InputRecord & string,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
): z.ZodType<
  NuaApiResponse_CastArray<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>
> => {
  const recordSchema = zs_ResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>(
    primaryKeyName,
    outputKey,
    outputSchema
  );
  const dataSchema = z.array(recordSchema) as z.ZodType<
    Array<ResponseRecord<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>>
  >;

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
    NuaApiResponse_CastArray<OutputZodSchema, OutputName, InputRecord, PrimaryKeyName>
  >;
};
