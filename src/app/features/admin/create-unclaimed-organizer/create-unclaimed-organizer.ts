import { Component, inject, signal } from '@angular/core';
import { OrganizerCreateDto, OrganizerDetailDto, OrganizerType } from '../../../core/models/organizer.model';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { Navbar } from '../../../shared/navbar/navbar';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';

const ORGANIZER_TYPES: { value: OrganizerType; label: string }[] = [
  { value: 'PERSON', label: 'Persona'},
  { value: 'VENUE', label: 'Locale'},
  { value: 'CLUB', label: 'Club'},
  { value: 'SCHOOL', label: 'Scuola'},
  { value: 'ASSOCIATION', label: 'Associazione'},
]

@Component({
  selector: 'app-create-unclaimed-organizer',
  imports: [ReactiveFormsModule, Navbar, HlmSelectImports],
  templateUrl: './create-unclaimed-organizer.html',
  styleUrl: './create-unclaimed-organizer.css',
})
export class CreateUnclaimedOrganizer {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly router = inject(Router);

  readonly organizerTypes = ORGANIZER_TYPES;
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createdOrganizer = signal<OrganizerCreateDto | null>(null);

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

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    this.admin.createUnclaimedOrganizer({ ...value, type: value.type as OrganizerType }).subscribe({
      next: (organizer) => {
        this.submitting.set(false);
        this.createdOrganizer.set(organizer);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Si è verificato un errore durante la creazione dell\'organizzatore non reclamato.');
      },
    });
  }

  protected createAnother(): void {
    this.form.reset();
    this.createdOrganizer.set(null);
  }

  protected backToAdmin(): void {
    this.router.navigate(['/admin']);
  }
}
