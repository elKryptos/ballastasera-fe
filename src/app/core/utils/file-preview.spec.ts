import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilePreview } from './file-preview';

describe('FilePreview', () => {
  const file = new File(['flyer'], 'flyer.jpg', { type: 'image/jpeg' });
  let created: number;
  let revoked: string[];

  beforeEach(() => {
    created = 0;
    revoked = [];
    // jsdom has no object URLs.
    URL.createObjectURL = () => `blob:${++created}`;
    URL.revokeObjectURL = (url: string) => void revoked.push(url);
  });

  /** In a child injector, destroyed like a page that goes. */
  const inPage = () => {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    return { preview: runInInjectionContext(injector, () => new FilePreview()), injector };
  };

  it('frees the one it showed before', () => {
    const { preview } = inPage();
    preview.show(file);
    preview.show(file);
    expect(preview.url()).toBe('blob:2');
    expect(revoked).toEqual(['blob:1']);
  });

  it('frees it when cleared, and when the page goes', () => {
    const { preview, injector } = inPage();
    preview.show(file);
    preview.clear();
    expect(preview.url()).toBeNull();
    preview.show(file);
    injector.destroy();
    expect(revoked).toEqual(['blob:1', 'blob:2']);
  });
});
