import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env/environment';
import { firstValueFrom } from 'rxjs';
import { PostalCodesService } from './postal-codes.service';

describe('PostalCodesService', () => {
  let http: HttpTestingController;
  let service: PostalCodesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PostalCodesService, provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PostalCodesService);
  });

  afterEach(() => http.verify());

  it('restituisce i CAP del comune con corrispondenza esatta', async () => {
    const result = firstValueFrom(service.getByMunicipality('Milano'));
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.comuniItaApiUrl}/v5/comuni` &&
        candidate.params.get('q') === 'Milano' &&
        candidate.params.get('fields') === 'nome,cap' &&
        candidate.params.get('pagesize') === '10',
    );

    expect(request.request.method).toBe('GET');
    request.flush([
      { nome: 'Milano Marittima', cap: ['48015'] },
      { nome: 'Milano', cap: ['20121', '20122'] },
    ]);

    await expect(result).resolves.toEqual(['20121', '20122']);
  });
});
