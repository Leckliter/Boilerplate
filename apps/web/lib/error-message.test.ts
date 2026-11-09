import { describe, expect, it } from 'vitest';

import { withoutReference } from './error-message';

describe('withoutReference', () => {
  it('removes the trailing reference the action put in its message', () => {
    expect(
      withoutReference('Something went wrong. Error reference: E-7K3QX9MD', 'E-7K3QX9MD'),
    ).toBe('Something went wrong.');
    expect(withoutReference('Stripe said no. Error reference: E-7K3QX9MD.', 'E-7K3QX9MD')).toBe(
      'Stripe said no.',
    );
  });

  it('leaves a message without a reference alone', () => {
    expect(withoutReference('That already exists.')).toBe('That already exists.');
    expect(withoutReference('Plain message', 'E-AAAAAAAA')).toBe('Plain message');
  });
});
