const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export function validateBranch(value: string): string {
  const branch = value.trim();
  if (
    !BRANCH_PATTERN.test(branch) ||
    branch.endsWith("/") ||
    branch.endsWith(".") ||
    branch.endsWith(".lock") ||
    branch.includes("//") ||
    branch.includes("..") ||
    branch.includes("@{")
  ) {
    throw new Error("output-branch is not a valid branch name");
  }
  return branch;
}

export function validateOutputPath(value: string): string {
  const outputPath = value.trim();
  if (outputPath === ".") {
    return "";
  }
  if (!outputPath || outputPath.startsWith("/") || outputPath.includes("\\")) {
    throw new Error("output-path must be a repository-relative directory");
  }

  const segments = outputPath.split("/");
  if (
    segments.some(
      (segment) =>
        !PATH_SEGMENT_PATTERN.test(segment) ||
        segment === "." ||
        segment === ".." ||
        segment.toLowerCase() === ".git",
    )
  ) {
    throw new Error("output-path contains an invalid path segment");
  }
  return segments.join("/");
}

export function outputFile(outputPath: string, filename: string): string {
  return outputPath ? `${outputPath}/${filename}` : filename;
}

function encodePath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

export function rawUrl(
  serverUrl: string,
  repository: string,
  branch: string,
  path: string,
): string {
  const suffix = `refs/heads/${encodePath(branch)}/${encodePath(path)}`;
  if (serverUrl === "https://github.com") {
    return `https://raw.githubusercontent.com/${repository}/${suffix}`;
  }
  return `${serverUrl.replace(/\/$/, "")}/${repository}/raw/${suffix}`;
}
