import * as core from "@actions/core";

import {
  DEFAULT_CONTRIBUTORS_LIMIT,
  validateAvatarGap,
  validateAvatarShape,
  validateAvatarSize,
  validateContributorsColumns,
  validateContributorsLimit,
  validatePadding,
  type ContributorLayout,
} from "./contributors.ts";
import { GitHubClient } from "./github.ts";
import { validateRepository } from "./history.ts";
import { validateBranch, validateOutputPath } from "./paths.ts";
import { runAction } from "./run.ts";
import type { PaletteOverrides } from "./theme.ts";
import { validateChartLayout, validateChartStyle, validateChartVariant, validateColor } from "./svg.ts";

function optionalText(value: string, label: string): string | undefined {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  if (text.length > 80 || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(`${label} must be a single line of at most 80 characters`);
  }
  return text;
}

async function main(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    core.setSecret(token);
    const stargazersToken = core.getInput("stargazers-token");
    if (stargazersToken) {
      core.setSecret(stargazersToken);
    }
    const repository = validateRepository(process.env.GITHUB_REPOSITORY ?? "");
    const repositoryId = Number(process.env.GITHUB_REPOSITORY_ID);
    const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
    const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
    const outputBranch = validateBranch(core.getInput("output-branch") || "star-history");
    const outputPath = validateOutputPath(core.getInput("output-path") || ".");
    const chartStyle = validateChartStyle(core.getInput("chart-style") || "classic");
    const chartVariantInput = core.getInput("chart-variant");
    const chartVariant = chartVariantInput ? validateChartVariant(chartVariantInput) : undefined;
    const chartLayout = validateChartLayout(core.getInput("chart-layout") || "editorial");
    const chartTitle = optionalText(core.getInput("chart-title"), "chart-title");
    const contributorsTitle = optionalText(core.getInput("contributors-title"), "contributors-title");
    const smooth = core.getBooleanInput("smooth");
    const contributors = core.getBooleanInput("contributors");
    const contributorsLimit = validateContributorsLimit(
      core.getInput("contributors-limit") || String(DEFAULT_CONTRIBUTORS_LIMIT),
    );

    const overrides: PaletteOverrides = {};
    const background = core.getInput("background-color");
    if (background) {
      overrides.background = validateColor(background, "background-color");
    }
    const backgroundDark = core.getInput("background-color-dark");
    if (backgroundDark) {
      overrides.backgroundDark = validateColor(backgroundDark, "background-color-dark");
    }
    const accent = core.getInput("accent-color");
    if (accent) {
      overrides.accent = validateColor(accent, "accent-color");
    }
    const accentDark = core.getInput("accent-color-dark");
    if (accentDark) {
      overrides.accentDark = validateColor(accentDark, "accent-color-dark");
    }

    const contributorLayout: Partial<ContributorLayout> = {};
    const avatarSize = core.getInput("avatar-size");
    if (avatarSize) {
      contributorLayout.avatarSize = validateAvatarSize(avatarSize);
    }
    const avatarGap = core.getInput("avatar-gap");
    if (avatarGap) {
      contributorLayout.gap = validateAvatarGap(avatarGap);
    }
    const columns = core.getInput("contributors-columns");
    if (columns) {
      contributorLayout.columns = validateContributorsColumns(columns);
    }
    const padding = core.getInput("padding");
    if (padding) {
      contributorLayout.padding = validatePadding(padding);
    }
    const avatarShape = core.getInput("avatar-shape");
    if (avatarShape) {
      contributorLayout.shape = validateAvatarShape(avatarShape);
    }

    const commitMessage = core.getInput("commit-message") || "chore: update star history";
    if (!commitMessage.trim() || /[\u0000-\u001f\u007f]/.test(commitMessage)) {
      throw new Error("commit-message must be a non-empty single line");
    }

    const result = await runAction(
      new GitHubClient(token, repository, apiUrl),
      {
        repository,
        repositoryId: Number.isSafeInteger(repositoryId) && repositoryId > 0 ? repositoryId : null,
        serverUrl,
        outputBranch,
        outputPath,
        bootstrap: core.getBooleanInput("bootstrap"),
        contributors,
        contributorsLimit,
        chartStyle,
        chartVariant,
        chartLayout,
        chartTitle,
        contributorsTitle,
        smooth,
        overrides,
        contributorLayout,
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
