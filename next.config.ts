import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist', 'pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/legacy/build/pdf.worker.mjs'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
