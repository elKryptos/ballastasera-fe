import { personTone } from './person-tone';

describe('personTone', () => {
  it('gives the same person the same tone every time', () => {
    const id = '6f1c2a9e-3b4d-4c8e-9a7f-1e2d3c4b5a69';
    expect(personTone(id)).toEqual(personTone(id));
  });

  it('spreads different people over different tones', () => {
    const tones = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => personTone(id).bg));
    expect(tones.size).toBeGreaterThan(3);
  });
});
