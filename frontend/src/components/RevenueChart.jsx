import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { money, moneyShort } from '../lib/format.js';

const H = 330;
const PAD = { top: 44, right: 8, bottom: 30, left: 52 };
const SERIES = '#6a4cff'; // validated: lightness band, chroma and contrast vs surface
const MAX_BAR = 24;

// Round the axis max up to a clean step so ticks read 0 / 50 / 100 …
function niceMax(v) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v / 4) * pow;
  return Math.ceil(v / step) * step;
}

const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Column with a rounded top and a square base on the baseline.
function barPath(x, y, w, base) {
  const h = base - y;
  if (h <= 0) return '';
  const r = Math.min(6, w / 2, h);
  return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`;
}

/** Single-series daily revenue as columns: hatched days, the active day solid, dark tooltip, table view. */
export function RevenueChart({ series }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const hatch = useId();
  // Draw in real pixels (viewBox = rendered width) so axis text stays 11px on every screen.
  const [W, setW] = useState(720);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = (width) => setW(Math.max(320, Math.round(width)));
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);

  const geo = useMemo(() => {
    if (!series.length) return null;
    const max = niceMax(Math.max(...series.map((d) => d.revenueCents)) / 100);
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const slot = iw / series.length;
    const bw = Math.max(3, Math.min(MAX_BAR, slot * 0.62));
    const base = PAD.top + ih;
    const cx = (i) => PAD.left + slot * i + slot / 2;
    const y = (cents) => base - (cents / 100 / max) * ih;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: base - f * ih }));
    const every = Math.ceil(series.length / Math.max(2, Math.floor(iw / 80)));
    return { ticks, every, cx, y, bw, base, slot };
  }, [series, W]);

  if (!geo) return null;
  const last = series.length - 1;
  const active = hover ?? last;

  const indexFromPointer = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(last, Math.floor((sx - PAD.left) / geo.slot)));
  };

  const tipX = geo.cx(active);
  const tipY = geo.y(series[active].revenueCents);

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button className="btn-quiet btn-sm" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-auto rounded-[var(--radius-inner)] bg-wash">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-wash text-left text-xs text-muted">
              <tr><th className="px-4 py-2.5 font-medium">Day</th><th className="px-4 py-2.5 text-right font-medium">Sales</th><th className="px-4 py-2.5 text-right font-medium">Revenue</th></tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {[...series].reverse().map((d) => (
                <tr key={d.day}><td className="px-4 py-2">{dayLabel(d.day)}</td><td className="px-4 py-2 text-right">{d.sales}</td><td className="px-4 py-2 text-right font-medium">{money(d.revenueCents)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" ref={wrapRef}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="block max-w-full touch-none select-none"
            role="img"
            aria-label={`Daily revenue over the last ${series.length} days. Use left and right arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={(e) => setHover(indexFromPointer(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? last) - 1));
              if (e.key === 'ArrowRight') setHover((h) => Math.min(last, (h ?? last) + 1));
            }}
          >
            <defs>
              <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#ece8ff" />
                <rect width="2.2" height="7" fill={SERIES} fillOpacity="0.42" />
              </pattern>
            </defs>
            {geo.ticks.map((t) => (
              <g key={t.v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#ebebf0" strokeWidth="1" />
                <text x={PAD.left - 12} y={t.y + 4} textAnchor="end" className="fill-muted text-[11px] tabular-nums">{moneyShort(t.v * 100)}</text>
              </g>
            ))}
            {series.map((d, i) => {
              // Regular ticks, minus any that would collide with the highlighted day's label.
              const tick = (i % geo.every === 0 || i === last) && Math.abs(i - active) * geo.slot >= 56;
              if (i !== active && !tick) return null;
              return (
                <text key={d.day} x={geo.cx(i)} y={H - 8} textAnchor="middle" className={i === active ? 'fill-ink text-[11px] font-semibold' : 'fill-muted text-[11px]'}>{dayLabel(d.day)}</text>
              );
            })}
            {series.map((d, i) => (
              <path
                key={d.day}
                d={barPath(geo.cx(i) - geo.bw / 2, Math.min(geo.y(d.revenueCents), geo.base - (d.revenueCents ? 2 : 0)), geo.bw, geo.base)}
                fill={i === active ? SERIES : `url(#${hatch})`}
              />
            ))}
            <circle cx={tipX} cy={tipY - 1} r="5" fill="#fff" stroke={SERIES} strokeWidth="2.5" pointerEvents="none" />
          </svg>
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-night px-3.5 py-1.5 text-xs text-white shadow-[var(--shadow-lift)]"
            style={{ left: Math.min(W - 130, Math.max(130, tipX)), top: Math.max(26, tipY - 12) }}
            role="status"
          >
            <span className="font-display text-sm font-semibold">{money(series[active].revenueCents)}</span>
            <span className="ml-2 text-white/55">{dayLabel(series[active].day)} · {series[active].sales} {series[active].sales === 1 ? 'sale' : 'sales'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
