import type {
  HouseholdAccountColorKey,
  HouseholdAccountOption,
  HouseholdAccountSlug,
} from "@/lib/finance/types";

type FixedHouseholdAccountSeed = {
  slug: HouseholdAccountSlug;
  name: string;
  colorKey: HouseholdAccountColorKey;
  sortOrder: number;
};

export const FIXED_HOUSEHOLD_ACCOUNT_SEEDS: FixedHouseholdAccountSeed[] = [
  {
    slug: "atsuki",
    name: "あつき",
    colorKey: "blue",
    sortOrder: 1,
  },
  {
    slug: "sara",
    name: "さら",
    colorKey: "pink",
    sortOrder: 2,
  },
  {
    slug: "shared",
    name: "共用",
    colorKey: "blend",
    sortOrder: 3,
  },
];

export const DEFAULT_HOUSEHOLD_ACCOUNT_SLUG: HouseholdAccountSlug = "atsuki";

export function isHouseholdAccountSlug(value: string): value is HouseholdAccountSlug {
  return FIXED_HOUSEHOLD_ACCOUNT_SEEDS.some((account) => account.slug === value);
}

export function mapFixedAccountSeedToOption(
  seed: FixedHouseholdAccountSeed,
  id: string
): HouseholdAccountOption {
  return {
    id,
    slug: seed.slug,
    name: seed.name,
    colorKey: seed.colorKey,
    sortOrder: seed.sortOrder,
  };
}
