import type { FrontConfig } from "../../secrets/front.config";
import type { Branding } from "../vite-plugin-branding";

declare global {
    const __GLOBAL_CONFIG__: FrontConfig;
    const __BRANDING__: Branding;
}

export {};