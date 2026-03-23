import type { Request, Response } from "express";

export interface AuthSession {
  providerUserId: string;
  displayName: string;
  internalUserId: string;
}

export interface AuthService {
  getSession(req: Request): Promise<AuthSession | null>;
  handleCallback(req: Request, res: Response): Promise<void>;

  handleLogin(req: Request, res: Response): Promise<void>;
  handleLogout(req: Request, res: Response): Promise<void>;

  handleMobileTokenExchange(req: Request, res: Response): Promise<void>;
  handleMobileLogout(req: Request, res: Response): Promise<void>;
}
