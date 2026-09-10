/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep parallel dev/test servers from writing to the same webpack cache.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
