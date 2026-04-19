import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VersionDiffSummary } from "./VersionDiffSummary";
import type { AgentVersion } from "@/lib/api";
import type { ContractV2 } from "@/lib/types";

function mkVersion(overrides: Partial<AgentVersion>): AgentVersion {
  return {
    id: "v",
    agent_id: "a",
    version_number: 1,
    label: "",
    system_prompt: "",
    tool_schemas: [],
    parent_version_id: null,
    source: "upload",
    created_at: "",
    ...overrides,
  };
}

function mkContract(overrides: Partial<ContractV2>): ContractV2 {
  return {
    id: "c",
    agent_id: "a",
    agent_version_id: "v",
    obligations: [],
    tool_sequences: [],
    forbidden_behaviors: [],
    latency_budgets: [],
    ...overrides,
  } as ContractV2;
}

describe("VersionDiffSummary", () => {
  it("renders 'No changes' when everything is identical", () => {
    const v = mkVersion({ id: "v-1", system_prompt: "hi" });
    const c = mkContract({});
    render(
      <VersionDiffSummary
        leftVersion={v}
        rightVersion={{ ...v, id: "v-2" }}
        leftContract={c}
        rightContract={c}
        onJump={() => {}}
      />
    );
    expect(screen.getByText("No changes")).toBeInTheDocument();
  });

  it("flags changed prompt and obligation delta counts", () => {
    const left = mkVersion({ id: "v-1", system_prompt: "old" });
    const right = mkVersion({ id: "v-2", system_prompt: "new" });
    const leftC = mkContract({
      obligations: [{ id: "o1", text: "A", source: "x", failure_category: "y" } as any],
    });
    const rightC = mkContract({
      obligations: [
        { id: "o1", text: "A", source: "x", failure_category: "y" } as any,
        { id: "o2", text: "B", source: "x", failure_category: "y" } as any,
      ],
    });
    render(
      <VersionDiffSummary
        leftVersion={left}
        rightVersion={right}
        leftContract={leftC}
        rightContract={rightC}
        onJump={() => {}}
      />
    );
    expect(screen.getByText("What changed")).toBeInTheDocument();
    // Prompt pill shows "changed"
    const promptPill = screen.getByText("Prompt").closest("button");
    expect(promptPill?.textContent?.toLowerCase()).toContain("changed");
    // Obligations pill shows "+1"
    const obPill = screen.getByText("Obligations").closest("button");
    expect(obPill?.textContent).toContain("+1");
  });

  it("invokes onJump when a pill is clicked", () => {
    const onJump = vi.fn();
    const v = mkVersion({ id: "v-1" });
    render(
      <VersionDiffSummary
        leftVersion={v}
        rightVersion={{ ...v, id: "v-2" }}
        leftContract={mkContract({})}
        rightContract={mkContract({})}
        onJump={onJump}
      />
    );
    fireEvent.click(screen.getByText("Schema").closest("button")!);
    expect(onJump).toHaveBeenCalledWith("schema");
  });
});
