import { TranslinkLanguageController } from '../controllers/TranslinkLanguageController';

export class TranslinkLanguageToggle {
    private button: HTMLElement | null = null;
    private langController: TranslinkLanguageController;

    constructor() {
        this.langController = TranslinkLanguageController.getInstance();
    }

    mount(parent: HTMLElement): void {
        const enabledLangs = this.langController.getEnabledLanguages();
        if (enabledLangs.length <= 1) {
            return; // Completely hide from UI if only 1 language is enabled
        }

        this.button = document.createElement('button');
        this.button.id = 'global-language-toggle';
        // Positioned slightly to the left of the SoundToggle
        this.button.className =
            'fixed top-6 right-20 md:top-10 md:right-24 z-[var(--z-ui-global)] flex items-center justify-center transition-all duration-300 hover:scale-110 group cursor-pointer p-2';
        this.button.setAttribute('aria-label', 'Toggle Language');

        const currentLang = this.langController.getLanguage();
        const currentIndex = enabledLangs.indexOf(currentLang);
        const nextIndex = (currentIndex + 1) % enabledLangs.length;
        const nextLang = enabledLangs[nextIndex];
        const displayLang = nextLang.toUpperCase();

        this.button.innerHTML = `
            <div class="lang-icon-container w-[30px] h-[30px] flex items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-[#f5f1e8]/70 dark:bg-black/40 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:bg-[#f5f1e8] dark:group-hover:bg-black group-hover:border-black/25 dark:group-hover:border-white/20">
                <span class="text-[8.5px] font-black text-[var(--theme-h-color)] tracking-tight uppercase">
                    ${displayLang}
                </span>
            </div>
        `;

        this.button.addEventListener('click', () => {
            this.langController.toggleLanguage();
        });

        parent.appendChild(this.button);
    }
}
