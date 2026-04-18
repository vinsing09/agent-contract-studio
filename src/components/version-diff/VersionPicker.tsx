import type { AgentVersion } from "@/lib/api";

interface Props {
  label: string;
  versions: AgentVersion[];
  value: string | null;
  onChange: (id: string) => void;
  disabledIds?: string[];
}

export function VersionPicker({ label, versions, value, onChange, disabledIds = [] }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded bg-background text-foreground text-xs font-mono"
      >
        <option value="">Select version…</option>
        {versions.map((v) => (
          <option key={v.id} value={v.id} disabled={disabledIds.includes(v.id)}>
            v{v.version_number}
            {v.label ? ` · ${v.label}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
