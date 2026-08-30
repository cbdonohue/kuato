import type { NextConfig } from "next";
import {
  allowedDevOrigins,
  serverActionAllowedOrigins,
} from "./src/lib/dev-origins";

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins(),
  experimental: {
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins(),
    },
  },
};

export default nextConfig;
