import * as THREE from 'three';
import { noise } from '../utils/noise';
import { deviceOptimization } from './responsiveSystem';

export class TerrainSystem {
    private scene: THREE.Scene;
    private terrainMesh: THREE.Mesh | null = null;
    private isVisible: boolean = true;
    private currentOpacityMultiplier: number = 1.0;
    private xOffset: number = 0.0;

    // Dimensions centered around the road system:
    // Road center: truckX = 0.36, truckZ = -0.6
    private readonly TERRAIN_X = 0.36;
    private readonly TERRAIN_Y = -0.36; // 0.01 below ROAD_Y = -0.35
    private readonly TERRAIN_Z = -0.6;

    // Theme-aware colors and opacities
    // Dark mode: Muted futuristic slate steel gray / blue-gray (brightened for contrast on 0x0c0e12)
    private readonly COLOR_DARK = 0x4b5e6e;  
    // Light mode: Muted warm gray to blend beautifully with the cream background
    private readonly COLOR_LIGHT = 0x8a8578; 
    
    // Fine-wire grid requires slightly higher base opacities for visual definition
    private readonly OPACITY_DARK = 0.46;  // Elevated for dark mode to counter extreme fragment blending contrast losses
    private readonly OPACITY_LIGHT = 0.12;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Initialize noise seed
     */
    private initNoise(): void {
        noise.seed(42); // Fixed seed for consistent landscape features
    }

    /**
     * Compute terrain height using multi-octave Perlin noise.
     * Frequencies are mathematically matched to the Vision page TopoGrid scale.
     */
    private getTerrainHeight(x: number, z: number): number {
        // Noise scales: Tuned to represent dense, rolling terrain waves matching original Vision
        const scaleX = 0.25;
        const scaleZ = 0.25;
        
        const nx = x * scaleX;
        const nz = z * scaleZ;

        // Base multi-octave noise formula from getRealHeight (Vision page)
        let h = noise.perlin2(nx, nz) * 3.5;
        h += noise.perlin2(nx * 4, nz * 4) * 0.8;
        h += Math.abs(noise.perlin2(nx * 12, nz * 12)) * 0.3;
        h += noise.perlin2(nx * 32, nz * 32) * 0.06;

        // Flatten valleys below a threshold, just like in original Vision getRealHeight
        if (h < -1.2) {
            h = -1.2 + (h + 1.2) * 0.1;
        }

        // Center on road Z coordinate (-0.6)
        const distToRoad = Math.abs(z - this.TERRAIN_Z);
        
        // Flatten completely within 1.2 units of road center (Z from -1.8 to 0.6)
        // and gradually transition to full height over another 1.8 units.
        const roadFade = Math.min(Math.max((distToRoad - 1.2) / 1.8, 0), 1);
        h *= roadFade;

        // Apply a height multiplier to match the smaller 1-unit model coordinate system
        return h * 0.35;
    }

    /**
     * Initialize the wireframe terrain mesh with a high-fidelity custom ShaderMaterial
     */
    init(): void {
        this.initNoise();

        // Determine resolution based on device capabilities
        const isMobile = deviceOptimization.isMobile();
        const width = 60;
        const length = 80;
        
        // Denser, finer wireframe grid to match the original high-resolution aesthetic
        const resW = isMobile ? 80 : 150;
        const resL = isMobile ? 100 : 200;

        const geometry = new THREE.PlaneGeometry(width, length, resW, resL);
        geometry.rotateX(-Math.PI / 2);

        // Apply displacement
        const pos = geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            pos.setY(i, this.getTerrainHeight(x, z));
        }
        geometry.computeVertexNormals();

        // Custom ShaderMaterial for dynamic edge, road, depth, height and fog fading
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uBgColor:     { value: new THREE.Color() },
                uValleyColor: { value: new THREE.Color() },
                uPeakColor:   { value: new THREE.Color() },
                uOpacity:     { value: 1.0 },
                uIsDark:      { value: 0.0 },
                // Animated terrain scroll — incremented every frame in update()
                uXOffset:     { value: 0.0 },
            },
            vertexShader: `
                uniform float uXOffset;

                varying vec3 vNormal;
                varying vec3 vLocalPos;
                varying vec3 vScrolledLocalPos;
                varying vec3 vViewPosition;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vLocalPos = position;
                    // Pass a scrolled copy so edge-fades and height colours
                    // drift with the terrain in the fragment shader
                    vScrolledLocalPos = position + vec3(uXOffset, 0.0, 0.0);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3  uBgColor;
                uniform vec3  uValleyColor;
                uniform vec3  uPeakColor;
                uniform float uOpacity;
                uniform float uIsDark;
                uniform float uXOffset;

                varying vec3 vNormal;
                varying vec3 vLocalPos;
                varying vec3 vScrolledLocalPos;
                varying vec3 vViewPosition;

                void main() {
                    // 1. Edge Border Dissolve — uses SCROLLED X so the
                    //    fade window travels with the terrain flow
                    float edgeX = abs(vScrolledLocalPos.x) / 30.0;
                    float edgeZ = abs(vScrolledLocalPos.z) / 40.0;
                    float edgeFade = smoothstep(1.0, 0.65, max(edgeX, edgeZ));

                    // 2. Road Masking (Z never changes, use static vLocalPos)
                    float distToRoad = abs(vLocalPos.z);
                    float roadFade = smoothstep(1.5, 9.0, distToRoad);

                    // 3. Camera Depth Fog (Near-fade, Far-fade)
                    float dist = length(vViewPosition);
                    float nearFade = smoothstep(0.4, 3.5, dist);
                    float farFade = 1.0 - smoothstep(10.0, 26.0, dist);

                    // 4. Height Valley Suppression — height is static geometry
                    float heightFade = smoothstep(-0.6, 1.2, vLocalPos.y);
                    heightFade = mix(0.18, 1.0, heightFade);

                    // 5. Height-based Color Gradient
                    float heightT = smoothstep(-0.25, 0.65, vLocalPos.y);
                    vec3 baseColor = mix(uValleyColor, uPeakColor, heightT);

                    // 6. Simulated Studio Lighting Highlight
                    vec3 normal   = normalize(vNormal);
                    vec3 lightDir = normalize(vec3(0.4, 0.9, 0.3));
                    float ndl = max(dot(normal, lightDir), 0.0);
                    vec3 shineColor = mix(uPeakColor, vec3(1.0, 1.0, 1.0), 0.5);
                    vec3 finalColor = mix(baseColor, shineColor,
                                         ndl * (uIsDark > 0.5 ? 0.75 : 0.3));

                    // Combine all atmospheric modulators
                    float finalAlpha =
                        edgeFade * roadFade * nearFade * farFade * heightFade * uOpacity;

                    if (finalAlpha < 0.001) discard;

                    gl_FragColor = vec4(finalColor, finalAlpha);
                }
            `,
            wireframe: true,
            transparent: true,
            depthWrite: false, // Prevents wireframe from blocking main assets
            depthTest: true,
        });

        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.position.set(this.TERRAIN_X, this.TERRAIN_Y, this.TERRAIN_Z);
        this.terrainMesh.renderOrder = -2; // Render first, before road ground plane
        this.terrainMesh.visible = this.isVisible;

        this.scene.add(this.terrainMesh);

        // Apply initial colors and uniforms
        this.applyThemeColors();

        console.log('[TerrainSystem] Dynamic Shader wireframe terrain initialized:', {
            width,
            length,
            resW,
            resL,
            position: [this.TERRAIN_X, this.TERRAIN_Y, this.TERRAIN_Z],
        });
    }

    /**
     * Advance the slow-motion scroll animation every frame.
     *
     * Speed design:
     *   RoadSystem ROAD_SPEED = 4.0 units/sec (dashes scrolling)
     *   Terrain scroll = 0.12 units/sec  (~3 % of road speed)
     *
     * The uXOffset uniform is passed to the vertex shader which shifts the
     * scrolled sample coordinate sent to the fragment shader. This keeps all
     * edge-fade dissolves, height colours, and road-masking visually drifting
     * in perfect sync with the road without any CPU vertex re-bake.
     *
     * Wrapping every 60 units (terrain width) keeps the offset small and
     * avoids float-precision drift on long sessions.
     */
    update(delta: number): void {
        if (!this.terrainMesh || !this.isVisible) return;

        // Super slow motion: ~3 % of ROAD_SPEED so it feels like distant terrain
        const TERRAIN_SCROLL_SPEED = 0.12;
        this.xOffset -= delta * TERRAIN_SCROLL_SPEED;

        // Wrap after one full terrain width (60 units) — seamless on Perlin noise
        if (this.xOffset < -60) this.xOffset += 60;

        // Push to GPU — zero CPU geometry work
        const mat = this.terrainMesh.material as THREE.ShaderMaterial;
        mat.uniforms.uXOffset.value = this.xOffset;
    }

    /**
     * Set terrain visibility
     */
    setVisible(visible: boolean): void {
        this.isVisible = visible;
        if (this.terrainMesh) {
            this.terrainMesh.visible = visible;
        }
    }

    /**
     * Set opacity multiplier for fade-in/fade-out transitions
     */
    setOpacity(opacity: number): void {
        this.currentOpacityMultiplier = opacity;
        this.applyThemeColors();
    }

    /**
     * Apply the correct color and opacity depending on the active theme
     */
    applyThemeColors(): void {
        if (!this.terrainMesh) return;

        const isDark = document.documentElement.classList.contains('dark');
        
        // Muted opacities for seamless blending
        const baseOpacity = isDark ? this.OPACITY_DARK : this.OPACITY_LIGHT;

        const mat = this.terrainMesh.material as THREE.ShaderMaterial;
        const colorBg = new THREE.Color(isDark ? 0x0c0e12 : 0xf5f1e8);
        const colorValley = new THREE.Color(isDark ? 0x111622 : 0x8a8578);
        const colorPeak = new THREE.Color(isDark ? 0x06b6d4 : 0xc7bead);

        mat.uniforms.uBgColor.value.copy(colorBg);
        mat.uniforms.uValleyColor.value.copy(colorValley);
        mat.uniforms.uPeakColor.value.copy(colorPeak);
        mat.uniforms.uOpacity.value = baseOpacity * this.currentOpacityMultiplier;
        mat.uniforms.uIsDark.value = isDark ? 1.0 : 0.0;
    }

    /**
     * Clean up resources on destroy
     */
    dispose(): void {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            (this.terrainMesh.material as THREE.Material).dispose();
            this.terrainMesh = null;
        }
    }
}
