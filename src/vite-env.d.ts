/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PORT: string;
    readonly VITE_HOST: string;
    readonly VITE_MODEL_PATH: string;
    readonly VITE_HDR_PATH: string;
    readonly VITE_SENSOR_PATH: string;
    readonly VITE_TRUCK_PATH: string;
    readonly VITE_DEBUG: string;
    readonly VITE_CAMERA_DEBUG: string;
    readonly VITE_MAX_PIXEL_RATIO: string;
    readonly VITE_ENABLE_SHADOWS: string;
    readonly VITE_ASSET_VERSION: string;
    /**
     * Hostname of the Render backend service (no protocol, no trailing slash).
     * Used by TranslinkVoiceManager to build WSS connection URLs when the
     * frontend is served from a different origin than the backend (e.g. cPanel
     * frontend at translinket.com + Render backend at translink-voice-web.onrender.com).
     *
     * Set in .env.production before running `npm run build`.
     * Leave blank in .env for local dev (Vite's WS plugin handles /ws/live directly).
     *
     * @example "translink-voice-web.onrender.com"
     */
    readonly VITE_WS_BACKEND_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Audio file imports
declare module '*.mp3?url' {
    const src: string;
    export default src;
}

declare module '*.mp3' {
    const src: string;
    export default src;
}

/**
 * Vite ?raw imports — returns the file content as a plain UTF-8 string
 * at build time. Used by TranslinkAIBrain to import knowledge.md
 * without hardcoding its contents in TypeScript source.
 */
declare module '*.md?raw' {
    const content: string;
    export default content;
}
