"use client";

import type { InputHTMLAttributes } from "react";

type InputMonedaProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Solo dígitos, sin separadores: es lo que guarda el formulario. */
  value: string;
  onValueChange: (digitos: string) => void;
};

/** 1000000 → «1.000.000» (la convención de es-CO; Intl no agrupa los números de 4 cifras). */
function conMiles(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Campo de dinero en pesos: muestra los puntos de miles mientras se escribe y entrega al
 * formulario solo los dígitos, así el resto del código sigue recibiendo un número limpio.
 */
export function InputMoneda({ value, onValueChange, ...resto }: InputMonedaProps) {
  const digitos = value.replace(/\D/g, "");
  return (
    <input
      {...resto}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={conMiles(digitos)}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 13))}
    />
  );
}
