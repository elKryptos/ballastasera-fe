import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { controlValue, toggleControl } from '../../../core/utils/form-controls';
import { isValidWhatsapp, normalizeWhatsapp } from '../../../core/utils/whatsapp';
import { RequestField } from '../../../shared/request-field/request-field';
import { ToggleSwitch } from '../../../shared/toggle-switch/toggle-switch';
import { PROFILE_FORM } from '../profile-form';

/** WhatsApp in "Il tuo account": the number, typed however the user likes (normalizeWhatsapp
 * makes it +39…, and the hint shows it), and whether people opening the profile see it. */
@Component({
  selector: 'app-whatsapp-field',
  imports: [ReactiveFormsModule, RequestField, ToggleSwitch],
  templateUrl: './whatsapp-field.html',
  styleUrl: './whatsapp-field.css',
})
export class WhatsappField {
  protected readonly form = inject(PROFILE_FORM);

  private readonly number = controlValue(this.form.controls.whatsapp);
  protected readonly visible = controlValue(this.form.controls.whatsappVisible);

  /** What the number will be saved as, once it's a number at all. */
  protected readonly hint = computed(() => {
    const number = this.number();
    return number.trim() && isValidWhatsapp(number)
      ? `Lo salviamo come ${normalizeWhatsapp(number)}`
      : 'Scrivilo come vuoi: il +39 lo aggiungiamo noi.';
  });

  protected toggleVisible(): void {
    toggleControl(this.form.controls.whatsappVisible);
  }
}
