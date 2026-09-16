import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '@env/environment';
import { map, Observable } from 'rxjs';

interface MunicipalityPostalCodes {
  nome: string;
  cap: string[];
}

@Service()
export class PostalCodesService {
  private readonly http = inject(HttpClient);

  getByMunicipality(municipalityName: string): Observable<string[]> {
    const params = new HttpParams()
      .set('q', municipalityName)
      .set('fields', 'nome,cap')
      .set('pagesize', 10);

    return this.http
      .get<MunicipalityPostalCodes[]>(`${environment.comuniItaApiUrl}/v5/comuni`, { params })
      .pipe(
        map(
          (municipalities) =>
            municipalities.find(
              (municipality) =>
                municipality.nome.localeCompare(municipalityName, 'it', {
                  sensitivity: 'base',
                }) === 0,
            )?.cap ?? [],
        ),
      );
  }
}
