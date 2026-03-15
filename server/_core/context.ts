import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// Single-user mode: auto-create and inject the owner user on every request.
const OWNER_OPEN_ID = "owner";

async function getOrCreateOwner(): Promise<User | null> {
  try {
    let user = await db.getUserByOpenId(OWNER_OPEN_ID);
    if (!user) {
      await db.upsertUser({
        openId: OWNER_OPEN_ID,
        name: "Owner",
        email: null,
        loginMethod: "single-user",
        lastSignedIn: new Date(),
        role: "admin" as const,
      });
      user = await db.getUserByOpenId(OWNER_OPEN_ID);
    }
    return user;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await getOrCreateOwner();
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
