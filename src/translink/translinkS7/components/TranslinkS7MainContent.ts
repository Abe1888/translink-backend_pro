import { TranslinkS7ContentSection } from '../sections/TranslinkS7ContentSection';
import { TranslinkS7Footer } from './TranslinkS7Footer';

export class TranslinkS7MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS7ContentSection().mount(main);

        new TranslinkS7Footer().mount(main);

        parent.appendChild(main);
    }
}
