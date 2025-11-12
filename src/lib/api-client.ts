import { resolveConfigValue } from './env';
import { NuabaseError, parseErrorResponse } from './error-response';
import { getErrorMessageFromException } from './error-utils';

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined' && !!window.document;

type NuabaseApiKeyConfig = {
  apiKey?: string;
  fetchToken?: never;
  baseUrl?: string;
};

type NuabaseTokenConfig = {
  fetchToken: () => Promise<string>;
  apiKey?: never;
  baseUrl?: string;
};

export type NuabaseConfig = NuabaseApiKeyConfig | NuabaseTokenConfig;

// TODO: Check the expiry time of the token whenever we get a new token, and if it is in the immediate future, queue up a new token refresh.
// It is possible to read JWT token values from the client side without HS256 key (https://gemini.google.com/app/87e08fd79ca59719)
class NuabaseAuthTokenManager {
  private readonly apiKey?: string;
  private readonly fetchToken?: () => Promise<string>;
  private apiToken?: string;
  private pendingTokenPromise?: Promise<string>;

  constructor(config: NuabaseConfig) {
    this.apiKey = resolveConfigValue(config, 'apiKey', 'NUABASE_API_KEY') || undefined;
    this.fetchToken = config.fetchToken;

    if (this.apiKey && this.fetchToken) {
      throw new Error('Provide either an apiKey or a fetchToken function, but not both.');
    }

    if (!this.apiKey && !this.fetchToken) {
      throw new Error(
        'Authentication is required. Provide config.apiKey/NUABASE_API_KEY or a fetchToken function.'
      );
    }

    if (this.apiKey && isBrowserEnvironment()) {
      throw new Error(
        'found config.apiKey. It is a private secret that must only be used in server environments.'
      );
    }
  }

  async getToken(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    if (!this.fetchToken) {
      throw new Error('Unable to resolve API token because no fetchToken function is configured.');
    }

    if (this.apiToken) {
      return this.apiToken;
    }

    if (!this.pendingTokenPromise) {
      this.pendingTokenPromise = this.fetchToken()
        .then((token) => {
          if (!token) {
            throw new Error('fetchToken must resolve a non-empty API token.');
          }

          this.apiToken = token;

          return token;
        })
        .finally(() => {
          this.pendingTokenPromise = undefined;
        });
    }

    return this.pendingTokenPromise;
  }
}

export class NuabaseAPIClient {
  private readonly baseUrl: string;
  private readonly authTokenManager: NuabaseAuthTokenManager;

  constructor(config: NuabaseConfig = {}) {
    this.baseUrl =
      resolveConfigValue(config, 'baseUrl', 'NUABASE_API_URL') || 'https://api.nuabase.com';
    this.authTokenManager = new NuabaseAuthTokenManager(config);
  }

  async request(
    method: 'GET' | 'POST',
    urlPath: string,
    params?: object
  ): Promise<NuabaseError | unknown> {
    const url = `${this.baseUrl}/${urlPath}`;

    let response: Response;

    const hasBody = method !== 'GET' && params !== undefined;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.authTokenManager.getToken()}`,
    };

    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(params) : undefined,
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
