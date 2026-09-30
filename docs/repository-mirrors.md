# Repository mirrors

Centient's canonical repository is private. Two public mirrors exist so the
project's history can be shared without granting access to the canonical repo.
This note records the topology and the sync procedure so the layout isn't
rediscovered from `git remote -v` each time.

## Remotes

| Remote | URL | Role |
| --- | --- | --- |
| `origin` | `github.com/webnxt-2030/Centient` | Canonical (private). All PRs open and merge here. |
| `mirror-personal` | `github.com/cemmacabales/centient` | Public mirror. |
| `mirror-artisam` | `github.com/artisam-centient/centient` | Public mirror. |

## Sync procedure

Mirrors track `develop`. After a PR merges into `develop` on the canonical
repo, refresh the local branch and push it to each public mirror:

```bash
git fetch origin
git push mirror-personal origin/develop:develop
git push mirror-artisam  origin/develop:develop
```

Notes:

- Only `develop` is mirrored; feature branches stay on the canonical repo.
- The mirrors are push destinations, not sources of truth — never open PRs
  against them.
- Run the sync from a checkout that has all three remotes configured (the
  primary working copy).
