import { TranslinkS2ContentSection } from '../sections/TranslinkS2ContentSection';
import { TranslinkS2Footer } from './TranslinkS2Footer';

export class TranslinkS2MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative h-full min-h-full';

        new TranslinkS2ContentSection().mount(main);

        new TranslinkS2Footer().mount(main);

        parent.appendChild(main);
    }
}
