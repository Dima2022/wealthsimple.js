// @ts-ignore idk
import queryString from 'query-string';
import ApiError from './api-error';
import ApiResponse from './api-response';
import { FetchOptions2 } from './types';
import Wealthsimple from '.';

export default class ApiRequest {
  client: Wealthsimple;

  constructor({ client }: { client: Wealthsimple }) {
    this.client = client;
  }

  fetch({
    method, headers = {}, path, query = {}, body = null,
  }: FetchOptions2) {
    let newHeaders = headers;
    let newPath = path;
    let newBody = body;

    if (query && Object.keys(query).length > 0) {
      newPath += `?${queryString.stringify(query)}`;
    }
    const url = this.urlFor(newPath);

    // All request bodies (for now) are JSON:
    if (newBody && typeof newBody !== 'string') {
      newBody = JSON.stringify(newBody);
    }

    newHeaders = {
      ...newHeaders,
      ...this._defaultHeaders(),
    };

    if (this.client.verbose) {
      const logs = [`${method}: ${url}`];
      if (newBody) {
        logs.push(newBody);
      }
      console.info(`${logs.join('\n')}\n`);
    }

    return this.client.fetchAdapter(url, {
      headers: newHeaders,
      method,
      body: newBody,
      credentials: 'same-origin',
    }).then(this._handleResponse.bind(this));
  }

  urlFor(path: string) {
    let newPath = path;
    if (!newPath.startsWith('/')) {
      newPath = `/${newPath}`;
    }

    return `${this.client.baseUrl}/${this.client.apiVersion}${newPath}`;
  }

  // Given a Response object ( https://developer.mozilla.org/en-US/docs/Web/API/Response )
  // either parse it and wrap it in our own ApiResponse class, or throw an ApiError.
  _handleResponse(response: Response) {
    const apiResponse = new ApiResponse({
      status: response.status,
      headers: response.headers,
    });
    return response.json()
      .then((json: Record<string, any>) => {
        apiResponse.setJson(json);
      }).catch(() => {
        // Fail silently if response body is not present or malformed JSON:
        apiResponse.json = null;
      }).then(() => {
        if (this.client.onResponse) {
          this.client.onResponse(apiResponse);
        }
        if (!response.ok) {
          throw new ApiError(apiResponse);
        }
        return apiResponse;
      });
  }

  _defaultHeaders() {
    const h = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Date: new Date().toUTCString(),
      'X-Wealthsimple-Client': 'wealthsimple.js',
    };
    if (this.client.deviceId) {
      // @ts-ignore bad
      h['X-WS-Device-ID'] = this.client.deviceId;
    }
    return h;
  }
}
