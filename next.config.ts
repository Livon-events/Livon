import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sharp's native binding outside the Turbopack graph (Next 16.2 +
  // sharp 0.35 could crash mid-upload with "libvipsVersion is not a function").
  serverExternalPackages: ["sharp"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      {
        protocol: "https",
        hostname: "zzgnkqpkmumpwjpsbbil.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "vlfmgceimhduemsslhsg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;