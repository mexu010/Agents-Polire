import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, expect, test, vi } from "vitest";
import { CodexOAuthClient, OAuthTransportError } from "../src/codex-oauth.js";

const spawned: Array<{ args: string[]; options: any; process: FakeServer }> =
  [];
class FakeServer extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  killed = false;
  requests: any[] = [];
  responder: (request: any) => any = () => undefined;
  constructor() {
    super();
    let buffer = "";
    this.stdin.on("data", (chunk) => {
      buffer += chunk.toString();
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const request = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        this.requests.push(request);
        const response = this.responder(request);
        for (const item of Array.isArray(response)
          ? response
          : response
            ? [response]
            : [])
          queueMicrotask(() => this.stdout.write(JSON.stringify(item) + "\n"));
      }
    });
  }
  kill() {
    this.killed = true;
    this.emit("close", 0);
    return true;
  }
}
vi.mock("node:child_process", () => ({
  spawn: (_binary: string, args: string[], options: any) => {
    const process = new FakeServer();
    spawned.push({ args, options, process });
    process.responder = respond;
    return process;
  },
}));

let auth: "chatgpt" | "apiKey" = "chatgpt";
let models = [
  {
    model: "gpt-5.6-terra",
    hidden: false,
    supportedReasoningEfforts: [
      { reasoningEffort: "low" },
      { reasoningEffort: "medium" },
    ],
    inputModalities: ["text", "image"],
  },
];
let turnStatus = "completed";
let toolEvent = false;
let reroute = false;
let outputTokens = 7;
let oversizedStdout = false;
let messagePhase: "final_answer" | "commentary" | null = "final_answer";
let responseModelProvider = "openai";
let configuredHooks = false;
let hookEvent = false;
function respond(request: any): any {
  if (request.method === "initialized") {
    if (oversizedStdout)
      queueMicrotask(() =>
        spawned.at(-1)?.process.stdout.write("x".repeat(33 * 1024 * 1024)),
      );
    return;
  }
  const result = (value: any) => ({ id: request.id, result: value });
  switch (request.method) {
    case "initialize":
      return result({ userAgent: "fake" });
    case "account/read":
      return result({ account: { type: auth }, requiresOpenaiAuth: true });
    case "model/list":
      return result({ data: models, nextCursor: null });
    case "config/read":
      return result({ config: { mcp_servers: {} }, origins: {}, layers: null });
    case "hooks/list":
      return result({
        data: [
          {
            cwd: request.params.cwds[0],
            hooks: configuredHooks ? [{ name: "unsafe" }] : [],
            warnings: [],
            errors: [],
          },
        ],
      });
    case "account/rateLimits/read":
      return result({ rateLimits: null });
    case "thread/start":
      return result({
        thread: { id: "thread-1" },
        model: request.params.model,
        modelProvider: responseModelProvider,
      });
    case "turn/start":
      return [
        result({ turn: { id: "turn-1", status: "inProgress" } }),
        ...(toolEvent
          ? [
              {
                method: "item/started",
                params: {
                  threadId: "thread-1",
                  turnId: "turn-1",
                  item: { type: "commandExecution", id: "danger" },
                },
              },
            ]
          : []),
        ...(reroute
          ? [
              {
                method: "model/rerouted",
                params: {
                  threadId: "thread-1",
                  turnId: "turn-1",
                  fromModel: "gpt-5.6-terra",
                  toModel: "gpt-5.6-sol",
                },
              },
            ]
          : []),
        ...(hookEvent
          ? [
              {
                method: "hook/started",
                params: { threadId: "thread-1", turnId: "turn-1", run: {} },
              },
            ]
          : []),
        {
          method: "item/completed",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            item: {
              type: "agentMessage",
              id: "interim",
              text: "Working",
              phase: "commentary",
            },
          },
        },
        {
          method: "item/completed",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            item: {
              type: "agentMessage",
              id: "message",
              text: '{"ok":true}',
              phase: messagePhase,
            },
          },
        },
        {
          method: "thread/tokenUsage/updated",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            tokenUsage: {
              last: {
                inputTokens: 11,
                cachedInputTokens: 3,
                outputTokens,
                reasoningOutputTokens: 2,
                totalTokens: 18,
              },
            },
          },
        },
        {
          method: "turn/completed",
          params: {
            threadId: "thread-1",
            turn: { id: "turn-1", status: turnStatus },
          },
        },
      ];
  }
  throw new Error(`unexpected request: ${request.method}`);
}

beforeEach(() => {
  spawned.length = 0;
  auth = "chatgpt";
  turnStatus = "completed";
  toolEvent = false;
  reroute = false;
  outputTokens = 7;
  oversizedStdout = false;
  messagePhase = "final_answer";
  responseModelProvider = "openai";
  configuredHooks = false;
  hookEvent = false;
  models = [
    {
      model: "gpt-5.6-terra",
      hidden: false,
      supportedReasoningEfforts: [
        { reasoningEffort: "low" },
        { reasoningEffort: "medium" },
      ],
      inputModalities: ["text", "image"],
    },
  ];
});

const requirement = {
  model: "gpt-5.6-terra",
  reasoning: "low" as const,
  image: true,
};
const args = {
  ...requirement,
  instructions: "Only JSON",
  input: "Describe",
  images: ["data:image/png;base64,YWJj"],
  schema: { type: "object" },
  timeoutMs: 1000,
  maxOutputTokens: 100,
};

test("check reads ChatGPT account and advertised model capabilities without starting a turn", async () => {
  const result = await new CodexOAuthClient().check([requirement]);
  expect(result).toMatchObject({
    authMode: "chatgpt",
    models: ["gpt-5.6-terra"],
  });
  expect(spawned[0].process.requests.map((r) => r.method)).not.toContain(
    "thread/start",
  );
  expect(spawned[0].process.killed).toBe(true);
});

test("API key login fails closed even when the model exists", async () => {
  auth = "apiKey";
  await expect(
    new CodexOAuthClient().check([requirement]),
  ).rejects.toMatchObject({ code: "AUTH_MODE" });
  expect(spawned[0].process.requests.map((r) => r.method)).not.toContain(
    "thread/start",
  );
});

test("unadvertised image capability fails before generation", async () => {
  models[0].inputModalities = ["text"];
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "MODEL_CAPABILITY",
  });
  expect(spawned[0].process.requests.map((r) => r.method)).not.toContain(
    "thread/start",
  );
});

test("run creates isolated read-only ephemeral thread and captures final usage", async () => {
  const result = await new CodexOAuthClient().run(args);
  expect(result).toEqual({
    text: '{"ok":true}',
    model: "gpt-5.6-terra",
    usage: {
      inputTokens: 11,
      cachedInputTokens: 3,
      outputTokens: 7,
      reasoningTokens: 2,
      totalTokens: 18,
    },
  });
  const { process, args: command, options } = spawned[0];
  expect(command).toEqual(["app-server", "-c", "features.hooks=false"]);
  expect(options).toMatchObject({ shell: false, windowsHide: true });
  expect(options.env.OPENAI_API_KEY).toBeUndefined();
  expect(
    process.requests.find((r) => r.method === "initialize").params.capabilities,
  ).toEqual({ experimentalApi: true, requestAttestation: false });
  expect(
    process.requests.find((r) => r.method === "thread/start").params,
  ).toMatchObject({
    model: "gpt-5.6-terra",
    modelProvider: "openai",
    ephemeral: true,
    environments: [],
    selectedCapabilityRoots: [],
    approvalPolicy: "never",
    sandbox: "read-only",
    config: {
      project_doc_max_bytes: 0,
      web_search: "disabled",
      features: { hooks: false },
    },
  });
  expect(
    process.requests.find((r) => r.method === "turn/start").params,
  ).toMatchObject({
    model: "gpt-5.6-terra",
    effort: "low",
    outputSchema: { type: "object" },
    environments: [],
    input: [
      { type: "text", text: "Describe", text_elements: [] },
      { type: "image", url: "data:image/png;base64,YWJj" },
    ],
  });
  expect(process.killed).toBe(true);
});

test("tool activity fails closed rather than returning generated text", async () => {
  toolEvent = true;
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "TOOL_ACTIVITY",
  });
});

test("failed turn rejects without leaking server details", async () => {
  turnStatus = "failed";
  await expect(new CodexOAuthClient().run(args)).rejects.toBeInstanceOf(
    OAuthTransportError,
  );
});

test("rerouted model is rejected instead of silently upgrading", async () => {
  reroute = true;
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "MODEL_MISMATCH",
  });
});

test("a custom API model provider is rejected before starting a turn", async () => {
  responseModelProvider = "custom-api";
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "MODEL_PROVIDER",
  });
  expect(spawned[0].process.requests.map((r) => r.method)).not.toContain(
    "turn/start",
  );
});

test("configured inherited hooks are rejected before thread creation", async () => {
  configuredHooks = true;
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "HOOKS_CONFIGURED",
  });
  expect(spawned[0].process.requests.map((r) => r.method)).not.toContain(
    "thread/start",
  );
});

test("check rejects inherited hooks without creating a thread", async () => {
  configuredHooks = true;
  await expect(
    new CodexOAuthClient().check([requirement]),
  ).rejects.toMatchObject({ code: "HOOKS_CONFIGURED" });
  expect(spawned[0].process.requests.map((r) => r.method)).not.toContain(
    "thread/start",
  );
});

test("unexpected hook execution during a turn aborts the result", async () => {
  hookEvent = true;
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "HOOK_ACTIVITY",
  });
});

test("reported output above the caller limit retains usage for accounting", async () => {
  outputTokens = 101;
  await expect(new CodexOAuthClient().run(args)).resolves.toMatchObject({
    usage: { outputTokens: 101, inputTokens: 11 },
  });
});

test("legacy null phase uses the last agent message after the turn completes", async () => {
  messagePhase = null;
  await expect(new CodexOAuthClient().run(args)).resolves.toMatchObject({
    text: '{"ok":true}',
  });
});

test("commentary-only turn is not mistaken for a final answer", async () => {
  messagePhase = "commentary";
  await expect(new CodexOAuthClient().run(args)).rejects.toMatchObject({
    code: "NO_OUTPUT",
  });
});

test("unterminated stdout is bounded before a line can accumulate indefinitely", async () => {
  oversizedStdout = true;
  await expect(
    new CodexOAuthClient().check([requirement]),
  ).rejects.toMatchObject({ code: "PROTOCOL_LIMIT" });
});
