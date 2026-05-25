/**
 * TranslinkEasterEggFriend.ts
 * ──────────────────────────────────────────────────────────────────
 * Main orchestrator for the Translink companion robot.
 *
 * This file handles:
 *  - Singleton pattern and lifecycle (mount/destroy)
 *  - DOM construction
 *  - State class management and expression system
 *  - Delegation to specialized controllers for flight, voice,
 *    interaction, welcome, and audio
 *
 * For implementation details of each concern, see the companion/ modules.
 */
import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { TranslinkVoiceManager, VoiceState } from './TranslinkVoiceManager';
import { TranslinkLanguageController } from '../controllers/TranslinkLanguageController';
import { TranslinkAIBrain } from './TranslinkAIBrain';

/* ── Companion Modules ───────────────────────────────────────── */
import { PROC_CSS } from './companion/companion-styles';
import { State, type BusinessExpression, type CompanionHost } from './companion/companion-types';
import { getAudioContext, playSynthBeep, hasWelcomedThisSession, setWelcomedThisSession } from './companion/CompanionAudioUtils';
import { CompanionFlightController } from './companion/CompanionFlightController';
import { CompanionVoiceController } from './companion/CompanionVoiceController';
import { CompanionInteractionController } from './companion/CompanionInteractionController';
import { CompanionWelcomeSequence } from './companion/CompanionWelcomeSequence';

gsap.registerPlugin(MotionPathPlugin);

export class TranslinkEasterEggFriend implements CompanionHost {
    private static instance: TranslinkEasterEggFriend | null = null;
    static getInstance(): TranslinkEasterEggFriend {
        if (!TranslinkEasterEggFriend.instance)
            TranslinkEasterEggFriend.instance = new TranslinkEasterEggFriend();
        return TranslinkEasterEggFriend.instance;
    }
    static reset(): void {
        TranslinkEasterEggFriend.instance = null;
    }

    /* ── DOM ─────────────────────────────────────────────────── */
    shell: HTMLElement | null = null;
    mover: HTMLElement | null = null;
    tiltWrap: HTMLElement | null = null;
    floater: HTMLElement | null = null;
    creatureEl: HTMLElement | null = null;
    headEl: HTMLElement | null = null;
    buttonSlot: HTMLElement | null = null;
    private styleTag: HTMLStyleElement | null = null;
    stopSpeechBtn: HTMLButtonElement | null = null;
    emblemEl: HTMLElement | null = null;
    mouthEl: HTMLElement | null = null;

    /* ── Animation State ─────────────────────────────────────── */
    floatTl: gsap.core.Timeline | null = null;
    flightTl: gsap.core.Timeline | null = null;
    buttonFloatTl: gsap.core.Timeline | null = null;
    hoverFloatTl: gsap.core.Timeline | null = null;
    state = State.IDLE;
    prevX = 0;
    prevY = 0;
    isHovered = false;
    facing = 1;
    currentFacing = 1;
    activeExpression: BusinessExpression = 'neutral';

    /* ── Button Tracking ─────────────────────────────────────── */
    carriedBtn: HTMLElement | null = null;
    btnParent: HTMLElement | null = null;
    btnSibling: Node | null = null;

    /* ── Popup Tracking ──────────────────────────────────────── */
    currentSectionId: string | null = null;
    activePopupEl: HTMLElement | null = null;

    /* ── Interactive Variables ────────────────────────────────── */
    audioCtx: AudioContext | null = null;
    isAcknowledgingClick = false;
    isHoldingNotepad = false;
    scrollTimer: ReturnType<typeof setTimeout> | null = null;
    scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
    wanderTimer: ReturnType<typeof setTimeout> | null = null;
    isWandering = false;
    handleScroll: (() => void) | null = null;

    /* ── Voice Link Variables ────────────────────────────────── */
    voiceManager: TranslinkVoiceManager | null = null;
    lipSyncRafId: number | null = null;
    brain: TranslinkAIBrain | null = null;
    welcomeCompleted = false;
    welcomeGuideDelivered = false;
    _robotHasSpoken = false;
    _isAutomatedSession = false;
    _pendingAutomatedPrompt: string | null = null;
    _pendingAutomatedExpression: BusinessExpression = 'neutral';
    _pendingChatGreeting = false;
    _speechStoppedByUser = false;

    /* ── Popup Handlers ──────────────────────────────────────── */
    handlePopupOpen: ((e: Event) => void) | null = null;
    handlePopupClose: ((e: Event) => void) | null = null;

    /* ── Controllers ─────────────────────────────────────────── */
    private flightCtrl!: CompanionFlightController;
    private voiceCtrl!: CompanionVoiceController;
    private interactionCtrl!: CompanionInteractionController;
    private welcomeSeq!: CompanionWelcomeSequence;

    private constructor() {}

    /* ── CompanionHost Delegation Methods ─────────────────────── */

    setExpression(expr: BusinessExpression): void {
        if (!this.shell) return;
        this.activeExpression = expr;
        this.shell.classList.remove('exp-confirming', 'exp-empathetic', 'exp-thinking', 'exp-error');
        if (expr !== 'neutral') {
            this.shell.classList.add(`exp-${expr}`);
        }
        if (expr === 'confirming') {
            this.playSynthBeep(520, 'sine', 0.08);
        } else if (expr === 'error') {
            this.playSynthBeep(220, 'triangle', 0.12);
        } else if (expr === 'thinking') {
            this.playSynthBeep(360, 'sine', 0.06);
        }
    }

    updateStateClasses(stateClass: string, expClass: BusinessExpression = 'neutral'): void {
        if (!this.shell) return;
        const classesToRemove: string[] = [];
        this.shell.classList.forEach((cls) => {
            if (cls.startsWith('state-') || cls.startsWith('exp-')) {
                classesToRemove.push(cls);
            }
        });
        classesToRemove.forEach((cls) => this.shell?.classList.remove(cls));
        this.shell.classList.add(`state-${stateClass}`);
        const finalExp = expClass !== 'neutral' ? expClass : this.activeExpression;
        if (finalExp !== 'neutral') {
            this.shell.classList.add(`exp-${finalExp}`);
        }
    }

    /* ── Audio Delegation ────────────────────────────────────── */
    playSynthBeep(freq: number, type: OscillatorType, duration: number, delay = 0): void {
        playSynthBeep(this, freq, type, duration, delay);
    }
    getAudioContext(): AudioContext | null {
        return getAudioContext(this);
    }
    hasWelcomedThisSession(): boolean {
        return hasWelcomedThisSession();
    }
    setWelcomedThisSession(): void {
        setWelcomedThisSession();
    }

    /* ── Flight Delegation ───────────────────────────────────── */
    flyToButton(btn: HTMLElement): void { this.flightCtrl.flyToButton(btn); }
    returnHome(): void { this.flightCtrl.returnHome(); }
    startIdleFloat(): void { this.flightCtrl.startIdleFloat(); }
    stopFloat(): void { this.flightCtrl.stopFloat(); }
    startCarryFloat(): void { this.flightCtrl.startCarryFloat(); }
    killFlight(): void { this.flightCtrl.killFlight(); }
    releaseButton(): void { this.flightCtrl.releaseButton(); }
    applyProceduralTilt(): void { this.flightCtrl.applyProceduralTilt(); }
    animateButtonPresentation(): void { this.flightCtrl.animateButtonPresentation(); }
    flyBackHome(): void { this.flightCtrl.flyBackHome(); }

    /* ── Voice Delegation ────────────────────────────────────── */
    private _ensureVoiceManager(): TranslinkVoiceManager {
        return this.voiceCtrl.ensureVoiceManager();
    }
    ensureVoiceManager(): TranslinkVoiceManager {
        return this._ensureVoiceManager();
    }
    async toggleVoiceSession(): Promise<void> { return this.voiceCtrl.toggleVoiceSession(); }
    startLipSync(): void { this.voiceCtrl.startLipSync(); }
    stopLipSync(): void { this.voiceCtrl.stopLipSync(); }
    autoConnectAndPrompt(promptText: string, emotion: BusinessExpression): void {
        this.voiceCtrl.autoConnectAndPrompt(promptText, emotion);
    }

    /* ── Interaction Delegation ──────────────────────────────── */
    presentPopupForSection(sectionId: string): void { this.interactionCtrl.presentPopupForSection(sectionId); }
    returnFromWander(): void { this.interactionCtrl.returnFromWander(); }
    wanderNext(): void { this.interactionCtrl.wanderNext(); }
    startWanderingCycle(): void { this.interactionCtrl.startWanderingCycle(); }
    handleHoverStart(): void { this.interactionCtrl.handleHoverStart(); }
    handleHoverEnd(): void { this.interactionCtrl.handleHoverEnd(); }

    /* ── Welcome Delegation ──────────────────────────────────── */
    playWelcomeSequence(): void { this.welcomeSeq.play(); }

    /* ═══════════════════════════════════════════════════════════
     *  mount() — DOM Construction & Controller Initialization
     * ═══════════════════════════════════════════════════════════ */
    mount(parent: HTMLElement = document.body): void {
        if (this.shell) return;

        /* ── Inject CSS ──────────────────────────────────────── */
        if (!document.getElementById('tl-companion-css')) {
            this.styleTag = document.createElement('style');
            this.styleTag.id = 'tl-companion-css';
            this.styleTag.textContent = PROC_CSS;
            document.head.appendChild(this.styleTag);
        }

        /* ── Create Controllers ──────────────────────────────── */
        this.flightCtrl = new CompanionFlightController(this);
        this.voiceCtrl = new CompanionVoiceController(this);
        this.interactionCtrl = new CompanionInteractionController(this);
        this.welcomeSeq = new CompanionWelcomeSequence(this);

        /* ── Build DOM Tree ──────────────────────────────────── */
        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        this.shell = document.createElement('div');
        this.shell.id = 'tl-companion';
        this.shell.className = 'state-idle';
        Object.assign(this.shell.style, {
            position: 'fixed',
            right: isAr ? 'auto' : '32px',
            left: isAr ? '32px' : 'auto',
            bottom: '32px',
            zIndex: '9999',
            pointerEvents: 'none',
            overflow: 'visible',
        });

        this.mover = document.createElement('div');
        Object.assign(this.mover.style, { willChange: 'transform' });

        this.tiltWrap = document.createElement('div');
        Object.assign(this.tiltWrap.style, {
            position: 'relative',
            transformOrigin: 'bottom center',
            willChange: 'transform',
        });

        this.floater = document.createElement('div');
        Object.assign(this.floater.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            willChange: 'transform',
        });

        this.buttonSlot = document.createElement('div');
        Object.assign(this.buttonSlot.style, {
            position: 'absolute',
            left: isAr ? '-105px' : '95px',
            top: '16px',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'auto',
            opacity: '0',
            transform: isAr
                ? 'scale(0) translate3d(100px, 50px, -50px) rotate(30deg)'
                : 'scale(0) translate3d(-100px, 50px, -50px) rotate(-30deg)',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
            zIndex: '5',
            willChange: 'transform, opacity',
        });

        this.creatureEl = document.createElement('div');
        this.creatureEl.className = 'robot-creature';
        Object.assign(this.creatureEl.style, {
            position: 'relative',
            bottom: 'auto',
            left: 'auto',
            right: 'auto',
            top: 'auto',
            transform: 'none',
            display: 'block',
            cursor: 'pointer',
            pointerEvents: 'auto',
        });

        this.creatureEl.innerHTML = `
            <div class="robot-floating-wrapper">
                <div class="robot-head">
                    <div class="robot-headset">
                        <div class="earcup l"></div>
                        <div class="earcup r">
                            <div class="robot-mic"></div>
                        </div>
                    </div>
                    <div class="robot-antenna"></div>
                    <div class="robot-visor">
                        <div class="robot-eye"></div>
                        <div class="robot-eye"></div>
                    </div>
                    <!-- Procedural mouth for lip-sync -->
                    <div class="robot-mouth" style="
                        position: absolute;
                        bottom: 6px;
                        left: 50%;
                        transform: translateX(-50%) translateZ(8px);
                        width: 14px;
                        height: 2px;
                        background: var(--brand-cyan);
                        border-radius: 2px;
                        box-shadow: 0 0 8px var(--brand-cyan);
                        opacity: 0;
                        transition: opacity 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
                    "></div>
                </div>
                <div class="robot-body">
                    <div class="robot-hand l"></div>
                    <div class="robot-hand r"></div>
                    <div class="robot-emblem">
                        <img src="./textures/ui/logo.png" alt="TL Logo" onerror="this.style.display='none'; if(this.nextElementSibling) (this.nextElementSibling as HTMLElement).style.display='block';">
                        <svg viewBox="0 0 24 24" style="display:none; fill:#000; width:13px; height:13px;">
                            <path d="M4,2H20V6H14V22H10V6H4V2Z" />
                        </svg>
                    </div>
                </div>
            </div>
        `;

        this.headEl = this.creatureEl.querySelector('.robot-head') as HTMLElement;
        if (this.headEl) {
            Object.assign(this.headEl.style, {
                transformOrigin: 'bottom center',
                willChange: 'transform',
            });
        }

        this.mouthEl = this.creatureEl.querySelector('.robot-mouth') as HTMLElement;
        this.emblemEl = this.creatureEl.querySelector('.robot-emblem') as HTMLElement;

        /* ── Emblem click/tap → voice toggle ─────────────────── */
        const handleEmblemTap = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Companion] Emblem tapped/clicked — toggling voice session');
            this.toggleVoiceSession();
            if (this.emblemEl) {
                this.emblemEl.classList.remove('emblem-pulse-guide');
            }
        };

        if (this.emblemEl) {
            this.emblemEl.style.cursor = 'pointer';
            this.emblemEl.addEventListener('click', handleEmblemTap);
            this.emblemEl.addEventListener('touchstart', handleEmblemTap, { passive: false });
        }

        const handleBodyTap = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Companion] Robot body tapped/clicked - toggling voice session');
            this.toggleVoiceSession();
        };

        const bodyEl = this.creatureEl.querySelector('.robot-body') as HTMLElement | null;
        if (bodyEl) {
            bodyEl.style.cursor = 'pointer';
            bodyEl.addEventListener('click', handleBodyTap);
            bodyEl.addEventListener('touchstart', handleBodyTap, { passive: false });
        }

        /* ── Hover & double-click ────────────────────────────── */
        this.creatureEl.addEventListener('mouseenter', () => {
            this.handleHoverStart();
        });
        this.creatureEl.addEventListener('mouseleave', () => {
            this.handleHoverEnd();
        });
        this.creatureEl.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleVoiceSession();
        });

        /* ── Client-side AI Brain ────────────────────────────── */
        this.brain = new TranslinkAIBrain();
        this.brain.setDecisionCallback((promptText, emotion, event) => {
            if (event === 'assistant_click') {
                const voiceManager = this.ensureVoiceManager();
                if (voiceManager.isConnected() && !this._speechStoppedByUser) {
                    voiceManager.sendText(promptText);
                    this.setExpression(emotion);
                }
            } else {
                this.setExpression(emotion);
                console.log(`[Companion] Auto speech disabled for event: ${event}. Visual expression updated to: ${emotion}`);
            }
        });

        /* ── Assemble DOM ────────────────────────────────────── */
        this.floater.appendChild(this.creatureEl);
        this.tiltWrap.appendChild(this.floater);
        this.tiltWrap.appendChild(this.buttonSlot);
        this.mover.appendChild(this.tiltWrap);
        this.shell.appendChild(this.mover);
        parent.appendChild(this.shell);

        /* ── Stop Talking Button ─────────────────────────────── */
        this.stopSpeechBtn = document.createElement('button');
        this.stopSpeechBtn.id = 'tl-stop-speech-btn';
        this.stopSpeechBtn.className = 'tl-stop-speech-btn';
        this.stopSpeechBtn.innerHTML = `
            <svg class="stop-waves" viewBox="0 0 24 24" fill="none">
                <line class="wave-bar" x1="4" y1="10" x2="4" y2="14" />
                <line class="wave-bar" x1="8" y1="7" x2="8" y2="17" />
                <line class="wave-bar" x1="12" y1="4" x2="12" y2="20" />
                <line class="wave-bar" x1="16" y1="7" x2="16" y2="17" />
                <line class="wave-bar" x1="20" y1="10" x2="20" y2="14" />
            </svg>
        `;
        gsap.set(this.stopSpeechBtn, { opacity: 0, scale: 0.8, y: 15, display: 'none' });

        const handleStopSpeech = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Companion] Stop Talking clicked — disconnecting voice session');
            this._speechStoppedByUser = true;
            const vm = this.ensureVoiceManager();
            if (vm.isConnected()) {
                vm.disconnect();
            }
        };

        this.stopSpeechBtn.addEventListener('click', handleStopSpeech);
        this.stopSpeechBtn.addEventListener('touchstart', handleStopSpeech, { passive: false });
        this.shell.appendChild(this.stopSpeechBtn);

        /* ── Initialize Controllers ──────────────────────────── */
        this.startIdleFloat();
        this.interactionCtrl.initMouseTracking();
        this.interactionCtrl.initClickInteraction();
        this.interactionCtrl.initScrollTracking();

        /* ── Mobile popup hide/show ──────────────────────────── */
        this.handlePopupOpen = () => {
            if (window.innerWidth <= 768 && this.shell) {
                gsap.to(this.shell, {
                    opacity: 0,
                    scale: 0.8,
                    duration: 0.3,
                    ease: 'power2.in',
                    onComplete: () => {
                        if (this.shell) this.shell.style.display = 'none';
                    }
                });
            }
        };

        this.handlePopupClose = () => {
            if (window.innerWidth <= 768 && this.shell) {
                if (this.shell) this.shell.style.display = 'block';
                gsap.to(this.shell, {
                    opacity: 1,
                    scale: 1,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            }
        };

        window.addEventListener('translink:popup-open', this.handlePopupOpen);
        window.addEventListener('translink:popup-close', this.handlePopupClose);

        /* ── Audio unlock listeners ──────────────────────────── */
        const resumeAudio = () => {
            if (this.voiceManager) {
                this.voiceManager.resumeContext();
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
            window.removeEventListener('scroll', resumeAudio);
            window.removeEventListener('translink:audio-unlock', resumeAudio);
        };
        window.addEventListener('click', resumeAudio, { once: true, passive: true });
        window.addEventListener('touchstart', resumeAudio, { once: true, passive: true });
        window.addEventListener('keydown', resumeAudio, { once: true, passive: true });
        window.addEventListener('scroll', resumeAudio, { once: true, passive: true });
        window.addEventListener('translink:audio-unlock', resumeAudio, { once: true, passive: true });

        /* ── Welcome Sequence ────────────────────────────────── */
        if (!this.hasWelcomedThisSession()) {
            this.playWelcomeSequence();
        } else {
            this.welcomeCompleted = true;
            this.welcomeGuideDelivered = true;
            this.state = State.IDLE;
            this.updateStateClasses('idle', 'neutral');
            this.startIdleFloat();
        }
    }

    /* ═══════════════════════════════════════════════════════════
     *  destroy() — Teardown
     * ═══════════════════════════════════════════════════════════ */
    destroy(): void {
        this.killFlight();
        this.stopFloat();
        this.stopLipSync();
        if (this.hoverFloatTl) {
            this.hoverFloatTl.kill();
            this.hoverFloatTl = null;
        }
        this.releaseButton();
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
            this.scrollTimer = null;
        }
        if (this.scrollIdleTimer) {
            clearTimeout(this.scrollIdleTimer);
            this.scrollIdleTimer = null;
        }
        if (this.wanderTimer) {
            clearTimeout(this.wanderTimer);
            this.wanderTimer = null;
        }
        if (this.handleScroll) {
            window.removeEventListener('scroll', this.handleScroll);
            this.handleScroll = null;
        }
        if (this.handlePopupOpen) {
            window.removeEventListener('translink:popup-open', this.handlePopupOpen);
            this.handlePopupOpen = null;
        }
        if (this.handlePopupClose) {
            window.removeEventListener('translink:popup-close', this.handlePopupClose);
            this.handlePopupClose = null;
        }
        if (this.voiceManager) {
            this.voiceManager.disconnect();
            this.voiceManager = null;
        }
        if (this.brain) {
            this.brain.destroy();
            this.brain = null;
        }

        if (this.stopSpeechBtn) {
            this.stopSpeechBtn.remove();
            this.stopSpeechBtn = null;
        }
        this.styleTag?.remove();
        this.shell?.remove();
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
            this.audioCtx = null;
        }
        this.shell = this.mover = this.tiltWrap = this.floater = null;
        this.creatureEl = this.buttonSlot = this.styleTag = this.headEl = null;
        TranslinkEasterEggFriend.instance = null;
    }
}
