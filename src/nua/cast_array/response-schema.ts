import { z } from 'zod';

// We expect the primary key for the rows - both input and output - to always be string | number
export type UserDataPKValue = string | number;

// Minimal shape each caller-supplied row must satisfy: includes the primary key we reference later.
export type PrimaryKeyedInputRecord<PrimaryKeyName extends string> = Record<
  PrimaryKeyName,
  UserDataPKValue
> &
  Record<string, unknown>;

// Creates a new object type with only two properties:
//   {[PrimaryKeyName]: string | number, [OutputName]: <type of the value represented by OutputZodSchema>}
// 1. Pick creates a new object from the InputRecord, but with *only* the PrimaryKeyName (e.g., { id: string }).
// 2. Then we intersect it with a new Record which has *only* the OutputName and its inferred type (e.g., { result: boolean }).
// The final type is the merge of both, e.g., { id: string; result: boolean }.
// `InputRecord` is constrained below so that *every* incoming row includes the chosen primary key.
type ResponseRow<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
> = Pick<InputRecord, PrimaryKeyName> & Record<OutputName, z.infer<OutputZodSchema>>;

type NuaApiResponseShape<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
> = {
  llmRequestId: string;
  kind: 'cast/array';
  data: Array<ResponseRow<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>>;
  cacheHits: number;
  rowsWithNoResults: string[];
  isSuccess: true;
  isError?: false;
};

// This helper describes the exact runtime payload that the CastArray endpoint returns.
// Keeping it split out lets us reuse the shape both for the Zod builder and for TS inference.
type NuaApiResponseCastArrayBuilder = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
) => z.ZodType<NuaApiResponseShape<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>>;

const zs_ResponseRecord = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
): z.ZodType<ResponseRow<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>> => {
  // Zod cannot infer the literal key name here, so we upcast `z.any()` to the precise PK value type.
  // At runtime we still accept any value, but at the type level the primary-key property stays aligned
  // with whatever field the caller picked from their `InputRecord`.
  const primaryKeySchema: z.ZodType<InputRecord[PrimaryKeyName]> = z.any();
  // TypeScript widens computed keys to `string`, so we cast the object literal to reconnect the literal
  // names to the corresponding Zod schemas. Without this, inference would lose the strong key mapping.
  const shape = {
    [primaryKeyName]: primaryKeySchema,
    [outputKey]: outputSchema,
  } as Record<PrimaryKeyName | OutputName, z.ZodTypeAny>;

  return z.object(shape).strict() as z.ZodType<
    ResponseRow<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>
  >;
};

// Builds the full success response schema that we use for runtime validation of Nuabase responses.
const createNuaApiResponseCastArray: NuaApiResponseCastArrayBuilder = <
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
>(
  primaryKeyName: PrimaryKeyName,
  outputKey: OutputName,
  outputSchema: OutputZodSchema
) => {
  const recordSchema = zs_ResponseRecord<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>(
    primaryKeyName,
    outputKey,
    outputSchema
  );
  const dataSchema = z.array(recordSchema);

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
    .strict();
};

// We expose both the schema (for runtime parsing) and a derived TS type (for developer ergonomics).
// Callers should validate with this schema and annotate their variables with `NuaApiResponse_CastArray`.
export const zs_NuaApiResponse_CastArray = createNuaApiResponseCastArray;

// `z.infer` keeps the TypeScript response type in lock-step with the Zod schema above.
// Client code imports this alias so that runtime parsing (via Zod) and static typing never drift apart.
export type NuaApiResponse_CastArray<
  OutputZodSchema extends z.ZodTypeAny,
  OutputName extends string,
  PrimaryKeyName extends string,
  InputRecord extends PrimaryKeyedInputRecord<PrimaryKeyName>,
> = z.infer<
  ReturnType<
    typeof zs_NuaApiResponse_CastArray<OutputZodSchema, OutputName, PrimaryKeyName, InputRecord>
  >
>;
