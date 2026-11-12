import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// BASE_PATH is "/gridlingo/" on GitHub Pages (set by the workflow) and "/" everywhere else.
export default defineConfig({
    base: process.env.BASE_PATH ?? "/",
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
