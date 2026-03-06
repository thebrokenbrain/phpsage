interface CopyLinkErrorProps {
  copyLinkStatus: "idle" | "copied" | "error";
}

export function CopyLinkError({ copyLinkStatus }: CopyLinkErrorProps): JSX.Element | null {
  if (copyLinkStatus !== "error") {
    return null;
  }

  return <p className="error">Could not copy link.</p>;
}