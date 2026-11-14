'use client';

export function CommissionTable({ title, description, rows }: { title: string; description?: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      {description && <p className="text-xs text-white/40 leading-relaxed">{description}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 text-white/50 font-medium text-xs">Faixa de Preço</th>
              <th className="text-right py-2 text-white/50 font-medium text-xs">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="py-2 text-white/60 text-xs">{row.label}</td>
                <td className="py-2 text-right text-white/80 text-xs font-mono">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}