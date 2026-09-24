import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // Il solo ciò che App richiede all'iniezione: TranslocoService (usato
      // da App per ripristinare la lingua salvata) e il Router per l'outlet.
      // Il loader HTTP completo non serve a questi smoke test.
      providers: [provideRouter([]), provideTransloco({ config: { availableLangs: ['it'], defaultLang: 'it' } })],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('monta la shell con il router-outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
