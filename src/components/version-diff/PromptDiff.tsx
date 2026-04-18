import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

interface Props {
  left: string;
  right: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function PromptDiff({ left, right, leftLabel, rightLabel }: Props) {
  if (left === right) {
    return (
      <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
        No prompt changes between these versions.
      </div>
    );
  }
  return (
    <div className="border border-border rounded overflow-hidden text-xs [&_pre]:whitespace-pre-wrap [&_pre]:break-words">
      <ReactDiffViewer
        oldValue={left}
        newValue={right}
        splitView
        compareMethod={DiffMethod.WORDS}
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
