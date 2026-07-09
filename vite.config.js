import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cardWritePlugin } from "./src/dev/cardWritePlugin.js";

// For GitHub Pages project sites the app is served from
// https://<user>.github.io/<repo>/, so the build must use base "/<repo>/".
// Set VITE_BASE (e.g. in the Pages CI workflow) to that path. Local dev and
// user/org pages use "/". See README for details.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), cardWritePlugin()],
  build: {
    rollupOptions: {
      // Multi-page. index.html is the DEV HUB (lists builds + renders docs); the
      // original prototype moved to prototype.html. app = the v1 game, battle =
      // the combat-v2 squad prototype, combat = the v1 engine demo, editor = the
      // standalone editor.
      input: {
        main: "index.html",
        prototype: "prototype.html",
        combat: "combat.html",
        editor: "editor.html",
        app: "app.html",
        battle: "battle.html",
      },
    },
  },
});
