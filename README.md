## Nuabase TypeScript SDK

Nuabase turns LLM prompts into type-safe functions in under five lines of code. Set up your free account now at [Nuabase](https://nuabase.com).

With Nuabase, you write a prompt, specify the output schema, and get back a well-typed function. You can invoke it with input data, like any other code in your application, and receive data that matches the exact schema you specified.

Example use-cases:

- Provide free-form text input for faster filling of complex HTML forms
- Enrich a list of food items with nutrition facts
- Tag sales leads with more details about the company

Behind the scenes, Nuabase runs the LLM transformation as async jobs, and once ready, call your server API with the results using Webhooks. It can also stream the result directly to your front-end using SSE. You can also see all requests and responses as they happen in the [Nuabase Console](https://console.nuabase.com). All outputs are guaranteed to match the schema you specified.

One major reason I built Nuabase is the need for granular, row-level caching. For example, let's say you want to classify your bank transaction entries, and map them to your chart of accounts. With Nuabase's row-level caching, it will only send new entries to the LLM. Any specific entry that it has seen before will be returned from the cache. This also means you can make LLM requests multiple times with identical values, and after the first time, they will return immediately without needing to go through the LLM.

## Usage at a glance

**1. Input.** Start with the data you want to send to the LLM:

```ts
const leads = [{ id: 'lead-101', notes: 'Growth-stage SaaS, ~80 employees, wants a demo.' }];
```

**2. Desired shape.** Describe the structure you expect back:

```ts
const LeadInsights = z.object({
  industry: z.string(),
  company_size: z.enum(['SMB', 'Mid-market', 'Enterprise']),
});
```

**3. Declare the prompt.** Turn it into a typed function:

```ts
const classifyLeads = new Nua().createArrayFn({
  prompt: 'Classify each lead with industry and company_size bucket.',
  output: {
    name: 'leadInsights',
    schema: LeadInsights,
  },
});
```

**4. Invoke.** Call it like any other async function:

```ts
const result = await classifyLeads.now(leads, 'id');
if (result.isError) throw new Error(result.error);
console.log(result.data[0].insights);
// -> { industry: 'Software', company_size: 'Mid-market' }
```

## Quick Start

1. Add the Nuabase SDK along with Zod:

```bash
npm install nuabase zod
```

2. Get your API key from the [Nuabase Console](https://console.nuabase.com/dashboard/api-keys/new).

3. Set `NUABASE_API_KEY` environment variable, or pass it directly in `new Nua({apiKey: "KEY"})`):

## Lead Enrichment Example

```ts
import { Nua } from 'nuabase';
import { z } from 'zod';

const nua = new Nua({ apiKey: 'API-KEY' });

const LeadInsights = z.object({
  company_name: z.string(),
  industry: z.string(),
  company_size: z.enum(['SMB', 'Mid-market', 'Enterprise']),
  recommended_follow_up: z.enum(['Call', 'Email', 'Event']),
});

const enrichLeads = nua.createArrayFn({
  prompt:
    'Summarize each inbound lead by extracting company_name, industry, company_size bucket (SMB, Mid-market, Enterprise), and the recommended_follow_up channel (Call, Email, or Event) based on their notes.',
  output: {
    name: 'leadInsights',
    schema: LeadInsights,
  },
});

const rows = [
  {
    leadId: 'lead-101',
    name: 'Acme Analytics',
    notes: 'Signed up after webinar, growth-stage SaaS, 80 employees. Wants a live demo next week.',
  },
  {
    leadId: 'lead-102',
    name: 'Bright Logistics',
    notes: 'Regional freight operator asking for pricing via email. 12 depots across the Midwest.',
  },
  {
    leadId: 'lead-103',
    name: 'Nimbus Retail',
    notes:
      'Enterprise retailer. Mentioned they will send the procurement team to our booth at NRF.',
  },
];

const response = await enrichLeads.now(rows, 'leadId'); // `leadId` is the primary key field

if (response.isError) {
  console.error(response.error);
  return;
}

response.data.forEach(({ id, leadInsights }) => {
  // leadInsights satisfies the LeadInsights schema
  console.log(id, leadInsights.company_name, leadInsights.industry, leadInsights.company_size);
});

console.log(response.data);
// -> [
//   {
//     id: 'lead-101',
//     leadInsights: {
//       company_name: 'Acme Analytics',
//       industry: 'Software',
//       company_size: 'Mid-market',
//       recommended_follow_up: 'Call',
//     },
//   },
//   // ...
// ];
```

`map(data, primaryKey)` submits an asynchronous mapping job. But `map.now(data, primaryKey)` is immediate — it waits for completion and returns the full result.

## Why Nuabase

- Type-safe from prompt to runtime: Zod schemas compile to JSON Schema, and the SDK re-validates every response before you see it.
- Zero glue code: Nuabase runs the queueing, retries, webhooks, SSE streaming, and polling so your application code stays clean.
- Built-in performance: granular caching, cost attribution, and usage metrics come for free on every request.
- Production visibility: every run shows up in the Nuabase dashboard with logs, prompt/response history, and tracing ids.

## API Response

Every call returns a discriminated union. When `isError` is `true`, you get a flat error object. Otherwise `isSuccess` is `true`, and `data` contains rows merged with your typed output—along with metadata for observability and caching.

**Success**

| Field               | Type                                                                     | Description                                                                 |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `isSuccess`         | `true`                                                                   | Indicates that the request completed successfully.                          |
| `data`              | `Array<{ [primaryKey]: unknown; [outputName]: z.infer<typeof output> }>` | Rows that merged the original primary key with the validated schema output. |
| `llmRequestId`      | `string`                                                                 | Unique identifier for tracing each Nuabase LLM execution.                   |
| `cacheHits`         | `number`                                                                 | Count of input rows served from Nuabase response cache.                     |
| `rowsWithNoResults` | `string[]`                                                               | Primary keys that could not be resolved by the model.                       |
| `isError`           | `false \| undefined`                                                     | Absent on success; included for type narrowing.                             |

**Error**

| Field     | Type     | Description                                              |
| --------- | -------- | -------------------------------------------------------- |
| `isError` | `true`   | Indicates the request failed.                            |
| `error`   | `string` | Message describing the error returned by the API or SDK. |

## SDK API

**`new Nua(config?)`**
Creates a client bound to your Nuabase account. Provide:

- `apiKey?: string` – API key for authentication. Defaults to `process.env.NUABASE_API_KEY`.
- `baseUrl?: string` – Override the API host. Defaults to `https://api.nuabase.com`.

**`nua.map({ name, prompt, output })`**
Declares a typed mapping function backed by Nuabase. Parameters:

- `name: string` – Label applied to the enriched payload in each response row (e.g., `result.data[i][name]`).
- `prompt: string` – Natural-language instructions sent to the LLM.
- `output: ZodSchema` – Zod schema describing the output shape. Nuabase stores the JSON Schema twin and validates responses against it before returning.

Returns a callable object (the mapper) with two entry points:

- `mapper(data, primaryKey)` – Submits the job asynchronously and returns immediately with metadata and eventual results.
- `mapper.now(data, primaryKey)` – Runs the job and waits until the full enriched result set is ready.

Both entry points expect:

- `data: Array<Record<string, unknown>>` – Rows you want Nuabase to enrich. Each row must include the primary key.
- `primaryKey: string` – Field name that uniquely identifies each row within `data`. The SDK throws if the field is missing on any item.

Both entry points resolve to either:

- **Success** – `{ isSuccess: true, data, llmRequestId, cacheHits, rowsWithNoResults }`.
- **Error** – `{ isError: true, error }`.

## Next Steps

- Create an API key or inspect request logs in the [Nuabase Console](https://console.nuabase.com/).
- Explore more SDK usage patterns (SSE streaming, webhooks, caching) in the full docs at https://docs.nuabase.com.

## Support

Email us at [hello@nuabase.com](mailto:hello@nuabase.com). On X at [@NuabaseHQ](x.com/NuabaseHQ).

## Credits

The template for this package comes from https://github.com/rtivital/ts-package-template

## License

MIT
