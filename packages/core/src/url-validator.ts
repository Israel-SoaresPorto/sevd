import { InvalidUrlError } from "./domain/errors";

export function isValidHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") {
    return false;
  }

  try {
    const url = new URL(rawUrl.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function extractDomain(rawUrl: string): string {
  try {
    const isValid = isValidHttpUrl(rawUrl);

    if (!isValid) {
      throw new InvalidUrlError();
    }

    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^www\./i, '')
    
    return hostname;
  } catch (err) {
    if (err instanceof InvalidUrlError) {
      throw err;
    }

    throw new InvalidUrlError(`Failed to extract domain from URL: ${rawUrl}`);
  }
}
