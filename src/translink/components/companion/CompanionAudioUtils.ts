/**
 * CompanionAudioUtils.ts
 * ──────────────────────────────────────────────────────────────────
 * Pure utility functions for audio context management, synth beep
 * generation, and session-storage welcome tracking.
 *
 * These are stateless helpers that operate on a CompanionHost.
 */
import type { CompanionHost } from './companion-types';

/**
 * Lazily create or resume the companion's AudioContext.
 */
export function getAudioContext(host: CompanionHost): AudioContext | null {
    if (!host.audioCtx) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
            host.audioCtx = new AC();
        }
    }
    if (host.audioCtx && host.audioCtx.state === 'suspended') {
        host.audioCtx.resume().catch(() => {});
    }
    return host.audioCtx;
}

/**
 * Play a short synthesized beep using the Web Audio API.
 * Silently no-ops if user hasn't interacted yet (autoplay policy).
 */
export function playSynthBeep(
    host: CompanionHost,
    freq: number,
    type: OscillatorType,
    duration: number,
    delay = 0,
): void {
    try {
        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
        const ctx = getAudioContext(host);
        if (!ctx) return;

        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    } catch {
        /* silent */
    }
}

/**
 * Check sessionStorage for whether the welcome sequence has already
 * played this browser session.
 */
export function hasWelcomedThisSession(): boolean {
    try {
        return sessionStorage.getItem('tl_welcomed') === 'true';
    } catch {
        return false;
    }
}

/**
 * Mark the welcome sequence as played for this browser session.
 */
export function setWelcomedThisSession(): void {
    try {
        sessionStorage.setItem('tl_welcomed', 'true');
    } catch {}
}
