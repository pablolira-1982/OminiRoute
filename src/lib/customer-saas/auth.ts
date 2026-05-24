import { createSupabaseAnonServerClient } from "@/lib/supabase/server";

export interface CustomerPortalAuthResult {
  userId: string;
  email: string | null;
}

export async function requireCustomerPortalAuth(
  request: Request
): Promise<CustomerPortalAuthResult | null> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) return null;

  const jwt = authHeader.slice(7).trim();
  if (!jwt) return null;

  const supabase = createSupabaseAnonServerClient();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user?.id) return null;

  return {
    userId: data.user.id,
    email: data.user.email || null,
  };
}
