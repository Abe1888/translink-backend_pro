import { TranslinkS10ContentSection } from '../sections/TranslinkS10ContentSection';
import { TranslinkS10Footer } from './TranslinkS10Footer';

export class TranslinkS10MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS10ContentSection().mount(main);

        new TranslinkS10Footer().mount(main);

        parent.appendChild(main);
    }
}
