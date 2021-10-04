import ApiResponse from './api-response'

export type HttpMethod = 'GET' | 'PATCH' | 'PUT' | 'POST' | 'DELETE' | 'HEAD';
export type Profile = 'invest' | 'trade' | 'tax';
export type FetchWithVerb = (path: string, options: FetchOptions) => Promise<any>;

export interface Auth {
  created_at: number;
  email: string;
  profiles: Record<Profile, any>;
  access_token: string;
  refresh_token: string;
  expires_at: Date | string;
  expires_in: number;
  resource_owner_id: string;
  identity_canonical_id: string;
  client_canonical_id: string;
  client_canonical_ids: Record<Profile, any>
}

export interface WealthsimpleOptions {
  clientId: string,
  clientSecret?: string,
  fetchAdapter?: (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
  auth?: Auth | null,
  env?: 'development' | 'sandbox' | 'production' | null,
  baseUrl?: string | null,
  apiVersion?: 'v1' | null,
  onAuthSuccess?: ((auth: any) => void) | null,
  onTokenInfoSuccess?: ((auth: any) => void) | null,
  onAuthRevoke?: (() => void) | null,
  onAuthInvalid: ((response: Record<string | never, any> | null | undefined) => void) | null;
  onResponse?: ((response: ApiResponse) => void) | null,
  verbose?: boolean,
  deviceId?: string | null,
  getFallbackProfile?: (() => Profile) | null,
}

export interface FetchOptions2 extends FetchOptions {
  method: HttpMethod,
  path: string,
}

export interface FetchOptions {
  headers?: Record<string, any>;
  query?: any;
  body?: any;
  checkAuthRefresh?: boolean;
  withProfileHeader?: boolean;
  ignoreAuthPromise?: boolean;
}

export type OtpOptions = Record<string, any>
