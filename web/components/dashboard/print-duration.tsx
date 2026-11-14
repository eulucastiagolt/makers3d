import { Input } from '@/components/ui/input';

const units = [
  { label: 'Horas', seconds: 3600, max: undefined },
  { label: 'Minutos', seconds: 60, max: 59 },
  { label: 'Segundos', seconds: 1, max: 59 },
] as const;

export function PrintDuration({ value, onChange }: {
  value: number;
  onChange: (hours: number) => void;
}) {
  const total = Math.round(value * 3600);

  return <div className="grid grid-cols-3 gap-2 sm:gap-4" role="group" aria-label="Duração da impressão">
    {units.map(({ label, seconds, max }) => {
      const wholeUnits = Math.floor(total / seconds);
      const current = max === undefined ? wholeUnits : wholeUnits % (max + 1);

      return <label className="min-w-0 space-y-2" key={label}>
        <span className="block text-xs text-white/50">{label}</span>
        <Input type="number" inputMode="numeric" min={0} max={max} step={1}
          value={current} onFocus={event => event.currentTarget.select()}
          onChange={event => {
            const entered = event.currentTarget.valueAsNumber;
            if (!Number.isFinite(entered) && event.currentTarget.value !== '') return;
            const next = Math.min(max ?? Infinity, Math.max(0, Math.trunc(entered || 0)));
            const updated = total + (next - current) * seconds;
            if (Number.isSafeInteger(updated)) onChange(updated / 3600);
          }}
          className="bg-white/5 border-white/10 font-mono text-white focus:border-gold"
        />
      </label>;
    })}
  </div>;
}
