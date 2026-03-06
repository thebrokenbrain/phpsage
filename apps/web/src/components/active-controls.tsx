interface ActiveControlsProps {
  labels: string[];
}

export function ActiveControls({ labels }: ActiveControlsProps): JSX.Element | null {
  if (labels.length === 0) {
    return null;
  }

  return (
    <section className="active-controls">
      {labels.map((controlLabel) => (
        <span key={controlLabel}>{controlLabel}</span>
      ))}
    </section>
  );
}