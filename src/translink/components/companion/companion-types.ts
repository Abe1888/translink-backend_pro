/**
 * companion-types.ts
 * ──────────────────────────────────────────────────────────────────
 * Shared types, enums, and the CompanionHost interface.
 * All companion controllers depend on this file — NOT on the main
 * TranslinkEasterEggFriend class — eliminating circular imports.
 */
import type { TranslinkVoiceManager, VoiceState } from '../TranslinkVoiceManager';
import type { TranslinkAIBrain } from '../TranslinkAIBrain';

/* ── Expression & State Enums ─────────────────────────────────── */

export type BusinessExpression = 'neutral' | 'confirming' | 'empathetic' | 'thinking' | 'error';

export enum State {
    IDLE,
    FLYING,
    PRESENTING,
    RETURNING,
}

/* ── CompanionHost Interface ──────────────────────────────────── */
/**
 * Contract that the main TranslinkEasterEggFriend implements.
 * Controllers store a `host: CompanionHost` reference and call
 * through this interface to access shared DOM, state, and methods.
 */
export interface CompanionHost {
    /* ── DOM References ──────────────────────────────────────── */
    shell: HTMLElement | null;
    mover: HTMLElement | null;
    tiltWrap: HTMLElement | null;
    floater: HTMLElement | null;
    creatureEl: HTMLElement | null;
    headEl: HTMLElement | null;
    buttonSlot: HTMLElement | null;
    emblemEl: HTMLElement | null;
    mouthEl: HTMLElement | null;
    stopSpeechBtn: HTMLButtonElement | null;

    /* ── Animation State ─────────────────────────────────────── */
    floatTl: gsap.core.Timeline | null;
    flightTl: gsap.core.Timeline | null;
    buttonFloatTl: gsap.core.Timeline | null;
    hoverFloatTl: gsap.core.Timeline | null;
    state: State;
    prevX: number;
    prevY: number;
    isHovered: boolean;
    facing: number;
    currentFacing: number;
    activeExpression: BusinessExpression;

    /* ── Button Tracking ─────────────────────────────────────── */
    carriedBtn: HTMLElement | null;
    btnParent: HTMLElement | null;
    btnSibling: Node | null;

    /* ── Popup Tracking ──────────────────────────────────────── */
    currentSectionId: string | null;
    activePopupEl: HTMLElement | null;

    /* ── Interactive Variables ────────────────────────────────── */
    audioCtx: AudioContext | null;
    isAcknowledgingClick: boolean;
    isHoldingNotepad: boolean;
    scrollTimer: ReturnType<typeof setTimeout> | null;
    scrollIdleTimer: ReturnType<typeof setTimeout> | null;
    wanderTimer: ReturnType<typeof setTimeout> | null;
    isWandering: boolean;
    handleScroll: (() => void) | null;

    /* ── Voice Link Variables ────────────────────────────────── */
    voiceManager: TranslinkVoiceManager | null;
    lipSyncRafId: number | null;
    brain: TranslinkAIBrain | null;
    welcomeCompleted: boolean;
    welcomeGuideDelivered: boolean;
    _robotHasSpoken: boolean;
    _isAutomatedSession: boolean;
    _pendingAutomatedPrompt: string | null;
    _pendingAutomatedExpression: BusinessExpression;
    _pendingChatGreeting: boolean;
    _speechStoppedByUser: boolean;

    /* ── Popup Handlers ──────────────────────────────────────── */
    handlePopupOpen: ((e: Event) => void) | null;
    handlePopupClose: ((e: Event) => void) | null;

    /* ── Methods Controllers Can Call ─────────────────────────── */
    setExpression(expr: BusinessExpression): void;
    updateStateClasses(stateClass: string, expClass?: BusinessExpression): void;
    playSynthBeep(freq: number, type: OscillatorType, duration: number, delay?: number): void;
    getAudioContext(): AudioContext | null;

    /* Flight delegation */
    startIdleFloat(): void;
    stopFloat(): void;
    startCarryFloat(): void;
    killFlight(): void;
    releaseButton(): void;
    applyProceduralTilt(): void;
    animateButtonPresentation(): void;
    flyBackHome(): void;

    /* Voice delegation */
    ensureVoiceManager(): TranslinkVoiceManager;
    toggleVoiceSession(): Promise<void>;
    startLipSync(): void;
    stopLipSync(): void;
    autoConnectAndPrompt(promptText: string, emotion: BusinessExpression): void;

    /* Interaction delegation */
    returnHome(): void;
    presentPopupForSection(sectionId: string): void;
    returnFromWander(): void;
    wanderNext(): void;
    startWanderingCycle(): void;
    handleHoverStart(): void;
    handleHoverEnd(): void;

    /* Welcome delegation */
    playWelcomeSequence(): void;
    hasWelcomedThisSession(): boolean;
    setWelcomedThisSession(): void;
}
