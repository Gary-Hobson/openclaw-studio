import { describe, expect, it } from "vitest";
import {
  buildConfigMutationFailureMessage,
  resolveConfigMutationPostRunEffects,
  runConfigMutationWorkflow,
} from "@/features/agents/operations/configMutationWorkflow";

describe("configMutationWorkflow integration", () => {
  it("delete workflow maps awaiting-restart outcome to awaiting-restart block phase", async () => {
    const result = await runConfigMutationWorkflow(
      { kind: "delete-agent", isLocalGateway: false },
      {
        executeMutation: async () => undefined,
        shouldAwaitRemoteRestart: async () => true,
      }
    );

    const effects = resolveConfigMutationPostRunEffects(result);
    expect(effects).toEqual({
      shouldReloadAgents: false,
      shouldClearBlock: false,
      awaitingRestartPatch: {
        phase: "awaiting-restart",
        sawDisconnect: false,
      },
    });
  });

  it("rename workflow maps completed outcome to load-and-clear flow", async () => {
    const result = await runConfigMutationWorkflow(
      { kind: "rename-agent", isLocalGateway: false },
      {
        executeMutation: async () => undefined,
        shouldAwaitRemoteRestart: async () => false,
      }
    );

    const effects = resolveConfigMutationPostRunEffects(result);
    let didLoadAgents = false;
    let block: { phase: string; sawDisconnect: boolean } | null = {
      phase: "mutating",
      sawDisconnect: false,
    };
    if (effects.shouldReloadAgents) {
      didLoadAgents = true;
    }
    if (effects.shouldClearBlock) {
      block = null;
    }

    expect(didLoadAgents).toBe(true);
    expect(block).toBeNull();
    expect(effects.awaitingRestartPatch).toBeNull();
  });

  it("workflow errors clear block and set page error message", async () => {
    let block: { phase: string; sawDisconnect: boolean } | null = {
      phase: "mutating",
      sawDisconnect: false,
    };
    let errorMessage: string | null = null;

    try {
      await runConfigMutationWorkflow(
        { kind: "rename-agent", isLocalGateway: false },
        {
          executeMutation: async () => {
            throw new Error("rename exploded");
          },
          shouldAwaitRemoteRestart: async () => false,
        }
      );
    } catch (error) {
      block = null;
      errorMessage = buildConfigMutationFailureMessage({
        kind: "rename-agent",
        error,
      });
    }

    expect(block).toBeNull();
    expect(errorMessage).toBe("rename exploded");
  });
});
