export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}

export function isProductionDeployment() {
  const vercelEnvironment = process.env.VERCEL_ENV;
  if (vercelEnvironment) {
    return vercelEnvironment === "production";
  }
  return process.env.NODE_ENV === "production";
}

export function getSiteUrl() {
  const vercelUrl = process.env.VERCEL_URL;
  if (process.env.VERCEL_ENV === "preview" && vercelUrl) {
    return new URL(`https://${vercelUrl}`).origin;
  }

  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) {
    if (isProductionDeployment()) {
      throw new Error("Missing NEXT_PUBLIC_SITE_URL.");
    }
    return "http://localhost:3000";
  }

  const url = new URL(configuredUrl);
  if (
    isProductionDeployment() &&
    url.protocol !== "https:"
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }

  return url.origin;
}
