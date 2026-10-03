import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating "N" dev badge sits on the sidebar's account card; the dev
  // overlay still reports errors.
  devIndicators: false,
};

export default nextConfig;
