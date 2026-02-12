import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AgentCreateModal } from "@/features/agents/components/AgentCreateModal";

const openModal = (overrides?: {
  onClose?: () => void;
  onSubmit?: (payload: unknown) => void;
}) => {
  const onClose = overrides?.onClose ?? vi.fn();
  const onSubmit = overrides?.onSubmit ?? vi.fn();
  render(
    createElement(AgentCreateModal, {
      open: true,
      suggestedName: "New Agent",
      onClose,
      onSubmit,
    })
  );
  return { onClose, onSubmit };
};

describe("AgentCreateModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits guided payload through starter-kit flow", () => {
    const onSubmit = vi.fn();
    openModal({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Researcher starter kit" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Conservative control level" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Agent name"), {
      target: { value: "Research Agent" },
    });
    fireEvent.change(screen.getByLabelText("First task"), {
      target: { value: "Investigate competitor positioning and summarize findings." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "guided",
        name: "Research Agent",
        draft: expect.objectContaining({
          starterKit: "researcher",
          controlLevel: "conservative",
          firstTask: "Investigate competitor positioning and summarize findings.",
        }),
      })
    );
  });

  it("shows starter-derived summary in review", () => {
    openModal();

    fireEvent.click(screen.getByRole("button", { name: "Researcher starter kit" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Conservative control level" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText(/Starter: Researcher/i)).toBeInTheDocument();
    expect(screen.getByText(/Tools profile: minimal/i)).toBeInTheDocument();
  });

  it("allows advanced controls for runtime tool additions", () => {
    const onSubmit = vi.fn();
    openModal({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Engineer starter kit" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Balanced control level" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Show advanced controls" }));

    const toolsAllow = screen.getByLabelText(
      "Additional tool allowlist entries (comma or newline separated)"
    );
    fireEvent.change(toolsAllow, { target: { value: "group:web\ngroup:runtime" } });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "guided",
        draft: expect.objectContaining({
          controls: expect.objectContaining({
            toolsAllow: expect.arrayContaining(["group:web", "group:runtime"]),
          }),
        }),
      })
    );
  });

  it("calls onClose when close is pressed", () => {
    const onClose = vi.fn();
    openModal({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
