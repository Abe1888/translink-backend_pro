import { TranslinkS4ContentSection } from '../sections/TranslinkS4ContentSection';
import { TranslinkS4Footer } from './TranslinkS4Footer';

export class TranslinkS4MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS4ContentSection().mount(main);

        new TranslinkS4Footer().mount(main);

        parent.appendChild(main);
    }
}
