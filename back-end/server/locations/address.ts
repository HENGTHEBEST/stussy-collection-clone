import { getAllCitiesOfCountry, getCitiesOfState, getCountries, getStatesOfCountry } from '@countrystatecity/countries';

export interface AddressLocation { city: string; region: string; country: string }
export type AddressLocationErrors = Partial<Record<keyof AddressLocation, string>>;

function samePlace(left: string, right: string): boolean {
  const normalize = (value: string) => value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en');
  return normalize(left) === normalize(right);
}

export async function verifyAddressLocation(input: AddressLocation): Promise<{ address?: AddressLocation; errors: AddressLocationErrors }> {
  const country = (await getCountries()).find(item => samePlace(item.name, input.country));
  if (!country) return { errors: { country: 'Enter a real country.' } };

  const region = input.region.trim()
    ? (await getStatesOfCountry(country.iso2)).find(item => samePlace(item.name, input.region))
    : undefined;
  if (input.region.trim() && !region) return { errors: { region: `Enter a real region in ${country.name}.` } };

  const cities = region
    ? await getCitiesOfState(country.iso2, region.iso2)
    : await getAllCitiesOfCountry(country.iso2);
  const city = cities.find(item => samePlace(item.name, input.city));
  if (!city) return { errors: { city: `Enter a real city in ${region?.name ?? country.name}.` } };

  return { address: { city: city.name, region: region?.name ?? '', country: country.name }, errors: {} };
}
