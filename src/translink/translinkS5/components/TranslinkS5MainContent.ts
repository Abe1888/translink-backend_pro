import { TranslinkS5ContentSection } from '../sections/TranslinkS5ContentSection';
import { TranslinkS5Footer } from './TranslinkS5Footer';

export class TranslinkS5MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS5ContentSection().mount(main);

        new TranslinkS5Footer().mount(main);

        parent.appendChild(main);
    }
}
