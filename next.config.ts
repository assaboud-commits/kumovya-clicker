import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_PAGES_BUILD === 'true';

const nextConfig: NextConfig = isGitHubPages ? {
  output: 'export',
  basePath: '/kumovya-clicker',
  trailingSlash: true,
  images: { unoptimized: true },
} : {};

export default nextConfig;
