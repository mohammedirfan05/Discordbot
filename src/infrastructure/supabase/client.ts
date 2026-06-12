import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import type { Database } from "./database.types.js";

// Service-role key bypasses Row Level Security — safe for server-side bot use only.
// Never expose this key in a browser or client-side context.
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);
