import { useMemo } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

interface Props {
  left: any[] | null | undefined;
  right: any[] | null | undefined;
  leftLabel?: string;
  rightLabel?: string;
}

function stringify(schemas: any[] | null | undefined): string {
  if (!schemas || schemas.length === 0) return "";
  try {
    return JSON.stringify(schemas, null, 2);
  } catch {
    return String(schemas);
  }
}

export function SchemaDiff({ left, right, leftLabel, rightLabel }: Props) {
  const leftText = useMemo(() => stringify(left), [left]);
  const rightText = useMemo(() => stringify(right), [right]);

  if (!leftText && !rightText) {
    return (
      <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
        No tool schemas on either version.
      </div>
    );
  }

  if (leftText === rightText) {
    return (
      <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
        No schema changes between these versions.
      </div>
    );
  }

  return (
    <div className="border border-border rounded overflow-hidden text-xs [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
      <ReactDiffViewer
        oldValue={leftText}
        newValue={rightText}
        splitView
        compareMethod={DiffMethod.LINES}
        leftTitle={leftLabel}
        rightTitle={rightLabel}
        useDarkTheme
        styles={{
          diffContainer: { background: "hsl(var(--card))" },
          line: { fontSize: "11px" },
          contentText: { fontFamily: "monospace" },
        }}
      />
    </div>
  );
}
