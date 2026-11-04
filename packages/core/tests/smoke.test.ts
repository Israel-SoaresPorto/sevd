import { describe, expect, it } from 'vitest';
import { CORE_PACKAGE_NAME } from '../src/index';

describe('@sevd/core', () => {
  it('carrega', () => {
    expect(CORE_PACKAGE_NAME).toBe('@sevd/core');
  });
});