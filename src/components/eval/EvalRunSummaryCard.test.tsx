import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvalRunSummaryCard } from "./EvalRunSummaryCard";
import type { EvalResult } from "@/lib/api";

function mkResult(overrides: Partial<EvalResult>): EvalResult {
  return {
    id: "r",
    eval_run_id: "run",
    test_case_id: "tc",
    assertion_id: null,
    result_type: "deterministic",
    passed: true,
    latency_ms: 200,
    reason: null,
    actual: null,
    expected: null,
    regression_type: null,
    ...overrides,
  } as EvalResult;
}

describe("EvalRunSummaryCard", () => {
  it("renders 100% pass rate and success tone when every case passes", () => {
    render(
      <EvalRunSummaryCard
        results={[
          mkResult({ id: "a", passed: true }),
          mkResult({ id: "b", passed: true }),
        ]}
      />
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
  });

  it("reports over-budget count when informational results fail", () => {
    render(
      <EvalRunSummaryCard
        results={[
          mkResult({ id: "a", result_type: "deterministic", passed: true }),
          mkResult({
            id: "b",
            result_type: "informational",
            passed: false,
            latency_ms: 9000,
          }),
        ]}
      />
    );
    expect(screen.getByText("1 over budget")).toBeInTheDocument();
  });

  it("prefers summary counts over computed counts when provided", () => {
    render(
      <EvalRunSummaryCard
        results={[mkResult({ id: "a", passed: true })]}
        summary={{ total: 10, passed: 7, failed: 3 }}
      />
    );
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("7/10 passed")).toBeInTheDocument();
  });
});
