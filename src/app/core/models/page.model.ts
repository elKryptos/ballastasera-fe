export interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface SpringPage<T> {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}


/** Keyset page — mirrors CursorPageDto in the backend. The next page is asked
 * for with nextCursorStartAt + nextCursorId sent back exactly as they came;
 * both null: this was the last page. total counts every item, not this page's. */
export interface CursorPage<T> {
  items: T[];
  nextCursorStartAt: string | null;
  nextCursorId: string | null;
  total: number;
}

/** Where a CursorPage left off: the last item's start and id. */
export interface PageCursor {
  startAt: string;
  id: string;
}