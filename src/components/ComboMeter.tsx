interface ComboMeterProps {
  combo: number;
  xpEarned: number;
}

export default function ComboMeter({ combo, xpEarned }: ComboMeterProps) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold" data-testid="combo-meter">
      {combo > 1 && (
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent" data-testid="combo-value">
          {combo}× combo
        </span>
      )}
      <span className="text-ink-muted">{xpEarned} XP</span>
    </div>
  );
}
