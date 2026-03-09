import type { AuthTokenPayload } from "@plm/shared";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export {};
