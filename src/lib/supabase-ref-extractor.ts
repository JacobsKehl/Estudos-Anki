import { URL } from "url";

/**
 * Extracts the Supabase project reference ID from any Supabase connection string
 * (Direct, Session Pooler, Transaction Pooler) or API URL.
 *
 * Direct URL: postgresql://user:pass@db.<ref>.supabase.co:5432/postgres
 * Pooler URL: postgresql://postgres.<ref>:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
 * HTTP API URL: https://<ref>.supabase.co
 *
 * Returns null if ref cannot be conclusively identified.
 */
export function extractProjectRef(connectionString: string): string | null {
  if (!connectionString || typeof connectionString !== "string") {
    return null;
  }

  const str = connectionString.trim();
  if (!str) return null;

  try {
    const parsed = new URL(str);
    const host = parsed.hostname;
    const user = parsed.username;

    // Case 1: Direct hostname -> db.<ref>.supabase.co
    if (host.startsWith("db.") && host.endsWith(".supabase.co")) {
      const parts = host.split(".");
      if (parts.length >= 4 && parts[1]) {
        return parts[1];
      }
    }

    // Case 2: Pooler username -> postgres.<ref> or <user>.<ref>
    if (user && user.includes(".")) {
      const userParts = user.split(".");
      if (userParts.length === 2 && userParts[1]) {
        return userParts[1];
      }
    }

    // Case 3: Supabase API URL -> https://<ref>.supabase.co
    if (host.endsWith(".supabase.co") && !host.startsWith("db.")) {
      const ref = host.replace(".supabase.co", "");
      if (ref && !ref.includes(".")) {
        return ref;
      }
    }

    return null;
  } catch {
    return null;
  }
}
