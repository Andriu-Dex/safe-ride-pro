import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['10.79.20.241'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@saferidepro/shared-types': path.resolve(
        __dirname,
        '../../packages/shared-types/dist/index.js',
      ),
    };

    return config;
  },
};

export default nextConfig;
