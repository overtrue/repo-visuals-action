import {
  aggregateStargazers,
  mergeSnapshot,
  SCHEMA_VERSION,
  validateHistory,
  type StarHistory,
} from "./history.ts";
import type { Artifact, StarHistoryClient } from "./github.ts";
import { outputFile, rawUrl } from "./paths.ts";
import { renderSvg } from "./svg.ts";

export interface ActionInputs {
  repository: string;
  serverUrl: string;
  outputBranch: string;
  outputPath: string;
  bootstrap: boolean;
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
}

export async function runAction(client: StarHistoryClient, inputs: ActionInputs): Promise<ActionResult> {
  const historyPath = outputFile(inputs.outputPath, "history.json");
  const lightPath = outputFile(inputs.outputPath, "star-history-light.svg");
  const darkPath = outputFile(inputs.outputPath, "star-history-dark.svg");
  const loaded = await client.loadHistory(inputs.outputBranch, historyPath);

  let history: StarHistory;
  if (loaded.history) {
    history = validateHistory(loaded.history, inputs.repository);
  } else {
    const timestamps = inputs.bootstrap ? await client.fetchStargazerTimestamps() : [];
    history = {
      schema: SCHEMA_VERSION,
      repository: inputs.repository,
      points: aggregateStargazers(timestamps),
    };
  }

  const stars = await client.fetchRepositoryCount();
  history = mergeSnapshot(history, inputs.today, stars);
  const artifacts: Artifact[] = [
    { path: historyPath, content: `${JSON.stringify(history, null, 2)}\n` },
    { path: lightPath, content: renderSvg(history) },
    { path: darkPath, content: renderSvg(history, true) },
  ];
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
  };
}
