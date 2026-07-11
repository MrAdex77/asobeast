export const RANGE_PRESETS = ["7d", "30d", "90d"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const VISIBILITY_RANGES = ["30d", "90d"] as const;
export type VisibilityRange = (typeof VISIBILITY_RANGES)[number];

export const DISCOVERY_WINDOWS = [7, 30, 90] as const;
export type DiscoveryWindow = (typeof DISCOVERY_WINDOWS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function presetToRange(preset: RangePreset): {
  from: string;
  to: string;
} {
  const days = Number(preset.replace("d", ""));
  const now = Date.now();
  return {
    from: new Date(now - days * DAY_MS).toISOString().slice(0, 10),
    to: new Date(now).toISOString().slice(0, 10),
  };
}
