import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/domain/constants';
import { extractShareTarget } from '../src/share-extractor';

describe('extractShareTarget', () => {
  it('extrai compartilhamento direto do navegador (campo url válido e text como nota)', () => {
    const result = extractShareTarget({
      title: 'MDN Web Docs',
      url: 'https://developer.mozilla.org/pt-BR',
      text: 'Excelente documentação para desenvolvedores.',
    });

    expect(result).toEqual({
      url: 'https://developer.mozilla.org/pt-BR',
      title: 'MDN Web Docs',
      note: 'Excelente documentação para desenvolvedores.',
    });
  });

  it('extrai compartilhamento do YouTube (url vazia e link no meio do text)', () => {
    const result = extractShareTarget({
      title: 'Vídeo Educativo',
      url: '',
      text: 'Confira este vídeo: https://youtu.be/dQw4w9WgXcQ?si=abc123xyz muito bom!',
    });

    expect(result).toEqual({
      url: 'https://youtu.be/dQw4w9WgXcQ?si=abc123xyz',
      title: 'Vídeo Educativo',
      note: 'Confira este vídeo: muito bom!',
    });
  });

  it('extrai compartilhamento do X/Twitter (link no final do text)', () => {
    const result = extractShareTarget({
      text: 'Thread sensacional sobre desenvolvimento web https://x.com/autor/status/123456789',
    });

    expect(result).toEqual({
      url: 'https://x.com/autor/status/123456789',
      title: undefined,
      note: 'Thread sensacional sobre desenvolvimento web',
    });
  });

  it('limpa pontuações finais presas à URL no text (pontos, vírgulas, parênteses)', () => {
    const result = extractShareTarget({
      text: 'Veja o site https://exemplo.com/artigo. Vale a leitura!',
    });

    expect(result?.url).toBe('https://exemplo.com/artigo');
    expect(result?.note).toBe('Veja o site Vale a leitura!');
  });

  it('trunca a nota restante no limite de 280 caracteres', () => {
    const longText = 'A'.repeat(300);
    const result = extractShareTarget({
      url: 'https://exemplo.com',
      text: longText,
    });

    expect(result?.note?.length).toBe(LIMITS.NOTE_MAX_LENGTH);
    expect(result?.note).toBe('A'.repeat(280));
  });

  it('retorna null se o esquema não for http ou https', () => {
    expect(extractShareTarget({ url: 'ftp://exemplo.com/arquivo.zip' })).toBeNull();
    expect(extractShareTarget({ url: 'javascript:alert(1)' })).toBeNull();
  });

  it('retorna null quando nenhuma URL for encontrada no text', () => {
    expect(extractShareTarget({ text: 'Apenas uma anotação qualquer sem link.' })).toBeNull();
    expect(extractShareTarget({})).toBeNull();
  });
});