import { NuabaseError, parseErrorResponse } from './error-response';
import { getErrorMessageFromException } from './error-utils';

export type NuabaseConfig = {
  apiKey?: string;
  baseUrl?: string;
};

export class NuabaseAPIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: NuabaseConfig = {}) {
    this.apiKey = config.apiKey || process.env.NUABASE_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.nuabase.com';

    if (!this.apiKey) {
      throw new Error(
        'API key is required. Provide it via config.apiKey or NUABASE_API_KEY environment variable.'
      );
    }
  }

  async request(urlPath: string, params: object): Promise<NuabaseError | unknown> {
    const url = `${this.baseUrl}/${urlPath}`;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(params),
      });
    } catch (e) {
      return { error: `Error calling Nuabase API: ${getErrorMessageFromException(e)}` };
    }

    let result: unknown;

    if (!response.ok) {
      return await parseErrorResponse(response, urlPath);
    }

    try {
      result = await response.json();
    } catch {
      return { error: 'Invalid response received from Nuabase API call, unable to parse' };
    }

    return result;
  }
}
