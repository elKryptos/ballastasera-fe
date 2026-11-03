import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrganizerRequestRejectDto } from '../../../../core/models/organizer-request.model';
import { RejectForm } from './reject-form';

describe('RejectForm', () => {
  let fixture: ComponentFixture<RejectForm>;
  let sent: OrganizerRequestRejectDto[];

  const element = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) => [...element().querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
  const pick = async (label: string) => {
    button(label).click();
    await fixture.whenStable();
  };
  const type = async (message: string) => {
    const textarea = element().querySelector('textarea')!;
    textarea.value = message;
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    sent = [];
    fixture = TestBed.createComponent(RejectForm);
    fixture.componentRef.setInput('requestId', 'r1');
    fixture.componentInstance.submitted.subscribe((body) => sent.push(body));
    await fixture.whenStable();
  });

  it('waits for a reason', () => {
    expect(button('Invia rifiuto').disabled).toBe(true);
  });

  it('sends a reason alone: the message is optional', async () => {
    await pick('Doppione');
    button('Invia rifiuto').click();
    expect(sent).toEqual([{ reason: 'DUPLICATE', message: undefined }]);
  });

  it('needs a message with "Altro", like the backend', async () => {
    await pick('Altro');
    expect(button('Invia rifiuto').disabled).toBe(true);

    await type('   ');
    expect(button('Invia rifiuto').disabled).toBe(true);

    await type(' Non è una scuola ');
    button('Invia rifiuto').click();
    expect(sent).toEqual([{ reason: 'OTHER', message: 'Non è una scuola' }]);
  });

  it('refuses a message over the limit', async () => {
    await pick('Doppione');
    await type('x'.repeat(501));
    expect(button('Invia rifiuto').disabled).toBe(true);
  });
});
