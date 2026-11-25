import { Component, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { AVATAR_MAX_MB, AVATAR_TYPES } from '../../../core/config/social';
import { UserDto } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { UsersService } from '../../../core/services/users.service';
import { apiErrorMessage } from '../../../core/utils/api-errors';
import { FilePreview } from '../../../core/utils/file-preview';
import { PendingAction } from '../../../core/utils/pending-action';
import { PersonAvatar } from '../../../shared/person-avatar/person-avatar';

const CAPTIONS: Record<UserDto['avatarSource'], string> = {
  GOOGLE: 'Foto del tuo account Google',
  CUSTOM: 'La tua foto',
  NONE: 'Nessuna foto: si vede la tua iniziale',
};

/**
 * The photo in "Modifica profilo" (canvas 4b, social phase 2): the camera opens "Carica una foto"
 * (JPG, PNG or WebP up to 5 MB, checked here first), "Usa la foto di Google" and "Togli la foto". It
 * saves at once, not with "Salva" (F10 of the dancer's profile), and the session's user follows, so
 * the menu and the profile show it everywhere. Name and email come from Google and only show.
 */
@Component({
  selector: 'app-avatar-editor',
  imports: [PersonAvatar],
  templateUrl: './avatar-editor.html',
  styleUrl: './avatar-editor.css',
  // The profile's camera button links here (/il-tuo-account#foto).
  host: { id: 'foto' },
})
export class AvatarEditor {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);

  protected readonly user = this.auth.currentUser;
  protected readonly menuOpen = signal(false);

  constructor() {
    // Arrived from the profile's camera (/il-tuo-account#foto): the photo's choices open, in view.
    // The router doesn't scroll to fragments in this app, so it's done here.
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    const host: HTMLElement = inject(ElementRef).nativeElement;
    afterNextRender(() => {
      if (fragment !== 'foto') return;
      this.menuOpen.set(true);
      host.scrollIntoView({ block: 'center' });
    });
  }
  protected readonly saving = new PendingAction();
  protected readonly status = signal<string | null>(null);
  protected readonly preview = new FilePreview();
  protected readonly accept = AVATAR_TYPES.join(',');
  protected readonly maxMb = AVATAR_MAX_MB;

  protected readonly source = computed(() => this.user()?.avatarSource ?? 'GOOGLE');
  protected readonly caption = computed(() => CAPTIONS[this.source()]);
  /** While a new photo uploads, it shows already. */
  protected readonly shownUrl = computed(() => this.preview.url() ?? this.user()?.avatarUrl ?? null);
  protected readonly canUseGoogle = computed(() => this.source() !== 'GOOGLE' && !!this.user()?.googleAvatarUrl);
  protected readonly canRemove = computed(() => this.source() !== 'NONE');

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
    this.status.set(null);
    this.saving.error.set(null);
  }

  protected picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      this.saving.error.set('Scegli una foto JPG, PNG o WebP.');
      return;
    }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
      this.saving.error.set(`La foto è troppo grande: massimo ${AVATAR_MAX_MB} MB.`);
      return;
    }
    this.preview.show(file);
    this.save(this.users.uploadAvatar(file), 'Foto aggiornata');
  }

  protected useGoogle(): void {
    this.save(this.users.setAvatarSource('GOOGLE'), 'Ora usi la foto di Google');
  }

  protected remove(): void {
    this.save(this.users.setAvatarSource('NONE'), 'Foto tolta');
  }

  private save(request: Observable<UserDto>, done: string): void {
    this.status.set(null);
    this.saving.run(request, {
      complete: () => {
        this.preview.clear();
        this.menuOpen.set(false);
        this.status.set(done);
      },
      errorMessage: (error) => {
        this.preview.clear();
        return apiErrorMessage(
          error,
          {
            413: `La foto è troppo grande: massimo ${AVATAR_MAX_MB} MB.`,
            415: 'Scegli una foto JPG, PNG o WebP.',
          },
          'Non siamo riusciti a cambiare la foto. Riprova tra poco.',
        );
      },
    });
  }
}
