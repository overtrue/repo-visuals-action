import assert from "node:assert/strict";
import test from "node:test";

import type {
  Artifact,
  LoadedHistory,
  PublishResult,
  StarHistoryClient,
} from "../src/github.ts";
import { runAction, type ActionInputs } from "../src/run.ts";

class FakeClient implements StarHistoryClient {
  artifacts: Artifact[] = [];
  bootstrapCalls = 0;
  private readonly loaded: LoadedHistory;
  private readonly stars: number;

  constructor(loaded: LoadedHistory, stars: number) {
    this.loaded = loaded;
    this.stars = stars;
  }

  async loadHistory(): Promise<LoadedHistory> {
    return this.loaded;
  }

  async fetchStargazerTimestamps(): Promise<string[]> {
    this.bootstrapCalls += 1;
    return ["2024-05-06T14:14:07Z", "2024-05-07T08:00:00Z"];
  }

  async fetchRepositoryCount(): Promise<number> {
    return this.stars;
  }

  async publishArtifacts(
    _branch: string,
    _parentSha: string | null,
    _message: string,
    artifacts: Artifact[],
  ): Promise<PublishResult> {
    this.artifacts = artifacts;
    return { changed: true, commitSha: "commit-sha" };
  }
}

const inputs = (overrides: Partial<ActionInputs> = {}): ActionInputs => ({
  repository: "rustfs/rustfs",
  serverUrl: "https://github.com",
  outputBranch: "star-history",
  outputPath: "assets/stars",
  bootstrap: true,
  commitMessage: "chore: update star history",
  today: "2026-07-18",
  ...overrides,
});

test("bootstraps and publishes all artifacts below output-path", async () => {
  const client = new FakeClient({ history: null, parentSha: null }, 29_944);
  const result = await runAction(client, inputs());

  assert.equal(client.bootstrapCalls, 1);
  assert.deepEqual(
    client.artifacts.map(({ path }) => path),
    [
      "assets/stars/history.json",
      "assets/stars/star-history-light.svg",
      "assets/stars/star-history-dark.svg",
    ],
  );
  const stored = JSON.parse(client.artifacts[0]?.content ?? "") as { points: [string, number][] };
  assert.deepEqual(stored.points.at(-1), ["2026-07-18", 29_944]);
  assert.match(result.lightUrl, /assets\/stars\/star-history-light\.svg$/);
});

test("can start tracking without historical bootstrap", async () => {
  const client = new FakeClient({ history: null, parentSha: null }, 0);
  await runAction(client, inputs({ bootstrap: false }));

  assert.equal(client.bootstrapCalls, 0);
  const stored = JSON.parse(client.artifacts[0]?.content ?? "") as { points: [string, number][] };
  assert.deepEqual(stored.points, [["2026-07-18", 0]]);
});

test("updates existing history without refetching stargazers", async () => {
  const client = new FakeClient(
    {
      history: {
        schema: 1,
        repository: "rustfs/rustfs",
        points: [["2026-07-17", 29_900]],
      },
      parentSha: "parent",
    },
    29_944,
  );
  await runAction(client, inputs());

  assert.equal(client.bootstrapCalls, 0);
});
