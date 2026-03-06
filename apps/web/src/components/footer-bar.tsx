// This component renders the persistent dashboard footer status.
interface FooterBarProps {
  targetPath: string;
  runId: string;
  status: string;
  issuesCount: number;
  runsCount: number;
}

export function FooterBar({ targetPath, runId, status, issuesCount, runsCount }: FooterBarProps): JSX.Element {
  return (
    <footer className="footerbar">
      <div className="footer-left">
        <span>{`Running in: ${targetPath}`}</span>
        <span>{`Run ID: ${runId}`}</span>
      </div>
      <div className="footer-right">
        <span>{status}</span>
        <span>{`Issues: ${issuesCount}`}</span>
        <span>{`Runs: ${runsCount}`}</span>
      </div>
    </footer>
  );
}
