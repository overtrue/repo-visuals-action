import {
  aggregateStargazers,
  mergeSnapshot,
  readRepository,
  SCHEMA_VERSION,
  validateHistory,
  type StarHistory,
} from "./history.ts";
import type { Artifact, StarHistoryClient } from "./github.ts";
import { outputFile, rawUrl } from "./paths.ts";
import { renderContributorsSvg, type ContributorLayout } from "./contributors.ts";
import { renderSvg } from "./svg.ts";
import type { ChartStyle, ChartVariant, PaletteOverrides } from "./theme.ts";

export interface ActionInputs {
  repository: string;
  repositoryId: number | null;
  serverUrl: string;
  outputBranch: string;
  outputPath: string;
  bootstrap: boolean;
  contributors: boolean;
  contributorsLimit: number;
  chartStyle: ChartStyle;
  chartVariant?: ChartVariant;
  chartTitle?: string;
  contributorsTitle?: string;
  smooth: boolean;
  overrides: PaletteOverrides;
  contributorLayout: Partial<ContributorLayout>;
  animate: boolean;
  commitMessage: string;
  today: string;
}

export interface ActionResult {
  stars: number;
  changed: boolean;
  commitSha: string;
  lightUrl: string;
  darkUrl: string;
  historyUrl: string;
  contributors: number | null;
  contributorsLightUrl: string | null;
  contributorsDarkUrl: string | null;
}

type StargazerClient = Pick<StarHistoryClient, "fetchStargazerTimestamps">;

// A repository rename leaves the stored history under the former name. GitHub keeps
// resolving that name to the same numeric id, which separates a rename from history
// belonging to a genuinely different repository (a fork carrying the output branch).
async function resolveStoredRepository(
  client: StarHistoryClient,
  inputs: ActionInputs,
  stored: string,
): Promise<string> {
  if (stored === inputs.repository) {
    return stored;
  }
  if (inputs.repositoryId !== null && (await client.fetchRepositoryId(stored)) === inputs.repositoryId) {
    return stored;
  }
  throw new Error(`star history belongs to ${stored}, not ${inputs.repository}`);
}

export async function runAction(
  client: StarHistoryClient,
  inputs: ActionInputs,
  stargazerClient?: StargazerClient,
): Promise<ActionResult> {
  const historyPath = outputFile(inputs.outputPath, "history.json");
  const lightPath = outputFile(inputs.outputPath, "star-history-light.svg");
  const darkPath = outputFile(inputs.outputPath, "star-history-dark.svg");
  const contributorsLightPath = outputFile(inputs.outputPath, "contributors-light.svg");
  const contributorsDarkPath = outputFile(inputs.outputPath, "contributors-dark.svg");
  const loaded = await client.loadHistory(inputs.outputBranch, historyPath);
  const stars = await client.fetchRepositoryCount();

  let history: StarHistory;
  if (loaded.history) {
    const stored = readRepository(loaded.history) ?? inputs.repository;
    history = validateHistory(loaded.history, await resolveStoredRepository(client, inputs, stored));
    history = { ...history, repository: inputs.repository };
  } else {
    let timestamps: string[] = [];
    if (inputs.bootstrap) {
      if (!stargazerClient) {
        throw new Error("stargazers-token is required to bootstrap historical timestamps");
      }
      timestamps = await stargazerClient.fetchStargazerTimestamps();
    }
    history = {
      schema: SCHEMA_VERSION,
      repository: inputs.repository,
      points: aggregateStargazers(timestamps),
    };
  }

  history = mergeSnapshot(history, inputs.today, stars);
  const contributors = inputs.contributors
    ? await client.fetchContributors(inputs.contributorsLimit)
    : null;
  const chartOptions = {
    style: inputs.chartStyle,
    variant: inputs.chartVariant,
    animate: inputs.animate,
    smooth: inputs.smooth,
    title: inputs.chartTitle,
    overrides: inputs.overrides,
  };
  const wallOptions = {
    style: inputs.chartStyle,
    animate: inputs.animate,
    title: inputs.contributorsTitle,
    overrides: inputs.overrides,
    layout: inputs.contributorLayout,
  };
  const artifacts: Artifact[] = [
    { path: historyPath, content: `${JSON.stringify(history, null, 2)}\n` },
    { path: lightPath, content: renderSvg(history, chartOptions) },
    { path: darkPath, content: renderSvg(history, { ...chartOptions, dark: true }) },
  ];
  if (contributors) {
    artifacts.push(
      {
        path: contributorsLightPath,
        content: renderContributorsSvg(contributors, inputs.repository, wallOptions),
      },
      {
        path: contributorsDarkPath,
        content: renderContributorsSvg(contributors, inputs.repository, { ...wallOptions, dark: true }),
      },
    );
  }
  const published = await client.publishArtifacts(
    inputs.outputBranch,
    loaded.parentSha,
    inputs.commitMessage,
    artifacts,
  );

  return {
    stars,
    changed: published.changed,
    commitSha: published.commitSha,
    lightUrl: rawUrl(inputs.serverUrl, inputs.repository, inputs.outputBranch, lightPath),
    darkUrl: rawUrl(inputs.serverUrl, inputs.repository, inputs.outputBranch, darkPath),
    historyUrl: rawUrl(inputs.serverUrl, inputs.repository, inputs.outputBranch, historyPath),
    contributors: contributors?.length ?? null,
    contributorsLightUrl: contributors
      ? rawUrl(inputs.serverUrl, inputs.repository, inputs.outputBranch, contributorsLightPath)
      : null,
    contributorsDarkUrl: contributors
      ? rawUrl(inputs.serverUrl, inputs.repository, inputs.outputBranch, contributorsDarkPath)
      : null,
  };
}
