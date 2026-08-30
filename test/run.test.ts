import assert from "node:assert/strict";
import test from "node:test";

import type {
  Artifact,
  LoadedHistory,
  PublishResult,
  StarHistoryClient,
} from "../src/github.ts";
import type { Contributor } from "../src/contributors.ts";
import { runAction, type ActionInputs } from "../src/run.ts";

class FakeClient implements StarHistoryClient {
  artifacts: Artifact[] = [];
  bootstrapCalls = 0;
  contributorCalls = 0;
  contributorLimit: number | null = null;
  lookedUpRepositories: string[] = [];
  repositoryIds = new Map<string, number>();
  private readonly loaded: LoadedHistory;
  private readonly stars: number;

  constructor(loaded: LoadedHistory, stars: number) {
    this.loaded = loaded;
    this.stars = stars;
  }

  async loadHistory(): Promise<LoadedHistory> {
    return this.loaded;
  }

  async fetchRepositoryId(repository: string): Promise<number | null> {
    this.lookedUpRepositories.push(repository);
    return this.repositoryIds.get(repository) ?? null;
  }

  async fetchStargazerTimestamps(): Promise<string[]> {
    this.bootstrapCalls += 1;
    return ["2024-05-06T14:14:07Z", "2024-05-07T08:00:00Z"];
  }

  async fetchRepositoryCount(): Promise<number> {
    return this.stars;
  }

  async fetchContributors(limit: number): Promise<Contributor[]> {
    this.contributorCalls += 1;
    this.contributorLimit = limit;
    return [
      {
        login: "overtrue",
        contributions: 1516,
        avatarDataUrl: `data:image/png;base64,${Buffer.from("avatar").toString("base64")}`,
      },
    ];
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
  repositoryId: 42,
  serverUrl: "https://github.com",
  outputBranch: "star-history",
  outputPath: "assets/stars",
  bootstrap: true,
  contributors: true,
  contributorsLimit: 150,
  chartStyle: "gradient",
  chartLayout: "glance",
  smooth: true,
  overrides: {},
  contributorLayout: {},
  animate: true,
  commitMessage: "chore: update star history",
  today: "2026-07-18",
  ...overrides,
});

test("bootstraps and publishes all artifacts below output-path", async () => {
  const client = new FakeClient({ history: null, parentSha: null }, 29_944);
  const result = await runAction(client, inputs(), client);

  assert.equal(client.bootstrapCalls, 1);
  assert.deepEqual(
    client.artifacts.map(({ path }) => path),
    [
      "assets/stars/history.json",
      "assets/stars/star-history-light.svg",
      "assets/stars/star-history-dark.svg",
      "assets/stars/contributors-light.svg",
      "assets/stars/contributors-dark.svg",
    ],
  );
  const stored = JSON.parse(client.artifacts[0]?.content ?? "") as { points: [string, number][] };
  assert.deepEqual(stored.points.at(-1), ["2026-07-18", 29_944]);
  assert.match(client.artifacts[1]?.content ?? "", /data-style="gradient"/);
  assert.match(client.artifacts[1]?.content ?? "", /data-layout="glance"/);
  assert.match(client.artifacts[1]?.content ?? "", /prefers-reduced-motion/);
  assert.match(client.artifacts[3]?.content ?? "", /overtrue, 1516 contributions/);
  assert.match(result.lightUrl, /assets\/stars\/star-history-light\.svg$/);
  assert.match(result.contributorsLightUrl ?? "", /assets\/stars\/contributors-light\.svg$/);
  assert.equal(result.contributors, 1);
  assert.equal(client.contributorLimit, 150);
});

test("can start tracking without historical bootstrap", async () => {
  const client = new FakeClient({ history: null, parentSha: null }, 0);
  const result = await runAction(client, inputs({ bootstrap: false, contributors: false }));

  assert.equal(client.bootstrapCalls, 0);
  const stored = JSON.parse(client.artifacts[0]?.content ?? "") as { points: [string, number][] };
  assert.deepEqual(stored.points, [["2026-07-18", 0]]);
  assert.equal(client.contributorCalls, 0);
  assert.equal(result.contributors, null);
  assert.equal(result.contributorsLightUrl, null);
  assert.equal(result.contributorsDarkUrl, null);
});

test("requires a user token only when historical bootstrap is needed", async () => {
  const client = new FakeClient({ history: null, parentSha: null }, 29_944);

  await assert.rejects(() => runAction(client, inputs()), /stargazers-token/);
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

test("adopts history stored under a former repository name", async () => {
  const client = new FakeClient(
    {
      history: {
        schema: 1,
        repository: "rustfs/rustfs-old",
        points: [["2026-07-17", 29_900]],
      },
      parentSha: "parent",
    },
    29_944,
  );
  client.repositoryIds.set("rustfs/rustfs-old", 42);
  await runAction(client, inputs());

  assert.deepEqual(client.lookedUpRepositories, ["rustfs/rustfs-old"]);
  const stored = JSON.parse(client.artifacts[0]?.content ?? "") as {
    repository: string;
    points: [string, number][];
  };
  assert.equal(stored.repository, "rustfs/rustfs");
  assert.deepEqual(stored.points, [["2026-07-17", 29_900], ["2026-07-18", 29_944]]);
});

test("rejects history belonging to a different repository", async () => {
  const client = new FakeClient(
    {
      history: {
        schema: 1,
        repository: "other/repo",
        points: [["2026-07-17", 29_900]],
      },
      parentSha: "parent",
    },
    29_944,
  );
  client.repositoryIds.set("other/repo", 7);

  await assert.rejects(() => runAction(client, inputs()), /belongs to other\/repo/);
});

test("rejects a renamed history when the repository id is unknown", async () => {
  const client = new FakeClient(
    {
      history: {
        schema: 1,
        repository: "rustfs/rustfs-old",
        points: [["2026-07-17", 29_900]],
      },
      parentSha: "parent",
    },
    29_944,
  );
  client.repositoryIds.set("rustfs/rustfs-old", 42);

  await assert.rejects(
    () => runAction(client, inputs({ repositoryId: null })),
    /belongs to rustfs\/rustfs-old/,
  );
  assert.deepEqual(client.lookedUpRepositories, []);
});
