/**
 * CompanionVoiceController.ts
 * ──────────────────────────────────────────────────────────────────
 * Manages the voice integration lifecycle for the companion robot:
 *  - TranslinkVoiceManager creation and lifecycle
 *  - Voice session toggle (connect/disconnect)
 *  - Voice state change handling (connecting/listening/speaking/idle)
 *  - Lip-sync animation (mouth, visor glow, emblem pulse)
 *  - Auto-connect and prompt injection
 */
import gsap from 'gsap';
import { TranslinkVoiceManager, type VoiceState } from '../TranslinkVoiceManager';
import { State, type CompanionHost, type BusinessExpression } from './companion-types';

export class CompanionVoiceController {
    constructor(private host: CompanionHost) {}

    /* ── Voice Manager Lifecycle ─────────────────────────────── */

    ensureVoiceManager(): TranslinkVoiceManager {
        const h = this.host;
        if (!h.voiceManager) {
            h.voiceManager = new TranslinkVoiceManager({
                onStateChange: (state) => this.handleVoiceStateChange(state),
                onTranscription: (text) => this.handleVoiceTranscription(text),
                onError: (err) => this.handleVoiceError(err),
                onSetupComplete: () => this.onVoiceSetupComplete(),
                onMetric: (name, value) => this.handleVoiceMetric(name, value),
            });
        }
        return h.voiceManager;
    }

    async toggleVoiceSession(): Promise<void> {
        const h = this.host;
        const vm = this.ensureVoiceManager();

        if (vm.isConnected()) {
            console.log('[Companion] Emblem clicked — voice session active, disconnecting.');
            h._speechStoppedByUser = true;
            vm.disconnect();
            return;
        }

        console.log('[Companion] Emblem clicked — initiating chat voice session.');
        h._speechStoppedByUser = false;
        h.setWelcomedThisSession();
        if (h.brain) {
            h.brain.makeDecision('voice_link_open');
        }

        h._isAutomatedSession = false;
        h._pendingChatGreeting = true;
        h._pendingAutomatedPrompt = null;
        await vm.connect(false, true);
    }

    /* ── Voice State Callbacks ───────────────────────────────── */

    handleVoiceStateChange(voiceState: VoiceState): void {
        const h = this.host;
        if (!h.creatureEl) return;

        // Stop Talking button visibility synchronization
        if (h.stopSpeechBtn) {
            if (voiceState !== 'idle') {
                gsap.to(h.stopSpeechBtn, {
                    display: 'flex',
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.4,
                    ease: 'back.out(1.7)',
                    overwrite: 'auto'
                });
            } else {
                gsap.to(h.stopSpeechBtn, {
                    opacity: 0,
                    scale: 0.8,
                    y: 15,
                    duration: 0.35,
                    ease: 'power2.in',
                    overwrite: 'auto',
                    onComplete: () => {
                        if (h.stopSpeechBtn) {
                            h.stopSpeechBtn.style.display = 'none';
                        }
                    }
                });
            }
        }

        switch (voiceState) {
            case 'connecting':
                this.stopLipSync();
                h.updateStateClasses('thinking', 'neutral');
                h.playSynthBeep(450, 'triangle', 0.25);
                break;

            case 'listening':
                this.stopLipSync();
                h.updateStateClasses('listening', 'neutral');

                if (h._isAutomatedSession) {
                    if (!h.welcomeGuideDelivered && h._robotHasSpoken) {
                        h.welcomeCompleted = true;
                        h.welcomeGuideDelivered = true;
                        h.setWelcomedThisSession();

                        if (h.emblemEl) {
                            h.emblemEl.classList.add('emblem-pulse-guide');
                        }

                        setTimeout(() => {
                            if (h.voiceManager && h.voiceManager.isConnected()) {
                                h.voiceManager.sendText(
                                    `Now gently tell the visitor: to start talking with you, they just need to click the glowing red Translink logo on your body. Say it in one calm, professional sentence.`
                                );
                                h.setExpression('confirming');
                            }
                        }, 800);
                    } else if (h.welcomeGuideDelivered && h.welcomeCompleted && h._robotHasSpoken) {
                        console.log('[Companion] Guide verbal announcement complete — disconnecting, returning to idle.');
                        h.returnHome();
                        if (h.voiceManager && h.voiceManager.isConnected()) {
                            h.voiceManager.disconnect();
                        }
                    }
                }
                break;

            case 'speaking':
                h._robotHasSpoken = true;
                this.startLipSync();
                h.updateStateClasses('speaking', 'confirming');
                break;

            case 'idle':
                this.stopLipSync();
                h._robotHasSpoken = false;
                if (h.state === State.IDLE || h.state === State.RETURNING) {
                    h.updateStateClasses('idle', 'neutral');
                }
                h.playSynthBeep(250, 'sine', 0.2);
                break;
        }
    }

    handleVoiceTranscription(text: string): void {
        console.log('[Companion] Live Voice Transcription heard:', text);
    }

    handleVoiceError(error: string): void {
        const h = this.host;
        console.error('[Companion] Voice session error:', error);
        h.updateStateClasses('alert', 'error');
        h.playSynthBeep(180, 'triangle', 0.18);

        setTimeout(() => {
            h.updateStateClasses('idle', 'neutral');
        }, 4000);
    }

    handleVoiceMetric(name: string, value?: number | string): void {
        console.log('[Companion] Voice metric:', { name, value, timestamp: performance.now() });
    }

    /* ── Lip Sync ────────────────────────────────────────────── */

    startLipSync(): void {
        this.stopLipSync();
        const h = this.host;
        if (!h.mouthEl) return;

        h.mouthEl.style.opacity = '1';

        // Cache visor and emblem references to avoid querySelector lookups on every animation frame
        const visor = h.creatureEl?.querySelector('.robot-visor') as HTMLElement | null;
        const emblem = h.creatureEl?.querySelector('.robot-emblem') as HTMLElement | null;

        const loop = () => {
            if (h.voiceManager && h.voiceManager.getState() === 'speaking') {
                const volume = h.voiceManager.getPlaybackVolume();

                const scaleY = 1 + volume * 15;
                const scaleX = 1 + volume * 2;
                h.mouthEl!.style.transform = `translateX(-50%) translateZ(8px) scale(${scaleX}, ${scaleY})`;

                let mouthColor = '#00d2ff';
                if (h.activeExpression === 'error') mouthColor = '#ffb84d';
                else if (h.activeExpression === 'confirming') mouthColor = '#00d2ff';
                else if (h.activeExpression === 'empathetic') mouthColor = '#9be7ff';

                h.mouthEl!.style.background = mouthColor;
                h.mouthEl!.style.boxShadow = `0 0 ${8 + volume * 15}px ${mouthColor}`;

                if (visor) {
                    visor.style.boxShadow = `inset 0 2px 5px rgba(0, 0, 0, 0.8), 0 0 ${10 + volume * 30}px ${mouthColor}`;
                }

                if (emblem) {
                    emblem.style.transform = `translateZ(3px) scale(${1 + volume * 0.35})`;
                    let emblemGlow = 'var(--brand-crimson)';
                    if (h.activeExpression === 'confirming') emblemGlow = 'var(--brand-cyan)';
                    emblem.style.boxShadow = `0 0 ${12 + volume * 40}px ${emblemGlow}`;
                }

                h.lipSyncRafId = requestAnimationFrame(loop);
            } else {
                this.stopLipSync();
            }
        };
        loop();
    }

    stopLipSync(): void {
        const h = this.host;
        if (h.lipSyncRafId !== null) {
            cancelAnimationFrame(h.lipSyncRafId);
            h.lipSyncRafId = null;
        }
        if (h.mouthEl) {
            h.mouthEl.style.opacity = '0';
            h.mouthEl.style.transform = 'translateX(-50%) translateZ(8px) scale(1, 1)';
        }

        const visor = h.creatureEl?.querySelector('.robot-visor') as HTMLElement | null;
        if (visor) {
            visor.style.boxShadow = '';
        }
        const emblem = h.creatureEl?.querySelector('.robot-emblem') as HTMLElement | null;
        if (emblem) {
            emblem.style.transform = 'translateZ(3px) scale(1)';
            emblem.style.boxShadow = '';
        }
    }

    /* ── Setup Complete & Auto-Connect ───────────────────────── */

    onVoiceSetupComplete(): void {
        const h = this.host;
        if (!h.voiceManager) return;

        console.log('[Companion] Voice session setup complete. Handling pending queues.');
        if (h._pendingChatGreeting) {
            h._pendingChatGreeting = false;
            const visitorName = localStorage.getItem('translink_visitor_name') || '';
            const prompt = visitorName
                ? `The visitor, ${visitorName}, has just clicked to start a conversation with you. Greet them by name in one calm, professional, warm sentence. Ask what fleet operation, safety, fuel, or tracking question you can help with today.`
                : `The visitor has just clicked to start a conversation with you. Greet them in one calm, professional, warm sentence. Ask what fleet operation, safety, fuel, or tracking question you can help with. Politely ask for their name so you know who you are speaking to.`;

            h.voiceManager.sendText(prompt);
            h.setExpression('confirming');
            h.playSynthBeep(440, 'sine', 0.15);
        } else if (h._pendingAutomatedPrompt) {
            const prompt = h._pendingAutomatedPrompt;
            const expr = h._pendingAutomatedExpression;
            h._pendingAutomatedPrompt = null;

            h.voiceManager.sendText(prompt);
            h.setExpression(expr);
        }
    }

    autoConnectAndPrompt(promptText: string, emotion: BusinessExpression): void {
        const h = this.host;
        const voiceManager = this.ensureVoiceManager();
        h.setExpression(emotion);

        if (h.isWandering && h.state === State.IDLE) {
            h.returnFromWander();
        }

        h._isAutomatedSession = true;
        h._pendingChatGreeting = false;
        h._pendingAutomatedPrompt = promptText;
        h._pendingAutomatedExpression = emotion;

        voiceManager.connect(false, false).catch(err => {
            console.error('[Companion] Failed auto connect voice:', err);
        });
    }
}
