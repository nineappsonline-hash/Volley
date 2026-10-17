/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return ["football", "basketball", "padel", "swimming"].map(sport => ({
      source: `/solutions/${sport}`,
      destination: "/solutions",
      permanent: true,
    }));
  },
};

export default nextConfig;
