import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "tesseract.js", "tesseract.js-core"],
  outputFileTracingIncludes: {
    "/api/jadual/analyze": [
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
      "./node_modules/wasm-feature-detect/**",
      "./vendor/tessdata/**",
    ],
    "/api/jadual/analyze/**": [
      "./node_modules/tesseract.js/**",
      "./node_modules/tesseract.js-core/**",
      "./node_modules/wasm-feature-detect/**",
      "./vendor/tessdata/**",
    ],
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
