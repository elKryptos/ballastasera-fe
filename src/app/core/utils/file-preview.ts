import { DestroyRef, inject, signal } from '@angular/core';

/** A picked image shown before it's uploaded, or while the backend converts it: its object URL,
 * freed when another is shown, when it's cleared and when the page goes. Create it in an injection
 * context (a field initializer), like FormSave. */
export class FilePreview {
  readonly url = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  show(file: File): void {
    this.clear();
    this.url.set(URL.createObjectURL(file));
  }

  clear(): void {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
    this.url.set(null);
  }
}
