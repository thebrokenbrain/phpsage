// This hook encapsulates sidepanel resizing and persisted width behavior.
import { useEffect, type RefObject } from "react";
import { clampSidepanelWidth, saveSidepanelWidth } from "../utils/sidepanel-width.js";

interface UseSidepanelResizeOptions {
  layoutRef: RefObject<HTMLDivElement | null>;
  isResizing: boolean;
  sidepanelWidth: number;
  minWidth: number;
  maxWidth: number;
  onSetWidth: (nextWidth: number) => void;
  onStopResizing: () => void;
}

export function useSidepanelResize({
  layoutRef,
  isResizing,
  sidepanelWidth,
  minWidth,
  maxWidth,
  onSetWidth,
  onStopResizing
}: UseSidepanelResizeOptions): void {
  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const layoutRect = layoutRef.current?.getBoundingClientRect();
      if (!layoutRect) {
        return;
      }

      const maxAllowedByViewport = Math.floor(window.innerWidth * 0.55);
      const nextWidth = clampSidepanelWidth(event.clientX - layoutRect.left, maxAllowedByViewport, minWidth, maxWidth);
      onSetWidth(nextWidth);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", onStopResizing);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", onStopResizing);
    };
  }, [isResizing, layoutRef, minWidth, maxWidth, onSetWidth, onStopResizing]);

  useEffect(() => {
    saveSidepanelWidth(sidepanelWidth);
  }, [sidepanelWidth]);

  useEffect(() => {
    if (!isResizing) {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      return;
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing]);
}
