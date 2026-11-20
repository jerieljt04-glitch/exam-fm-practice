/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Browser tests build into their own folder so they never disturb the desktop app's build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `katex` and `react-katex` ship untranspiled ESM/JSX that Next must compile.
  transpilePackages: ["katex", "react-katex"],
};

export default nextConfig;
