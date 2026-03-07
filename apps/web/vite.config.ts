import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const allowedHosts = ["phpsage.localtest.me"];

if (process.env.PHPSAGE_PUBLIC_HOST) {
  allowedHosts.push(process.env.PHPSAGE_PUBLIC_HOST);
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts
  }
});
