import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  base: "/filters/",
  server: {
    https: true,
    host: "0.0.0.0",
  },
  plugins: [mkcert()],
  build: {
    target: "es2022",
  },
});
