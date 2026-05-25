import { TranslinkLanguageController } from '../controllers/TranslinkLanguageController';

const CLIENT_LOGOS = [
    { src: 'airlines.png', alt: 'AIRLINES' },
    { src: 'dbe.png', alt: 'DBE' },
    { src: 'moenco.png', alt: 'MOENCO' },
    { src: 'jti.png', alt: 'JTI' },
    { src: 'bgi.png', alt: 'BGI' },
    { src: 'safari.png', alt: 'SAFARICOM' },
    { src: 'habesha.png', alt: 'HABESHA' },
    { src: 'orda.png', alt: 'ORDA' },
    { src: 'midroc.png', alt: 'MIDROC' },
    { src: 'pepsico.svg', alt: 'PEPSICO' },
    { src: 'agp.png', alt: 'AGP' },
    { src: 'crs.svg', alt: 'CRS' },
    { src: 'ghion.svg', alt: 'GHION' },
    { src: 'heineken.svg', alt: 'HEINEKEN' },
    { src: 'msf.png', alt: 'MSF' },
    { src: 'taf.png', alt: 'TAF' },
    { src: 'unilever.svg', alt: 'UNILEVER' },
];

export class TranslinkClientLogoScroll {
    private container: HTMLElement | null = null;
    private items: HTMLElement[] = [];
    private animationFrameId: number | null = null;

    mount(parent: HTMLElement): void {
        this.container = document.createElement('div');
        this.container.className = 'global-client-logo-column';

        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'logo-scroll-container';

        // Reverse the marquee loop direction dynamically in Arabic (RTL) for mirroring alignment
        const isRtl = TranslinkLanguageController.getInstance().getLanguage() === 'ar';
        if (isRtl) {
            scrollContainer.style.animationDirection = 'reverse';
        }

        // Create 3x logos for perfect mathematical loop (300% height)
        const allLogos = [...CLIENT_LOGOS, ...CLIENT_LOGOS, ...CLIENT_LOGOS];

        this.items = [];
        allLogos.forEach((logo) => {
            const item = document.createElement('div');
            item.className = 'global-client-logo-item mb-10'; // mb-10 reduces the previous mb-16 gap by 40%

            const img = document.createElement('img');
            img.src = `./images/clients/${logo.src}`;
            img.alt = logo.alt;
            img.className = 'w-full h-auto object-contain px-2'; // Ensures auto-fit to column width with slight padding
            img.loading = 'lazy';

            item.appendChild(img);
            scrollContainer.appendChild(item);
            this.items.push(item);
        });

        this.container.appendChild(scrollContainer);
        parent.appendChild(this.container);

        // Start tracking focus
        this.startFocusTracking();
    }

    private startFocusTracking(): void {
        const updateFocus = () => {
            if (!this.container) return;

            // Only run tracking if the column is visible (width > 1024px)
            if (window.innerWidth <= 1024) {
                this.animationFrameId = requestAnimationFrame(updateFocus);
                return;
            }

            const centerY = window.innerHeight / 2;
            const maxDistance = 160; // Distance in pixels over which the highlight transitions

            // Batch reads first to prevent layout thrashing
            const itemRects = this.items.map(item => item.getBoundingClientRect());

            // Write styles in batches
            this.items.forEach((item, index) => {
                const rect = itemRects[index];
                const itemCenterY = rect.top + rect.height / 2;
                const distanceFromCenter = Math.abs(itemCenterY - centerY);

                let focusFactor = 0;
                if (distanceFromCenter < maxDistance) {
                    const ratio = distanceFromCenter / maxDistance;
                    // Smooth cosine transition for high-end professional feel
                    focusFactor = 0.5 + 0.5 * Math.cos(ratio * Math.PI);
                }

                // Smoothly map focusFactor (0 -> 1) to visual properties:
                // scale: 0.88 -> 1.1
                const scale = 0.88 + 0.22 * focusFactor;
                // opacity: 0.35 -> 1.0  (more readable at edges, no fog)
                const opacity = 0.35 + 0.65 * focusFactor;
                // grayscale: 100% -> 0%
                const grayscale = (1 - focusFactor) * 100;
                // brightness: 0.75 -> 1.15
                const brightness = 0.75 + 0.4 * focusFactor;

                // Apply variables — NO blur, only grayscale + opacity for clean depth
                item.style.setProperty('--logo-scale', `${scale}`);
                item.style.setProperty('--logo-opacity', `${opacity}`);
                item.style.setProperty('--logo-grayscale', `${grayscale}%`);
                item.style.setProperty('--logo-brightness', `${brightness}`);
            });

            this.animationFrameId = requestAnimationFrame(updateFocus);
        };

        this.animationFrameId = requestAnimationFrame(updateFocus);
    }

    destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
