import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** URL 유효성 검증 (http/https 여부) */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// URL이 올바른 형식일 때만 클라이언트 생성, 그렇지 않으면 null
export const supabase: SupabaseClient | null =
  isValidUrl(supabaseUrl) && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
