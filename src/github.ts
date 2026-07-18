type Sleep = (milliseconds: number) => Promise<void>;

interface RefResponse {
  object: { sha: string };
}

interface CommitResponse {
  sha: string;
  tree: { sha: string };
}

interface ContentResponse {
  type: string;
  content?: string;
  encoding?: string;
}

interface TreeResponse {
  sha: string;
  truncated: boolean;
  tree: Array<{ path?: string; type?: string; sha?: string }>;
}

interface BlobResponse {
  sha: string;
}

interface RepositoryResponse {
  stargazers_count: number;
}

interface StargazerResponse {
  starred_at?: unknown;
}

export interface LoadedHistory {
  history: unknown | null;
  parentSha: string | null;
}

export interface PublishResult {
  changed: boolean;
  commitSha: string;
}

export interface Artifact {
  path: string;
  content: string;
}

export interface StarHistoryClient {
  loadHistory(branch: string, path: string): Promise<LoadedHistory>;
  fetchStargazerTimestamps(): Promise<string[]>;
  fetchRepositoryCount(): Promise<number>;
  publishArtifacts(
    branch: string,
    expectedParentSha: string | null,
    message: string,
    artifacts: Artifact[],
  ): Promise<PublishResult>;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number, now: () => number): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1_000;
    }
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.max(0, retryAt - now());
    }
  }

  const rateLimited =
    response.status === 429 ||
    (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
  if (rateLimited) {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0) {
      return Math.max(0, reset * 1_000 - now());
    }
    return 2 ** attempt * 1_000;
  }

  return [500, 502, 503, 504].includes(response.status) ? 2 ** attempt * 1_000 : null;
}

function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === "string") {
      return `GitHub API request failed with HTTP ${status}: ${parsed.message}`;
    }
  } catch {
    // The status remains actionable when GitHub returns a non-JSON error page.
  }
  return `GitHub API request failed with HTTP ${status}`;
}

export class GitHubClient implements StarHistoryClient {
  private readonly token: string;
  private readonly repositoryPath: string;
  private readonly apiUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: Sleep;
  private readonly now: () => number;

  constructor(
    token: string,
    repository: string,
    apiUrl: string,
    fetchImplementation: typeof fetch = fetch,
    sleep: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: () => number = Date.now,
  ) {
    this.token = token;
    this.repositoryPath = `/repos/${repository}`;
    this.apiUrl = apiUrl;
    this.fetchImplementation = fetchImplementation;
    this.sleep = sleep;
    this.now = now;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    accept = "application/vnd.github+json",
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImplementation(`${this.apiUrl.replace(/\/$/, "")}${path}`, {
          method,
          headers: {
            accept,
            authorization: `Bearer ${this.token}`,
            "content-type": "application/json",
            "user-agent": "overtrue-star-history-action",
            "x-github-api-version": "2026-03-10",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        if (attempt === 2) {
          throw new Error(`GitHub API request failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        await this.sleep(2 ** attempt * 1_000);
        continue;
      }

      if (response.ok) {
        return (response.status === 204 ? undefined : await response.json()) as T;
      }

      const responseBody = await response.text();
      const delay = retryDelay(response, attempt, this.now);
      if (delay !== null && attempt < 2) {
        await this.sleep(delay);
        continue;
      }
      throw new ApiError(response.status, errorMessage(response.status, responseBody));
    }
    throw new Error("GitHub API request failed");
  }

  private async getRef(branch: string): Promise<RefResponse | null> {
    try {
      return await this.request<RefResponse>(
        "GET",
        `${this.repositoryPath}/git/ref/heads/${encodeURIComponent(branch)}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async loadHistory(branch: string, path: string): Promise<LoadedHistory> {
    const ref = await this.getRef(branch);
    if (!ref) {
      return { history: null, parentSha: null };
    }

    try {
      const response = await this.request<ContentResponse>(
        "GET",
        `${this.repositoryPath}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref.object.sha)}`,
      );
      if (response.type !== "file" || response.encoding !== "base64" || typeof response.content !== "string") {
        throw new Error("history path does not contain a base64-encoded file");
      }
      const content = Buffer.from(response.content.replaceAll("\n", ""), "base64").toString("utf8");
      return { history: JSON.parse(content) as unknown, parentSha: ref.object.sha };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return { history: null, parentSha: ref.object.sha };
      }
      if (error instanceof SyntaxError) {
        throw new Error("history.json is not valid JSON", { cause: error });
      }
      throw error;
    }
  }

  async fetchStargazerTimestamps(): Promise<string[]> {
    const timestamps: string[] = [];
    for (let page = 1; ; page += 1) {
      const response = await this.request<StargazerResponse[]>(
        "GET",
        `${this.repositoryPath}/stargazers?per_page=100&page=${page}`,
        undefined,
        "application/vnd.github.star+json",
      );
      if (!Array.isArray(response)) {
        throw new Error("GitHub returned an invalid stargazer response");
      }
      for (const stargazer of response) {
        if (typeof stargazer.starred_at !== "string") {
          throw new Error("GitHub returned a stargazer without starred_at");
        }
        timestamps.push(stargazer.starred_at);
      }
      if (response.length < 100) {
        return timestamps;
      }
    }
  }

  async fetchRepositoryCount(): Promise<number> {
    const response = await this.request<RepositoryResponse>("GET", this.repositoryPath);
    if (!Number.isSafeInteger(response.stargazers_count) || response.stargazers_count < 0) {
      throw new Error("GitHub returned an invalid stargazers_count");
    }
    return response.stargazers_count;
  }

  async publishArtifacts(
    branch: string,
    expectedParentSha: string | null,
    message: string,
    artifacts: Artifact[],
  ): Promise<PublishResult> {
    const currentRef = await this.getRef(branch);
    const currentSha = currentRef?.object.sha ?? null;
    if (currentSha !== expectedParentSha) {
      throw new Error("output branch changed during generation; rerun the action");
    }

    let baseTree: string | undefined;
    const existing = new Map<string, string>();
    if (currentSha) {
      const commit = await this.request<CommitResponse>(
        "GET",
        `${this.repositoryPath}/git/commits/${encodeURIComponent(currentSha)}`,
      );
      baseTree = commit.tree.sha;
      const tree = await this.request<TreeResponse>(
        "GET",
        `${this.repositoryPath}/git/trees/${encodeURIComponent(baseTree)}?recursive=1`,
      );
      for (const entry of tree.tree) {
        if (entry.type === "blob" && entry.path && entry.sha) {
          existing.set(entry.path, entry.sha);
        }
      }
    }

    const blobs: Array<Artifact & { sha: string }> = [];
    for (const artifact of artifacts) {
      const blob = await this.request<BlobResponse>("POST", `${this.repositoryPath}/git/blobs`, {
        content: artifact.content,
        encoding: "utf-8",
      });
      blobs.push({ ...artifact, sha: blob.sha });
    }

    if (currentSha && blobs.every(({ path, sha }) => existing.get(path) === sha)) {
      return { changed: false, commitSha: currentSha };
    }

    const tree = await this.request<TreeResponse>("POST", `${this.repositoryPath}/git/trees`, {
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: blobs.map(({ path, sha }) => ({ path, mode: "100644", type: "blob", sha })),
    });
    const commit = await this.request<CommitResponse>("POST", `${this.repositoryPath}/git/commits`, {
      message,
      tree: tree.sha,
      parents: currentSha ? [currentSha] : [],
    });

    if (currentSha) {
      await this.request<void>(
        "PATCH",
        `${this.repositoryPath}/git/refs/heads/${encodeURIComponent(branch)}`,
        { sha: commit.sha, force: false },
      );
    } else {
      await this.request<void>("POST", `${this.repositoryPath}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
      });
    }
    return { changed: true, commitSha: commit.sha };
  }
}
