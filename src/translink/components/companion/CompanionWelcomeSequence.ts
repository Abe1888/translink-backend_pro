/**
 * CompanionWelcomeSequence.ts
 * ──────────────────────────────────────────────────────────────────
 * The welcome animation sequence played once per session when the
 * companion robot first appears on page load. Includes:
 *  - Cinematic pop-in and scale entrance
 *  - Curved flight from home corner to viewport center
 *  - Premium 2.4x close-up zoom
 *  - Hand wave greeting
 *  - Auto-connect voice with welcome prompt
 */
import gsap from 'gsap';
import { TranslinkLanguageController } from '../../controllers/TranslinkLanguageController';
import { State, type CompanionHost } from './companion-types';

export class CompanionWelcomeSequence {
    constructor(private host: CompanionHost) {}

    play(): void {
        const h = this.host;
        if (!h.shell || !h.creatureEl || !h.floater || !h.mover) return;

        gsap.set(h.creatureEl, { scale: 0, opacity: 0 });
        gsap.set(h.mover, { x: 0, y: 0 });

        h.stopFloat();

        const welcomeTl = gsap.timeline({
            delay: 1.0,
            onStart: () => {
                h.state = State.FLYING;
                h.updateStateClasses('flying', 'confirming');
                h.setExpression('confirming');
                h.playSynthBeep(523.25, 'sine', 0.15); // C5
                setTimeout(() => h.playSynthBeep(659.25, 'sine', 0.15), 100); // E5
                setTimeout(() => h.playSynthBeep(783.99, 'sine', 0.25), 200); // G5
            }
        });

        // 1. Cinematic pop-in at home corner
        welcomeTl.to(h.creatureEl, {
            scale: 1,
            opacity: 1,
            duration: 0.8,
            ease: 'back.out(1.5)'
        });

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            welcomeTl.add(() => {
                h.state = State.PRESENTING;
                h.updateStateClasses('guiding', 'confirming');
                h.welcomeCompleted = false;

                const visitorName = localStorage.getItem('translink_visitor_name');
                const welcomePrompt = visitorName
                    ? `Welcome back the visitor, whose name is "${visitorName}". Clearly say that Translink is the ONE STOP SOLUTION for fleet telematics, GPS tracking, fuel management, and AI-driven safety across East Africa. Keep it to 2 short, natural sentences. Sound warm, calm, premium, professional, and helpful. Ask how we can help them optimize their fleet today.`
                    : `Welcome the visitor warmly. In your greeting, clearly say that Translink is the ONE STOP SOLUTION for fleet telematics, GPS tracking, fuel management, and AI-driven safety across East Africa. Keep it to 2 short, natural sentences. Sound calm, premium, professional, and helpful. Politely ask for their name so we can personalize their experience.`;

                h.autoConnectAndPrompt(welcomePrompt, "confirming");
            });
        } else {
            const shellRect = h.shell.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            const targetX = (vw / 2) - (shellRect.left + shellRect.width / 2);
            const targetY = (vh / 2) - (shellRect.top + shellRect.height / 2) - 30;

            h.prevX = 0;
            h.prevY = 0;

            // 2. Organic curved flight from home corner to center
            welcomeTl.to(h.mover, {
                duration: 2.0,
                ease: 'power2.inOut',
                motionPath: {
                    path: [
                        { x: targetX * 0.3, y: targetY * 0.5 - 100 },
                        { x: targetX * 0.7, y: targetY * 0.85 - 50 },
                        { x: targetX, y: targetY }
                    ],
                    curviness: 1.5,
                    type: 'soft'
                },
                onUpdate: () => h.applyProceduralTilt(),
                onComplete: () => {
                    h.state = State.PRESENTING;
                    h.updateStateClasses('guiding', 'confirming');

                    gsap.to(h.tiltWrap, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                    if (h.headEl) {
                        gsap.to(h.headEl, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                    }
                    // Zoom/scale up to 2.4x for premium close-up
                    gsap.to(h.creatureEl, {
                        rotationX: 0,
                        rotationY: 0,
                        rotationZ: 0,
                        scaleX: isAr ? -2.4 : 2.4,
                        scaleY: 2.4,
                        duration: 0.8,
                        ease: 'back.out(1.1)'
                    });
                    h.facing = 1;
                    h.currentFacing = 1;

                    h.welcomeCompleted = false;
                    h.state = State.PRESENTING;

                    const visitorName = localStorage.getItem('translink_visitor_name');
                    const welcomePrompt = visitorName
                        ? `Welcome back the visitor, whose name is "${visitorName}". Clearly say that Translink is the ONE STOP SOLUTION for fleet telematics, GPS tracking, fuel management, and AI-driven safety across East Africa. Keep it to 2 short, natural sentences. Sound warm, calm, premium, professional, and helpful. Ask how we can help them optimize their fleet today.`
                        : `Welcome the visitor warmly. In your greeting, clearly say that Translink is the ONE STOP SOLUTION for fleet telematics, GPS tracking, fuel management, and AI-driven safety across East Africa. Keep it to 2 short, natural sentences. Sound calm, premium, professional, and helpful. Politely ask for their name so we can personalize their experience.`;

                    h.autoConnectAndPrompt(welcomePrompt, "confirming");
                }
            }, '-=0.2');
        }

        // Cute greeting hand wave sequence
        const activeHand = h.creatureEl.querySelector(
            isAr ? '.robot-hand.r' : '.robot-hand.l'
        ) as HTMLElement | null;

        if (activeHand) {
            welcomeTl.to(activeHand, {
                rotation: isAr ? -60 : 60,
                duration: 0.35,
                ease: 'power2.out',
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    gsap.set(activeHand, { clearProps: 'all' });
                    h.setExpression('neutral');
                }
            }, '-=0.5');
        }
    }
}
