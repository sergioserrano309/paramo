type ModulePlaceholderProps = {
  title: string;
  description: string;
};

/** Pantalla stub de módulo hasta implementar el comportamiento del as-is. */
export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h1 className="font-paramo-display text-2xl font-bold text-paramo-fg">
          {title}
        </h1>
        <p className="text-sm text-paramo-muted">{description}</p>
      </header>
      <div className="rounded-[10px] border border-paramo-line bg-paramo-surface p-5">
        <p className="text-sm text-paramo-muted">
          Módulo en setup inicial. La lógica de negocio se portará desde{" "}
          <code className="text-paramo-fg">pre-arquitectura/</code> sin modificar ese
          snapshot.
        </p>
      </div>
    </section>
  );
}
