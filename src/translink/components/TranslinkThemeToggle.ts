/**
 * TranslinkThemeToggle - Premium HUD Theme Control
 *
 * Implements a gorgeous, rotating Sun/Moon theme toggle in the global HUD.
 * Synchronizes with index.html's IIFE pre-loader and World.ts 3D background.
 */
export class TranslinkThemeToggle {
    private button: HTMLElement | null = null;
    private isDark: boolean = false;

    constructor() {
        // Read initial theme preference matching index.html logic
        const storedTheme = localStorage.getItem('theme');
        this.isDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    mount(parent: HTMLElement): void {
        this.button = document.createElement('button');
        this.button.id = 'global-theme-toggle';
        
        // Positioned perfectly to the left of the Language Toggle
        // LTR: right-[8.5rem] (mobile) / right-[9.5rem] (desktop)
        // RTL overrides are handled dynamically via translink-shared.css [dir="rtl"] #global-theme-toggle
        this.button.className =
            'fixed top-6 right-[8.5rem] md:top-10 md:right-[9.5rem] z-[var(--z-ui-global)] flex items-center justify-center transition-all duration-300 hover:scale-110 group cursor-pointer p-2';
        this.button.setAttribute('aria-label', 'Toggle Theme');
        this.button.setAttribute('aria-pressed', this.isDark ? 'true' : 'false');

        // Premium double-SVG structure allowing smooth cross-fade rotation transitions
        this.button.innerHTML = `
            <div class="theme-icon-container w-[30px] h-[30px] flex items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-[#f5f1e8]/70 dark:bg-black/40 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:bg-[#f5f1e8] dark:group-hover:bg-black group-hover:border-black/25 dark:group-hover:border-white/20 relative overflow-hidden">
                <!-- Sun SVG -->
                <svg class="sun-icon w-4 h-4 absolute transition-all duration-500 ease-out" viewBox="0 0 24 24" fill="none" stroke="var(--theme-h-color)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
                <!-- Moon SVG -->
                <svg class="moon-icon w-4 h-4 absolute transition-all duration-500 ease-out" viewBox="0 0 24 24" fill="none" stroke="var(--theme-h-color)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            </div>
        `;

        this.button.addEventListener('click', () => this.toggle());

        parent.appendChild(this.button);
        this.updateButtonState();
    }

    toggle(): void {
        this.isDark = !this.isDark;
        if (this.isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
        this.updateButtonState();

        // Dispatch dynamic theme sync event
        window.dispatchEvent(new CustomEvent('translink:theme-change', { detail: { isDark: this.isDark } }));
    }

    private updateButtonState(): void {
        if (!this.button) return;

        this.button.setAttribute('aria-pressed', this.isDark ? 'true' : 'false');
        
        const sun = this.button.querySelector('.sun-icon') as SVGElement;
        const moon = this.button.querySelector('.moon-icon') as SVGElement;

        if (this.isDark) {
            if (sun) {
                sun.style.transform = 'rotate(-90deg) scale(0)';
                sun.style.opacity = '0';
            }
            if (moon) {
                moon.style.transform = 'rotate(0deg) scale(1)';
                moon.style.opacity = '1';
                moon.style.fill = 'var(--theme-h-color)';
            }
        } else {
            if (sun) {
                sun.style.transform = 'rotate(0deg) scale(1)';
                sun.style.opacity = '1';
                sun.style.fill = 'none';
            }
            if (moon) {
                moon.style.transform = 'rotate(90deg) scale(0)';
                moon.style.opacity = '0';
            }
        }
    }
}
