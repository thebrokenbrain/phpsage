import type { JSX } from "react";

interface WorkspaceGridProps {
  runsPane: JSX.Element;
  inspectorPane: JSX.Element;
}

export function WorkspaceGrid({ runsPane, inspectorPane }: WorkspaceGridProps): JSX.Element {
  return (
    <section className="workspace-grid">
      {runsPane}
      {inspectorPane}
    </section>
  );
}