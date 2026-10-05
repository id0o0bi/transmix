import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, loadEnv } from "vite"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const rpcTarget = env.VITE_RPC_PROXY_TARGET ?? "http://127.0.0.1:9091"

  return {
    base: "/transmission/web/",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/transmission/rpc": {
          target: rpcTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      proxy: {
        "/transmission/rpc": {
          target: rpcTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
