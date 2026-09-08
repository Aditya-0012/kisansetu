import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

/** Validates req.body against a zod schema and replaces it with the parsed
 * (and therefore type-safe + coerced) result. Validation failures are
 * ZodErrors, caught by the shared errorHandler. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query) as any;
    next();
  };
}
