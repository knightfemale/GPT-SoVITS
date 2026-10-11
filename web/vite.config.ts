import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base 由 VITE_BASE_PATH 控制（默认 "/"）；dev 时 /api 代理到本地后端。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH || "/";
  const apiTarget = env.VITE_API_PROXY || "http://127.0.0.1:9880";

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          // SSE 需要关闭缓冲；http-proxy 默认透传流，这里保持 ws=false
          ws: false,
        },
      },
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      target: "es2022",
      chunkSizeWarningLimit: 1200,
    },
  };
});
