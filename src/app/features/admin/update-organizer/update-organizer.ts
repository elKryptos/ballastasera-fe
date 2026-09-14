import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { Navbar } from '../../../shared/navbar/navbar';
import { AdminService } from '../../../core/services/admin.service';
import { OrganizerType } from '../../../core/models/organizer.model';

const ORGANIZER_TYPES: { value: OrganizerType; label: string }[] = [
  { value: 'PERSON', label: 'Persona' },
  { value: 'VENUE', label: 'Locale' },
  { value: 'CLUB', label: 'Club' },
  { value: 'SCHOOL', label: 'Scuola' },
  { value: 'ASSOCIATION', label: 'Associazione' },
];

@Component({
  selector: 'app-update-organizer',
  imports: [ReactiveFormsModule, Navbar, HlmSelectImports],
  templateUrl: './update-organizer.html',
  styleUrl: './update-organizer.css',
})
export class UpdateOrganizer {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly organizerId = this.route.snapshot.paramMap.get('id')!;

  readonly organizerTypes = ORGANIZER_TYPES;
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    type: ['' as OrganizerType | '', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
    logoUrl: [''],
    website: [''],
    phone: [''],
    contactEmail: ['', Validators.email],
    instagram: [''],
    facebook: [''],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.admin.getOrganizer(this.organizerId).subscribe({
      next: (organizer) => {
        this.form.patchValue({
          name: organizer.name,
          type: organizer.type,
          description: organizer.description ?? '',
          logoUrl: organizer.logoUrl ?? '',
          website: organizer.website ?? '',
          phone: organizer.phone ?? '',
          contactEmail: organizer.contactEmail ?? '',
          instagram: organizer.instagram ?? '',
          facebook: organizer.facebook ?? '',
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Impossibile caricare i dati dell\'organizzatore.');
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    this.admin.updateOrganizer(this.organizerId, { ...value, type: value.type as OrganizerType }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Si è verificato un errore durante l\'aggiornamento dell\'organizzatore.');
      },
    });
  }

  protected backToList(): void {
    this.router.navigate(['/admin/verified-organizers-list']);
  }
}
