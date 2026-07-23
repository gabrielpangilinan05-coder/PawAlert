"use client";

import { useId, useMemo, useState } from "react";
import { ANIMAL_SPECIES, breedPlaceholder, breedsForSpecies } from "@/lib/species";

type Props = {
  defaultSpecies?: string;
  defaultBreed?: string;
};

export function SpeciesBreedFields({
  defaultSpecies = "Dog",
  defaultBreed = "",
}: Props) {
  const speciesListId = useId();
  const breedListId = useId();
  const [species, setSpecies] = useState(defaultSpecies);
  const breeds = useMemo(() => breedsForSpecies(species), [species]);
  const placeholder = breedPlaceholder(species);

  return (
    <>
      <div className="form-row">
        <label>
          Species
          <input
            type="text"
            name="species"
            list={speciesListId}
            className="js-species-input"
            required
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            placeholder="Type to search: Dog, Cat, Rabbit…"
            autoComplete="off"
          />
        </label>
        <label>
          Breed
          <input
            type="text"
            name="breed"
            list={breedListId}
            className="js-breed-input"
            defaultValue={defaultBreed}
            placeholder={placeholder}
            autoComplete="off"
          />
        </label>
      </div>
      <datalist id={speciesListId}>
        {ANIMAL_SPECIES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id={breedListId}>
        {breeds.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  );
}
