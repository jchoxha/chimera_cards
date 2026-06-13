import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages project sites the app is served from
// https://<user>.github.io/<repo>/, so the build must use base "/<repo>/".
// Set VITE_BASE (e.g. in the Pages CI workflow) to that path. Local dev and
// user/org pages use "/". See README for details.
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
