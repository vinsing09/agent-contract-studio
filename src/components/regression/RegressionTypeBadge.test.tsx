import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegressionTypeBadge } from "./RegressionTypeBadge";

describe("RegressionTypeBadge", () => {
  it("renders 'stable' for STABLE", () => {
    render(<RegressionTypeBadge type="STABLE" />);
    expect(screen.getByText("stable")).toBeInTheDocument();
  });

  it("renders 'regression' for REGRESSION", () => {
    render(<RegressionTypeBadge type="REGRESSION" />);
    expect(screen.getByText("regression")).toBeInTheDocument();
  });

  it("renders 'no progress' for NO_PROGRESS", () => {
    render(<RegressionTypeBadge type="NO_PROGRESS" />);
    expect(screen.getByText("no progress")).toBeInTheDocument();
  });

  it("returns null when type is falsy", () => {
    const { container } = render(<RegressionTypeBadge type={null} />);
    expect(container.firstChild).toBeNull();
  });
});
