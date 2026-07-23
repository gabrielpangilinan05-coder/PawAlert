import data from "./species-data";

export const ANIMAL_SPECIES = data.species as string[];
export const BREEDS_BY_SPECIES = data.breeds as Record<string, string[]>;

export function breedsForSpecies(species: string): string[] {
  const selected = species.trim().toLowerCase();
  if (!selected) return [];
  const key = Object.keys(BREEDS_BY_SPECIES).find((k) => k.toLowerCase() === selected);
  return key ? BREEDS_BY_SPECIES[key]! : [];
}

export function breedPlaceholder(species: string): string {
  const selected = species.trim().toLowerCase();
  const key = Object.keys(BREEDS_BY_SPECIES).find((k) => k.toLowerCase() === selected);
  return key ? `Select or type a ${key} breed` : "Type a breed or variety";
}
