/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "jqysnlkykznwdonicwsm.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "playza.nineapps.online" }],
        destination: "https://playza.life/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.playza.life" }],
        destination: "https://playza.life/:path*",
        permanent: true,
      },
      ...["football", "basketball", "padel", "swimming"].map(sport => ({
        source: `/solutions/${sport}`,
        destination: "/solutions",
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
