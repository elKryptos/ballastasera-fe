import { Component, computed, DestroyRef, ElementRef, inject, model, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileWarning, lucideImage, lucideRefreshCw, lucideTrash2, lucideUpload } from '@ng-icons/lucide';
import { AdminService } from '../../../core/services/admin.service';
import { VenueDetailDto } from '../../../core/models/venue.model';

/** Uploads, replaces or removes a saved venue's logo. The logo needs the
 * venue's id, so CreateVenue shows this once the venue exists — same flow as
 * the event's flyer (CreateEvent), minus the processing step: the backend
 * answers with the venue and its logoUrl right away. */
@Component({
  selector: 'app-venue-logo-editor',
  imports: [HlmSpinnerImports, NgIcon],
  providers: [provideIcons({ lucideImage, lucideUpload, lucideRefreshCw, lucideFileWarning, lucideTrash2 })],
  templateUrl: './venue-logo-editor.html',
})
export class VenueLogoEditor {
  private readonly adminService = inject(AdminService);

  /** Two-way: updated with the venue the backend sends back. */
  readonly venue = model.required<VenueDetailDto>();

  protected readonly logoState = signal<'idle' | 'uploading' | 'removing' | 'error'>('idle');
  protected readonly logoError = signal<string | null>(null);
  protected readonly logoFile = signal<File | null>(null);
  protected readonly logoPreviewUrl = signal<string | null>(null);
  /** The staged file's preview first; otherwise the logo already saved on the venue. */
  protected readonly logoImageUrl = computed(() => this.logoPreviewUrl() ?? this.venue().logoUrl ?? null);
  protected readonly logoBusy = computed(() => this.logoState() === 'uploading' || this.logoState() === 'removing');
  private readonly logoFileInput = viewChild<ElementRef<HTMLInputElement>>('logoFileInput');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearStagedLogo());
  }

  protected openLogoPicker(): void {
    this.logoFileInput()?.nativeElement.click();
  }

  protected onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    this.clearStagedLogo();
    this.logoState.set('idle');
    this.logoError.set(null);
    this.logoFile.set(file);
    this.logoPreviewUrl.set(URL.createObjectURL(file));
  }

  /** Uploads the staged file, replacing the venue's logo if it had one. */
  protected uploadLogo(): void {
    const file = this.logoFile();
    if (!file) {
      return;
    }

    this.logoError.set(null);
    this.logoState.set('uploading');

    this.adminService.uploadVenueLogo(this.venue().id, file).subscribe({
      next: (updated) => {
        this.venue.set(updated);
        this.logoState.set('idle');
        this.clearStagedLogo();
      },
      error: (err: HttpErrorResponse) => {
        this.logoState.set('error');
        this.logoError.set(err.error?.message ?? 'Caricamento del logo non riuscito. Riprova.');
      },
    });
  }

  protected removeLogo(): void {
    const venue = this.venue();
    this.logoError.set(null);
    this.logoState.set('removing');

    this.adminService.deleteVenueLogo(venue.id).subscribe({
      next: () => {
        this.logoState.set('idle');
        this.venue.set({ ...venue, logoUrl: null });
      },
      error: (err: HttpErrorResponse) => {
        this.logoState.set('error');
        this.logoError.set(err.error?.message ?? 'Rimozione del logo non riuscita. Riprova.');
      },
    });
  }

  private clearStagedLogo(): void {
    const previewUrl = this.logoPreviewUrl();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    this.logoFile.set(null);
    this.logoPreviewUrl.set(null);
  }
}
