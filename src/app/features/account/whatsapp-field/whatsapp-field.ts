import { Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FEATURE_FLAGS } from '../../../core/config/feature-flags';
import { VISIBILITY_ORDER, WHATSAPP_VISIBILITY_LABELS, WHATSAPP_VISIBILITY_TEXTS } from '../../../core/config/social';
import { ContactVisibility } from '../../../core/models/user.model';
import { FeatureFlagService } from '../../../core/services/feature-flag.service';
import { controlValue } from '../../../core/utils/form-controls';
import { isValidWhatsapp, normalizeWhatsapp } from '../../../core/utils/whatsapp';
import { Choice, ChoiceGroup } from '../../../shared/choice-group/choice-group';
import { RequestField } from '../../../shared/request-field/request-field';
import { ToggleSwitch } from '../../../shared/toggle-switch/toggle-switch';
import { PROFILE_FORM } from '../profile-form';

/** WhatsApp in "Il tuo account": the number, typed however the user likes (normalizeWhatsapp
 * makes it +39…, and the hint shows it), and who sees it. With the social features, "Chi vede il
 * tuo WhatsApp": everyone, friends or nobody. Without, the old "Mostra il mio WhatsApp" switch,
 * which leaves "friends" as it is unless it's tapped (a new user starts there), and says what the
 * value saved means, "friends" included. */
@Component({
  selector: 'app-whatsapp-field',
  imports: [ReactiveFormsModule, ChoiceGroup, RequestField, ToggleSwitch],
  templateUrl: './whatsapp-field.html',
  styleUrl: './whatsapp-field.css',
})
export class WhatsappField {
  protected readonly form = inject(PROFILE_FORM);
  protected readonly socialEnabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.social);

  private readonly number = controlValue(this.form.controls.whatsapp);
  protected readonly visibility = controlValue(this.form.controls.whatsappVisibility);
  protected readonly visible = computed(() => this.visibility() !== 'NOBODY');
  protected readonly visibilityText = computed(() => WHATSAPP_VISIBILITY_TEXTS[this.visibility()]);
  protected readonly visibilityChoices: Choice<ContactVisibility>[] = VISIBILITY_ORDER.map((value) => ({
    value,
    label: WHATSAPP_VISIBILITY_LABELS[value],
  }));

  /** What the number will be saved as, once it's a number at all. */
  protected readonly hint = computed(() => {
    const number = this.number();
    return number.trim() && isValidWhatsapp(number)
      ? `Lo salviamo come ${normalizeWhatsapp(number)}`
      : 'Scrivilo come vuoi: il +39 lo aggiungiamo noi.';
  });

  /** The switch without the social features: off is NOBODY, on is EVERYONE. */
  protected toggleVisible(): void {
    const control = this.form.controls.whatsappVisibility;
    control.setValue(this.visible() ? 'NOBODY' : 'EVERYONE');
    control.markAsDirty();
  }
}
