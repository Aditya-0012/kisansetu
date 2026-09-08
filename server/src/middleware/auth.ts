import { NextFunction, Request, Response } from "express";
import { UserRole } from "@kisansetu/shared";
import { ApiError } from "../utils/apiError";
import { JwtError, verifyToken } from "../utils/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized();
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role as UserRole };
    next();
  } catch (err) {
    if (err instanceof JwtError) throw ApiError.unauthorized("Invalid or expired session");
    throw err;
  }
}

/** Attaches req.user if a valid token is present, but never rejects the
 * request — for endpoints (like the public marketplace) that behave
 * slightly differently for logged-in users without requiring login. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(header.slice("Bearer ".length));
      req.user = { id: payload.sub, role: payload.role as UserRole };
    } catch {
      // ignore invalid token on optional routes
    }
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`This action requires role: ${roles.join(" or ")}`);
    }
    next();
  };
}
