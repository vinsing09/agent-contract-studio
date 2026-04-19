import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VersionDiff from "./VersionDiff";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agents/:id/diff" element={<VersionDiff />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VersionDiff page (with MSW)", () => {
  it("loads versions and renders the summary pill row", async () => {
    renderAt("/agents/agent-1/diff");

    await waitFor(() => {
      expect(screen.getByText(/Compare Versions/i)).toBeInTheDocument();
    });

    // Summary header presence
    expect(await screen.findByText(/What changed|No changes/i)).toBeInTheDocument();

    // Uniquely-labeled pills
    expect(screen.getByText("Obligations")).toBeInTheDocument();
    expect(screen.getByText("Forbidden")).toBeInTheDocument();

    // Prompt appears twice (pill + tab). Pill says "changed" since prompts differ.
    const prompts = screen.getAllByText("Prompt");
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    const pillText = prompts
      .map((el) => el.closest("button")?.textContent ?? "")
      .join(" ");
    expect(pillText.toLowerCase()).toContain("changed");
  });

  it("renders the picker labels for baseline and challenger", async () => {
    renderAt("/agents/agent-1/diff");
    expect(await screen.findByText(/Baseline \(left\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/Challenger \(right\)/i)).toBeInTheDocument();
  });
});
