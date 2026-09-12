import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../../shared/navbar/navbar';

interface AdminOption {
  title: string;
  description: string;
  routerLink: string;
}

@Component({
  selector: 'app-admin-home',
  imports: [Navbar, RouterLink],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css',
})
export class AdminHome {
  protected readonly options: AdminOption[] = [
    {
      title: 'Organizzatori in attesa',
      description: 'Verifica gli organizzatori che si sono registrati.',
      routerLink: '/admin/pending-organizers',
    },
    {
      title: 'Crea organizzatore unclaimed',
      description: 'Aggiungi un organizzatore non ancora rivendicato dal proprietario.',
      routerLink: '/admin/create-unclaimed-organizer', 
    },
  ];
}
