import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware, populateUser } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { assertClerkKeysForProduction } from "./lib/clerkKeyValidation";

// ── Clerk key preflight ──────────────────────────────────────────────────────
// In production, both keys must be the live pair of the user's own Clerk
// production instance. A test key here means the deployment secrets are still
// synced to the workspace (development) values, so the server exits instead of
// serving a broken auth experience.
assertClerkKeysForProduction(
  process.env.CLERK_SECRET_KEY,
  "CLERK_SECRET_KEY",
  process.env.CLERK_PUBLISHABLE_KEY,
  "CLERK_PUBLISHABLE_KEY",
);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);
app.use(populateUser);

app.use("/api", router);

export default app;
