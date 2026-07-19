/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required on Next 14 for instrumentation.ts (Sentry server init).
    instrumentationHook: true,
  },
};

export default nextConfig;
