import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { runWorkflow } from "@/inngest/functions";

// The Inngest dev server talks to the app through this route:
//   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runWorkflow],
});
