// This component centralizes small symbolic icons used across dashboard controls.
type AppIconName = "dashboard" | "insights" | "issue" | "run" | "prev" | "next" | "delete";

export function AppIcon({ name }: { name: AppIconName }): JSX.Element {
  switch (name) {
    case "dashboard":
      return <span className="btn-icon" aria-hidden="true">▦</span>;
    case "insights":
      return <span className="btn-icon" aria-hidden="true">◔</span>;
    case "issue":
      return <span className="btn-icon" aria-hidden="true">⚠</span>;
    case "run":
      return <span className="btn-icon" aria-hidden="true">▶</span>;
    case "prev":
      return <span className="btn-icon" aria-hidden="true">←</span>;
    case "next":
      return <span className="btn-icon" aria-hidden="true">→</span>;
    case "delete":
      return <span className="btn-icon" aria-hidden="true">🗑</span>;
    default:
      return <span className="btn-icon" aria-hidden="true">•</span>;
  }
}
