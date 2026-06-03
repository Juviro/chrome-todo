import { useMemo, type CSSProperties } from "react";
import {
  getFloatingLabel,
  LOOT_TIER_CONFIG,
  type LootTier,
} from "./lootTiers";

export type LootBurstProps = {
  x: number;
  y: number;
  tier: LootTier;
  combo: number;
};

type Sparkle = {
  id: string;
  angleDeg: number;
  distanceRem: number;
  sizeRem: number;
  delayMs: number;
};

const SPARKLE_ANGLE_STEP_DEG = 360;

export const LootBurst = ({ x, y, tier, combo }: LootBurstProps) => {
  const config = LOOT_TIER_CONFIG[tier];
  const label = getFloatingLabel(tier, combo);

  const sparkles = useMemo((): Sparkle[] => {
    const count = config.sparkleCount;
    if (count === 0) return [];

    return Array.from({ length: count }, (_, index) => {
      const angleDeg =
        (index / count) * SPARKLE_ANGLE_STEP_DEG +
        (index % 2 === 0 ? 7 : -7);
      const distanceRem = 1.2 + (index % 5) * 0.35 + (tier === "legendary" ? 1.2 : 0);
      const sizeRem = 0.2 + (index % 3) * 0.08;
      const delayMs = (index % 6) * 25;

      return {
        id: `${index}`,
        angleDeg,
        distanceRem,
        sizeRem,
        delayMs,
      };
    });
  }, [config.sparkleCount, tier]);

  const style = {
    left: `${x}px`,
    top: `${y}px`,
    "--loot-color": config.color,
    "--loot-glow": config.glowColor,
    "--loot-beam-height": `${config.beamHeightRem}rem`,
    "--loot-beam-width": `${config.beamWidthRem}rem`,
  } as CSSProperties;

  return (
    <div
      className={`loot-burst loot-burst--${tier}`}
      style={style}
      aria-hidden
    >
      {config.showScreenGlow && (
        <div className="loot-burst__screen-glow" />
      )}
      {config.beamHeightRem > 0 && (
        <div className="loot-burst__beam" />
      )}
      <div className="loot-burst__radial-glow" />
      {config.showShockwave && <div className="loot-burst__shockwave" />}
      {sparkles.map((sparkle) => (
        <span
          key={sparkle.id}
          className="loot-burst__sparkle"
          style={
            {
              "--sparkle-angle": `${sparkle.angleDeg}deg`,
              "--sparkle-distance": `${sparkle.distanceRem}rem`,
              "--sparkle-size": `${sparkle.sizeRem}rem`,
              "--sparkle-delay": `${sparkle.delayMs}ms`,
            } as CSSProperties
          }
        />
      ))}
      <span className="loot-burst__label">{label}</span>
    </div>
  );
};
