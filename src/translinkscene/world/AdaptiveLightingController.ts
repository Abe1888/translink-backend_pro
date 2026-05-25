import * as THREE from 'three';

/**
 * AdaptiveLightingController
 *
 * Dynamically modulates light intensities based on background theme and scroll progress.
 * Implements premium cybertech dual-tone studio lighting.
 */
export class AdaptiveLightingController {
    private ambientLight: THREE.AmbientLight | null = null;
    private rimLight: THREE.DirectionalLight | null = null;
    private keyLight: THREE.DirectionalLight | null = null;
    private fillLight: THREE.DirectionalLight | null = null;
    private topLight: THREE.DirectionalLight | null = null;
    private scene: THREE.Scene | null = null;

    private baseAmbientIntensity: number = 0.2;
    private baseRimIntensity: number = 0.25;
    private baseKeyIntensity: number = 1.15;
    private baseFillIntensity: number = 0.35;
    private baseTopIntensity: number = 0.08;

    constructor(
        options: {
            ambient?: THREE.AmbientLight;
            rim?: THREE.DirectionalLight;
            key?: THREE.DirectionalLight;
            fill?: THREE.DirectionalLight;
            top?: THREE.DirectionalLight;
            scene?: THREE.Scene;
        } = {}
    ) {
        if (options.ambient) {
            this.ambientLight = options.ambient;
            this.baseAmbientIntensity = this.ambientLight.intensity;
        }
        if (options.rim) {
            this.rimLight = options.rim;
            this.baseRimIntensity = this.rimLight.intensity;
        }
        if (options.key) {
            this.keyLight = options.key;
            this.baseKeyIntensity = this.keyLight.intensity;
        }
        if (options.fill) {
            this.fillLight = options.fill;
            this.baseFillIntensity = this.fillLight.intensity;
        }
        if (options.top) {
            this.topLight = options.top;
            this.baseTopIntensity = this.topLight.intensity;
        }
        if (options.scene) {
            this.scene = options.scene;
        }
    }

    /**
     * Update light intensities and colors based on global theme and scroll progress
     * @param p Current scroll progress (0-1)
     */
    update(p: number): void {
        const isDark = document.documentElement.classList.contains('dark');
        const lerpFactor = 0.08; // Smooth transitions

        // 1. Ambient Light
        // In dark mode: lift to 0.24 to preserve volume fill. In light mode: 0.20 for soft fill.
        const targetAmbientIntensity = isDark ? 0.24 : 0.20;
        if (this.ambientLight) {
            this.ambientLight.intensity = THREE.MathUtils.lerp(
                this.ambientLight.intensity,
                targetAmbientIntensity,
                lerpFactor
            );
        }

        // 2. Rim Light (crimson brand red)
        // In dark mode: boost to 1.25 for crisp solid crimson edge outlines. In light mode: subtle 0.25.
        const targetRimIntensity = isDark ? 1.25 : 0.25;
        if (this.rimLight) {
            this.rimLight.intensity = THREE.MathUtils.lerp(
                this.rimLight.intensity,
                targetRimIntensity,
                lerpFactor
            );
        }

        // 3. Key Light
        // Soften slightly in dark mode to prevent over-exposure, keep strong in light mode.
        const targetKeyIntensity = isDark ? 0.95 : 1.15;
        if (this.keyLight) {
            this.keyLight.intensity = THREE.MathUtils.lerp(
                this.keyLight.intensity,
                targetKeyIntensity,
                lerpFactor
            );
        }

        // 4. Fill Light
        // In dark mode: gorgeous cybertech teal color `#06b6d4` with high intensity (0.65)
        // In light mode: soft sky blue `#d9e6ff` with moderate intensity (0.35)
        const targetFillIntensity = isDark ? 0.65 : 0.35;
        const targetFillColor = new THREE.Color(isDark ? '#06b6d4' : '#d9e6ff');
        if (this.fillLight) {
            this.fillLight.intensity = THREE.MathUtils.lerp(
                this.fillLight.intensity,
                targetFillIntensity,
                lerpFactor
            );
            this.fillLight.color.lerp(targetFillColor, lerpFactor);
        }

        // 5. Top Light
        // In dark mode: boost to 0.65 to create stunning specular contours on the cab roof, doors, and hood.
        // In light mode: subtle 0.08.
        const targetTopIntensity = isDark ? 0.65 : 0.08;
        if (this.topLight) {
            this.topLight.intensity = THREE.MathUtils.lerp(
                this.topLight.intensity,
                targetTopIntensity,
                lerpFactor
            );
        }

        // 6. Environment Intensity
        // In dark mode: boost to 1.6 for stunning glossy reflections. In light mode: soft 0.6.
        if (this.scene) {
            const targetEnvIntensity = isDark ? 1.6 : 0.6;
            const currentEnvIntensity = (this.scene as any).environmentIntensity ?? 0.6;
            (this.scene as any).environmentIntensity = THREE.MathUtils.lerp(
                currentEnvIntensity,
                targetEnvIntensity,
                lerpFactor
            );
        }
    }
}

