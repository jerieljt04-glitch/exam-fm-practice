/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `katex` and `react-katex` ship untranspiled ESM/JSX that Next must compile.
  transpilePackages: ["katex", "react-katex"],
};

export default nextConfig;
