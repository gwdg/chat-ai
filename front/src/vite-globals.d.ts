import type { FrontConfig } from "../../secrets/front.config";

declare global {
    const __GLOBAL_CONFIG__: FrontConfig;
}

export {};