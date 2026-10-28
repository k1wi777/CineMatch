import type { NextConfig } from "next";

// La API corre en otro puerto: Next la expone en el mismo origen, así el navegador no necesita CORS.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @cinematch/shared se consume como TypeScript fuente desde el workspace.
  transpilePackages: ["@cinematch/shared"],
  poweredByHeader: false,
  // Los paquetes del workspace usan imports NodeNext ("./x.js" que apunta a "./x.ts"); webpack necesita este alias.
  webpack(config) {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
