import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewerStateService } from '../services/viewer-state.service';
import { EN } from './en';
import ES from './es';
import {
  detectLocale,
  ES_MESSAGES_LOADER,
  LOCALE_STORAGE_KEY,
  LocaleService,
  PIECE_MESSAGES_LOADER,
} from './locale.service';
import PIECES_EN from '../pieces/pieces.en';
import PIECES_ES from '../pieces/pieces.es';
import { Messages, PieceMessages } from './messages';
import { localeReady, provideLocale } from './testing';

type PieceLoader = (locale: 'en' | 'es') => Promise<PieceMessages>;

const piecesFor = (locale: 'en' | 'es') =>
  Promise.resolve(locale === 'es' ? PIECES_ES : PIECES_EN);

function setup(options: {
  languages?: string[];
  loader?: () => Promise<Messages>;
  pieceLoader?: PieceLoader;
}) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(
    options.languages ?? ['en-US']
  );
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ES_MESSAGES_LOADER,
        useValue: options.loader ?? (() => Promise.resolve(ES)),
      },
      {
        provide: PIECE_MESSAGES_LOADER,
        useValue: options.pieceLoader ?? piecesFor,
      },
    ],
  });
  return TestBed.inject(LocaleService);
}

describe('detectLocale (spec C.2)', () => {
  it.each([
    [['es-MX'], 'es'],
    [['es'], 'es'],
    [['en-GB', 'es'], 'en'],
    [['fr-FR', 'es-ES'], 'es'],
    [['fr'], 'en'],
    [[], 'en'],
  ] as const)('%j → %s', (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected);
  });

  it('copes with a missing list and odd casing', () => {
    expect(detectLocale(undefined)).toBe('en');
    expect(detectLocale(['ES-ar'])).toBe('es');
  });
});

describe('LocaleService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    document.title = EN.meta.title;
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = EN.meta.description;
    document.head.appendChild(meta);
  });

  afterEach(() => {
    document.head.querySelector('meta[name="description"]')?.remove();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts in English and keeps it without a Spanish preference', async () => {
    const service = setup({ languages: ['en-US'] });
    await service.init();
    expect(service.locale()).toBe('en');
    expect(service.messages()).toBe(EN);
    expect(service.announcement()).toBe('');
  });

  it('detects Spanish, waits for its chunk and does not write storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const service = setup({ languages: ['es-MX'] });
    await service.init();
    expect(service.locale()).toBe('es');
    expect(service.messages()).toBe(ES);
    expect(document.documentElement.lang).toBe('es');
    expect(setItem).not.toHaveBeenCalled();
    expect(service.announcement()).toBe('');
  });

  it('a stored valid value wins over the browser language', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const service = setup({ languages: ['es'] });
    await service.init();
    expect(service.locale()).toBe('en');
  });

  it('an invalid stored value is ignored', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    const service = setup({ languages: ['es'] });
    await service.init();
    expect(service.locale()).toBe('es');
  });

  it('survives a localStorage that throws on getItem', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = setup({ languages: ['es'] });
    await service.init();
    expect(service.locale()).toBe('es');
  });

  it('survives a localStorage that throws on setItem', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = setup({});
    await service.setLocale('es');
    expect(service.locale()).toBe('es');
    expect(service.messages()).toBe(ES);
  });

  it('setLocale changes language, remembers the choice and announces it', async () => {
    const service = setup({});
    await service.init();
    await service.setLocale('es');
    expect(service.locale()).toBe('es');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    expect(service.announcement()).toBe(ES.language.announce);
    await service.setLocale('en');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(service.announcement()).toBe(EN.language.announce);
  });

  it('updates <html lang>, the title and the meta description', async () => {
    const service = setup({});
    await service.init();
    await service.setLocale('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.title).toBe(ES.meta.title);
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content')
    ).toBe(ES.meta.description);
    await service.setLocale('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe(EN.meta.title);
  });

  it('the document effect follows the signals', async () => {
    const service = setup({});
    await service.init();
    await service.setLocale('es');
    document.documentElement.lang = 'xx';
    TestBed.tick();
    // El efecto no se vuelve a ejecutar sin cambios: lo fija `use`.
    await service.setLocale('en');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');
  });

  it('a rejected import keeps English, the announcement and warns', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = setup({
      loader: () => Promise.reject(new Error('offline')),
    });
    await service.init();
    await service.setLocale('es');
    expect(service.locale()).toBe('en');
    expect(service.messages()).toBe(EN);
    expect(service.announcement()).toBe('');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.lang).toBe('en');
    const error = TestBed.inject(ViewerStateService).error();
    expect(error?.code).toBe('locale-load-failed');
  });

  it('a failed initial load falls back to English with the notice', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = setup({
      languages: ['es'],
      loader: () => Promise.reject(new Error('offline')),
    });
    await service.init();
    expect(service.locale()).toBe('en');
    expect(TestBed.inject(ViewerStateService).error()?.code).toBe(
      'locale-load-failed'
    );
  });

  it('the notice retry loads Spanish once the network is back', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let online = false;
    const service = setup({
      loader: () =>
        online ? Promise.resolve(ES) : Promise.reject(new Error('x')),
    });
    await service.setLocale('es');
    const state = TestBed.inject(ViewerStateService);
    online = true;
    state.error()?.retry?.();
    await vi.waitFor(() => expect(service.locale()).toBe('es'));
    expect(state.error()).toBeNull();
  });

  it('loads the Spanish chunk only once', async () => {
    const loader = vi.fn(() => Promise.resolve(ES));
    const service = setup({ loader });
    await service.setLocale('es');
    await service.setLocale('en');
    await service.setLocale('es');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('LocaleService: piece dictionaries (T-422)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('has no piece texts and loads nothing until the pieces chunk is present', async () => {
    const pieceLoader = vi.fn(piecesFor);
    const service = setup({ pieceLoader });
    await service.init();
    await service.setLocale('es');
    expect(service.pieceMessages()).toBeNull();
    expect(pieceLoader).not.toHaveBeenCalled();
  });

  it('enablePieces loads the dictionary of the active language', async () => {
    const service = setup({});
    await service.init();
    expect(await service.enablePieces()).toBe(true);
    expect(service.pieceMessages()).toBe(PIECES_EN);
  });

  it('switching EN→ES with the pieces loaded updates pieceMessages()', async () => {
    const service = setup({});
    await service.init();
    await service.enablePieces();
    await service.setLocale('es');
    expect(service.locale()).toBe('es');
    expect(service.messages()).toBe(ES);
    expect(service.pieceMessages()).toBe(PIECES_ES);
    await service.setLocale('en');
    expect(service.pieceMessages()).toBe(PIECES_EN);
  });

  it('a Spanish start loads the Spanish pieces on enablePieces', async () => {
    const service = setup({ languages: ['es-ES'] });
    await service.init();
    await service.enablePieces();
    expect(service.pieceMessages()).toBe(PIECES_ES);
  });

  it('loads each piece dictionary only once', async () => {
    const pieceLoader = vi.fn(piecesFor);
    const service = setup({ pieceLoader });
    await service.enablePieces();
    await service.setLocale('es');
    await service.setLocale('en');
    await service.setLocale('es');
    expect(pieceLoader).toHaveBeenCalledTimes(2);
  });

  it('a failed piece load on a language change keeps the previous language and shows the notice', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = setup({
      pieceLoader: locale =>
        locale === 'en'
          ? Promise.resolve(PIECES_EN)
          : Promise.reject(new Error('offline')),
    });
    await service.init();
    await service.enablePieces();
    await service.setLocale('es');
    expect(service.locale()).toBe('en');
    expect(service.messages()).toBe(EN);
    expect(service.pieceMessages()).toBe(PIECES_EN);
    expect(service.announcement()).toBe('');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.lang).toBe('en');
    expect(TestBed.inject(ViewerStateService).error()?.code).toBe(
      'pieces-load-failed'
    );
  });

  it('the notice retry switches language once the network is back', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let online = false;
    const service = setup({
      pieceLoader: locale =>
        locale === 'en' || online
          ? piecesFor(locale)
          : Promise.reject(new Error('offline')),
    });
    await service.init();
    await service.enablePieces();
    await service.setLocale('es');
    const state = TestBed.inject(ViewerStateService);
    online = true;
    state.error()?.retry?.();
    await vi.waitFor(() => expect(service.locale()).toBe('es'));
    expect(service.pieceMessages()).toBe(PIECES_ES);
    expect(state.error()).toBeNull();
  });

  it('a failed enablePieces reports false, shows the notice and keeps the language', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = setup({
      pieceLoader: () => Promise.reject(new Error('offline')),
    });
    await service.init();
    expect(await service.enablePieces()).toBe(false);
    expect(service.locale()).toBe('en');
    expect(service.pieceMessages()).toBeNull();
    expect(TestBed.inject(ViewerStateService).error()?.code).toBe(
      'pieces-load-failed'
    );
  });

  it('after a failed enablePieces, the notice retry loads the dictionary', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let online = false;
    const service = setup({
      pieceLoader: locale =>
        online ? piecesFor(locale) : Promise.reject(new Error('offline')),
    });
    await service.init();
    await service.enablePieces();
    const state = TestBed.inject(ViewerStateService);
    online = true;
    state.error()?.retry?.();
    await vi.waitFor(() => expect(service.pieceMessages()).toBe(PIECES_EN));
    expect(state.error()).toBeNull();
  });
});

describe('LocaleService: carrera y límite de arranque (R8-I2, R8-M2)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('ES con el chunk en vuelo y luego EN termina en EN sin guardar ES', async () => {
    let resolveEs!: (messages: Messages) => void;
    const service = setup({
      loader: () => new Promise<Messages>(resolve => (resolveEs = resolve)),
    });
    await service.init();
    const first = service.setLocale('es');
    const second = service.setLocale('en');
    await second;
    resolveEs(ES);
    await first;
    expect(service.locale()).toBe('en');
    expect(service.messages()).toBe(EN);
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(service.announcement()).toBe(EN.language.announce);
    expect(document.documentElement.lang).toBe('en');
  });

  it('un fallo del chunk ES ya obsoleto no muestra el aviso', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let rejectEs!: (reason: Error) => void;
    const service = setup({
      loader: () => new Promise<Messages>((_, reject) => (rejectEs = reject)),
    });
    await service.init();
    const first = service.setLocale('es');
    await service.setLocale('en');
    rejectEs(new Error('offline'));
    await first;
    expect(service.locale()).toBe('en');
    expect(TestBed.inject(ViewerStateService).error()).toBeNull();
  });

  it('con piezas: ES con sus textos en vuelo y luego EN termina en EN', async () => {
    let resolveEsPieces!: (pieces: PieceMessages) => void;
    const service = setup({
      pieceLoader: locale =>
        locale === 'es'
          ? new Promise<PieceMessages>(resolve => (resolveEsPieces = resolve))
          : Promise.resolve(PIECES_EN),
    });
    await service.init();
    await service.enablePieces();
    const first = service.setLocale('es');
    await vi.waitFor(() => expect(resolveEsPieces).toBeDefined());
    await service.setLocale('en');
    resolveEsPieces(PIECES_ES);
    await first;
    expect(service.locale()).toBe('en');
    expect(service.messages()).toBe(EN);
    expect(service.pieceMessages()).toBe(PIECES_EN);
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });

  it('si el chunk ES no llega en 4 s, el arranque sigue en EN con el aviso', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let resolveEs!: (messages: Messages) => void;
    const service = setup({
      languages: ['es-ES'],
      loader: () => new Promise<Messages>(resolve => (resolveEs = resolve)),
    });
    let done = false;
    void service.init().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(3900);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
    expect(service.locale()).toBe('en');
    const state = TestBed.inject(ViewerStateService);
    expect(state.error()?.code).toBe('locale-load-failed');
    // Si el chunk llega tarde no cambia el idioma por sorpresa.
    resolveEs(ES);
    await vi.advanceTimersByTimeAsync(0);
    expect(service.locale()).toBe('en');
    // El reintento del aviso sí lo carga.
    state.error()?.retry?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(service.locale()).toBe('es');
  });

  it('un arranque normal no deja el temporizador pendiente', async () => {
    vi.useFakeTimers();
    const service = setup({ languages: ['es-ES'] });
    const before = vi.getTimerCount();
    await service.init();
    expect(service.locale()).toBe('es');
    expect(vi.getTimerCount()).toBe(before);
  });
});

describe('provideLocale (test helper)', () => {
  it.each(['en', 'es'] as const)(
    'boots in %s without storage',
    async locale => {
      localStorage.clear();
      TestBed.configureTestingModule({ providers: [provideLocale(locale)] });
      await localeReady();
      expect(TestBed.inject(ApplicationInitStatus).done).toBe(true);
      const service = TestBed.inject(LocaleService);
      expect(service.locale()).toBe(locale);
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
    }
  );
});
