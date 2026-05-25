/**
 * CompanionFlightController.ts
 * ──────────────────────────────────────────────────────────────────
 * Handles all flight, floating, procedural tilt, and button-presentation
 * animations for the companion robot.
 *
 * Responsibilities:
 *  - flyToButton()         — cinematic spline flight to a target button
 *  - animateButtonPresentation() — choreographed button reveal
 *  - returnHome()          — tuck-away + return flight
 *  - flyBackHome()         — return spline to origin (0,0)
 *  - startIdleFloat()      — gentle idle breathing animation
 *  - startCarryFloat()     — faster float while carrying a button
 *  - stopFloat()           — kill float timeline
 *  - applyProceduralTilt() — velocity-driven body lean + squash/stretch
 *  - releaseButton()       — reparent carried button back to its original parent
 *  - killFlight()          — terminate all flight timelines
 */
import gsap from 'gsap';
import { TranslinkLanguageController } from '../../controllers/TranslinkLanguageController';
import { State, type CompanionHost, type BusinessExpression } from './companion-types';

export class CompanionFlightController {
    constructor(private host: CompanionHost) {}

    /* ── Public API ──────────────────────────────────────────── */

    flyToButton(btn: HTMLElement): void {
        const h = this.host;
        if (window.innerWidth <= 768) return;
        if (!h.mover || !h.shell || !h.buttonSlot || !h.floater || !h.creatureEl) return;
        if (h.state === State.FLYING || h.state === State.PRESENTING) return;

        // Cancel wandering if active
        h.isWandering = false;
        if (h.wanderTimer) {
            clearTimeout(h.wanderTimer);
            h.wanderTimer = null;
        }

        this.killFlight();
        h.state = State.FLYING;
        h.updateStateClasses('flying', 'confirming');

        const shellRect = h.shell.getBoundingClientRect();
        const parentRect = btn.parentElement?.getBoundingClientRect();

        h.carriedBtn = btn;
        h.btnParent = btn.parentElement;
        h.btnSibling = btn.nextSibling;

        h.buttonSlot.innerHTML = '';
        h.buttonSlot.appendChild(btn);
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        gsap.set(h.buttonSlot, {
            opacity: 0,
            scale: 0,
            x: isAr ? 100 : -100,
            y: 50,
            z: -50,
            rotation: isAr ? 30 : -30,
        });
        const vw = window.innerWidth,
            vh = window.innerHeight,
            pad = 24;

        let targetX: number, targetY: number;
        if (parentRect) {
            targetX = parentRect.left + parentRect.width / 2 - shellRect.left - shellRect.width / 2;
            targetY = parentRect.top - shellRect.top - shellRect.height;
        } else {
            targetX = vw * 0.4 - shellRect.left;
            targetY = -(vh * 0.3);
        }

        const fL = shellRect.left + targetX,
            fT = shellRect.top + targetY;
        if (fL < pad) targetX += pad - fL;
        if (fT < pad) targetY += pad - fT;
        if (fL + shellRect.width > vw - pad) targetX -= fL + shellRect.width - (vw - pad);
        if (fT + shellRect.height > vh - pad) targetY -= fT + shellRect.height - (vh - pad);

        const startX = gsap.getProperty(h.mover, 'x') as number;
        const startY = gsap.getProperty(h.mover, 'y') as number;

        h.prevX = startX;
        h.prevY = startY;

        this.stopFloat();
        this.startCarryFloat();

        h.playSynthBeep(300, 'sine', 0.5);
        setTimeout(() => h.playSynthBeep(400, 'sine', 0.5), 100);

        h.shell.style.pointerEvents = 'auto';

        h.flightTl = gsap.timeline({
            onUpdate: () => this.applyProceduralTilt(),
            onComplete: () => {
                h.state = State.PRESENTING;
                h.updateStateClasses('guiding', 'confirming');

                gsap.to(h.tiltWrap, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                if (h.headEl)
                    gsap.to(h.headEl, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                gsap.to(h.creatureEl, {
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: 0,
                    scaleX: isAr ? -1 : 1,
                    scaleY: 1,
                    duration: 0.4,
                    ease: 'power2.out',
                });
                h.facing = 1;
                h.currentFacing = 1;

                this.animateButtonPresentation();
            },
        });

        const dx = targetX - startX;
        const dy = targetY - startY;
        h.flightTl.to(h.mover, {
            duration: 2.0,
            ease: 'power2.inOut',
            motionPath: {
                path: [
                    { x: startX + dx * 0.2, y: startY + dy * 0.5 - 150 },
                    { x: startX + dx * 0.7, y: targetY - 100 },
                    { x: targetX, y: targetY },
                ],
                curviness: 1.5,
                type: 'soft',
            },
        });
    }

    animateButtonPresentation(): void {
        const h = this.host;
        if (!h.creatureEl || !h.buttonSlot || !h.tiltWrap) return;

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        const activeHand = h.creatureEl.querySelector(
            isAr ? '.robot-hand.r' : '.robot-hand.r'
        ) as HTMLElement | null;
        const visor = h.creatureEl.querySelector('.robot-visor') as HTMLElement | null;
        const eyes = h.creatureEl.querySelectorAll('.robot-eye') as NodeListOf<HTMLElement>;

        if (h.buttonFloatTl) {
            h.buttonFloatTl.kill();
            h.buttonFloatTl = null;
        }

        const presentationTl = gsap.timeline();

        // 1. REACH PHASE
        presentationTl.to(h.tiltWrap, {
            rotationZ: isAr ? 8 : -8,
            rotationY: isAr ? 15 : -15,
            y: 5,
            duration: 0.35,
            ease: 'power1.out',
        });
        if (activeHand) {
            presentationTl.to(
                activeHand,
                {
                    rotation: isAr ? -30 : 30,
                    translateZ: -20,
                    duration: 0.35,
                    ease: 'power1.out',
                },
                0
            );
        }
        if (visor) {
            presentationTl.to(
                visor,
                {
                    '--visor-offset-x': isAr ? '6px' : '-6px',
                    '--visor-offset-y': '3px',
                    duration: 0.35,
                    ease: 'power1.out',
                },
                0
            );
        }
        eyes.forEach((eye) => {
            presentationTl.to(
                eye,
                {
                    '--eye-offset-x': isAr ? '2px' : '-2px',
                    '--eye-offset-y': '1px',
                    duration: 0.35,
                    ease: 'power1.out',
                },
                0
            );
        });

        // 2. PRESENT PHASE
        presentationTl.to(
            h.tiltWrap,
            {
                rotationZ: isAr ? -12 : 12,
                rotationY: isAr ? -20 : 20,
                y: -4,
                duration: 0.5,
                ease: 'back.out(1.5)',
            },
            '+=0.05'
        );

        if (activeHand) {
            presentationTl.to(
                activeHand,
                {
                    rotation: isAr ? 95 : -95,
                    translateY: -4,
                    translateZ: -10,
                    duration: 0.55,
                    ease: 'back.out(1.8)',
                },
                '<'
            );
        }

        if (visor) {
            presentationTl.to(
                visor,
                {
                    '--visor-offset-x': isAr ? '-7px' : '7px',
                    '--visor-offset-y': '-2px',
                    duration: 0.55,
                    ease: 'power2.out',
                },
                '<'
            );
        }
        eyes.forEach((eye) => {
            presentationTl.to(
                eye,
                {
                    '--eye-offset-x': isAr ? '-2px' : '2px',
                    '--eye-offset-y': '-1px',
                    duration: 0.55,
                    ease: 'power2.out',
                },
                '<'
            );
        });

        presentationTl.to(
            h.buttonSlot,
            {
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0,
                z: 0,
                rotation: 0,
                duration: 0.85,
                ease: 'elastic.out(1, 0.65)',
                onStart: () => {
                    h.playSynthBeep(600, 'sine', 0.15);
                    setTimeout(() => h.playSynthBeep(850, 'sine', 0.25), 80);
                },
            },
            '<+=0.1'
        );

        // 3. SETTLE PHASE
        presentationTl.to(h.tiltWrap, {
            rotationZ: 0,
            rotationY: 0,
            y: 0,
            duration: 0.6,
            ease: 'power2.out',
        });

        if (activeHand) {
            presentationTl.to(
                activeHand,
                {
                    rotation: isAr ? 90 : -90,
                    translateY: -2,
                    translateZ: -8,
                    duration: 0.6,
                    ease: 'power2.out',
                },
                '<'
            );
        }

        if (visor) {
            presentationTl.to(
                visor,
                {
                    '--visor-offset-x': '0px',
                    '--visor-offset-y': '0px',
                    duration: 0.6,
                    ease: 'power2.out',
                },
                '<'
            );
        }
        eyes.forEach((eye) => {
            presentationTl.to(
                eye,
                {
                    '--eye-offset-x': '0px',
                    '--eye-offset-y': '0px',
                    duration: 0.6,
                    ease: 'power2.out',
                },
                '<'
            );
        });

        presentationTl.eventCallback('onComplete', () => {
            h.buttonFloatTl = gsap.timeline({ repeat: -1, yoyo: true });
            h.buttonFloatTl.to(h.buttonSlot, {
                y: -3,
                x: isAr ? -1 : 1,
                duration: 2.5,
                ease: 'sine.inOut',
            });

            setTimeout(() => {
                if (activeHand && h.state === State.PRESENTING) {
                    gsap.to(activeHand, {
                        rotation: 0,
                        x: 0,
                        y: 0,
                        z: 0,
                        duration: 0.8,
                        ease: 'power2.inOut',
                        onComplete: () => {
                            if (activeHand && h.state === State.PRESENTING) {
                                gsap.set(activeHand, { clearProps: 'all' });
                                h.updateStateClasses('idle', 'confirming');
                            }
                        }
                    });
                }
            }, 3000);
        });
    }

    returnHome(): void {
        const h = this.host;
        if (window.innerWidth <= 768) {
            if (h.activePopupEl) {
                const el = h.activePopupEl;
                gsap.to(el, {
                    opacity: 0,
                    scale: 0.9,
                    duration: 0.3,
                    ease: 'power2.in',
                    onComplete: () => {
                        el.remove();
                    }
                });
            }
            h.currentSectionId = null;
            h.activePopupEl = null;
            h.state = State.IDLE;
            h.updateStateClasses('idle', 'neutral');
            return;
        }

        if (!h.mover || !h.shell || !h.creatureEl || !h.buttonSlot) return;
        if (h.state === State.IDLE || h.state === State.RETURNING) return;

        h.isWandering = false;
        if (h.wanderTimer) {
            clearTimeout(h.wanderTimer);
            h.wanderTimer = null;
        }

        this.killFlight();
        h.state = State.RETURNING;
        h.updateStateClasses('flying', 'neutral');
        h.shell.style.pointerEvents = 'none';

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        const activeHand = h.creatureEl.querySelector(
            isAr ? '.robot-hand.l' : '.robot-hand.r'
        ) as HTMLElement | null;
        const visor = h.creatureEl.querySelector('.robot-visor') as HTMLElement | null;
        const eyes = h.creatureEl.querySelectorAll('.robot-eye') as NodeListOf<HTMLElement>;

        const tuckTl = gsap.timeline({
            onComplete: () => {
                this.releaseButton();
                this.flyBackHome();
            },
        });

        const popupIsToRight = (h.facing > 0);

        tuckTl.to(h.creatureEl, {
            scaleX: popupIsToRight ? (isAr ? -1.0 : 1.0) : (isAr ? 1.0 : -1.0),
            scaleY: 1.0,
            duration: 0.5,
            ease: 'power2.inOut'
        }, 0);

        // 1. TUCK PHASE
        tuckTl.to(h.tiltWrap, {
            rotationZ: popupIsToRight ? -4 : 4,
            rotationY: popupIsToRight ? -10 : 10,
            duration: 0.35,
            ease: 'power2.inOut',
        });
        if (activeHand) {
            tuckTl.to(
                activeHand,
                {
                    rotation: popupIsToRight ? -30 : 30,
                    translateZ: -10,
                    duration: 0.35,
                    ease: 'power2.inOut',
                },
                0
            );
        }
        if (visor) {
            tuckTl.to(
                visor,
                {
                    '--visor-offset-x': popupIsToRight ? '4px' : '-4px',
                    '--visor-offset-y': '1px',
                    duration: 0.35,
                    ease: 'power2.inOut',
                },
                0
            );
        }
        eyes.forEach((eye) => {
            tuckTl.to(
                eye,
                {
                    '--eye-offset-x': popupIsToRight ? '1px' : '-1px',
                    '--eye-offset-y': '0.5px',
                    duration: 0.35,
                    ease: 'power2.inOut',
                },
                0
            );
        });

        tuckTl.to(
            h.buttonSlot,
            {
                opacity: 0,
                scale: 0,
                x: popupIsToRight ? -100 : 100,
                y: 50,
                z: -50,
                rotation: popupIsToRight ? -30 : 30,
                duration: 0.4,
                ease: 'back.in(1.5)',
                onStart: () => {
                    h.playSynthBeep(400, 'sine', 0.25);
                    setTimeout(() => h.playSynthBeep(300, 'sine', 0.35), 80);
                },
            },
            '<'
        );
    }

    flyBackHome(): void {
        const h = this.host;
        if (!h.mover || !h.shell || !h.creatureEl) return;

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        const activeHand = h.creatureEl.querySelector(
            isAr ? '.robot-hand.l' : '.robot-hand.r'
        ) as HTMLElement | null;

        const startX = gsap.getProperty(h.mover, 'x') as number;
        const startY = gsap.getProperty(h.mover, 'y') as number;
        h.prevX = startX;
        h.prevY = startY;

        this.stopFloat();

        if (activeHand) {
            gsap.set(activeHand, { clearProps: 'all' });
        }

        h.flightTl = gsap.timeline({
            onUpdate: () => this.applyProceduralTilt(),
            onComplete: () => {
                h.state = State.IDLE;
                h.updateStateClasses('idle', 'neutral');

                gsap.to(h.tiltWrap, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                if (h.headEl)
                    gsap.to(h.headEl, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                gsap.to(h.creatureEl, {
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: 0,
                    scaleX: isAr ? -1 : 1,
                    scaleY: 1,
                    duration: 0.4,
                    ease: 'power2.out',
                });
                h.facing = 1;
                h.currentFacing = 1;

                const visor = h.creatureEl?.querySelector('.robot-visor') as HTMLElement | null;
                const eyes = h.creatureEl?.querySelectorAll(
                    '.robot-eye'
                ) as NodeListOf<HTMLElement>;
                if (visor) {
                    visor.style.setProperty('--visor-offset-x', '0px');
                    visor.style.setProperty('--visor-offset-y', '0px');
                }
                eyes.forEach((eye) => {
                    eye.style.setProperty('--eye-offset-x', '0px');
                    eye.style.setProperty('--eye-offset-y', '0px');
                });

                this.startIdleFloat();
            },
        });

        h.flightTl.to(h.mover, {
            duration: 1.8,
            ease: 'power2.inOut',
            motionPath: {
                path: [
                    { x: startX * 0.5, y: startY - 100 },
                    { x: 0, y: 0 },
                ],
                curviness: 1.5,
                type: 'soft',
            },
        });
    }

    /* ── Float Animations ────────────────────────────────────── */

    startIdleFloat(): void {
        this.stopFloat();
        const h = this.host;
        if (!h.floater) return;
        h.floatTl = gsap.timeline({ repeat: -1, yoyo: true });
        if (window.innerWidth <= 1024) {
            h.floatTl.to(h.floater, { y: -2, duration: 4.0, ease: 'sine.inOut' });
            h.floatTl.to(h.floater, { rotation: 0.2, duration: 5.0, ease: 'sine.inOut' }, 0);
        } else {
            h.floatTl.to(h.floater, { y: -10, duration: 2.0, ease: 'sine.inOut' });
            h.floatTl.to(h.floater, { rotation: 1.5, duration: 2.5, ease: 'sine.inOut' }, 0);
        }
    }

    startCarryFloat(): void {
        this.stopFloat();
        const h = this.host;
        if (!h.floater) return;
        h.floatTl = gsap.timeline({ repeat: -1, yoyo: true });
        h.floatTl.to(h.floater, { y: -14, duration: 1.3, ease: 'sine.inOut' });
        h.floatTl.to(h.floater, { rotation: 2.5, duration: 1.6, ease: 'sine.inOut' }, 0);
    }

    stopFloat(): void {
        const h = this.host;
        if (h.floatTl) {
            h.floatTl.kill();
            h.floatTl = null;
        }
        if (h.floater) gsap.set(h.floater, { y: 0, rotation: 0 });
    }

    /* ── Procedural Tilt (velocity-driven) ───────────────────── */

    applyProceduralTilt(): void {
        const h = this.host;
        if (h.isHovered) return;
        if (!h.mover || !h.tiltWrap || !h.creatureEl) return;
        const cx = gsap.getProperty(h.mover, 'x') as number;
        const cy = gsap.getProperty(h.mover, 'y') as number;
        const vx = cx - h.prevX;
        const vy = cy - h.prevY;

        if (Math.abs(vx) > 0.15) {
            h.facing = vx > 0 ? 1 : -1;
        }

        h.currentFacing += (h.facing - h.currentFacing) * 0.12;

        const lean = vx * 1.5;
        const pitch = vy * 0.8;

        const rotX = pitch * (h.currentFacing > 0 ? 1 : -1);
        const rotY = -h.currentFacing * 15;
        const rotZ = lean * (h.currentFacing > 0 ? 1 : -1);

        const speed = Math.sqrt(vx * vx + vy * vy);
        const squashY = Math.min(1.06, 1 + speed * 0.003);
        const squashX = Math.max(0.95, 1 - speed * 0.002);

        const targetScaleX = squashX * h.currentFacing;

        gsap.to(h.creatureEl, {
            rotationX: rotX,
            rotationY: rotY,
            rotationZ: rotZ,
            scaleX: targetScaleX,
            scaleY: squashY,
            duration: 0.25,
            ease: 'power1.out',
            overwrite: 'auto',
        });

        if (h.headEl && (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1)) {
            const headAngle = Math.max(-15, Math.min(15, vx * 0.8 * h.currentFacing));
            gsap.to(h.headEl, { rotation: headAngle, duration: 0.2, ease: 'power1.out' });
        }

        h.prevX = cx;
        h.prevY = cy;
    }

    /* ── Button Release & Flight Kill ────────────────────────── */

    releaseButton(): void {
        const h = this.host;
        if (h.carriedBtn && h.btnParent) {
            h.carriedBtn.style.opacity = '0';
            h.carriedBtn.style.pointerEvents = 'none';
            if (h.btnSibling) {
                h.btnParent.insertBefore(h.carriedBtn, h.btnSibling);
            } else {
                h.btnParent.appendChild(h.carriedBtn);
            }
        }
        h.carriedBtn = null;
        h.btnParent = null;
        h.btnSibling = null;
        if (h.buttonSlot) h.buttonSlot.innerHTML = '';
        h.currentSectionId = null;
        h.activePopupEl = null;
    }

    killFlight(): void {
        const h = this.host;
        if (h.flightTl) {
            h.flightTl.kill();
            h.flightTl = null;
        }
        if (h.buttonFloatTl) {
            h.buttonFloatTl.kill();
            h.buttonFloatTl = null;
        }
    }
}
