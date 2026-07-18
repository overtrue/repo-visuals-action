# Self-hosted Star History

Generate light and dark star history charts without a hosted third-party service. The action runs in your repository, reads stars through the GitHub API, and publishes aggregated history plus SVG files to a dedicated branch.

## Usage

```yaml
name: Star History

on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: star-history
  cancel-in-progress: false

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: overtrue/star-history-action@v1
        with:
          github-token: ${{ github.token }}
          output-branch: star-history
          output-path: .
```

The first run reconstructs available history from GitHub's stargazer timestamps. Later runs fetch only the current star count instead of listing stargazers again, then append or replace the current UTC day's count. Set `bootstrap: "false"` to start tracking from the first run instead.

The output branch contains:

- `history.json`
- `star-history-light.svg`
- `star-history-dark.svg`

When `output-path` is set, all three files are written below that repository-relative directory. For example, `output-path: assets/stars` publishes `assets/stars/star-history-light.svg`.

## README image

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPOSITORY/star-history/star-history-dark.svg">
  <img src="https://raw.githubusercontent.com/OWNER/REPOSITORY/star-history/star-history-light.svg" alt="Star history chart">
</picture>
```

For stronger supply-chain security, pin the action to a full commit SHA instead of the moving `v1` tag.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | required | Repository-scoped token used to read stars and publish artifacts. |
| `output-branch` | `star-history` | Branch used for generated artifacts. |
| `output-path` | `.` | Directory inside the output branch. |
| `bootstrap` | `true` | Fetch historical stargazer timestamps if history is missing. |
| `commit-message` | `chore: update star history` | Artifact commit message. |

## Outputs

The action returns `stars`, `changed`, `commit-sha`, `light-url`, `dark-url`, and `history-url`.

## Data and permissions

Only UTC dates and cumulative star counts are stored. Usernames and other stargazer details are discarded. The workflow needs `contents: write` to publish the output branch; no checkout is required.

## License

MIT
