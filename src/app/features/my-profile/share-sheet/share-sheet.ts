import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, input, model, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DANCE_LEVEL_LABELS, DANCE_ROLE_LABELS, levelRank } from '../../../core/config/dance-profile';
import { UserDto } from '../../../core/models/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { initialOf } from '../../../core/utils/initials';
import { injectPageShare } from '../../../core/utils/page-share';
import { profileShareLabel, profileShareUrl } from '../../../core/utils/person-links';
import { personTone } from '../../../core/utils/person-tone';
import { Sheet } from '../../../shared/sheet/sheet';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  LEVEL_COLORS,
  PROFILE_CARD_FONTS,
  ProfileCardData,
  drawProfileCard,
} from './profile-card';

/** Styles on the card: two rows of chips at most. */
const CARD_STYLES = 4;

/** The photo, loaded so the canvas may still be exported: with CORS, or not at all (the initial). */
function loadPhoto(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * "Condividi il tuo profilo" (canvas 4, social phase 7): the card for the stories, drawn on opening
 * (profile-card.ts), with "Condividi nelle storie" (the phone's share sheet with the picture, where
 * the browser can share files; elsewhere it downloads) and "Copia il link" (ballastasera.it/@name,
 * or the /persona link until a username is picked, which it suggests). The photo is loaded with CORS
 * like the flyers; without it, the initial: a picture from elsewhere would stop the canvas exporting.
 */
@Component({
  selector: 'app-share-sheet',
  imports: [RouterLink, Sheet],
  templateUrl: './share-sheet.html',
  styleUrl: './share-sheet.css',
})
export class ShareSheet {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly toasts = inject(ToastService);
  private readonly pageShare = injectPageShare();

  readonly open = model(false);
  readonly user = input.required<UserDto>();

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('card');
  protected readonly width = CARD_WIDTH;
  protected readonly height = CARD_HEIGHT;

  protected readonly link = computed(() => profileShareUrl(this.user().userId, this.user().username));
  protected readonly linkLabel = computed(() => profileShareLabel(this.user().userId, this.user().username));
  /** Phones that can hand a picture to Instagram; elsewhere the button downloads it. */
  protected readonly canShareFiles =
    this.isBrowser && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] });
  protected readonly copied = computed(() => this.pageShare.copied() === 'link');

  constructor() {
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      if (!this.open() || !canvas || !this.isBrowser) return;
      const user = this.user();
      untracked(() => void this.draw(canvas, user));
    });
  }

  protected async shareCard(): Promise<void> {
    const blob = await this.cardBlob();
    if (!blob) {
      this.toasts.show('Non siamo riusciti a preparare l\'immagine. Riprova tra poco.');
      return;
    }
    const file = new File([blob], `ballastasera-${this.user().username ?? 'profilo'}.png`, { type: 'image/png' });
    if (this.canShareFiles) {
      try {
        await navigator.share({ files: [file], title: this.user().displayName, url: this.link() });
      } catch {
        // Dismissed, or the target refused: nothing to say.
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  protected async copyLink(): Promise<void> {
    const copied = await this.pageShare.copy(this.link(), 'link');
    if (!copied) this.toasts.show('Non siamo riusciti a copiare il link.');
  }

  private async draw(canvas: HTMLCanvasElement, user: UserDto): Promise<void> {
    const [photo] = await Promise.all([
      loadPhoto(user.avatarUrl),
      Promise.all(PROFILE_CARD_FONTS.map((font) => document.fonts.load(font))).catch(() => undefined),
    ]);
    const context = canvas.getContext('2d');
    if (context) drawProfileCard(context, this.cardData(user), photo);
  }

  private cardData(user: UserDto): ProfileCardData {
    const where = user.showHomeCity ? user.homeCity?.name : null;
    const role = user.danceRole ? DANCE_ROLE_LABELS[user.danceRole] : null;
    return {
      name: user.displayName,
      initial: initialOf(user.displayName),
      tone: personTone(user.userId),
      line: [role, where].filter(Boolean).join(' · '),
      styles: (user.danceStyles ?? []).slice(0, CARD_STYLES).map((style) => ({
        label: `${style.name} · ${DANCE_LEVEL_LABELS[style.level]}`,
        color: LEVEL_COLORS[levelRank(style.level) - 1],
      })),
      link: profileShareLabel(user.userId, user.username),
    };
  }

  private cardBlob(): Promise<Blob | null> {
    const canvas = this.canvas()?.nativeElement;
    if (!canvas) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      } catch {
        resolve(null);
      }
    });
  }
}
