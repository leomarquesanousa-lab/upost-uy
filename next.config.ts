
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.UPOST_EDITORIAL_PREVIEW === '1' ? '.next-editorial-preview' : '.next',
  async redirects() {
    return [
      {source:'/radio',destination:'/radios',permanent:false},
      {source:'/contato',destination:'/contacto',permanent:false},
      {source:'/tv-ao-vivo',destination:'/videos',permanent:false},
      {source:'/programacao',destination:'/radios',permanent:false},
      {source:'/programas/:path*',destination:'/radios',permanent:false},
      {source:'/apresentadores/:path*',destination:'/especialistas',permanent:false},
    ];
  },
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
