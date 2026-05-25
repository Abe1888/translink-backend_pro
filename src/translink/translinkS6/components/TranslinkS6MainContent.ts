import { TranslinkS6ContentSection } from '../sections/TranslinkS6ContentSection';
import { TranslinkS6Footer } from './TranslinkS6Footer';

export class TranslinkS6MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS6ContentSection().mount(main);

        new TranslinkS6Footer().mount(main);

        parent.appendChild(main);
    }
}
