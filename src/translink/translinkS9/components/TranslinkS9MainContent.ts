import { TranslinkS9ContentSection } from '../sections/TranslinkS9ContentSection';
import { TranslinkS9Footer } from './TranslinkS9Footer';

export class TranslinkS9MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS9ContentSection().mount(main);

        new TranslinkS9Footer().mount(main);

        parent.appendChild(main);
    }
}
