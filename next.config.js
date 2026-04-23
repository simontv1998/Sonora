/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["music-metadata"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

module.exports = nextConfig;
