// This component renders issue navigation and current file/run counters.
import { AppIcon } from "./app-icon.js";

interface MainToolbarProps {
  canGoPrev: boolean;
  canGoNext: boolean;
  mainPath: string;
  currentFilePosition: number;
  totalFiles: number;
  currentErrorPosition: number;
  totalErrors: number;
  onPrev: () => void;
  onNext: () => void;
}

export function MainToolbar({
  canGoPrev,
  canGoNext,
  mainPath,
  currentFilePosition,
  totalFiles,
  currentErrorPosition,
  totalErrors,
  onPrev,
  onNext
}: MainToolbarProps): JSX.Element {
  return (
    <div className="main-toolbar">
      <div className="main-toolbar-left">
        <button disabled={!canGoPrev} onClick={onPrev}>
          <AppIcon name="prev" />
          Prev
        </button>
        <button disabled={!canGoNext} onClick={onNext}>
          <AppIcon name="next" />
          Next
        </button>
        <span className="main-path">{mainPath}</span>
      </div>
      <div className="main-toolbar-right">
        <span>{`File ${currentFilePosition} of ${totalFiles}`}</span>
        <span>{`Errors ${currentErrorPosition} of ${totalErrors}`}</span>
      </div>
    </div>
  );
}
