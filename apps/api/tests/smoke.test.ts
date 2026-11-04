import { describe, expect, it } from 'vitest';
import { CORE_PACKAGE_NAME } from '@sevd/core';

describe('@sevd/api', () => {
  it('importa @sevd/core via workspace', () => {
    expect(CORE_PACKAGE_NAME).toBe('@sevd/core');
  });
});