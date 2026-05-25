import gsap from 'gsap';
import { TranslinkLanguageController } from '../controllers/TranslinkLanguageController';

/**
 * TranslinkLiveFeedPopup
 *
 * A futuristic cybernetic HUD-style diagnostics interface.
 * Implements advanced 3D parallax spring interactions, holographic scan sweeps, 
 * rotating radar reticles, and custom industrial technical layouts.
 */
export class TranslinkLiveFeedPopup {
    private element: HTMLElement | null = null;

    constructor(
        private id: string,
        private title: string,
        private description: string,
        private tags: string[]
    ) {}

    private static injectStyles(): void {
        const id = 'tl-popup-css';
        if (document.getElementById(id)) return;
        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
            @keyframes hudLineDraw {
                from { stroke-dashoffset: 200; }
                to { stroke-dashoffset: 0; }
            }
            @keyframes hudPulse {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 0.8; }
            }
            @keyframes scanningLine {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
            }
            @keyframes blinkDot {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
            }
            @keyframes spinClockwise {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes spinCounterClockwise {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(-360deg); }
            }
            
            /* HUD Core Panel Framework */
            .hud-frame {
                position: relative;
                border-radius: 0px;
                overflow: hidden;
                transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1);
            }
            
            /* Dark Mode: Red HUD Theme */
            html.dark .hud-frame {
                background: rgba(10, 0, 0, 0.98);
                border: 2px solid #ef4444;
                box-shadow: 
                    0 25px 50px -12px rgba(0, 0, 0, 0.95);
                --theme-hud-accent: #ef4444;
                --theme-hud-grid-color: rgba(239, 68, 68, 0.45);
            }
            html.dark .hud-frame:hover {
                border-color: #ff0000;
                box-shadow: 
                    0 30px 60px -10px rgba(0, 0, 0, 0.98);
            }

            /* Light Mode: Black HUD Theme */
            html:not(.dark) .hud-frame {
                background: rgba(252, 251, 250, 0.96);
                border: 2px solid #161616;
                box-shadow: 
                    0 24px 55px -12px rgba(22, 22, 22, 0.18),
                    0 4px 18px rgba(22, 22, 22, 0.06);
                --theme-hud-accent: #161616;
                --theme-hud-grid-color: rgba(22, 22, 22, 0.25);
            }
            html:not(.dark) .hud-frame:hover {
                box-shadow: 
                    0 32px 64px -10px rgba(22, 22, 22, 0.26);
            }

            /* HUD Corner Tech Brackets (L-shapes) */
            .hud-bracket {
                position: absolute;
                width: 14px;
                height: 14px;
                pointer-events: none;
                z-index: 40;
                transition: border-color 0.4s ease;
            }
            .bracket-tl { top: 0; left: 0; border-top: 3px solid transparent; border-left: 3px solid transparent; }
            .bracket-tr { top: 0; right: 0; border-top: 3px solid transparent; border-right: 3px solid transparent; }
            .bracket-bl { bottom: 0; left: 0; border-bottom: 3px solid transparent; border-left: 3px solid transparent; }
            .bracket-br { bottom: 0; right: 0; border-bottom: 3px solid transparent; border-right: 3px solid transparent; }

            html.dark .hud-bracket {
                border-color: #ff0000;
            }
            html:not(.dark) .hud-bracket {
                border-color: #161616;
            }

            /* Hologram Scanline Sweeper */
            .hologram-scan {
                position: absolute;
                left: 0;
                width: 100%;
                height: 6px;
                animation: scanningLine 3.2s linear infinite;
                pointer-events: none;
                z-index: 5;
                transition: background 0.4s, box-shadow 0.4s;
            }
            html.dark .hologram-scan {
                background: linear-gradient(180deg, transparent, rgba(239, 68, 68, 0.45), transparent);
                box-shadow: none;
            }
            html:not(.dark) .hologram-scan {
                background: linear-gradient(180deg, transparent, rgba(22, 22, 22, 0.25), transparent);
                box-shadow: 0 0 8px rgba(22, 22, 22, 0.4);
            }

            /* Glow text styling */
            .hud-glow-text {
                transition: color 0.4s;
            }
            html.dark .hud-glow-text {
                color: #ff3b3b;
                text-shadow: none;
            }
            html:not(.dark) .hud-glow-text {
                color: #161616;
                text-shadow: none;
            }

            /* Technical Reticles */
            .hud-reticle-circle {
                transition: border-color 0.4s;
            }
            html.dark .hud-reticle-circle {
                border-color: rgba(239, 68, 68, 0.45) !important;
            }
            html:not(.dark) .hud-reticle-circle {
                border-color: rgba(22, 22, 22, 0.15) !important;
            }

            /* Technical Crosshair Lines */
            .hud-crosshair-line {
                transition: background 0.4s;
            }
            html.dark .hud-crosshair-line {
                background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.45), transparent) !important;
            }
            html:not(.dark) .hud-crosshair-line {
                background: linear-gradient(90deg, transparent, rgba(22, 22, 22, 0.15), transparent) !important;
            }
            .hud-crosshair-line-v {
                transition: background 0.4s;
            }
            html.dark .hud-crosshair-line-v {
                background: linear-gradient(180deg, transparent, rgba(239, 68, 68, 0.45), transparent) !important;
            }
            html:not(.dark) .hud-crosshair-line-v {
                background: linear-gradient(180deg, transparent, rgba(22, 22, 22, 0.15), transparent) !important;
            }

            /* Coordinate labels */
            .hud-coords {
                transition: color 0.4s;
            }
            html.dark .hud-coords {
                color: #ef4444 !important;
                opacity: 1;
            }
            html:not(.dark) .hud-coords {
                color: rgba(22, 22, 22, 0.5);
            }

            /* Top Bar and Metadata */
            .hud-top-meta {
                transition: color 0.4s;
            }
            html.dark .hud-top-meta {
                color: #ef4444 !important;
                opacity: 1;
            }
            html:not(.dark) .hud-top-meta {
                color: rgba(22, 22, 22, 0.7);
            }

            /* Bottom Panel (Technical Text Container) */
            .hud-info-panel {
                transition: background-color 0.4s, border-color 0.4s;
            }
            html.dark .hud-info-panel {
                background: rgba(18, 2, 2, 0.9) !important;
                border: 1px solid rgba(239, 68, 68, 0.35) !important;
            }
            html:not(.dark) .hud-info-panel {
                background: rgba(240, 240, 240, 0.75) !important;
                border: 1px solid rgba(22, 22, 22, 0.1) !important;
            }

            /* Live status ticker text */
            .hud-status-ticker {
                transition: color 0.4s;
            }
            html.dark .hud-status-ticker {
                color: #ff3b3b !important;
            }
            html:not(.dark) .hud-status-ticker {
                color: #161616;
            }

            /* Status pulsing dot */
            html.dark .hud-status-dot {
                background-color: #ff0000 !important;
                box-shadow: none;
            }
            html:not(.dark) .hud-status-dot {
                background-color: #161616 !important;
                box-shadow: none;
            }

            /* Futuristic Capsule Tags */
            .hud-tag {
                transition: all 0.3s ease;
            }
            html.dark .hud-tag {
                background: transparent;
                color: #ef4444;
                border: 1.5px solid #ef4444;
            }
            html.dark .hud-tag:hover {
                background: #ef4444;
                color: #ffffff;
                border-color: #ef4444;
            }
            html:not(.dark) .hud-tag {
                background: transparent;
                color: #161616;
                border: 1px solid rgba(22, 22, 22, 0.3);
            }
            html:not(.dark) .hud-tag:hover {
                background: #161616;
                color: #ffffff;
                border-color: #161616;
            }

            /* Bottom progress loading bar */
            .hud-progress-fill {
                transition: all 1s ease;
            }
            html.dark .hud-progress-fill {
                background: #ef4444;
                box-shadow: none;
            }
            html:not(.dark) .hud-progress-fill {
                background: #161616;
                box-shadow: none;
            }

            /* Close Button Styling */
            .hud-close-btn {
                transition: all 0.3s ease;
            }
            html.dark .hud-close-btn {
                background: rgba(12, 2, 2, 0.95);
                border: 2px solid #ef4444;
                color: #ef4444;
            }
            html.dark .hud-close-btn:hover {
                background: #ef4444;
                color: #ffffff;
                border-color: #ef4444;
                box-shadow: none;
            }
            html:not(.dark) .hud-close-btn {
                background: rgba(255, 255, 255, 0.9);
                border: 2.5px solid #161616;
                color: #161616;
            }
            html:not(.dark) .hud-close-btn:hover {
                background: #161616;
                color: #ffffff;
                border-color: #161616;
            }

            /* Body Text scrollbar adjustments */
            .hud-desc-scroll::-webkit-scrollbar {
                width: 3px;
            }
            .hud-desc-scroll::-webkit-scrollbar-track {
                background: transparent;
            }
            html.dark .hud-desc-scroll::-webkit-scrollbar-thumb {
                background: rgba(239, 68, 68, 0.35);
                border-radius: 2px;
            }
            html.dark .hud-desc-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(239, 68, 68, 0.75);
            }
            html:not(.dark) .hud-desc-scroll::-webkit-scrollbar-thumb {
                background: rgba(22, 22, 22, 0.3);
                border-radius: 2px;
            }
            html:not(.dark) .hud-desc-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(22, 22, 22, 0.7);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Synthesize procedural low-to-high cyber chime on popup open
     */
    private _playOpenBeep(): void {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
            try {
                const ctx = new AC();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sine';
                const now = ctx.currentTime;
                osc.frequency.setValueAtTime(500, now);
                osc.frequency.exponentialRampToValueAtTime(1100, now + 0.15);
                
                gain.gain.setValueAtTime(0.03, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                
                osc.start(now);
                osc.stop(now + 0.2);
            } catch (e) {
                console.log('[HUD] Audio play blocked by browser autoplay policy.');
            }
        }
    }

    /**
     * Synthesize procedural high-to-low cyber chime on popup close
     */
    private _playCloseBeep(): void {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
            try {
                const ctx = new AC();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sine';
                const now = ctx.currentTime;
                osc.frequency.setValueAtTime(950, now);
                osc.frequency.exponentialRampToValueAtTime(350, now + 0.15);
                
                gain.gain.setValueAtTime(0.03, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                
                osc.start(now);
                osc.stop(now + 0.2);
            } catch (e) {}
        }
    }

    /**
     * Build the HUD popup element on demand.
     */
    public create(): HTMLElement {
        TranslinkLiveFeedPopup.injectStyles();
        const lang = TranslinkLanguageController.getInstance();
        const popup = document.createElement('div');
        popup.id = `live-feed-popup-${this.id}`;

        // Highly responsive sizing keeping the aspect ratio beautifully while preventing vertical bleed
        const baseClasses =
            'flex fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] pointer-events-auto opacity-0 scale-95 origin-center overflow-visible';

        // MAPPING: Section ID -> Language Key Paths & Image Asset
        const mapping: Record<string, { title: string; desc: string; tags: string; img: string }> =
            {
                s1: {
                    title: 'sections.s1.card1_title',
                    desc: 'sections.s1.card1_desc',
                    tags: 'sections.s1.card1_tags',
                    img: 'gps.webp',
                }, // TELEMATICS
                s2: {
                    title: 'sections.s1.card1_title',
                    desc: 'sections.s1.card1_desc',
                    tags: 'sections.s1.card1_tags',
                    img: 'gps.webp',
                }, // ASSETS-REAL-TIME-TRACKING
                s3: {
                    title: 'sections.s1.card2_title',
                    desc: 'sections.s1.card2_desc',
                    tags: 'sections.s1.card2_tags',
                    img: 'fuel.webp',
                }, // REAL-TIME-FUEL-MONITORING
                s4: {
                    title: 'sections.s6.card1_title',
                    desc: 'sections.s6.card1_desc',
                    tags: 'sections.s6.card1_tags',
                    img: 'can.webp',
                }, // VEHICLE HEALTH & DIAGNOSTICS
                s5: {
                    title: 'sections.s2.card1_title',
                    desc: 'sections.s2.card1_desc',
                    tags: 'sections.s2.card1_tags',
                    img: 'dashcam_black.webp',
                }, // AI-DRIVEN VIDEO TELEMATICS
                s6: {
                    title: 'sections.s4.card2_title',
                    desc: 'sections.s4.card2_desc',
                    tags: 'sections.s4.card2_tags',
                    img: 'rfid.webp',
                }, // SMART IOT SOLUTIONS
                s7: {
                    title: 'sections.s9.popup_title',
                    desc: 'sections.s9.popup_description',
                    tags: 'sections.s9.popup_tags',
                    img: 'dashcam_black.webp',
                }, // AI-DRIVEN VIDEO TELEMATICS
                s8: {
                    title: 'sections.s8.popup_title',
                    desc: 'sections.s8.popup_description',
                    tags: 'sections.s8.popup_tags',
                    img: 'rfid.webp',
                }, // ONE-STOP IoT SOLUTIONS
                s9: {
                    title: 'sections.s10.popup_title',
                    desc: 'sections.s10.popup_description',
                    tags: 'sections.s10.popup_tags',
                    img: 'safety.webp',
                }, // 24/7 SUPPORT
                s10: {
                    title: 'sections.s2.card2_title',
                    desc: 'sections.s2.card2_desc',
                    tags: 'sections.s2.card2_tags',
                    img: 'safety.webp',
                }, // 24/7 CONNECT
            };

        const config = mapping[this.id];

        if (config) {
            popup.className = `${baseClasses} w-[92vw] sm:w-[85vw] max-w-[410px] h-[80vh] max-h-[610px] bg-transparent`;
            const tags = lang.tArray(config.tags);

            popup.innerHTML = `
                <div class="hud-frame relative flex flex-col w-full h-full backdrop-blur-2xl p-2.5 overflow-hidden group hover:-translate-y-1 transition-all duration-500" style="transform-style: preserve-3d;">
                    
                    <!-- HUD Corner Brackets -->
                    <div class="hud-bracket bracket-tl"></div>
                    <div class="hud-bracket bracket-tr"></div>
                    <div class="hud-bracket bracket-bl"></div>
                    <div class="hud-bracket bracket-br"></div>

                    <!-- HUD Cyber Glow Ambient Aura -->
                    <div class="absolute -inset-10 bg-gradient-to-tr from-transparent dark:via-red-500/5 to-transparent blur-2xl opacity-40 pointer-events-none z-0"></div>

                    <!-- HUD Technical Grid Overlay -->
                    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none z-0" style="background-image: radial-gradient(circle, var(--theme-hud-grid-color) 1px, transparent 1px); background-size: 16px 16px;"></div>

                    <!-- HUD Top Spec Readout Bar -->
                    <div class="flex items-center justify-between px-3 py-2 text-[8.5px] font-mono tracking-widest uppercase relative z-20 hud-top-meta">
                        <div class="flex items-center gap-2 font-bold">
                            <span class="w-1.5 h-1.5 rounded-full hud-status-dot animate-[blinkDot_1.5s_infinite]"></span>
                            <span>TL-DIAG: SECURE</span>
                        </div>
                        <div class="opacity-60 tracking-wider">SYS_REF_800X</div>
                    </div>

                    <!-- HUD Diagnostic Connecting Path Node Markers -->
                    <svg class="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 160" fill="none">
                        <!-- Hardware Node Marker -->
                        <circle cx="45" cy="40" r="1.8" stroke="var(--theme-hud-accent)" stroke-width="0.4" class="opacity-60 transition-colors duration-300"/>
                        <circle cx="45" cy="40" r="0.6" fill="var(--theme-hud-accent)" class="opacity-80 transition-colors duration-300"/>
                        <!-- Card Node Marker -->
                        <circle cx="15" cy="95" r="1.8" stroke="var(--theme-hud-accent)" stroke-width="0.4" class="opacity-60 transition-colors duration-300"/>
                        <circle cx="15" cy="95" r="0.6" fill="var(--theme-hud-accent)" class="opacity-80 transition-colors duration-300"/>
                    </svg>

                    <!-- Top Section: Hardware Asset Viewer (52% height) -->
                    <div class="relative w-full h-[52%] flex items-center justify-center p-4 md:p-6 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] z-10 overflow-hidden" style="transform-style: preserve-3d;">
                        
                        <!-- Rotating High-Tech Reticle Background (Triple Concentric Rings) -->
                        <div class="absolute w-[200px] h-[200px] rounded-full border border-dashed hud-reticle-circle animate-[spinClockwise_32s_linear_infinite] flex items-center justify-center pointer-events-none">
                            <div class="w-[160px] h-[160px] rounded-full border hud-reticle-circle opacity-60"></div>
                        </div>
                        <div class="absolute w-[130px] h-[130px] rounded-full border border-dashed hud-reticle-circle opacity-40 animate-[spinCounterClockwise_16s_linear_infinite] pointer-events-none"></div>
                        <div class="absolute w-[90px] h-[90px] rounded-full border border-dotted hud-reticle-circle opacity-80 animate-[spinClockwise_8s_linear_infinite] pointer-events-none"></div>
                        
                        <!-- Crosshair Overlay Lines -->
                        <div class="absolute w-[220px] h-[1px] hud-crosshair-line pointer-events-none"></div>
                        <div class="absolute h-[220px] w-[1px] hud-crosshair-line-v pointer-events-none"></div>

                        <!-- Scanline Effect -->
                        <div class="hologram-scan"></div>

                        <img src="/images/servicescards/${config.img}" alt="${lang.t(config.title)}" class="max-w-[85%] max-h-[85%] object-contain pointer-events-none transition-transform duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-108 group-hover:-translate-y-2 drop-shadow-[0_15px_25px_rgba(0,0,0,0.65)]" style="transform: translateZ(50px);">
                        
                        <!-- Dynamic Coordinate readouts (simulating active tracking ticks) -->
                        <div class="hud-lat absolute top-4 left-4 font-mono text-[7.5px] tracking-wider hud-coords font-bold">
                            + 9.0128° N
                        </div>
                        <div class="hud-lon absolute bottom-4 right-4 font-mono text-[7.5px] tracking-wider hud-coords font-bold">
                            + 38.7468° E
                        </div>
                    </div>

                    <!-- Bottom Section: Technical UI Text Panel (48% height) - Elevated Layered Depth -->
                    <div class="relative w-full h-[48%] p-5 md:p-6 backdrop-blur-md z-20 flex flex-col justify-between overflow-hidden shadow-sm dark:shadow-md hud-info-panel" style="transform: translateZ(25px);">
                        
                        <!-- Pulse Overlay Glow -->
                        <div class="absolute inset-0 bg-gradient-to-b from-transparent pointer-events-none z-0"></div>

                        <div class="flex flex-col h-full justify-between relative z-10">
                            <div>
                                <!-- Header Status Row -->
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-mono text-[8px] tracking-[0.2em] font-extrabold uppercase flex items-center gap-1.5 hud-status-ticker">
                                        <span class="w-1.5 h-1.5 rounded-full hud-status-dot animate-pulse"></span>
                                        LIVE STREAMING: <span class="hz-ticker font-black">59.8</span> HZ
                                    </span>
                                    <div class="flex gap-1">
                                        <span class="px-1.5 py-0.5 rounded-[3px] text-[7px] font-mono font-bold tracking-widest hud-tag">SECURE</span>
                                    </div>
                                </div>

                                <!-- Title -->
                                <h3 class="font-outfit font-black text-xl md:text-2xl tracking-tight mb-2 uppercase leading-none hud-glow-text transition-colors duration-500">${lang.t(config.title)}</h3>
                                
                                <!-- Futuristic Pill Tags (Borderless) -->
                                <div class="flex flex-wrap gap-1.5 mb-2.5">
                                    ${tags
                                        .slice(0, 3)
                                        .map(
                                            (tag) => `
                                        <span class="px-2 py-0.5 rounded-[4px] text-[8px] font-mono font-bold uppercase tracking-wider transition-all duration-300 cursor-default whitespace-nowrap hud-tag">${tag}</span>
                                    `
                                        )
                                        .join('')}
                                </div>

                                <!-- Description -->
                                <p class="hud-desc-scroll text-[10px] md:text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-300 font-mono tracking-tight text-left max-h-[70px] md:max-h-[85px] overflow-y-auto pr-1">
                                    ${lang.t(config.desc)}
                                </p>
                            </div>

                            <!-- Bottom Diagnostic Bar -->
                            <div class="pt-2 mt-2">
                                <div class="flex justify-between items-center text-[7.5px] font-mono mb-1 hud-top-meta">
                                    <span>DATA LINK: SECURE</span>
                                    <span class="font-extrabold animate-pulse">TRANSLINK CORE v3.0</span>
                                </div>
                                <div class="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-1000 w-[85%] group-hover:w-[100%] hud-progress-fill"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Close Trigger (Tech crosshair button - borderless) -->
                    <button class="popup-close-trigger absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-all duration-300 rounded-full hover:rotate-90 z-[70] shadow-sm backdrop-blur-md hud-close-btn">
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            `;
        } else {
            // Default: Fallback card with sleek HUD styling
            popup.className = `${baseClasses} w-[92vw] max-w-[420px] bg-transparent`;
            popup.innerHTML = `
                <div class="hud-frame relative flex flex-col w-full backdrop-blur-2xl p-5 group hover:-translate-y-1 transition-all duration-500" style="transform-style: preserve-3d;">
                    
                    <!-- HUD Corner Brackets -->
                    <div class="hud-bracket bracket-tl"></div>
                    <div class="hud-bracket bracket-tr"></div>
                    <div class="hud-bracket bracket-bl"></div>
                    <div class="hud-bracket bracket-br"></div>

                    <!-- HUD Technical Grid Overlay -->
                    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none z-0" style="background-image: radial-gradient(circle, var(--theme-hud-grid-color) 1px, transparent 1px); background-size: 16px 16px;"></div>

                    <div class="flex flex-col gap-4 relative z-10 text-left" style="transform: translateZ(25px);">
                        <!-- Header Status Row -->
                        <div class="flex items-center justify-between pb-2 hud-top-meta">
                            <span class="font-mono text-[8px] tracking-[0.25em] font-extrabold uppercase">TL_SEC_GEN_SYS</span>
                            <div class="flex gap-1.5">
                                <div class="w-1.5 h-1.5 rounded-full hud-status-dot animate-pulse"></div>
                            </div>
                        </div>

                        <!-- Title -->
                        <h3 class="text-2xl font-outfit font-black uppercase tracking-tight mb-1 hud-glow-text transition-colors duration-500">${this.title}</h3>
                        
                        <!-- Futuristic pill tags (borderless) -->
                        <div class="flex flex-wrap gap-1.5">
                            ${this.tags
                                .map(
                                    (tag) => `
                                <span class="px-2.5 py-0.5 rounded-[4px] text-[8px] font-mono font-bold uppercase tracking-wider transition-all duration-300 cursor-default whitespace-nowrap hud-tag">${tag}</span>
                            `
                                )
                                .join('')}
                        </div>

                        <!-- Description -->
                        <p class="hud-desc-scroll text-xs leading-relaxed text-slate-600 dark:text-slate-300 font-mono tracking-tight pr-1 overflow-y-auto max-h-[140px]">
                            ${this.description}
                        </p>

                        <!-- Bottom Diagnostic Bar -->
                        <div class="pt-2.5 mt-1 flex justify-between items-center text-[7px] font-mono hud-top-meta">
                            <span>DATA LINK: SECURE</span>
                            <span class="font-extrabold animate-pulse">TRANSLINK CORE v3.0</span>
                        </div>
                    </div>

                    <!-- Close Trigger (Borderless) -->
                    <button class="popup-close-trigger absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-all duration-300 rounded-full hover:rotate-90 z-[70] shadow-sm backdrop-blur-md hud-close-btn">
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            `;
        }

        // 1. Play procedural low-to-high swoop beep chime
        this._playOpenBeep();

        // 2. Telemetry Coordinate Live-Flickering engine & Live frequency ticker
        const latEl = popup.querySelector('.hud-lat');
        const lonEl = popup.querySelector('.hud-lon');
        if (latEl && lonEl) {
            const flickerInterval = setInterval(() => {
                // Ensure elements are still in the DOM before updating
                if (!document.body.contains(popup)) {
                    clearInterval(flickerInterval);
                    return;
                }
                const latVal = (9.0128 + (Math.random() - 0.5) * 0.0006).toFixed(4);
                const lonVal = (38.7468 + (Math.random() - 0.5) * 0.0006).toFixed(4);
                latEl.textContent = `+ ${latVal}° N`;
                lonEl.textContent = `+ ${lonVal}° E`;
            }, 400);
        }

        const hzEl = popup.querySelector('.hz-ticker');
        if (hzEl) {
            const hzInterval = setInterval(() => {
                if (!document.body.contains(popup)) {
                    clearInterval(hzInterval);
                    return;
                }
                const hzVal = (59.7 + Math.random() * 0.5).toFixed(1);
                hzEl.textContent = hzVal;
            }, 300);
        }

        // 3. Play close chime when the close button is clicked
        popup.querySelector('.popup-close-trigger')?.addEventListener('click', () => {
            this._playCloseBeep();
        });

        // 4. Interactive 3D Parallax Tilt Effect with GSAP spring
        popup.addEventListener('mousemove', (e: MouseEvent) => {
            const rect = popup.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const xc = rect.width / 2;
            const yc = rect.height / 2;
            
            // Calculate tilt angle (max 8 degrees)
            const angleX = -(y - yc) / (yc / 6);
            const angleY = (x - xc) / (xc / 6);
            
            const card = popup.querySelector('.hud-frame') as HTMLElement;
            if (card) {
                gsap.to(card, {
                    rotationX: angleX,
                    rotationY: angleY,
                    ease: 'power2.out',
                    duration: 0.3,
                    transformPerspective: 1000
                });
            }
        });
        
        popup.addEventListener('mouseleave', () => {
            const card = popup.querySelector('.hud-frame') as HTMLElement;
            if (card) {
                gsap.to(card, {
                    rotationX: 0,
                    rotationY: 0,
                    ease: 'power3.out',
                    duration: 0.5
                });
            }
        });

        this.element = popup;
        return popup;
    }

    getElement(): HTMLElement | null {
        return this.element;
    }
}
