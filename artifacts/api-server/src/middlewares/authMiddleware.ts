import { type Request, type Response, type NextFunction } from "express";
import { authService, type AuthSession } from "../auth";

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: AuthSession;
    }

    interface AuthedRequest extends Request {
      user: AuthSession;
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  try {
    const session = await authService.getSession(req);
    if (session) {
      req.user = session;
    }
  } catch (err) {
    req.log.warn({ err }, "Failed to resolve session; continuing unauthenticated");
  }

  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
