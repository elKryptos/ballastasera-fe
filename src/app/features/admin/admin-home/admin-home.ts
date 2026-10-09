import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SidebarPushDirective } from '../../../shared/directives/sidebar-push.directive';

interface AdminOption {
  title: string;
  description: string;
  routerLink: string;
}

@Component({
  selector: 'app-admin-home',
  imports: [RouterLink, SidebarPushDirective],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css',
})
export class AdminHome {
  protected readonly options: AdminOption[] = [
    {
      title: 'Crea venue',
      description: 'Aggiungi un locale, bar o discoteca',
      routerLink: '/admin/create-venue',
    },
    {
      title: 'Venue update/delete',
      description: 'Lista dei luoghi per città, dal più recente.',
      routerLink: '/admin/venues-list',
    },
    {
      title: 'Crea organizzatore unclaimed',
      description: 'Aggiungi un organizzatore non ancora rivendicato dal proprietario.',
      routerLink: '/admin/create-unclaimed-organizer', 
    },
    {
      title: 'Crea evento',
      description: 'Aggiungi un nuovo evento.',
      routerLink: '/admin/create-event',
    },
    {
      title: 'Crea evento recurrente',
      description: 'Aggiungi un nuovo evento repetitivo',
      routerLink: '/admin/create-event-series',
    },
    {
      title: 'Organizzatori verificati update/delete',
      description: 'Organizzatori che hanno completato il processo di verifica.',
      routerLink: '/admin/verified-organizers-list', 
    },
    {
      title: 'Organizzatori in attesa di verifica',
      description: 'Verifica gli organizzatori che si sono registrati.',
      routerLink: '/admin/pending-organizers',
    },
    {
      title: 'Lista organizzatori non rivendicati (DA IMPLEMENTARE)',
      description: 'Lista degli organizzatori non ancora rivendicati dal proprietario.',
      routerLink: '/admin/', 
    },
    {
      title: 'Lista organizzatori non verificati (DA IMPLEMENTARE)',
      description: 'Lista degli organizzatori che non hanno ancora completato il processo di verifica.',
      routerLink: '/admin/', 
    },

  ];
}
