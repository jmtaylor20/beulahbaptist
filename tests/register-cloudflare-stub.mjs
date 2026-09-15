/** Installs the loader hook. Used via `node --import`. */
import { register } from "node:module";
register("./cloudflare-loader.mjs", import.meta.url);
