import type { NextConfig } from "next";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: 'standalone',
  // Optional same-origin GoTrue proxy for MCP OAuth clients (D3).
  // Set CHYTR_MCP_AUTH_SERVER=https://app.chytr.ai/auth/v1 after verifying issuer rewrite.
  async rewrites() {
    if (!supabaseUrl) return [];
    return [
      {
        source: "/auth/v1/:path*",
        destination: `${supabaseUrl}/auth/v1/:path*`,
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: `${supabaseUrl}/auth/v1/.well-known/oauth-authorization-server`,
      },
    ];
  },
};

export default nextConfig;
