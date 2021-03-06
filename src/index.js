'use strict';

const snakeCase = require('lodash.snakecase');
const mapKeys = require('lodash.mapkeys');
const { default: jwtDecode } = require('jwt-decode');
const ApiRequest = require('./api-request');
const ApiResponse = require('./api-response');
const ApiError = require('./api-error');
const constants = require('./constants');

const isDate = require('date-fns/is_date');
const isAfter = require('date-fns/is_after');
const dateParse = require('date-fns/parse');
const addSeconds = require('date-fns/add_seconds');

class Wealthsimple {
  constructor({
    clientId,
    clientSecret,
    fetchAdapter,
    auth = null,
    env = null,
    baseUrl = null,
    apiVersion = 'v1',
    onAuthSuccess = null,
    onTokenInfoSuccess = null,
    onAuthRevoke = null,
    onAuthInvalid = null,
    onResponse = null,
    verbose = false,
    deviceId = null,
    getFallbackProfile = null,
  }) {
    // OAuth client details:
    if (!clientId || typeof clientId !== 'string') {
      throw new Error('Please specify a valid OAuth \'clientId\'.');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // API environment (either 'sandbox' or 'production') and version:
      if (!constants.ENVIRONMENTS.includes(env)) {
        throw new Error(`Unrecognized 'env'. Please use one of: ${constants.ENVIRONMENTS.join(', ')}`);
      }
      this.env = env;
      this.baseUrl = `https://api.${env}.wealthsimple.com`;
    }

    // Setting to `true` will add request logging.
    this.verbose = verbose;

    if (!constants.API_VERSIONS.includes(apiVersion)) {
      throw new Error(`Unrecognized 'apiVersion'. Please use one of: ${constants.API_VERSIONS.join(', ')}`);
    }
    this.apiVersion = apiVersion;

    this.deviceId = deviceId;

    // Optionally allow a custom request adapter to be specified (e.g. for
    // react-native) which must implement the `fetch` interface:
    if (fetchAdapter) {
      this.fetchAdapter = fetchAdapter;
    } else {
      require('isomorphic-fetch');
      if (typeof window !== 'undefined') {
        // Browser: fixes the following error:
        // Error: TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
        this.fetchAdapter = window.fetch.bind(window);
      } else {
        // Node.js:
        this.fetchAdapter = fetch;
      }
    }

    // Optionally allow for callbacks on certain key events:
    this.onAuthSuccess = onAuthSuccess;
    this.onAuthRevoke = onAuthRevoke;
    this.onAuthInvalid = onAuthInvalid;
    this.onResponse = onResponse;
    this.onTokenInfoSuccess = onTokenInfoSuccess;

    this.request = new ApiRequest({ client: this });

    this.getFallbackProfile = getFallbackProfile;

    // Optionally pass in existing OAuth details (access_token + refresh_token)
    // so that the user does not have to be prompted to log in again:
    if (auth) {
      // Checks auth validity on bootstrap
      this.authPromise = this.accessTokenInfo(auth.access_token, false).then(() => {
        this.auth = auth;
      });
    } else {
      this.authPromise = new Promise(resolve => resolve(this.auth));
    }
  }

  // TODO: Should this have the side-effect of updating this.auth?
  accessTokenInfo(accessToken = null, withProfileHeader = true) {
    const token = accessToken || this.accessToken();
    if (!token) {
      return new Promise((resolve) => {
        if (this.onAuthInvalid) {
          this.onAuthInvalid({});
        }
        resolve();
      });
    }

    return this.get(this.tokenInfoUrl(token), {
      headers: { Authorization: `Bearer ${token}` },
      ignoreAuthPromise: true,
      checkAuthRefresh: false,
      withProfileHeader,
    }).then((response) => {
      this.auth.email = response.json.email;
      this.auth.profiles = response.json.profiles;
      this.auth.client_canonical_ids = response.json.client_canonical_ids;
      this.auth.suspended_profiles = response.json.suspended_profiles;

      if (this.auth.profiles && Object.keys(this.auth.profiles).length === 0) {
        this.auth = null;
        throw new Error('no_available_users');
      }

      return response.json;
    }).then((response) => {
      if (this.onTokenInfoSuccess) {
        this.onTokenInfoSuccess(this.auth);
      }

      return response;
    }).catch((error) => {
      if (!error.response) {
        throw error;
      }
      if (error.response.status === 401) {
        if (this.onAuthInvalid) {
          this.onAuthInvalid(error.response.json);
        }
        return null;
      }
      throw new ApiError(error.response);
    });
  }

  setUseIdentityToken(useIdentityToken) {
    this.useIdentityToken = useIdentityToken;
  }

  shouldUseIdentityToken(token = null) {
    const isJwtToken = (this.auth && this.isJwt(this.auth.access_token)) || (token && this.isJwt(token));
    return (this.useIdentityToken && (!this.auth || isJwtToken)) || isJwtToken;
  }

  isJwt(token) {
    try {
      jwtDecode(token);
      return true;
    } catch (e) {
      return false;
    }
  }

  tokenInfoUrl(token) {
    return this.shouldUseIdentityToken(token) ? '/oauth/v2/token/info' : '/oauth/token/info';
  }

  tokenUrl() {
    return this.shouldUseIdentityToken() ? '/oauth/v2/token' : '/oauth/token';
  }

  tokenRevokeUrl() {
    return this.shouldUseIdentityToken() ? '/oauth/v2/revoke' : '/oauth/revoke';
  }

  accessToken() {
    // info endpoint and POST response have different structures
    return this.auth && this.auth.access_token;
  }

  refreshToken() {
    return this.auth && this.auth.refresh_token;
  }

  userId() {
    if (this.auth) {
      return this.auth.profiles[this.currentProfile()].default;
    }
    return null;
  }

  currentProfile() {
    let profile;
    if (this.profile) {
      return this.profile;
    }
    if (this.getFallbackProfile) {
      profile = this.getFallbackProfile();
    }
    if (!profile && this.auth && this.auth.profiles) {
      return Object.keys(this.auth.profiles)[0];
    }
    return profile;
  }

  resourceOwnerId() {
    if (this.shouldUseIdentityToken()) return this.userId();
    return this.auth && this.auth.resource_owner_id;
  }

  clientCanonicalId() {
    if (this.auth) {
      if (this.auth.client_canonical_id) return this.auth.client_canonical_id;

      return this.auth.client_canonical_ids[this.currentProfile()].default;
    }
    return null;
  }

  isAuthExpired() {
    const date = this.authExpiresAt();
    if (date === null) {
      return false;
    }
    return isAfter(new Date(), date);
  }

  authExpiresAt() {
    if (!this.auth || !this.auth.expires_at) {
      return null;
    }
    if (!isDate(this.auth.expires_at)) {
      this.auth.expires_at = dateParse(this.auth.expires_at);
    }
    return this.auth.expires_at;
  }

  isAuthRefreshable() {
    return !!(this.auth && typeof this.auth.refresh_token === 'string');
  }

  authenticate(attributes) {
    const headers = {};
    if (attributes.otp) {
      headers[constants.OTP_HEADER] = attributes.otp;
      delete attributes.otp;
    }

    if (attributes.otpAuthenticatedClaim) {
      headers[constants.OTP_AUTHENTICATED_CLAIM_HEADER] = attributes.otpAuthenticatedClaim;
      delete attributes.otpAuthenticatedClaim;
    }

    if (attributes.otpClaim) {
      headers[constants.OTP_CLAIM_HEADER] = attributes.otpClaim;
      delete attributes.otpClaim;
    }

    if (attributes.oktaClaim) {
      headers[constants.OKTA_CLAIM_HEADER] = attributes.oktaClaim;
      delete attributes.oktaClaim;
    }

    if (attributes.otpPreferredDeviceType) {
      headers[constants.OTP_PREFERRED_DEVICE_TYPE] = attributes.otpPreferredDeviceType;
      delete attributes.otpPreferredDeviceType;
    }

    if (attributes.otpPreferredDeviceIdentifier) {
      headers[constants.OTP_PREFERRED_DEVICE_IDENTIFIER] = attributes.otpPreferredDeviceIdentifier;
      delete attributes.otpPreferredDeviceIdentifier;
    }

    let checkAuthRefresh = true;
    if (attributes.hasOwnProperty('checkAuthRefresh')) {
      ({ checkAuthRefresh } = attributes);
      delete attributes.checkAuthRefresh;
    }

    const body = {
      ...mapKeys(attributes, (v, k) => snakeCase(k)),
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    return this.post(this.tokenUrl(), { headers, body, checkAuthRefresh })
      .then((response) => {
        // Save auth details for use in subsequent requests:
        this.auth = response.json;
        this.authHeaders = response.headers;

        // calculate a hard expiry date for proper refresh logic across reload
        this.auth.expires_at = addSeconds(
          this.auth.created_at * 1000, // JS operates in milliseconds
          this.auth.expires_in,
        );

        return response.json.access_token;
      })
      .then((accessToken) => {
        if (attributes.grant_type !== 'client_credentials') {
          return this.accessTokenInfo(accessToken, false);
        }

        return null;
      })
      .then(() => {
        if (this.onAuthSuccess) {
          this.onAuthSuccess(this.auth);
        }

        return new ApiResponse({
          headers: this.authHeaders,
          status: 200,
          json: this.auth,
        });
      })
      .catch((error) => {
        if (error.response) {
          throw new ApiError(error.response);
        } else {
          throw error;
        }
      });
  }

  refreshAuth() {
    return this.authPromise.then(() => {
      if (!this.isAuthRefreshable()) {
        throw new Error('Must have a refresh_token set in order to refresh auth.');
      }
      return this.authenticate({
        grantType: 'refresh_token',
        refreshToken: this.refreshToken(),
        checkAuthRefresh: false,
      });
    });
  }

  revokeAuth() {
    const accessToken = this.accessToken();
    const body = {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      token: accessToken,
    };
    const tokenRevokeUrl = this.tokenRevokeUrl();

    this.auth = null;
    if (this.onAuthRevoke) {
      this.onAuthRevoke();
    }

    if (accessToken) {
      return this.post(tokenRevokeUrl, { body });
    }
    return new Promise((resolve) => {
      resolve();
    });
  }

  _fetch(method, path, {
    headers = {},
    query = {},
    body = null,
    checkAuthRefresh = true,
    withProfileHeader = true,
  }) {
    const executePrimaryRequest = () => {
      if (!headers.Authorization && this.accessToken()) {
        headers.Authorization = `Bearer ${this.accessToken()}`;
      }
      if (this.shouldUseIdentityToken() && withProfileHeader) {
        headers['X-WS-Profile'] = this.currentProfile();
      }
      return this.request.fetch({
        method, path, headers, query, body,
      });
    };

    if (checkAuthRefresh && this.isAuthRefreshable() && this.isAuthExpired()) {
      // Automatically refresh auth using refresh_token, then subsequently
      // perform the actual request:
      return this.refreshAuth().then(executePrimaryRequest);
    }
    return executePrimaryRequest().catch((error) => {
      if (error.response && error.response.status === 401 && this.onAuthInvalid) {
        this.onAuthInvalid(error.response.json);
      }
      throw error;
    });
  }
}

['get', 'patch', 'put', 'post', 'delete', 'head'].forEach((method) => {
  Wealthsimple.prototype[method] = function (path, options = {}) {
    // Make sure that constructor's context bootstrapping is complete before a
    // remote call is made
    if (options.ignoreAuthPromise || !this.authPromise) {
      return this._fetch(method.toUpperCase(), path, options);
    }
    return this.authPromise.then(() => this._fetch(method.toUpperCase(), path, options));
  };
});

module.exports = Wealthsimple;
