import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoProgressSection } from "./NoProgressSection";

describe("NoProgressSection", () => {
  it("returns null when count is zero", () => {
    const { container } = render(<NoProgressSection count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows placeholder when backend hasn't shipped the array yet", () => {
    render(<NoProgressSection count={3} />);
    expect(screen.getByText(/NO CHANGE — 3 cases still failing/)).toBeInTheDocument();
    expect(screen.getByText(/Case list not yet available/)).toBeInTheDocument();
  });

  it("renders case list when array is provided", () => {
    render(
      <NoProgressSection
        count={2}
        cases={[
          { test_case_id: "t1", scenario: "Login redirect" },
          { test_case_id: "t2", scenario: "Empty cart checkout" },
        ]}
      />
    );
    expect(screen.getByText("Login redirect")).toBeInTheDocument();
    expect(screen.getByText("Empty cart checkout")).toBeInTheDocument();
    expect(screen.queryByText(/Case list not yet available/)).not.toBeInTheDocument();
  });
});
