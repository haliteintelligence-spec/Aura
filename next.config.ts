import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fragrantica.com" },
      { protocol: "https", hostname: "**.basenotes.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.parfumo.de" },
      { protocol: "https", hostname: "**.sephora.com" },
      { protocol: "https", hostname: "**.nordstrom.com" },
      { protocol: "https", hostname: "**.macys.com" },
      { protocol: "https", hostname: "**.ulta.com" },
      { protocol: "https", hostname: "**.bloomingdales.com" },
      { protocol: "https", hostname: "**.neimarmarcus.com" },
      { protocol: "https", hostname: "**.google.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "fimgs.net" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
