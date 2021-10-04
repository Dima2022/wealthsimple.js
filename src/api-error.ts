import ApiResponse from './api-response';

export default class ApiError extends Error {
  response : ApiResponse

  constructor(response: ApiResponse) {
    super(response.toString());

    this.response = response;

    Error.captureStackTrace?.(this, ApiError);
  }
}
