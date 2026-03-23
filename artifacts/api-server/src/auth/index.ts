import type { AuthService } from "./types";
import { ReplitAuthService } from "./providers/replit";

export type { AuthSession, AuthService } from "./types";

function createAuthService(): AuthService {
  const provider = process.env.AUTH_PROVIDER ?? "replit";

  switch (provider) {
    case "replit":
      return new ReplitAuthService();
    default:
      throw new Error(
        `Unknown AUTH_PROVIDER "${provider}". Supported values: "replit". ` +
          `To add a new provider, create a class implementing AuthService and register it here.`,
      );
  }
}

export const authService: AuthService = createAuthService();
