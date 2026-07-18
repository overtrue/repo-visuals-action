import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, GitHubClient, type Artifact } from "../src/github.ts";

interface RequestRecord {
  url: string;
  method: string;
  body: unknown;
  accept: string | null;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function fakeFetch(responses: Response[], records: RequestRecord[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const response = responses.shift();
    if (!response) {
      throw new Error("unexpected request");
    }
    records.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      accept: new Headers(init?.headers).get("accept"),
    });
    return response;
  }) as typeof fetch;
}

const artifacts: Artifact[] = [
  { path: "history.json", content: "history" },
  { path: "star-history-light.svg", content: "light" },
  { path: "star-history-dark.svg", content: "dark" },
];

test("honors Retry-After before retrying rate limits", async () => {
  const records: RequestRecord[] = [];
  const delays: number[] = [];
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch(
      [
        jsonResponse({ message: "rate limited" }, 429, { "retry-after": "60" }),
        jsonResponse({ stargazers_count: 29_944 }),
      ],
      records,
    ),
    async (delay) => {
      delays.push(delay);
    },
  );

  assert.equal(await client.fetchRepositoryCount(), 29_944);
  assert.deepEqual(delays, [60_000]);
  assert.equal(records.length, 2);
});

const retryScenarios: Array<{
  name: string;
  status: number;
  headers: Record<string, string>;
  delay: number;
}> = [
  { name: "retries internal server errors", status: 500, headers: {}, delay: 1_000 },
  {
    name: "honors Retry-After for unavailable responses",
    status: 503,
    headers: { "retry-after": "60" },
    delay: 60_000,
  },
];

for (const scenario of retryScenarios) {
  test(scenario.name, async () => {
    const delays: number[] = [];
    const client = new GitHubClient(
      "token",
      "rustfs/rustfs",
      "https://api.github.com",
      fakeFetch(
        [
          jsonResponse({ message: "server error" }, scenario.status, scenario.headers),
          jsonResponse({ stargazers_count: 29_944 }),
        ],
        [],
      ),
      async (delay) => {
        delays.push(delay);
      },
    );

    assert.equal(await client.fetchRepositoryCount(), 29_944);
    assert.deepEqual(delays, [scenario.delay]);
  });
}

test("does not retry a non-rate-limited forbidden response", async () => {
  const records: RequestRecord[] = [];
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch([jsonResponse({ message: "forbidden" }, 403)], records),
    async () => assert.fail("unexpected retry"),
  );

  await assert.rejects(() => client.fetchRepositoryCount(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 403);
    return true;
  });
  assert.equal(records.length, 1);
});

test("paginates timestamped stargazers with the star media type", async () => {
  const records: RequestRecord[] = [];
  const fullPage = Array.from({ length: 100 }, (_, index) => ({
    starred_at: `2024-05-06T00:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}Z`,
  }));
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch([jsonResponse(fullPage), jsonResponse([{ starred_at: "2024-05-07T00:00:00Z" }])], records),
  );

  assert.equal((await client.fetchStargazerTimestamps()).length, 101);
  assert.match(records[1]?.url ?? "", /page=2$/);
  assert.equal(records[0]?.accept, "application/vnd.github.star+json");
});

test("loads history from the exact output-branch commit", async () => {
  const records: RequestRecord[] = [];
  const history = { schema: 1, repository: "rustfs/rustfs", points: [["2026-07-18", 29_944]] };
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch(
      [
        jsonResponse({ object: { sha: "parent" } }),
        jsonResponse({
          type: "file",
          encoding: "base64",
          content: Buffer.from(JSON.stringify(history)).toString("base64"),
        }),
      ],
      records,
    ),
  );

  assert.deepEqual(await client.loadHistory("star-history", "assets/history.json"), {
    history,
    parentSha: "parent",
  });
  assert.match(records[1]?.url ?? "", /assets\/history\.json\?ref=parent$/);
});

test("publishes existing-branch artifacts with one non-forced ref update", async () => {
  const records: RequestRecord[] = [];
  const responses = [
    jsonResponse({ object: { sha: "parent" } }),
    jsonResponse({ sha: "parent", tree: { sha: "base-tree" } }),
    jsonResponse({ sha: "base-tree", truncated: false, tree: [] }),
    jsonResponse({ sha: "blob-history" }),
    jsonResponse({ sha: "blob-light" }),
    jsonResponse({ sha: "blob-dark" }),
    jsonResponse({ sha: "new-tree", truncated: false, tree: [] }),
    jsonResponse({ sha: "new-commit", tree: { sha: "new-tree" } }),
    jsonResponse({}),
  ];
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch(responses, records),
  );

  assert.deepEqual(
    await client.publishArtifacts("star-history", "parent", "update", artifacts),
    { changed: true, commitSha: "new-commit" },
  );
  const commit = records.find(({ url, method }) => url.endsWith("/git/commits") && method === "POST");
  assert.deepEqual(commit?.body, { message: "update", tree: "new-tree", parents: ["parent"] });
  const update = records.at(-1);
  assert.equal(update?.method, "PATCH");
  assert.deepEqual(update?.body, { sha: "new-commit", force: false });
});

test("creates a root commit for a missing output branch", async () => {
  const records: RequestRecord[] = [];
  const responses = [
    jsonResponse({ message: "not found" }, 404),
    jsonResponse({ sha: "blob-history" }),
    jsonResponse({ sha: "blob-light" }),
    jsonResponse({ sha: "blob-dark" }),
    jsonResponse({ sha: "new-tree", truncated: false, tree: [] }),
    jsonResponse({ sha: "new-commit", tree: { sha: "new-tree" } }),
    jsonResponse({}),
  ];
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch(responses, records),
  );

  const result = await client.publishArtifacts("star-history", null, "initial", artifacts);
  assert.deepEqual(result, { changed: true, commitSha: "new-commit" });
  const commit = records.find(({ url, method }) => url.endsWith("/git/commits") && method === "POST");
  assert.deepEqual(commit?.body, { message: "initial", tree: "new-tree", parents: [] });
  assert.deepEqual(records.at(-1)?.body, { ref: "refs/heads/star-history", sha: "new-commit" });
});

test("skips the commit when all artifact blobs are unchanged", async () => {
  const records: RequestRecord[] = [];
  const responses = [
    jsonResponse({ object: { sha: "parent" } }),
    jsonResponse({ sha: "parent", tree: { sha: "base-tree" } }),
    jsonResponse({
      sha: "base-tree",
      truncated: false,
      tree: [
        { path: "history.json", type: "blob", sha: "blob-history" },
        { path: "star-history-light.svg", type: "blob", sha: "blob-light" },
        { path: "star-history-dark.svg", type: "blob", sha: "blob-dark" },
      ],
    }),
    jsonResponse({ sha: "blob-history" }),
    jsonResponse({ sha: "blob-light" }),
    jsonResponse({ sha: "blob-dark" }),
  ];
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch(responses, records),
  );

  assert.deepEqual(await client.publishArtifacts("star-history", "parent", "update", artifacts), {
    changed: false,
    commitSha: "parent",
  });
  assert.equal(records.some(({ url, method }) => url.endsWith("/git/commits") && method === "POST"), false);
});

test("fails closed when the output branch changes during generation", async () => {
  const client = new GitHubClient(
    "token",
    "rustfs/rustfs",
    "https://api.github.com",
    fakeFetch([jsonResponse({ object: { sha: "new-parent" } })], []),
  );

  await assert.rejects(
    () => client.publishArtifacts("star-history", "old-parent", "update", artifacts),
    /changed during generation/,
  );
});
