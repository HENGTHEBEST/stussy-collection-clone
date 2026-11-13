// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { verifyAddressLocation } from './address.js';

describe('delivery location lookup', () => {
  it('accepts a real city, region, and country and returns their canonical names', async () => {
    expect(await verifyAddressLocation({ city: ' phnom penh ', region: ' PHNOM PENH ', country: ' cambodia ' })).toEqual({
      address: { city: 'Phnom Penh', region: 'Phnom Penh', country: 'Cambodia' }, errors: {},
    });
  });

  it('rejects invented countries, regions, and cities before payment', async () => {
    expect((await verifyAddressLocation({ city: 'Phnom Penh', region: 'Phnom Penh', country: 'Neverland' })).errors.country).toBeTruthy();
    expect((await verifyAddressLocation({ city: 'Phnom Penh', region: 'Atlantis', country: 'Cambodia' })).errors.region).toBeTruthy();
    expect((await verifyAddressLocation({ city: 'Madeup City', region: 'Phnom Penh', country: 'Cambodia' })).errors.city).toBeTruthy();
  });

  it('rejects a real city paired with the wrong region, while allowing an omitted region', async () => {
    expect((await verifyAddressLocation({ city: 'Phnom Penh', region: 'Siem Reap', country: 'Cambodia' })).errors.city).toBeTruthy();
    expect((await verifyAddressLocation({ city: 'Phnom Penh', region: '', country: 'Cambodia' })).errors).toEqual({});
  });
});
