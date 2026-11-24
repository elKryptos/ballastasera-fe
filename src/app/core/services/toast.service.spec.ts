import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => (toasts = TestBed.inject(ToastService)));

  it('shows one toast at a time, the newest', () => {
    toasts.show('Uno');
    toasts.show('Due');
    expect(toasts.current()?.message).toBe('Due');
  });

  it('doesn\'t show the same message twice in a row', () => {
    toasts.show('Uno');
    const first = toasts.current();
    toasts.show('Uno');
    expect(toasts.current()).toBe(first);
  });

  it('closes only the toast a late timer was set for', () => {
    toasts.show('Uno');
    const first = toasts.current()!.id;
    toasts.show('Due');
    toasts.dismiss(first);
    expect(toasts.current()?.message).toBe('Due');
    toasts.dismiss();
    expect(toasts.current()).toBeNull();
  });
});
