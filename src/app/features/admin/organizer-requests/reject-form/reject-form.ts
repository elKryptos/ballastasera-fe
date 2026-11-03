import { Component, computed, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { REJECT_REASON_LABELS } from '../../../../core/config/organizer-types';
import { OrganizerRejectReason, OrganizerRequestRejectDto } from '../../../../core/models/organizer-request.model';
import { RequestField } from '../../../../shared/request-field/request-field';

const MESSAGE_MAX_LENGTH = 500;

/** Why a request is turned down, and what the user is told. Only asks: the
 * card sends it. Same rule as the backend's: "Altro" needs a message. */
@Component({
  selector: 'app-reject-form',
  imports: [ReactiveFormsModule, RequestField],
  host: { class: 'flex flex-col gap-3.5' },
  templateUrl: './reject-form.html',
})
export class RejectForm {
  readonly requestId = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<OrganizerRequestRejectDto>();
  readonly cancelled = output<void>();

  protected readonly reasons = (Object.keys(REJECT_REASON_LABELS) as OrganizerRejectReason[]).map((value) => ({
    value,
    label: REJECT_REASON_LABELS[value],
  }));
  protected readonly maxLength = MESSAGE_MAX_LENGTH;
  protected readonly reason = signal<OrganizerRejectReason | null>(null);
  protected readonly message = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(MESSAGE_MAX_LENGTH)] });
  private readonly messageValue = toSignal(this.message.valueChanges, { initialValue: '' });

  protected readonly messageRequired = computed(() => this.reason() === 'OTHER');
  protected readonly canSubmit = computed(() => {
    const message = this.messageValue().trim();
    const reason = this.reason();
    return reason !== null && message.length <= MESSAGE_MAX_LENGTH && (reason !== 'OTHER' || message.length > 0);
  });

  protected submit(): void {
    const reason = this.reason();
    if (!reason || !this.canSubmit()) return;
    this.submitted.emit({ reason, message: this.messageValue().trim() || undefined });
  }
}
