/**
 * Material Applicator Utility
 *
 * Applies material configurations to loaded 3D models
 */

import * as THREE from 'three';
import materialConfigData from '../../translinkconfig/mesh_material_config.json';

const materialsConfig = materialConfigData.materials as Record<string, any>;

export function applyMaterials(model: THREE.Group): void {
    model.traverse((child: THREE.Object3D) => {
        if (!(child as THREE.Mesh).isMesh) return;

        const mesh = child as THREE.Mesh;
        const name = mesh.name;

        let materialConfig: any | null = null;

        // Apply material based on mesh name
        switch (name) {
            case 'Bolt_01':
            case 'Bolt_02':
            case 'Bolt_03':
            case 'Bolt_04':
                materialConfig = materialsConfig.bolt;
                break;
            case 'Fuel_Head':
                materialConfig = materialsConfig.fuelHead;
                break;
            case 'Fuel_Head_cover':
                materialConfig = materialsConfig.fuelHeadCover;
                break;
            case 'Text_Translink_pro':
            case 'Logo_Translink_pro':
                materialConfig = materialsConfig.brandLogo;
                break;
            case 'Harness':
                materialConfig = materialsConfig.harness;
                break;
            case 'Prob':
                materialConfig = materialsConfig.prob;
                break;
            case 'Base':
                materialConfig = materialsConfig.base;
                break;
            case 'Filter':
                materialConfig = materialsConfig.filter;
                break;
            case 'Filter_Wireframe':
                materialConfig = materialsConfig.filterWireframe;
                break;
            case 'Fuel_tank':
                materialConfig = materialsConfig.fuelTank;
                break;
            case 'Belt':
                materialConfig = materialsConfig.belt;
                break;
            case 'light':
                materialConfig = materialsConfig.light;
                break;
            case 'virtual_studio':
                materialConfig = materialsConfig.virtualStudio;
                break;
            case 'Truck':
            case 'Cab_door':
            case 'Cab_Door_glass_frame':
                materialConfig = materialsConfig.truckBody;
                break;
            case 'Cab_Glass':
            case 'Cab_door_glass':
                materialConfig = materialsConfig.truckGlass;
                break;
            case 'Truck_Lights':
                materialConfig = materialsConfig.truckLights;
                break;
            case 'axle001_Front_wheel_Left':
            case 'axle001_Front_wheel_Right':
            case 'axle002_wheel_Both_Left_Right':
            case 'axle003_wheel_Both_Left_Right':
                // Check if name contains 'wheel' part for tire vs hub?
                // For simplicity, using truckTires for these
                materialConfig = materialsConfig.truckTires;
                break;
            case 'Ground_point':
            case 'Wall_point':
            case 'virtual_studio_Ground_Spline_Circle_collisions':
                mesh.visible = false;
                return;
            default:
                if (
                    name.includes('_3D_point') ||
                    name.includes('_Ref_Point') ||
                    name.toLowerCase().includes('guide') ||
                    name.toLowerCase().includes('marker') ||
                    name.toLowerCase().includes('point')
                ) {
                    mesh.visible = false;
                    return;
                }
                break;
        }

        if (materialConfig) {
            const props = { ...materialConfig };

            // Handle hex strings from JSON
            if (typeof props.color === 'string' && props.color.startsWith('#')) {
                props.color = new THREE.Color(props.color);
            }

            if (typeof props.emissive === 'string' && props.emissive.startsWith('#')) {
                props.emissive = new THREE.Color(props.emissive);
            }

            const material = new THREE.MeshPhysicalMaterial(props);

            if (name === 'virtual_studio') {
                material.side = THREE.DoubleSide;
            }

            mesh.material = material;
            mesh.material.needsUpdate = true;
        }

        // mesh.visible = true; // RECOVERY: Let World.ts handle authoritative visibility
        mesh.frustumCulled = false;
        // All real-geometry meshes both cast AND receive shadows so inter-component
        // self-shadowing works throughout S1-S10. virtual_studio is the only mesh
        // excluded from casting (it is a backdrop, not an object).
        mesh.castShadow = name !== 'virtual_studio';
        mesh.receiveShadow = true; // was: name === 'virtual_studio' — blocked all self-shadowing
    });

    // Call the theme applicator immediately to apply starting theme properties
    const isDark = document.documentElement.classList.contains('dark');
    applyThemeToMaterials(model, isDark);
}

/**
 * Dynamically updates all mesh materials based on whether the dark theme is active.
 * Implements high-end space-graphite obsidian truck panels, dark polished steel,
 * glowing red fuel cover accents, and neon tech brand logos.
 */
export function applyThemeToMaterials(model: THREE.Group, isDark: boolean): void {
    model.traverse((child: THREE.Object3D) => {
        if (!(child as THREE.Mesh).isMesh) return;

        const mesh = child as THREE.Mesh;
        const name = mesh.name;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        if (!mat || !mat.isMeshStandardMaterial) return;

        switch (name) {
            case 'virtual_studio':
                mat.color.set(isDark ? '#0c0e12' : '#f5f1e8');
                mat.roughness = 1.0;
                mat.metalness = 0.0;
                break;

            case 'Truck':
            case 'Cab_door':
            case 'Cab_Door_glass_frame':
                mat.color.set(isDark ? '#1d2330' : '#d8d4d0');
                mat.roughness = isDark ? 0.24 : 0.95;
                mat.metalness = isDark ? 0.72 : 0.0;
                mat.envMapIntensity = isDark ? 2.6 : 0.5;
                if ('clearcoat' in mat) {
                    mat.clearcoat = 1.0;
                    mat.clearcoatRoughness = isDark ? 0.08 : 0.05;
                }
                break;

            case 'Fuel_tank':
                mat.color.set(isDark ? '#1a1f29' : '#d1d5db');
                mat.roughness = isDark ? 0.2 : 0.38;
                mat.metalness = 0.95;
                mat.envMapIntensity = isDark ? 1.6 : 0.3;
                break;

            case 'Fuel_Head_cover':
                mat.color.set('#c0202f');
                mat.roughness = isDark ? 0.1 : 0.72;
                mat.metalness = isDark ? 0.3 : 0.0;
                if ('clearcoat' in mat) {
                    mat.clearcoat = isDark ? 0.9 : 0.1;
                    mat.clearcoatRoughness = isDark ? 0.1 : 0.35;
                }
                if (mat.emissive) {
                    mat.emissive.set(isDark ? '#c0202f' : '#000000');
                    mat.emissiveIntensity = isDark ? 0.25 : 0.0;
                }
                break;

            case 'Fuel_Head':
                mat.color.set(isDark ? '#13161d' : '#161616');
                mat.roughness = isDark ? 0.2 : 0.35;
                mat.metalness = isDark ? 0.6 : 0.4;
                if ('clearcoat' in mat) {
                    mat.clearcoat = isDark ? 0.8 : 0.6;
                    mat.clearcoatRoughness = isDark ? 0.1 : 0.1;
                }
                break;

            case 'Prob':
                mat.color.set('#fafafa');
                mat.roughness = isDark ? 0.05 : 0.1;
                mat.metalness = 0.95;
                mat.envMapIntensity = isDark ? 1.6 : 1.0;
                break;

            case 'Base':
                mat.color.set(isDark ? '#1a1e26' : '#2a2a2a');
                mat.roughness = isDark ? 0.25 : 0.4;
                mat.metalness = isDark ? 0.85 : 0.8;
                break;

            case 'Filter_Wireframe':
                mat.color.set('#c0202f');
                if (mat.emissive) {
                    mat.emissive.set(isDark ? '#c0202f' : '#000000');
                    mat.emissiveIntensity = isDark ? 0.4 : 0.0;
                }
                break;

            case 'Text_Translink_pro':
            case 'Logo_Translink_pro':
                mat.color.set('#ffffff');
                if (mat.emissive) {
                    mat.emissive.set('#ffffff');
                    mat.emissiveIntensity = isDark ? 1.3 : 0.8;
                }
                break;

            case 'Bolt_01':
            case 'Bolt_02':
            case 'Bolt_03':
            case 'Bolt_04':
                mat.color.set(isDark ? '#1f2937' : '#2a2a2a');
                mat.roughness = isDark ? 0.2 : 0.4;
                mat.metalness = isDark ? 0.9 : 0.8;
                break;
        }

        mat.needsUpdate = true;
    });
}

