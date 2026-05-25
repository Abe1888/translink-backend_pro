/**
 * CompanionInteractionController.ts
 * ──────────────────────────────────────────────────────────────────
 * Manages all user-facing interaction handlers for the companion:
 *  - Mouse tracking and cursor-following eyes/visor/head
 *  - Hover start/end with flight pause and breathing
 *  - Click acknowledgement interaction
 *  - Scroll tracking and section detection
 *  - Live feed popup presentation for desktop and mobile
 *  - Wandering cycle (idle ambient roaming)
 */
import gsap from 'gsap';
import { TranslinkLanguageController } from '../../controllers/TranslinkLanguageController';
import { TranslinkLiveFeedPopup } from '../TranslinkLiveFeedPopup';
import { State, type CompanionHost } from './companion-types';

export class CompanionInteractionController {
    constructor(private host: CompanionHost) {}

    /* ── Mouse Tracking ──────────────────────────────────────── */

    initMouseTracking(): void {
        const h = this.host;
        window.addEventListener(
            'mousemove',
            (e) => {
                if (window.innerWidth <= 768) return;
                if (!h.creatureEl || !h.shell) return;

                const rect = h.creatureEl.getBoundingClientRect();
                const robotCenterX = rect.left + rect.width / 2;
                const robotCenterY = rect.top + rect.height / 2;

                const dx = e.clientX - robotCenterX;
                const dy = e.clientY - robotCenterY;
                const angle = Math.atan2(dy, dx);

                if (h.state === State.IDLE || h.isHovered) {
                    const eyes = h.creatureEl.querySelectorAll(
                        '.robot-eye'
                    ) as NodeListOf<HTMLElement>;
                    eyes.forEach((eye) => {
                        const eyeX = Math.cos(angle) * 2;
                        const eyeY = Math.sin(angle) * 2;
                        eye.style.setProperty('--eye-offset-x', `${eyeX}px`);
                        eye.style.setProperty('--eye-offset-y', `${eyeY}px`);
                    });

                    const visor = h.creatureEl.querySelector('.robot-visor') as HTMLElement;
                    if (visor) {
                        const visorX = Math.cos(angle) * 5;
                        const visorY = Math.sin(angle) * 2.5;
                        visor.style.setProperty('--visor-offset-x', `${visorX}px`);
                        visor.style.setProperty('--visor-offset-y', `${visorY}px`);
                    }

                    if (h.headEl) {
                        const maxRotation = 12;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const strength = Math.min(0.2, 100 / (distance + 1));
                        const targetRotation = Math.max(
                            -maxRotation,
                            Math.min(maxRotation, dx * strength)
                        );
                        gsap.to(h.headEl, {
                            rotation: targetRotation,
                            duration: 0.5,
                            ease: 'power2.out',
                        });
                    }
                }
            },
            { passive: true }
        );
    }

    /* ── Hover ───────────────────────────────────────────────── */

    handleHoverStart(): void {
        const h = this.host;
        if (window.innerWidth <= 1024) return;
        h.isHovered = true;

        h.facing = 1;
        h.currentFacing = 1;

        if (h.creatureEl) {
            const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
            const currentZoom = h.state === State.PRESENTING ? 2.4 : 1.0;
            gsap.to(h.creatureEl, {
                rotationX: 0,
                rotationY: 0,
                rotationZ: 0,
                scaleX: isAr ? -currentZoom : currentZoom,
                scaleY: currentZoom,
                duration: 0.45,
                ease: 'power2.out',
            });
        }

        if (h.flightTl && h.flightTl.isActive()) {
            gsap.to(h.flightTl, {
                timeScale: 0,
                duration: 0.5,
                ease: 'power2.out',
                onComplete: () => {
                    if (h.isHovered) {
                        h.flightTl?.pause();
                    }
                },
            });
        }

        if (h.wanderTimer) {
            clearTimeout(h.wanderTimer);
            h.wanderTimer = null;
        }

        if (h.floater) {
            gsap.to(h.floater, {
                y: 0,
                rotation: 0,
                duration: 0.45,
                ease: 'power2.out',
                onComplete: () => {
                    if (!h.isHovered) return;
                    h.stopFloat();

                    h.hoverFloatTl = gsap.timeline({ repeat: -1, yoyo: true });
                    h.hoverFloatTl.to(h.floater, {
                        y: -3,
                        duration: 3.2,
                        ease: 'sine.inOut',
                    });
                    h.hoverFloatTl.to(
                        h.floater,
                        {
                            rotation: 0.5,
                            duration: 3.8,
                            ease: 'sine.inOut',
                        },
                        0
                    );
                },
            });
        }
    }

    handleHoverEnd(): void {
        const h = this.host;
        if (window.innerWidth <= 1024) return;
        h.isHovered = false;

        if (h.flightTl) {
            h.flightTl.play();
            gsap.to(h.flightTl, {
                timeScale: 1,
                duration: 0.6,
                ease: 'power2.inOut',
            });
        }

        if (h.hoverFloatTl) {
            h.hoverFloatTl.kill();
            h.hoverFloatTl = null;
        }

        if (h.floater) {
            gsap.to(h.floater, {
                y: 0,
                rotation: 0,
                duration: 0.45,
                ease: 'power2.out',
                onComplete: () => {
                    if (h.isHovered) return;
                    h.startIdleFloat();
                },
            });
        }

        if (h.state === State.IDLE && h.isWandering && !h.wanderTimer) {
            h.wanderTimer = setTimeout(
                () => {
                    if (!h.isHovered) {
                        this.wanderNext();
                    }
                },
                3000 + Math.random() * 2000
            );
        }
    }

    /* ── Click Interaction ───────────────────────────────────── */

    initClickInteraction(): void {
        const h = this.host;
        h.creatureEl?.addEventListener('click', () => {
            if (window.innerWidth <= 768) return;
            if (h.isAcknowledgingClick || !h.shell || !h.floater || !h.creatureEl) return;
            h.isAcknowledgingClick = true;

            const prevExpr = h.activeExpression;
            h.setExpression('confirming');
            h.creatureEl.classList.add('popping');

            if (h.brain) {
                h.brain.makeDecision('assistant_click');
            }

            const acknowledgeTl = gsap.timeline({
                onComplete: () => {
                    h.creatureEl?.classList.remove('popping');
                    h.isAcknowledgingClick = false;
                    h.setExpression(prevExpr);
                },
            });

            acknowledgeTl
                .to(h.floater, {
                    y: -5,
                    rotation: 1.2,
                    duration: 0.18,
                    ease: 'power2.out',
                })
                .to(h.floater, { y: 0, rotation: 0, duration: 0.28, ease: 'power2.inOut' });
        });
    }

    /* ── Scroll Tracking ─────────────────────────────────────── */

    initScrollTracking(): void {
        const h = this.host;
        h.handleScroll = () => {
            if (h.scrollTimer) {
                clearTimeout(h.scrollTimer);
                h.scrollTimer = null;
            }
            if (h.scrollIdleTimer) {
                clearTimeout(h.scrollIdleTimer);
                h.scrollIdleTimer = null;
            }

            if (h.state === State.FLYING || h.state === State.PRESENTING) {
                h.returnHome();
                if (h.voiceManager && h.voiceManager.isConnected()) {
                    h.voiceManager.disconnect();
                }
            } else {
                if (h.voiceManager && h.voiceManager.isConnected()) {
                    h.voiceManager.disconnect();
                }
            }

            if (h.isWandering) {
                this.returnFromWander();
            }

            h.scrollTimer = setTimeout(() => {
                if (window.innerWidth <= 768) return;

                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercent = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;

                let sectionId = '';
                if (scrollPercent < 7.14) {
                    sectionId = 's1';
                } else if (scrollPercent < 14.29) {
                    sectionId = 's2';
                } else if (scrollPercent < 21.43) {
                    sectionId = 's3';
                } else if (scrollPercent < 28.57) {
                    sectionId = 's4';
                } else if (scrollPercent < 57.14) {
                    sectionId = 's5';
                } else if (scrollPercent < 64.29) {
                    sectionId = 's6';
                } else if (scrollPercent < 71.43) {
                    sectionId = 's7';
                } else if (scrollPercent < 78.57) {
                    sectionId = 's8';
                } else if (scrollPercent < 85.71) {
                    sectionId = 's9';
                } else {
                    sectionId = 's10';
                }

                if (sectionId !== 's1') {
                    if (h.currentSectionId !== sectionId) {
                        this.presentPopupForSection(sectionId);
                    }
                } else {
                    if (h.currentSectionId !== null) {
                        h.returnHome();
                    }
                }

                if (h.scrollIdleTimer) {
                    clearTimeout(h.scrollIdleTimer);
                }
                h.scrollIdleTimer = setTimeout(() => {
                    if (h.state === State.IDLE && !h.isWandering) {
                        this.startWanderingCycle();
                    }
                }, 10000);
            }, 250);
        };

        window.addEventListener('scroll', h.handleScroll, { passive: true });
        h.handleScroll();
    }

    /* ── Popup Presentation ──────────────────────────────────── */

    presentPopupForSection(sectionId: string): void {
        const h = this.host;
        const isMobile = window.innerWidth <= 768;
        if (isMobile) return;

        h.isWandering = false;
        if (h.wanderTimer) {
            clearTimeout(h.wanderTimer);
            h.wanderTimer = null;
        }

        h.killFlight();
        h.releaseButton();

        h.currentSectionId = sectionId;

        const lang = TranslinkLanguageController.getInstance();
        const title = lang.t(`sections.${sectionId}.popup_title`);
        const description = lang.t(`sections.${sectionId}.popup_description`);
        const tags = lang.tArray(`sections.${sectionId}.popup_tags`);

        const popupInstance = new TranslinkLiveFeedPopup(sectionId, title, description, tags);

        const popupEl = popupInstance.create();
        h.activePopupEl = popupEl;

        if (isMobile) {
            h.state = State.PRESENTING;
            h.updateStateClasses('idle', 'confirming');

            const closeBtn = popupEl.querySelector('.popup-close-trigger');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    h.returnHome();
                });
            }

            document.body.appendChild(popupEl);

            gsap.to(popupEl, {
                opacity: 1,
                scale: 1,
                duration: 0.5,
                ease: 'back.out(1.5)',
            });

            h.playSynthBeep(600, 'sine', 0.15);
            setTimeout(() => h.playSynthBeep(850, 'sine', 0.25), 80);
            return;
        }

        // Desktop path
        if (!h.mover || !h.shell || !h.buttonSlot || !h.floater || !h.creatureEl) return;

        h.state = State.FLYING;
        h.updateStateClasses('flying', 'confirming');

        popupEl.className = 'flex pointer-events-auto opacity-0 scale-95 origin-center overflow-visible w-[85vw] max-w-[325px] h-[75vh] max-h-[580px] bg-transparent relative';
        popupEl.style.position = 'relative';
        popupEl.style.left = 'auto';
        popupEl.style.top = 'auto';
        popupEl.style.transform = 'none';

        h.buttonSlot.innerHTML = '';
        h.buttonSlot.appendChild(popupEl);
        popupEl.style.opacity = '1';
        popupEl.style.pointerEvents = 'auto';

        const closeBtn = popupEl.querySelector('.popup-close-trigger');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                h.returnHome();
            });
        }

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';

        const robotRect = h.creatureEl!.getBoundingClientRect();
        const robotViewportX = robotRect.left + robotRect.width / 2;
        const activeSide = robotViewportX < window.innerWidth / 2 ? 'left' : 'right';

        if (activeSide === 'left') {
            h.buttonSlot.style.left = '95px';
        } else {
            h.buttonSlot.style.left = '-345px';
        }

        gsap.set(h.buttonSlot, {
            opacity: 0,
            scale: 0,
            x: activeSide === 'left' ? -100 : 100,
            y: 50,
            z: -50,
            rotation: activeSide === 'left' ? -30 : 30,
        });

        const robotWidth = 90;
        const moverX = gsap.getProperty(h.mover, 'x') as number;
        const moverY = gsap.getProperty(h.mover, 'y') as number;
        const shellRect = h.shell!.getBoundingClientRect();
        const homeViewportX = shellRect.left - moverX;
        const homeViewportY = shellRect.top - moverY;

        const homeCenterX = homeViewportX + robotWidth / 2;

        const targetViewportX = activeSide === 'left'
            ? 48 + robotWidth / 2
            : window.innerWidth - 48 - robotWidth / 2;

        const popupHeight = Math.min(580, window.innerHeight * 0.75);
        const popupTop = Math.max(24, (window.innerHeight - popupHeight) / 2);
        const targetViewportY = popupTop - 16;

        const targetX = targetViewportX - homeCenterX;
        const targetY = targetViewportY - homeViewportY;

        const startX = moverX;
        const startY = moverY;

        h.prevX = startX;
        h.prevY = startY;

        h.stopFloat();
        h.startCarryFloat();

        h.playSynthBeep(300, 'sine', 0.5);
        setTimeout(() => h.playSynthBeep(400, 'sine', 0.5), 100);

        h.shell.style.pointerEvents = 'auto';

        h.flightTl = gsap.timeline({
            onUpdate: () => h.applyProceduralTilt(),
            onComplete: () => {
                h.state = State.PRESENTING;
                h.updateStateClasses('guiding', 'confirming');

                gsap.to(h.tiltWrap!, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                if (h.headEl)
                    gsap.to(h.headEl, { rotation: 0, duration: 0.4, ease: 'power2.out' });

                const finalScaleX = activeSide === 'left'
                    ? (isAr ? -1 : 1)
                    : (isAr ? 1 : -1);

                gsap.to(h.creatureEl!, {
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: 0,
                    scaleX: finalScaleX,
                    scaleY: 1,
                    duration: 0.4,
                    ease: 'power2.out',
                });
                h.facing = activeSide === 'left' ? 1 : -1;
                h.currentFacing = activeSide === 'left' ? 1 : -1;

                h.animateButtonPresentation();
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

    /* ── Wandering Cycle ─────────────────────────────────────── */

    startWanderingCycle(): void {
        const h = this.host;
        if (window.innerWidth <= 768) return;
        if (h.state !== State.IDLE) return;
        h.isWandering = true;
        this.wanderNext();
    }

    wanderNext(): void {
        const h = this.host;
        if (h.isHovered) return;
        if (!h.mover || !h.shell || h.state !== State.IDLE || !h.isWandering) return;

        const isAr = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const targetX = isAr
            ? Math.max(40, Math.min(vw - 150, Math.random() * (vw - 190) + 40))
            : -Math.max(40, Math.min(vw - 150, Math.random() * (vw - 190) + 40));
        const targetY = -Math.max(40, Math.min(vh - 150, Math.random() * (vh - 190) + 40));

        h.killFlight();
        h.stopFloat();

        h.updateStateClasses('flying', 'confirming');
        h.playSynthBeep(350, 'sine', 0.3);

        const startX = gsap.getProperty(h.mover, 'x') as number;
        const startY = gsap.getProperty(h.mover, 'y') as number;
        h.prevX = startX;
        h.prevY = startY;

        h.flightTl = gsap.timeline({
            onUpdate: () => h.applyProceduralTilt(),
            onComplete: () => {
                h.updateStateClasses('idle', 'neutral');
                gsap.to(h.tiltWrap, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                if (h.headEl) {
                    gsap.to(h.headEl, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                }
                gsap.to(h.creatureEl, {
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: 0,
                    scaleX: h.facing > 0 ? 1 : -1,
                    scaleY: 1,
                    duration: 0.4,
                    ease: 'power2.out',
                });
                h.facing = 1;
                h.currentFacing = 1;

                h.startIdleFloat();

                h.wanderTimer = setTimeout(
                    () => {
                        this.wanderNext();
                    },
                    4000 + Math.random() * 2000
                );
            },
        });

        const dx = targetX - startX;
        const dy = targetY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = Math.max(1.5, Math.min(3.5, dist / 250));

        h.flightTl.to(h.mover, {
            duration,
            ease: 'power2.inOut',
            motionPath: {
                path: [
                    { x: startX + dx * 0.3, y: startY + dy * 0.3 - 50 },
                    { x: startX + dx * 0.7, y: targetY + 30 },
                    { x: targetX, y: targetY },
                ],
                curviness: 1.2,
                type: 'soft',
            },
        });
    }

    returnFromWander(): void {
        const h = this.host;
        h.isWandering = false;
        if (h.wanderTimer) {
            clearTimeout(h.wanderTimer);
            h.wanderTimer = null;
        }

        if (h.state !== State.IDLE || !h.mover) return;

        h.killFlight();
        h.stopFloat();
        h.updateStateClasses('flying', 'confirming');
        h.playSynthBeep(450, 'sine', 0.2);

        const startX = gsap.getProperty(h.mover, 'x') as number;
        const startY = gsap.getProperty(h.mover, 'y') as number;
        h.prevX = startX;
        h.prevY = startY;

        h.flightTl = gsap.timeline({
            onUpdate: () => h.applyProceduralTilt(),
            onComplete: () => {
                gsap.to(h.tiltWrap, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                if (h.headEl) {
                    gsap.to(h.headEl, { rotation: 0, duration: 0.4, ease: 'power2.out' });
                }
                gsap.to(h.creatureEl, {
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: 0,
                    scaleX: h.facing > 0 ? 1 : -1,
                    scaleY: 1,
                    duration: 0.4,
                    ease: 'power2.out',
                });
                h.facing = 1;
                h.currentFacing = 1;

                h.startIdleFloat();
            },
        });

        const dx = -startX;
        const dy = -startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = Math.max(1.2, Math.min(2.5, dist / 300));

        h.flightTl.to(h.mover, {
            duration,
            ease: 'power2.inOut',
            motionPath: {
                path: [
                    { x: startX * 0.6, y: startY * 0.6 - 40 },
                    { x: 0, y: 0 },
                ],
                curviness: 1.0,
                type: 'soft',
            },
        });
    }
}
