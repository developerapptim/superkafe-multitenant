/**
 * @superkafe/shared - API Response Types
 */

/** Standard API success response */
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success?: boolean;
}

/** Paginated API response */
export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Standard API error response */
export interface ApiError {
  error: string;
  message: string;
  code?: string;
  statusCode?: number;
}
