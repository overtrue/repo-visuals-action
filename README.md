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
          chart-style: gradient
          animate: "true"
```

The first run starts with the current UTC day's star count. Later runs append or replace that day's count, so the stored history becomes the source for future charts.

GitHub now limits the stargazer listing endpoint to repository admins and collaborators. To reconstruct available history on the first run, provide a fine-grained personal access token owned by an admin or collaborator with read-only repository metadata access:

```yaml
      - uses: overtrue/star-history-action@v1
        with:
          github-token: ${{ github.token }}
          stargazers-token: ${{ secrets.STARGAZERS_TOKEN }}
          bootstrap: "true"
```

The user token is used only when `history.json` does not exist. Scheduled updates continue with the repository-scoped `GITHUB_TOKEN`, so the secret can be removed after bootstrap.

The output branch contains:

- `history.json`
- `star-history-light.svg`
- `star-history-dark.svg`

When `output-path` is set, all three files are written below that repository-relative directory. For example, `output-path: assets/stars` publishes `assets/stars/star-history-light.svg`.

## SVG styles

The renderer is dependency-free TypeScript and emits self-contained SVG files:

| Style | Look |
| --- | --- |
| `classic` | Warm area chart compatible with the original design. |
| `minimal` | Crisp line-only chart with reduced decoration. |
| `gradient` | Layered green-to-blue trend with a subtle static glow. |

`animate: "true"` adds a one-time transform-and-opacity reveal. It never loops and automatically disables itself for `prefers-reduced-motion`. Set it to `"false"` for fully static SVG output.

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
| `stargazers-token` | unset | Admin or collaborator user token used only for historical bootstrap. |
| `output-branch` | `star-history` | Branch used for generated artifacts. |
| `output-path` | `.` | Directory inside the output branch. |
| `chart-style` | `classic` | SVG style: `classic`, `minimal`, or `gradient`. |
| `animate` | `true` | Add a reduced-motion-aware SVG entrance animation. |
| `bootstrap` | `false` | Fetch historical stargazer timestamps if history is missing. |
| `commit-message` | `chore: update star history` | Artifact commit message. |

## Outputs

The action returns `stars`, `changed`, `commit-sha`, `light-url`, `dark-url`, and `history-url`.

## Data and permissions

Only UTC dates and cumulative star counts are stored. Usernames and other stargazer details are discarded. The workflow needs `contents: write` to publish the output branch; no checkout is required.

## License

MIT
