import { defineConfig } from "vite";
import solidPlugin from "vite-plussgin-solid";

export default defineConfig({
    plugins: [solidPlugin()],
    server: {
        port: 3000,
    },
});