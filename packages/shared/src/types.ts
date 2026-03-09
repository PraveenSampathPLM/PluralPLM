export type Industry = "CPG" | "CHEMICAL" | "TYRE" | "POLYMER" | "PAINT" | "FOOD_BEVERAGE";

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: string;
}
