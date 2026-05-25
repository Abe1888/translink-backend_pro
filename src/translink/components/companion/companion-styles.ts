/**
 * companion-styles.ts
 * ──────────────────────────────────────────────────────────────────
 * All procedural CSS for the companion robot (previously inlined as
 * the PROC_CSS constant inside TranslinkEasterEggFriend.ts).
 *
 * Extracted as a pure string constant so the main class can inject
 * it into the DOM via a <style> tag without mixing presentation
 * concerns into logic.
 */

export const PROC_CSS = `
#tl-companion {
  --robot-color: #e0e0e0;
  --accent-glow: var(--brand-crimson);
  --brand-cyan: #00d2ff;
  --brand-crimson: #c0202f;
  
  /* 3D context perspective */
  perspective: 800px;
  
  /* Uniform scaling origin anchors */
  transform-origin: right bottom;
  transition: transform 0.3s ease;
}

html[dir="rtl"] #tl-companion {
  transform-origin: left bottom;
}

@media (max-width: 1024px) {
  #tl-companion {
    transform: scale(0.75);
    pointer-events: auto !important;
  }
}

@media (max-width: 640px) {
  #tl-companion {
    transform: scale(0.6);
    pointer-events: auto !important;
  }
}

#tl-companion .robot-creature {
  position: relative;
  width: 90px;
  height: 110px;
  z-index: 5;
  pointer-events: auto;
  cursor: pointer;
  transform-style: preserve-3d;
  transform-origin: center bottom;
  will-change: transform;
  transition: opacity 0.4s ease;
}

#tl-companion .robot-floating-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform-style: preserve-3d;
}

/* --- STATE IDLE FLOATING ANIMATION --- */
#tl-companion.state-idle .robot-floating-wrapper {
  animation: robotFloat 3.5s ease-in-out infinite;
}

@keyframes robotFloat {
  0%, 100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-10px) rotate(1deg);
  }
}

/* --- ROBOT HEAD --- */
#tl-companion .robot-head {
  width: 52px;
  height: 44px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 45%), 
              radial-gradient(circle at 75% 75%, rgba(0, 0, 0, 0.4) 0%, transparent 60%), 
              var(--robot-color);
  border-radius: 50% 50% 45% 45%;
  margin: 0 auto;
  position: relative;
  z-index: 2;
  box-shadow: inset -5px -8px 15px rgba(0, 0, 0, 0.4), 
              inset 3px 3px 10px rgba(255, 255, 255, 0.4), 
              0 10px 20px rgba(0, 0, 0, 0.5);
  transform-origin: bottom center;
  transform-style: preserve-3d;
  transform: translateZ(5px);
  will-change: transform;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

#tl-companion.state-idle .robot-head {
  animation: robotLookAround 4s ease-in-out infinite;
}

@keyframes robotLookAround {
  0%, 40%, 100% {
    transform: rotateY(0deg) rotateZ(0deg) translateZ(5px);
  }
  15% {
    transform: rotateY(-10deg) rotateZ(-1deg) translateZ(5px);
  }
  25% {
    transform: rotateY(10deg) rotateZ(1deg) translateZ(5px);
  }
}

/* --- VISOR & EYES --- */
#tl-companion .robot-visor {
  width: 38px;
  height: 16px;
  background: #0d0d11;
  border-radius: 12px;
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%) translateZ(8px) translate(var(--visor-offset-x, 0px), var(--visor-offset-y, 0px));
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 210, 255, 0.3);
  will-change: transform;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

#tl-companion .robot-visor::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.15), transparent);
  pointer-events: none;
}

#tl-companion .robot-eye {
  width: 8px;
  height: 5px;
  background: var(--brand-cyan);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--brand-cyan);
  transform: translate(var(--eye-offset-x, 0px), var(--eye-offset-y, 0px));
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* --- HEADSET & EARCUPS --- */
#tl-companion .robot-headset {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%) translateZ(2px);
  width: 60px;
  height: 38px;
  border-top: 4px solid #1c1c24;
  border-radius: 50% 50% 0 0;
  z-index: 3;
  transform-style: preserve-3d;
}

#tl-companion .earcup {
  width: 12px;
  height: 18px;
  background: linear-gradient(135deg, #2a2a35 0%, #1c1c24 100%);
  border-radius: 5px;
  position: absolute;
  top: 16px;
  box-shadow: inset 2px 2px 4px rgba(255, 255, 255, 0.1), 0 3px 8px rgba(0, 0, 0, 0.5);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

#tl-companion .earcup.l {
  left: -7px;
}

#tl-companion .earcup.r {
  right: -7px;
}

#tl-companion .robot-mic {
  width: 16px;
  height: 3px;
  background: #1c1c24;
  position: absolute;
  bottom: -2px;
  right: -3px;
  transform: rotate(35deg);
  transform-origin: left center;
}

#tl-companion .robot-mic::after {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--brand-cyan);
  border-radius: 50%;
  position: absolute;
  right: -3px;
  top: -1.5px;
  box-shadow: 0 0 5px var(--brand-cyan), inset 1px 1px 2px rgba(255, 255, 255, 0.5);
}

#tl-companion .robot-antenna {
  width: 2px;
  height: 14px;
  background: rgba(255, 255, 255, 0.4);
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%) translateZ(2px);
}

#tl-companion .robot-antenna::after {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--brand-cyan);
  border-radius: 50%;
  position: absolute;
  top: -4px;
  left: -2px;
  box-shadow: 0 0 10px var(--brand-cyan);
}

/* --- ROBOT BODY --- */
#tl-companion .robot-body {
  width: 44px;
  height: 65px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 45%), 
              radial-gradient(circle at 75% 75%, rgba(0, 0, 0, 0.4) 0%, transparent 60%), 
              var(--robot-color);
  border-radius: 35% 35% 75% 75%;
  margin: -10px auto 0;
  position: relative;
  z-index: 1;
  box-shadow: inset -6px -8px 18px rgba(0, 0, 0, 0.4), 
              inset 3px 3px 12px rgba(255, 255, 255, 0.3), 
              0 12px 25px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  padding-top: 16px;
  transform-origin: top center;
  transform-style: preserve-3d;
  transform: translateZ(0);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

#tl-companion.state-idle .robot-body {
  animation: robotBodyFollow 4s ease-in-out infinite;
}

@keyframes robotBodyFollow {
  0%, 40%, 100% {
    transform: rotateY(0deg) rotateZ(0deg) translateY(0) translateZ(0);
  }
  15% {
    transform: rotateY(-6deg) rotateZ(-1deg) translateY(0.5px) translateZ(0);
  }
  25% {
    transform: rotateY(6deg) rotateZ(1deg) translateY(0.5px) translateZ(0);
  }
}

/* --- ROBOT EMBLEM --- */
#tl-companion .robot-emblem {
  width: 24px;
  height: 24px;
  background: var(--accent-glow);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 12px var(--accent-glow);
  overflow: hidden;
  transform: translateZ(3px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

#tl-companion .robot-emblem img,
#tl-companion .robot-emblem svg {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

/* --- ROBOT HANDS / ARMS --- */
#tl-companion .robot-hand {
  width: 10px;
  height: 48px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.5) 0%, transparent 60%), 
              var(--robot-color);
  position: absolute;
  top: -3px;
  z-index: 0;
  box-shadow: inset -3px -3px 8px rgba(0, 0, 0, 0.4), 
              0 5px 10px rgba(0, 0, 0, 0.4);
  transform: translateZ(-8px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

#tl-companion .robot-hand.l {
  left: -5px;
  transform: rotate(16deg) translateZ(-8px);
  transform-origin: top center;
  border-radius: 100% 25% 5% 85%;
}

#tl-companion .robot-hand.r {
  right: -5px;
  transform: rotate(-16deg) translateZ(-8px);
  transform-origin: top center;
  border-radius: 25% 100% 85% 5%;
}

#tl-companion.state-idle .robot-hand.l {
  animation: robotHoverL 3s ease-in-out infinite alternate;
}

#tl-companion.state-idle .robot-hand.r {
  animation: robotHoverR 3s ease-in-out infinite alternate;
}

@keyframes robotHoverL {
  0% {
    transform: rotate(18deg) translateY(0) translateZ(-8px);
  }
  100% {
    transform: rotate(10deg) translateY(6px) translateX(1px) translateZ(-8px);
  }
}

@keyframes robotHoverR {
  0% {
    transform: rotate(-18deg) translateY(0) translateZ(-8px);
  }
  100% {
    transform: rotate(-10deg) translateY(6px) translateX(-1px) translateZ(-8px);
  }
}

/* ========================================== */
/*   BEHAVIOR STATE CSS MODIFIERS             */
/* ========================================== */

/* --- FLYING STATE --- */
#tl-companion.state-flying .robot-hand.l {
  transform: rotate(45deg) translateZ(-8px);
  height: 35px;
}

#tl-companion.state-flying .robot-hand.r {
  transform: rotate(-45deg) translateZ(-8px);
  height: 35px;
}

#tl-companion.state-flying .robot-floating-wrapper {
  animation: robotThruster 1.5s ease-in-out infinite alternate !important;
}

@keyframes robotThruster {
  0% {
    transform: translateY(0) rotate(-1.5deg);
  }
  100% {
    transform: translateY(-6px) rotate(1.5deg);
  }
}

/* --- GRABBING STATE --- */
#tl-companion.state-grabbing .robot-hand.l {
  transform: rotate(90deg) translateY(-15px) translateZ(-8px);
  height: 50px;
}

#tl-companion.state-grabbing .robot-hand.r {
  transform: rotate(-90deg) translateY(-15px) translateZ(-8px);
  height: 50px;
}

/* --- ERROR / CLARIFICATION STATE --- */
#tl-companion.state-alert .robot-head {
  background: linear-gradient(135deg, #d8dde5, #f4f7fa) !important;
  animation: attentivePause 1.8s infinite ease-in-out;
}

#tl-companion.state-alert .robot-eye {
  background: #ffb84d;
  box-shadow: 0 0 10px rgba(255, 184, 77, 0.65);
  transform: scaleY(0.72);
}

@keyframes attentivePause {
  0%, 100% { transform: rotateY(0) translateZ(5px); }
  50% { transform: rotateY(4deg) translateZ(5px); }
}

/* --- GUIDING STATE --- */
#tl-companion.state-guiding .robot-hand.r {
  transform: rotate(-90deg) translateY(-2px) translateZ(-8px);
  height: 50px;
}

html[dir="rtl"] #tl-companion.state-guiding .robot-hand.r {
  transform: rotate(-90deg) translateY(-2px) translateZ(-8px) !important;
  height: 50px !important;
}

html[dir="rtl"] #tl-companion.state-guiding .robot-hand.l {
  transform: rotate(16deg) translateZ(-8px) !important;
  height: 48px !important;
}

/* --- THINKING STATE --- */
#tl-companion.state-thinking .robot-visor {
  display: block;
  position: relative;
}

#tl-companion.state-thinking .robot-eye {
  position: absolute;
  top: 5px;
  animation: cylonScan 1.5s infinite alternate ease-in-out;
}

#tl-companion.state-thinking .robot-eye:nth-child(2) {
  display: none;
}

@keyframes cylonScan {
  0% { left: 5px; }
  100% { left: 25px; }
}

/* --- CONNECTING / THINKING STATE --- */
#tl-companion.state-thinking .robot-emblem {
  animation: emblemBreathe 1s infinite ease-in-out alternate;
}

@keyframes emblemBreathe {
  0% {
    box-shadow: 0 0 5px var(--brand-crimson);
    filter: drop-shadow(0 0 2px var(--brand-crimson));
  }
  100% {
    box-shadow: 0 0 25px var(--brand-crimson), 0 0 35px var(--brand-crimson);
    filter: drop-shadow(0 0 10px var(--brand-crimson));
  }
}

/* --- LISTENING STATE --- */
#tl-companion.state-listening .robot-emblem {
  box-shadow: 0 0 14px var(--brand-crimson), 0 0 24px rgba(192, 32, 47, 0.45);
  animation: emblemPulse 1.8s infinite ease-in-out alternate;
}

#tl-companion.state-listening .earcup {
  background: var(--brand-cyan) !important;
  box-shadow: 0 0 15px var(--brand-cyan) !important;
}

#tl-companion.state-listening .robot-eye {
  background: var(--brand-cyan) !important;
  box-shadow: 0 0 10px var(--brand-cyan) !important;
}

@keyframes emblemPulse {
  0% { box-shadow: 0 0 8px rgba(192, 32, 47, 0.75); }
  100% { box-shadow: 0 0 22px rgba(192, 32, 47, 0.85), 0 0 34px rgba(0, 210, 255, 0.16); }
}

/* --- SPEAKING STATE --- */
#tl-companion.state-speaking .robot-emblem {
  animation: speakPulse 0.38s infinite alternate !important;
}

@keyframes speakPulse {
  0% {
    transform: scale(1) translateZ(3px);
    box-shadow: 0 0 8px var(--brand-crimson);
  }
  100% {
    transform: scale(1.08) translateZ(3px);
    box-shadow: 0 0 20px var(--brand-crimson), 0 0 28px rgba(192, 32, 47, 0.5);
  }
}

/* --- EMBLEM PULSE GUIDE: Attention-grabbing glow to guide visitor to click the red logo --- */
#tl-companion .robot-emblem.emblem-pulse-guide {
  animation: emblemGuideGlow 1.2s ease-in-out infinite !important;
  cursor: pointer;
  z-index: 10;
}

@keyframes emblemGuideGlow {
  0%, 100% {
    transform: scale(1) translateZ(3px);
    box-shadow: 0 0 12px var(--brand-crimson), 0 0 24px rgba(255, 0, 85, 0.4);
  }
  50% {
    transform: scale(1.16) translateZ(5px);
    box-shadow: 0 0 22px var(--brand-crimson), 0 0 42px rgba(255, 0, 85, 0.42), 0 0 54px rgba(0, 210, 255, 0.16);
  }
}

@keyframes professionalAttention {
  0%, 100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  50% {
    transform: translateY(-4px) rotate(0.75deg) scale(1.01);
  }
}

/* ========================================== */
/*   EMOTION MATRIX OVERRIDES                 */
/* ========================================== */
#tl-companion.exp-error .robot-eye {
  transform: scaleY(0.72);
  background: #ffb84d;
  box-shadow: 0 0 10px rgba(255, 184, 77, 0.65);
}

#tl-companion.exp-confirming .robot-eye {
  border-radius: 8px;
  transform: scale(1.05);
  background: var(--brand-cyan);
  box-shadow: 0 0 10px rgba(0, 210, 255, 0.7);
}

#tl-companion.exp-empathetic .robot-eye {
  transform: scaleY(0.86);
  background: #9be7ff;
  box-shadow: 0 0 10px rgba(155, 231, 255, 0.6);
}

#tl-companion.exp-thinking .robot-eye {
  transform: scaleY(0.78);
  background: #ffffff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.55);
}

/* --- CALM CLICK ACKNOWLEDGEMENT --- */
#tl-companion.popping {
  animation: tl-pop 0.45s ease-out;
}

@keyframes tl-pop {
  0% { transform: scale(1); }
  45% { transform: scale(1.04) translateY(-3px); }
  100% { transform: scale(1); }
}

/* Notebook top binding & rings */
.tl-notepad-card .notepad-binding {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: -6px;
  margin-bottom: 6px;
}
.tl-notepad-card .binding-ring {
  width: 4px;
  height: 12px;
  background: linear-gradient(to bottom, #ffffff 0%, #a1a1aa 40%, #52525b 70%, #18181b 100%);
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.6);
  border: 0.5px solid rgba(255, 255, 255, 0.2);
}

/* --- STOP TALKING BUTTON (Animated Wave Bars) --- */
.tl-stop-speech-btn {
  position: absolute;
  bottom: 32px;
  right: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  z-index: 10000;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: auto;
}

html[dir="rtl"] .tl-stop-speech-btn {
  right: auto;
  left: 100px;
}

@media (max-width: 1024px) {
  .tl-stop-speech-btn {
    bottom: 25px;
    right: 85px;
  }
  html[dir="rtl"] .tl-stop-speech-btn {
    left: 85px;
    right: auto;
  }
}

@media (max-width: 640px) {
  .tl-stop-speech-btn {
    bottom: 20px;
    right: 72px;
  }
  html[dir="rtl"] .tl-stop-speech-btn {
    left: 72px;
    right: auto;
  }
}

.tl-stop-speech-btn:hover {
  transform: scale(1.15);
}

.tl-stop-speech-btn:active {
  transform: scale(0.9);
}

.tl-stop-speech-btn .stop-waves {
  width: 24px;
  height: 24px;
  stroke: var(--brand-crimson);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  filter: drop-shadow(0 0 3px rgba(192, 32, 47, 0.5));
  transition: all 0.3s ease;
}

.tl-stop-speech-btn:hover .stop-waves {
  filter: drop-shadow(0 0 8px var(--brand-crimson));
}

/* Animated wave bars — each bar bounces with a staggered delay */
.tl-stop-speech-btn .stop-waves path {
  animation: waveBarBounce 0.8s ease-in-out infinite alternate;
  transform-origin: center center;
}
.tl-stop-speech-btn .stop-waves path:nth-child(1) { animation-delay: 0s; }
.tl-stop-speech-btn .stop-waves path:nth-child(2) { animation-delay: 0.12s; }
.tl-stop-speech-btn .stop-waves path:nth-child(3) { animation-delay: 0.24s; }
.tl-stop-speech-btn .stop-waves path:nth-child(4) { animation-delay: 0.12s; }
.tl-stop-speech-btn .stop-waves path:nth-child(5) { animation-delay: 0s; }

@keyframes waveBarBounce {
  0% {
    d: path(attr(d));
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* Actual bar height animation via scaleY per bar */
.tl-stop-speech-btn .stop-waves .wave-bar {
  animation: wavePulse 0.6s ease-in-out infinite alternate;
}
.tl-stop-speech-btn .stop-waves .wave-bar:nth-child(1) { animation-delay: 0s; animation-duration: 0.5s; }
.tl-stop-speech-btn .stop-waves .wave-bar:nth-child(2) { animation-delay: 0.1s; animation-duration: 0.4s; }
.tl-stop-speech-btn .stop-waves .wave-bar:nth-child(3) { animation-delay: 0.05s; animation-duration: 0.55s; }
.tl-stop-speech-btn .stop-waves .wave-bar:nth-child(4) { animation-delay: 0.15s; animation-duration: 0.45s; }
.tl-stop-speech-btn .stop-waves .wave-bar:nth-child(5) { animation-delay: 0.08s; animation-duration: 0.5s; }

@keyframes wavePulse {
  0%   { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
}
`;
