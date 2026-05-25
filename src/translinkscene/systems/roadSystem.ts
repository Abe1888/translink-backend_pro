/**
 * RoadSystem - Animated road lane lines for S4-1 truck scene
 *
 * Truck width (Z-axis): ~0.5 scene units
 * - Real semi-truck: ~2.6m wide
 * - Scale factor: 0.5 / 2.6 approx 0.19
 *
 * Real-world road standards (scaled):
 * - Lane width: 3.6m -> 0.70 scene units (wider for visual clarity)
 * - Edge line: 15cm -> 0.03 scene units
 * - Center dash: 3m -> 0.58 scene units
 * - Dash gap: 9m -> 1.74 scene units
 *
 * Truck orientation:
 * - Front (driving direction): +X axis
 * - Road lanes run parallel to X-axis
 */

import * as THREE from 'three';

export class RoadSystem {
    private scene: THREE.Scene;
    private laneLines: THREE.Mesh[] = [];
    private groundPlane: THREE.Mesh | null = null;
    private isAnimating = false;

    // Road configuration - scaled to truck model
    private readonly ROAD_Y = -0.35; // Ground level
    private readonly ROAD_SPEED = 4.0; // Slower for realism

    // Theme-aware lane color — resolved at init and on theme change
    private laneColor: number = 0xffffff;
    private readonly DARK_LANE_COLOR = 0x6b7a8a;  // muted steel gray
    private readonly LIGHT_LANE_COLOR = 0xffffff; // white for light bg

    // Truck-scaled geometry
    private readonly TRUCK_WIDTH = 0.5; // Measured truck Z-span
    private readonly LANE_WIDTH = 1.0; // Increased - ~2x truck width per lane
    private readonly EDGE_LINE_THICKNESS = 0.025; // Visible edge lines
    private readonly CENTER_LINE_THICKNESS = 0.018; // Slightly thinner center
    private readonly DASH_LENGTH = 0.5; // Proportional dash
    private readonly DASH_GAP = 1.5; // 1:3 ratio (standard)
    private readonly ROAD_LENGTH = 30; // Extended road

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        // Resolve color based on current theme at construction time
        this.laneColor = this.getThemeAwareColor();
    }

    /** Returns the appropriate lane color based on active html.dark class */
    private getThemeAwareColor(): number {
        const isDark = document.documentElement.classList.contains('dark');
        return isDark ? this.DARK_LANE_COLOR : this.LIGHT_LANE_COLOR;
    }

    /**
     * Re-apply theme colors to all existing lane materials.
     * Call this when the theme toggle fires a theme-change event.
     */
    applyThemeColors(): void {
        const color = this.getThemeAwareColor();
        this.laneColor = color;
        this.laneLines.forEach((line) => {
            const mat = line.material as THREE.MeshBasicMaterial;
            mat.color.set(color);
            // Also tighten opacity in dark mode for subtlety
            const isDark = document.documentElement.classList.contains('dark');
            const baseOpacity = line.userData.solid
                ? (isDark ? 0.35 : 0.92)
                : (isDark ? 0.25 : 0.80);
            mat.opacity = baseOpacity;
            mat.needsUpdate = true;
        });
    }

    /**
     * Initialize road lane lines
     * Two-lane highway scaled to truck dimensions
     */
    init(): void {
        // Truck center position
        const truckX = 0.36;
        const truckZ = -0.6;

        // Total road width: 2 lanes
        const halfRoadWidth = this.LANE_WIDTH;

        // Ground plane: always visible — opacity driven externally via setGroundPlaneOpacity()
        // so it receives shadows throughout the full 0%-100% scroll range.
        const groundGeometry = new THREE.PlaneGeometry(this.ROAD_LENGTH * 2, halfRoadWidth * 4);
        const groundMaterial = new THREE.ShadowMaterial({
            opacity: 0.0, // starts at 0; World.ts ramps it up from first frame
            color: 0x000000,
            transparent: true,
        });
        this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.set(truckX, this.ROAD_Y - 0.001, truckZ);
        this.groundPlane.receiveShadow = true;
        this.groundPlane.visible = true; // always in scene — shadow is invisible until opacity > 0
        this.scene.add(this.groundPlane);

        // MeshBasicMaterial: unlit — renders the exact colour value regardless of scene lighting.
        const isDark = document.documentElement.classList.contains('dark');
        const edgeOpacity   = isDark ? 0.35 : 0.92;
        const centerOpacity = isDark ? 0.25 : 0.80;

        const edgeLineMaterial = new THREE.MeshBasicMaterial({
            color: this.laneColor,
            transparent: true,
            opacity: edgeOpacity,
            side: THREE.DoubleSide,
        });

        const centerLineMaterial = new THREE.MeshBasicMaterial({
            color: this.laneColor,
            transparent: true,
            opacity: centerOpacity,
            side: THREE.DoubleSide,
        });

        // Left edge line - solid
        const leftEdge = new THREE.Mesh(
            new THREE.PlaneGeometry(this.ROAD_LENGTH, this.EDGE_LINE_THICKNESS),
            edgeLineMaterial.clone()
        );
        leftEdge.rotation.x = -Math.PI / 2;
        leftEdge.position.set(truckX, this.ROAD_Y, truckZ - halfRoadWidth);
        leftEdge.userData.lane = 'left-edge';
        leftEdge.userData.solid = true;
        leftEdge.receiveShadow = true;
        leftEdge.visible = false;
        this.scene.add(leftEdge);
        this.laneLines.push(leftEdge);

        // Right edge line - solid
        const rightEdge = new THREE.Mesh(
            new THREE.PlaneGeometry(this.ROAD_LENGTH, this.EDGE_LINE_THICKNESS),
            edgeLineMaterial.clone()
        );
        rightEdge.rotation.x = -Math.PI / 2;
        rightEdge.position.set(truckX, this.ROAD_Y, truckZ + halfRoadWidth);
        rightEdge.userData.lane = 'right-edge';
        rightEdge.userData.solid = true;
        rightEdge.receiveShadow = true;
        rightEdge.visible = false;
        this.scene.add(rightEdge);
        this.laneLines.push(rightEdge);

        // Center dashed line
        const dashPattern = this.DASH_LENGTH + this.DASH_GAP;
        const numDashes = Math.ceil(this.ROAD_LENGTH / dashPattern) + 4;
        const startX = truckX - this.ROAD_LENGTH / 2;

        for (let i = 0; i < numDashes; i++) {
            const dash = new THREE.Mesh(
                new THREE.PlaneGeometry(this.DASH_LENGTH, this.CENTER_LINE_THICKNESS),
                centerLineMaterial.clone()
            );
            dash.rotation.x = -Math.PI / 2;
            dash.position.set(startX + i * dashPattern, this.ROAD_Y + 0.001, truckZ);
            dash.userData.lane = 'center';
            dash.userData.dashIndex = i;
            dash.receiveShadow = true;
            dash.visible = false;
            this.scene.add(dash);
            this.laneLines.push(dash);
        }

        console.log('[RoadSystem] Truck-scaled road:', {
            truckWidth: this.TRUCK_WIDTH,
            laneWidth: this.LANE_WIDTH,
            roadWidth: halfRoadWidth * 2,
            elements: this.laneLines.length,
        });
    }

    /**
     * Update road animation
     */
    update(delta: number): void {
        if (!this.isAnimating) return;

        const dashPattern = this.DASH_LENGTH + this.DASH_GAP;
        const resetThreshold = -this.ROAD_LENGTH / 2 - dashPattern;

        this.laneLines.forEach((line) => {
            if (line.userData.solid) return;

            line.position.x -= delta * this.ROAD_SPEED;

            if (line.position.x < resetThreshold) {
                line.position.x += this.ROAD_LENGTH + dashPattern * 2;
            }
        });
    }

    /**
     * Set visibility of lane lines only.
     * The ground plane is intentionally excluded — its opacity is controlled
     * by setGroundPlaneOpacity() so it persists across all scroll sections.
     */
    setVisible(visible: boolean): void {
        this.laneLines.forEach((line) => {
            line.visible = visible;
        });
        // NOTE: groundPlane.visible is NOT changed here.
        this.isAnimating = visible;
    }

    /**
     * Set opacity for lane line fade effects (section 47%-70%)
     */
    setOpacity(opacity: number): void {
        const isDark = document.documentElement.classList.contains('dark');
        this.laneLines.forEach((line) => {
            const mat = line.material as THREE.MeshBasicMaterial;
            const baseOpacity = line.userData.solid
                ? (isDark ? 0.35 : 0.92)
                : (isDark ? 0.25 : 0.80);
            mat.opacity = opacity * baseOpacity;
        });
        // NOTE: ground plane opacity is managed separately via setGroundPlaneOpacity()
    }

    /**
     * Set ground plane shadow opacity (0-100% scroll range)
     * Called every frame by World.ts — decoupled from lane line visibility.
     * @param opacity  0.0 (no shadow) → 1.0 (full shadow); internally clamped to max 0.35
     */
    setGroundPlaneOpacity(opacity: number): void {
        if (!this.groundPlane) return;
        const mat = this.groundPlane.material as THREE.ShadowMaterial;
        mat.opacity = Math.max(0, Math.min(0.35, opacity));
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.laneLines.forEach((line) => {
            this.scene.remove(line);
            line.geometry.dispose();
            (line.material as THREE.MeshBasicMaterial).dispose();
        });
        this.laneLines = [];

        if (this.groundPlane) {
            this.scene.remove(this.groundPlane);
            this.groundPlane.geometry.dispose();
            (this.groundPlane.material as THREE.ShadowMaterial).dispose();
            this.groundPlane = null;
        }
    }
}
