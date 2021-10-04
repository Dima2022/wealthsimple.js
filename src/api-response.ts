import jwtDecode from 'jwt-decode';
import constants from './constants';
import { Auth, OtpOptions } from './types';

export default class ApiResponse {
  headers?: Headers;
  status: number;
  json?: Auth | Record<string, any> | null;

  constructor({ headers, status, json }: {
    headers?: Headers,
    status: number,
    json?: Auth | Record<string, any> | null,
  }) {
    this.headers = headers;
    this.status = status;
    this.json = json;
  }

  hasHeaders(...headerKeys: Array<string>) {
    return headerKeys.every((headerKey: string) => this.headers?.has(headerKey));
  }

  isSuccess() {
    return this.status >= 200 && this.status < 300;
  }

  setJson(json: Auth | Record<string, any>) {
    const parsedToken = json.access_token && this.parseJwt(json.access_token);
    if (parsedToken) {
      this.json = json;
      this.json.identity_canonical_id = (parsedToken as any).sub;
    } else {
      this.json = json;
    }
  }

  parseJwt(token: string) {
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  }

  getRateLimit() {
    if (this.hasHeaders('x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset')) {
      return {
        // string casting no bueno
        limit: parseInt(this.headers?.get('x-ratelimit-limit') + '', 10),
        remaining: parseInt(this.headers?.get('x-ratelimit-remaining') + '', 10),
        reset: new Date(Date.parse(this.headers?.get('x-ratelimit-reset') + '')),
      };
    }
    return null;
  }

  getOTP() {
    const otpString = this.headers?.get(constants.OTP_HEADER);
    if (!otpString) {
      return null;
    }
    const otp: OtpOptions = {};

    if (otpString.match(/^[a-z]{16}$/i)) {
      otp.recovery_code = otpString;
      return otp;
    }

    // Parse out OTP details into a more usable format. It is expected to be
    // in the format like `invalid` or `required; method=sms; digits=1234`
    otpString.split('; ').forEach((otpAttribute: string) => {
      if (otpAttribute.includes('=')) {
        const [key, value] = otpAttribute.split('=');
        otp[key] = value;
      } else {
        otp[otpAttribute] = true;
      }
    });
    return otp;
  }

  getOTPOptions() {
    const otpOptions = this.headers?.get(constants.OTP_OPTIONS_HEADER);
    if (!otpOptions) {
      return null;
    }

    return jwtDecode(otpOptions);
  }
  getOTPClaim() {
    const otpClaimString = this.headers?.get(constants.OTP_CLAIM_HEADER);
    if (!otpClaimString) {
      return null;
    }
    return otpClaimString;
  }

  getOtpAuthenticatedClaim() {
    const otpAuthenticatedClaimString = this.headers?.get(constants.OTP_AUTHENTICATED_CLAIM_HEADER);
    if (!otpAuthenticatedClaimString) {
      return null;
    }

    return otpAuthenticatedClaimString;
  }

  toString() {
    let message = `Response status: ${this.status}`;
    try {
      message += `, body: ${JSON.stringify(this.json).substring(0, 500)}`;
    } catch (e) {
      // Ignore JSON stringify errors.
    }
    return message;
  }
}
