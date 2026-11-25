import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the count it is given', () => {
    service.loadUnread().subscribe();
    http.expectOne((req) => req.url.endsWith('/unread-count')).flush({ unread: 3 });
    expect(service.unread()).toBe(3);
  });

  it('drops a count asked before everything was marked read that arrives after', () => {
    service.loadUnread().subscribe();
    const count = http.expectOne((req) => req.url.endsWith('/unread-count'));
    service.markAllRead().subscribe();
    http.expectOne((req) => req.url.endsWith('/read') && req.method === 'PATCH').flush(null);
    expect(service.unread()).toBe(0);

    count.flush({ unread: 3 });
    expect(service.unread()).toBe(0);
  });

  it('takes a count asked after marking read', () => {
    service.markAllRead().subscribe();
    http.expectOne((req) => req.url.endsWith('/read')).flush(null);
    service.loadUnread().subscribe();
    http.expectOne((req) => req.url.endsWith('/unread-count')).flush({ unread: 1 });
    expect(service.unread()).toBe(1);
  });
});
