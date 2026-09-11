import { describe, expect, it, vi } from "vitest";
import { completeStagesFromDescription } from "./stages-from-description";

const EXAMPLE_STAGES = [
  { kind: "warmup" as const, label: "WU", duration: "2 km", target: "" },
  { kind: "work" as const, label: "", duration: "5 km", target: "4:20" },
  { kind: "cooldown" as const, label: "CD", duration: "2 km", target: "" },
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completion(content: string | null): unknown {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

describe("completeStagesFromDescription", () => {
  it("returns warmup, work, and cooldown for the notes example", async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      void init;
      return Promise.resolve(jsonResponse(200, completion(JSON.stringify({ stages: EXAMPLE_STAGES }))));
    });

    const result = await completeStagesFromDescription(
      { structure: "2km WU, 5km 4:20, 2km CD" },
      { apiKey: "sk-test", model: "gpt-4o-mini", fetchImpl },
    );

    expect(result.stages).toEqual(EXAMPLE_STAGES);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const firstBody = fetchImpl.mock.calls[0]?.[1]?.body;
    const body = JSON.parse(typeof firstBody === "string" ? firstBody : "{}") as {
      messages: { role: string; content: string }[];
    };
    expect(body.messages[0]?.content).toContain("2km WU, 5km 4:20, 2km CD");
    expect(body.messages[1]?.content).toBe("2km WU, 5km 4:20, 2km CD");
  });

  it("throws when the completion JSON fails the stages schema", async () => {
    await expect(
      completeStagesFromDescription(
        { structure: "2km WU" },
        {
          apiKey: "sk-test",
          model: "gpt-4o-mini",
          fetchImpl: () => Promise.resolve(jsonResponse(200, completion(JSON.stringify({ stages: "nope" })))),
        },
      ),
    ).rejects.toThrow(/stages schema/);
  });
});
