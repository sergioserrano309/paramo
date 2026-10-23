import { formatMoneyShort } from "@/lib/format";

type Punto = { l: string; v: number };

type Props = {
  data: Punto[];
  /** true = montos en COP; false = conteos. */
  money?: boolean;
  label: string;
  H?: number;
  W?: number;
};

const fmtN = (n: number) => Math.round(n || 0).toLocaleString("es-CO");
const fmtCOP = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CO");

/** Escala «bonita» del as-is: 4 divisiones con tope redondo. */
function tope(max: number, money: boolean): number {
  let nice: number;
  if (!money && max <= 8) {
    nice = Math.max(1, Math.ceil(max / 4));
  } else {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    nice = [0.25, 0.5, 1, 2, 2.5, 5, 10].map((x) => x * step).find((x) => x * 4 >= max) ?? step * 10;
  }
  return nice;
}

/**
 * Gráfica de barras en SVG (as-is barChart). Sin librerías: el CRM solo necesita barras.
 * La última barra se resalta con la marca; las demás van en teal.
 */
export function BarChart({ data, money = true, label, H = 240, W = 900 }: Props) {
  const pl = 52;
  const pb = 26;
  const pt = 22;
  const pr = 8;
  const max = Math.max(...data.map((d) => d.v), 1);
  const nice = tope(max, money);
  const top = nice * 4;
  const n = data.length;
  const bw = (W - pl - pr) / Math.max(n, 1);
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const f = (v: number) => (money ? formatMoneyShort(v).replace("$", "") : fmtN(v));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="h-auto w-full text-[11px]"
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const v = nice * i;
        return (
          <g key={i}>
            <line
              x1={pl}
              x2={W - pr}
              y1={y(v)}
              y2={y(v)}
              className="stroke-paramo-line"
              strokeWidth={1}
            />
            <text x={pl - 8} y={y(v) + 4} textAnchor="end" className="fill-paramo-muted">
              {f(v)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pl + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const yy = y(d.v);
        const ultima = i === n - 1;
        return (
          <g key={`${d.l}-${i}`}>
            <rect
              x={x}
              y={yy}
              width={w}
              height={Math.max(0, H - pb - yy)}
              rx={3}
              className={ultima ? "fill-paramo-brand" : "fill-paramo-teal"}
            >
              <title>{`${d.l}: ${money ? fmtCOP(d.v) : fmtN(d.v)}`}</title>
            </rect>
            <text x={x + w / 2} y={H - 8} textAnchor="middle" className="fill-paramo-muted">
              {d.l}
            </text>
            {ultima && d.v ? (
              <text
                x={x + w / 2}
                y={yy - 6}
                textAnchor="middle"
                className="fill-paramo-fg font-bold"
              >
                {money ? formatMoneyShort(d.v) : fmtN(d.v)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
