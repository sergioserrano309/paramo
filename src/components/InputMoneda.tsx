"use client";

import type { InputHTMLAttributes } from "react";

type InputMonedaProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /**
   * Solo dígitos, sin separadores: es lo que guarda el formulario. Con `decimales`, usa «.»
   * como separador decimal («1234.5»), que es lo que entiende `Number()`.
   */
  value: string;
  onValueChange: (valor: string) => void;
  /** Cantidad de decimales permitidos (p. ej. 2 para USD). Sin él, solo enteros. */
  decimales?: number;
};

/** 1000000 → «1.000.000» (la convención de es-CO; Intl no agrupa los números de 4 cifras). */
function conMiles(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Campo de dinero: muestra los puntos de miles mientras se escribe y entrega al formulario
 * solo el número limpio, así el resto del código sigue recibiendo un valor simple. Con
 * `decimales`, la coma es el separador decimal (es-CO).
 */
export function InputMoneda({
  value,
  onValueChange,
  decimales = 0,
  ...resto
}: InputMonedaProps) {
  let mostrado: string;
  if (decimales > 0) {
    const [entera = "", decimal] = value.split(".");
    const base = conMiles(entera.replace(/\D/g, ""));
    mostrado = decimal === undefined ? base : `${base},${decimal}`;
  } else {
    mostrado = conMiles(value.replace(/\D/g, ""));
  }

  function alCambiar(texto: string) {
    if (decimales > 0) {
      // Los puntos son miles y se ignoran; solo la coma separa decimales.
      const [entera = "", ...cola] = texto.split(",");
      const enteros = entera.replace(/\D/g, "").slice(0, 13);
      if (cola.length === 0) return onValueChange(enteros);
      const decimal = cola.join("").replace(/\D/g, "").slice(0, decimales);
      return onValueChange(`${enteros}.${decimal}`);
    }
    onValueChange(texto.replace(/\D/g, "").slice(0, 13));
  }

  return (
    <input
      {...resto}
      type="text"
      inputMode={decimales > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      value={mostrado}
      onChange={(e) => alCambiar(e.target.value)}
    />
  );
}
