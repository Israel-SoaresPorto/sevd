import { LIMITS } from "./domain/constants";
import { isValidHttpUrl } from "./url-validator";

export interface ShareExtractorInput {
  url?: string;
  title?: string;
  text?: string;
}

export interface ShareExtractorOutput {
  url: string;
  note?: string;
  title?: string;
}

/**
 * Regex para identificar URLs em um texto. Ele procura por padrões que começam com "http://" ou "https://", seguidos por qualquer caractere que não seja espaço, "<", ">", '"', ou "'". A flag "i" indica que a busca é case-insensitive.
 */
const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"']+/i;

/**
 * Regex para identificar pontuação final em um texto. Ele procura por padrões que consistem em uma ou mais pontuações, como ponto, vírgula, interrogação, exclamação, dois-pontos ou ponto-e-vírgula, no final da string.
 */
const TRAILING_PUNCTUATION_REGEX = /[.,!)?;:]+$/;

/**
 * Função para sanitizar o texto de entrada, removendo espaços extras e limitando o comprimento do texto.
 * @param text O texto a ser sanitizado.
 * @returns O texto sanitizado ou undefined se o texto for vazio após a sanitização.
 */
export function sanitizeText(text: string): string | undefined {
  const collapsed = text?.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return undefined;
  }

  return collapsed.slice(0, LIMITS.NOTE_MAX_LENGTH);
}

/**
 * Extrai URL, título e nota a partir dos parâmetros de compartilhamento do Web Share Target.
 * @param input O objeto de entrada contendo a URL, título e texto.
 * @returns Um objeto contendo a URL, título e nota extraídos, ou null se nenhuma URL válida for encontrada.
 */
export function extractShareTarget(input: ShareExtractorInput): ShareExtractorOutput | null {
  const rawUrl = input.url?.trim() || "";
  const rawTitle = input.title?.trim() || undefined;
  const rawText = input.text?.trim() || "";

  // Se a URL foi fornecida, valida e retorna os dados extraídos.
  if (rawUrl) {
    if (!isValidHttpUrl(rawUrl)) {
      return null;
    }

    const note = rawText ? sanitizeText(rawText) : undefined;

    return {
      url: rawUrl,
      title: rawTitle,
      note
    };
  }

  // Se url vazia, busca a primeira URL válida no texto fornecido.
  if (!rawText) {
    return null;
  }

  const match = rawText.match(URL_IN_TEXT_REGEX);

  if (!match || match.index === undefined) {
    return null;
  }

  const matchedUrl = match[0].replace(TRAILING_PUNCTUATION_REGEX, "");

  if (!isValidHttpUrl(matchedUrl)) {
    return null;
  }

  //Extrai o restante do texto como nota, removendo a URL encontrada.
  const beforeUrl = rawText.slice(0, match.index);
  const afterUrl = rawText.slice(match.index + match[0].length);
  const noteText = `${beforeUrl} ${afterUrl}`;
  const note = sanitizeText(noteText);

  return {
    url: matchedUrl,
    title: rawTitle,
    note
  };
}
