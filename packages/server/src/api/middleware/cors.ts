import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";

export function corsMiddleware(origins: string[]): MiddlewareHandler {
  return cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  });
}
