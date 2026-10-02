import { Inngest } from "inngest";

const isDev = process.env.NODE_ENV !== "production";

/**
 * In development this points at the local Inngest dev server
 * (default http://localhost:8288 — override with INNGEST_BASE_URL).
 * Start it with: npm run inngest
 */
export const inngest = new Inngest({
  id: "ai-decision-flow",
  isDev,
  ...(isDev
    ? { baseUrl: process.env.INNGEST_BASE_URL ?? "http://localhost:8288" }
    : {}),
});
