import { TranslinkS3ContentSection } from '../sections/TranslinkS3ContentSection';
import { TranslinkS3Footer } from './TranslinkS3Footer';

export class TranslinkS3MainContent {
    mount(parent: HTMLElement): void {
        const main = document.createElement('main');
        main.className =
            'w-[var(--content-width)] flex-none flex flex-col overflow-visible shrink-0 relative z-10';

        new TranslinkS3ContentSection().mount(main);

        new TranslinkS3Footer().mount(main);

        parent.appendChild(main);
    }
}
