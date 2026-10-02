import { describe, expect, it } from 'vitest';
import { enderecosDoCalendario } from './subscrever';

describe('enderecosDoCalendario', () => {
  it('dá o mesmo ficheiro em https, em webcal e pela porta do Google', () => {
    const e = enderecosDoCalendario('https://mediotejo.coreto.org', '/agenda/tomar.ics');
    expect(e.https).toBe('https://mediotejo.coreto.org/agenda/tomar.ics');
    expect(e.webcal).toBe('webcal://mediotejo.coreto.org/agenda/tomar.ics');
    expect(e.google).toBe(
      'https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fmediotejo.coreto.org%2Fagenda%2Ftomar.ics',
    );
  });

  it('troca também o http de uma instalação local, e guarda a porta', () => {
    const e = enderecosDoCalendario('http://demo.localhost:3000', '/agenda/charamela.ics');
    expect(e.webcal).toBe('webcal://demo.localhost:3000/agenda/charamela.ics');
  });
});
