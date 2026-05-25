import { TranslinkS8ContentSection } from '../sections/TranslinkS8ContentSection';
import { TranslinkS8Footer } from './TranslinkS8Footer';

export class TranslinkS8MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS8ContentSection().mount(main);

        new TranslinkS8Footer().mount(main);

        parent.appendChild(main);
    }
}
