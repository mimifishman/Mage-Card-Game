import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.delete("/admin/nuke-users", async (req, res) => {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.CLERK_SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await db.execute(sql`DELETE FROM game_actions_log`);
  await db.execute(sql`DELETE FROM game_state`);
  await db.execute(sql`DELETE FROM match_players`);
  await db.execute(sql`DELETE FROM matches`);
  await db.execute(sql`DELETE FROM users`);

  const [{ count }] = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
  return res.json({ ok: true, usersRemaining: Number(count) });
});

export default router;
