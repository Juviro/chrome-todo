export type LootTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type LootTierConfig = {
  color: string;
  glowColor: string;
  label: string;
  sparkleCount: number;
  beamHeightRem: number;
  beamWidthRem: number;
  showShockwave: boolean;
  showScreenGlow: boolean;
  durationMs: number;
};

export const LOOT_COMBO_WINDOW_MS = 3000;
export const LOOT_COMBO_IDLE_RESET_MS = 3500;
export const LOOT_EFFECT_BASE_DURATION_MS = 1100;
export const LOOT_EFFECT_LEGENDARY_DURATION_MS = 1800;

export const LOOT_TIER_CONFIG: Record<LootTier, LootTierConfig> = {
  common: {
    color: "#9aa0a6",
    glowColor: "rgba(154, 160, 166, 0.45)",
    label: "+1",
    sparkleCount: 4,
    beamHeightRem: 0,
    beamWidthRem: 0,
    showShockwave: false,
    showScreenGlow: false,
    durationMs: LOOT_EFFECT_BASE_DURATION_MS,
  },
  uncommon: {
    color: "#1eff00",
    glowColor: "rgba(30, 255, 0, 0.4)",
    label: "+1",
    sparkleCount: 8,
    beamHeightRem: 4,
    beamWidthRem: 0.35,
    showShockwave: false,
    showScreenGlow: false,
    durationMs: LOOT_EFFECT_BASE_DURATION_MS,
  },
  rare: {
    color: "#0070dd",
    glowColor: "rgba(0, 112, 221, 0.5)",
    label: "+1",
    sparkleCount: 12,
    beamHeightRem: 6,
    beamWidthRem: 0.45,
    showShockwave: false,
    showScreenGlow: false,
    durationMs: LOOT_EFFECT_BASE_DURATION_MS,
  },
  epic: {
    color: "#a335ee",
    glowColor: "rgba(163, 53, 238, 0.55)",
    label: "COMBO",
    sparkleCount: 16,
    beamHeightRem: 8,
    beamWidthRem: 0.55,
    showShockwave: true,
    showScreenGlow: true,
    durationMs: LOOT_EFFECT_BASE_DURATION_MS,
  },
  legendary: {
    color: "#ff8000",
    glowColor: "rgba(255, 128, 0, 0.65)",
    label: "LEGENDARY!",
    sparkleCount: 24,
    beamHeightRem: 11,
    beamWidthRem: 0.7,
    showShockwave: true,
    showScreenGlow: true,
    durationMs: LOOT_EFFECT_LEGENDARY_DURATION_MS,
  },
};

export const getTierForCombo = (combo: number): LootTier => {
  if (combo >= 8) return "legendary";
  if (combo >= 5) return "epic";
  if (combo >= 3) return "rare";
  if (combo >= 2) return "uncommon";
  return "common";
};

export const getFloatingLabel = (tier: LootTier, combo: number): string => {
  const config = LOOT_TIER_CONFIG[tier];
  if (tier === "epic") return `${config.label} x${combo}`;
  if (tier === "legendary") return config.label;
  return config.label;
};
