import type { Request, Response } from "express";

export interface AuthSession {
  providerUserId: string;
  displayName: string;
  internalUserId: string;
}

export interface AuthService {
  getSession(req: Request): Promise<AuthSession | null>;
  handleCallback(req: Request, res: Response): Promise<void>;
}
