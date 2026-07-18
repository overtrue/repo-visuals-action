import * as core from "@actions/core";

import { DEFAULT_CONTRIBUTORS_LIMIT, validateContributorsLimit } from "./contributors.ts";
import { GitHubClient } from "./github.ts";
import { validateRepository } from "./history.ts";
import { validateBranch, validateOutputPath } from "./paths.ts";
import { runAction } from "./run.ts";
import { validateChartStyle } from "./svg.ts";

async function main(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    core.setSecret(token);
    const stargazersToken = core.getInput("stargazers-token");
    if (stargazersToken) {
      core.setSecret(stargazersToken);
    }
    const repository = validateRepository(process.env.GITHUB_REPOSITORY ?? "");
    const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
    const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
    const outputBranch = validateBranch(core.getInput("output-branch") || "star-history");
    const outputPath = validateOutputPath(core.getInput("output-path") || ".");
    const chartStyle = validateChartStyle(core.getInput("chart-style") || "classic");
    const contributors = core.getBooleanInput("contributors");
    const contributorsLimit = validateContributorsLimit(
      core.getInput("contributors-limit") || String(DEFAULT_CONTRIBUTORS_LIMIT),
    );
    const commitMessage = core.getInput("commit-message") || "chore: update star history";
    if (!commitMessage.trim() || /[\u0000-\u001f\u007f]/.test(commitMessage)) {
      throw new Error("commit-message must be a non-empty single line");
    }

    const result = await runAction(
      new GitHubClient(token, repository, apiUrl),
      {
        repository,
        serverUrl,
        outputBranch,
        outputPath,
        bootstrap: core.getBooleanInput("bootstrap"),
        contributors,
        contributorsLimit,
        chartStyle,
        animate: core.getBooleanInput("animate"),
        commitMessage,
        today: new Date().toISOString().slice(0, 10),
      },
      stargazersToken ? new GitHubClient(stargazersToken, repository, apiUrl) : undefined,
    );

    core.setOutput("stars", result.stars);
    core.setOutput("changed", result.changed);
    core.setOutput("commit-sha", result.commitSha);
    core.setOutput("light-url", result.lightUrl);
    core.setOutput("dark-url", result.darkUrl);
    core.setOutput("history-url", result.historyUrl);
    if (result.contributors !== null) {
      core.setOutput("contributors", result.contributors);
      core.setOutput("contributors-light-url", result.contributorsLightUrl);
      core.setOutput("contributors-dark-url", result.contributorsDarkUrl);
    }
    const contributorSummary = result.contributors === null ? "" : ` and ${result.contributors} contributors`;
    core.info(
      result.changed
        ? `Published repository visuals for ${repository}: ${result.stars} stars${contributorSummary}`
        : `Repository visuals are already current: ${result.stars} stars${contributorSummary}`,
    );
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void main();
