import { LootBurst, type LootBurstProps } from "./LootBurst";

export type ActiveLootEffect = LootBurstProps & {
  id: string;
};

type Props = {
  effects: ActiveLootEffect[];
};

export const LootEffectLayer = ({ effects }: Props) => {
  if (effects.length === 0) return null;

  return (
    <div className="loot-effect-layer">
      {effects.map((effect) => (
        <LootBurst
          key={effect.id}
          x={effect.x}
          y={effect.y}
          tier={effect.tier}
          combo={effect.combo}
        />
      ))}
    </div>
  );
};
