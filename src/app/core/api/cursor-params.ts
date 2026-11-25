import { HttpParams } from '@angular/common/http';
import { PageCursor } from '../models/page.model';

/** The query of a keyset page (CursorPageDto in the backend): how many, and where the previous page
 * left off (none for the first). Added to `params` when the endpoint takes others too. */
export function cursorParams(cursor: PageCursor | null, limit: number, params = new HttpParams()): HttpParams {
  params = params.set('limit', limit);
  return cursor ? params.set('cursorStartAt', cursor.startAt).set('cursorId', cursor.id) : params;
}
