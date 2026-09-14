import React from 'react';

// Matches the prototype's `.chart` bar chart (js/screens-admin.js admDashboard/admReports).
export function BarChart({
  data,
  valueLabel,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  valueLabel?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2.5 h-[180px]">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <div className="text-[10.5px] font-bold text-[#6E5B4B]">{valueLabel ? valueLabel(d.value) : d.value}</div>
          <div
            className="w-full rounded-t-[7px] rounded-b-[3px] transition-[height]"
            style={{
              height: `${(d.value / max) * 130}px`,
              minHeight: 4,
              background: d.highlight ? '#E86A1C' : '#DCC3A9',
            }}
          />
          <div className="text-[10.5px] font-semibold text-[#6E5B4B]">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// Matches the prototype's `donut()` — a conic-gradient ring with a legend.
export function Donut({
  items,
  centerValue,
  centerLabel,
}: {
  items: { label: string; value: number; color: string }[];
  centerValue?: React.ReactNode;
  centerLabel?: string;
}) {
  let acc = 0;
  const stops = items
    .map((i) => {
      const from = acc;
      acc += i.value;
      return `${i.color} ${from}% ${acc}%`;
    })
    .join(', ');
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative shrink-0 rounded-full"
        style={{ width: 132, height: 132, background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-[26px] rounded-full bg-white grid place-items-center text-center">
          <div>
            {centerValue != null && <div className="font-bold text-[18px] text-[#1C1006]">{centerValue}</div>}
            {centerLabel && <div className="text-[11px] text-[#6E5B4B]">{centerLabel}</div>}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-2.5 text-[12.5px]">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: i.color }} />
            <span className="flex-1 min-w-0 text-[#1C1006]">{i.label}</span>
            <span className="font-bold text-[#1C1006]">{i.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
