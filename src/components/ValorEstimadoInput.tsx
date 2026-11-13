"use client";

import { InputMoneda } from "@/components/InputMoneda";
import { MONEDAS, type Moneda } from "@/lib/precios";

type Props = {
  id: string;
  moneda: Moneda;
  valor: string;
  onMoneda: (m: Moneda) => void;
  onValor: (v: string) => void;
  disabled?: boolean;
  className: string;
};

/** Venta mensual estimada: moneda (COP / USD) + monto. USD admite centavos. */
export function ValorEstimadoInput({
  id,
  moneda,
  valor,
  onMoneda,
  onValor,
  disabled,
  className,
}: Props) {
  return (
    <div className="flex gap-2">
      <select
        aria-label="Moneda de la venta mensual estimada"
        value={moneda}
        disabled={disabled}
        onChange={(e) => onMoneda(e.target.value as Moneda)}
        className={`${className} !w-24 shrink-0`}
      >
        {MONEDAS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <InputMoneda
        id={id}
        disabled={disabled}
        decimales={moneda === "USD" ? 2 : 0}
        value={valor}
        onValueChange={onValor}
        className={className}
      />
    </div>
  );
}
