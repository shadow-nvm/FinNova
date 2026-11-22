/**
 * Themed tooltip for every Recharts chart.
 *
 * Recharts' default tooltip colourises each row with `entry.color`, which for
 * pie slices resolves to black — unreadable on the dark surface. This renders
 * the same information with theme tokens instead, and keeps the series colour
 * only in the small swatch, so text stays legible in both themes.
 */

type TooltipEntry = {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: string | number;
  payload?: { color?: string; fill?: string } | null;
};

export type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipEntry[];
  /** Optional value formatter, e.g. the active-currency money formatter. */
  formatValue?: (value: number) => string;
};

function swatchOf(entry: TooltipEntry): string {
  return entry.payload?.color || entry.color || entry.payload?.fill || "var(--brand)";
}

export function ChartTooltip({ active, label, payload, formatValue }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = payload.filter(
    (entry) => entry && entry.value !== undefined && entry.value !== null,
  );
  if (rows.length === 0) return null;

  const heading = typeof label === "string" ? label.trim() : "";

  return (
    <div className="chart-tooltip">
      {heading && <div className="chart-tooltip-label">{heading}</div>}
      {rows.map((entry, index) => {
        const numeric = Number(entry.value);
        const text =
          formatValue && Number.isFinite(numeric) ? formatValue(numeric) : String(entry.value);
        return (
          <div
            className="chart-tooltip-row"
            key={`${String(entry.dataKey ?? entry.name ?? "row")}-${index}`}
          >
            <span
              className="chart-tooltip-swatch"
              style={{ background: swatchOf(entry) }}
              aria-hidden="true"
            />
            <span className="chart-tooltip-name">{entry.name}</span>
            <span className="chart-tooltip-value">{text}</span>
          </div>
        );
      })}
    </div>
  );
}
