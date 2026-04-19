import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ObligationCoverage } from "./ObligationCoverage";
import type { ObligationV2, TestCaseV2 } from "@/lib/types";

function ob(id: string, text = "obligation " + id): ObligationV2 {
  return { id, text, source: "x", failure_category: "y" } as ObligationV2;
}

function tc(id: string, obligationIds: string[]): TestCaseV2 {
  return {
    id,
    agent_id: "a",
    agent_version_id: "v",
    contract_id: "c",
    scenario: "scenario-" + id,
    input_text: "",
    tool_stubs: {},
    assertions: [],
    obligation_ids: obligationIds,
    tags: [],
    locked: false,
    locked_at_pass: null,
    locked_at_version_id: null,
  } as TestCaseV2;
}

describe("ObligationCoverage", () => {
  it("renders coverage count and surfaces uncovered obligations", () => {
    render(
      <MemoryRouter>
        <ObligationCoverage
          agentId="a"
          obligations={[ob("o1"), ob("o2"), ob("o3")]}
          testCases={[tc("t1", ["o1"]), tc("t2", ["o1", "o2"])]}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("2/3 covered")).toBeInTheDocument();
    expect(screen.getByText("1 uncovered")).toBeInTheDocument();
    expect(screen.getByText(/No test cases cover this obligation/)).toBeInTheDocument();
  });

  it("returns null when there are no obligations", () => {
    const { container } = render(
      <MemoryRouter>
        <ObligationCoverage agentId="a" obligations={[]} testCases={[]} />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
