import { describe, it, expect } from "vitest";
import {
  removeHashtagPrefix,
  limitTags,
  normalizeTag,
} from "../../src/utils/tags-normalizer";
import { LIMITS } from "../../src/domain/constants";

describe("removeHashtagPrefix", () => {
  it("deve remover o prefixo de hashtag de uma tag", () => {
    const tag = "#exemplo";
    const result = removeHashtagPrefix(tag);
    expect(result).toBe("exemplo");
  });

  it("deve retornar a tag inalterada se não houver prefixo de hashtag", () => {
    const tag = "exemplo";
    const result = removeHashtagPrefix(tag);
    expect(result).toBe("exemplo");
  });
});

describe("limitTags", () => {
  it("deve limitar o número de tags ao limite máximo definido", () => {
    const tags = ["tag1", "tag2", "tag3", "tag4", "tag5", 'tag6'];
    const result = limitTags(tags);
    expect(result.length).toBeLessThanOrEqual(LIMITS.MAX_TAGS_PER_BOOKMARK);
  });

  it("deve retornar todas as tags se o número de tags for menor ou igual ao limite", () => {
    const tags = ["tag1", "tag2"];
    const result = limitTags(tags);
    expect(result).toEqual(tags);
  });
});

describe("normalizeTag", () => {
  it("deve normalizar uma tag removendo o prefixo de hashtag, convertendo para minúsculas e removendo espaços em branco", () => {
    const tag = "  #ExEmPlO  ";
    const result = normalizeTag(tag);
    expect(result).toBe("exemplo");
  });

  it("deve retornar uma string vazia se a tag for apenas espaços em branco", () => {
    const tag = "   ";
    const result = normalizeTag(tag);
    expect(result).toBe("");
  });
});
