import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const allowedHosts = ["phpsage.localtest.me"];
const apiProxyTarget = process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:8080";

if (process.env.PHPSAGE_PUBLIC_HOST) {
  allowedHosts.push(process.env.PHPSAGE_PUBLIC_HOST);
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true
      },
      "/healthz": {
        target: apiProxyTarget,
        changeOrigin: true
      }
    }
  }
});
