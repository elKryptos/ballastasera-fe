import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { FormSave, PendingAction } from './pending-action';

const message = () => 'Riprova.';

describe('PendingAction', () => {
  it('is busy while the request is on its way, and ignores another tap meanwhile', () => {
    const action = new PendingAction();
    const request = new Subject<string>();
    let sent = 0;

    action.run(request, { next: () => sent++, errorMessage: message });
    action.run(of('again'), { next: () => sent++, errorMessage: message });
    expect(action.busy()).toBe(true);

    request.next('ok');
    request.complete();
    expect(action.busy()).toBe(false);
    expect(sent).toBe(1);
  });

  it('runs complete only once the request is over and went well', () => {
    const action = new PendingAction();
    let completed = false;
    action.run(throwError(() => new Error('down')), { complete: () => (completed = true), errorMessage: message });
    expect(completed).toBe(false);
    expect(action.error()).toBe('Riprova.');

    action.run(of(null), { complete: () => (completed = true), errorMessage: message });
    expect(completed).toBe(true);
    expect(action.error()).toBeNull();
  });
});

describe('FormSave', () => {
  it('says saved until the form changes again', () => {
    const control = new FormControl('');
    const save = TestBed.runInInjectionContext(() => new FormSave(control));

    save.run(of('ok'), { errorMessage: message });
    expect(save.saved()).toBe(true);

    control.setValue('changed');
    expect(save.saved()).toBe(false);
  });

  it('is not saved when it fails', () => {
    const save = TestBed.runInInjectionContext(() => new FormSave(new FormControl('')));
    save.run(throwError(() => new Error('down')), { errorMessage: message });
    expect(save.saved()).toBe(false);
    expect(save.error()).toBe('Riprova.');
  });
});
