import * as core from "@actions/core";

import { GitHubClient } from "./github.ts";
import { validateRepository } from "./history.ts";
import { validateBranch, validateOutputPath } from "./paths.ts";
import { runAction } from "./run.ts";

async function main(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    core.setSecret(token);
    const repository = validateRepository(process.env.GITHUB_REPOSITORY ?? "");
    const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
    const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
    const outputBranch = validateBranch(core.getInput("output-branch") || "star-history");
    const outputPath = validateOutputPath(core.getInput("output-path") || ".");
    const commitMessage = core.getInput("commit-message") || "chore: update star history";
    if (!commitMessage.trim() || /[\u0000-\u001f\u007f]/.test(commitMessage)) {
      throw new Error("commit-message must be a non-empty single line");
    }

    const result = await runAction(new GitHubClient(token, repository, apiUrl), {
      repository,
      serverUrl,
      outputBranch,
      outputPath,
      bootstrap: core.getBooleanInput("bootstrap"),
      commitMessage,
      today: new Date().toISOString().slice(0, 10),
    });

    core.setOutput("stars", result.stars);
    core.setOutput("changed", result.changed);
    core.setOutput("commit-sha", result.commitSha);
    core.setOutput("light-url", result.lightUrl);
    core.setOutput("dark-url", result.darkUrl);
    core.setOutput("history-url", result.historyUrl);
    core.info(
      result.changed
        ? `Published star history for ${repository}: ${result.stars} stars`
        : `Star history is already current: ${result.stars} stars`,
    );
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

void main();
