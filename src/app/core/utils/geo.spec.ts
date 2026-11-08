import { parseCoordinates } from './geo';

describe('parseCoordinates', () => {
  it.each([
    ['45.48812, 9.18923', { lat: 45.48812, lng: 9.18923 }],
    ['  45.48812,9.18923 ', { lat: 45.48812, lng: 9.18923 }],
    ['45.48812 9.18923', { lat: 45.48812, lng: 9.18923 }],
    ['-33.8688; 151.2093', { lat: -33.8688, lng: 151.2093 }],
  ])('reads %s as Google Maps copies it', (text, point) => {
    expect(parseCoordinates(text)).toEqual(point);
  });

  it.each(['', 'Via Roma 12', '45.48812', '45,48812, 9,18923', '95.1, 9.1', '45.1, 190.2'])(
    'refuses %s',
    (text) => {
      expect(parseCoordinates(text)).toBeNull();
    },
  );
});
