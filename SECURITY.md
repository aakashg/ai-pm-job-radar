# Security

## Reporting a problem

Please use GitHub's **Report a vulnerability** button on the Security tab. Don't open a public issue.

## How this project handles secrets and spend

- **No keys in the repo.** `.env*` is gitignored, and GitHub secret scanning with push protection is on. Locally, the key lives outside the repo. The daily refresh reads it from an encrypted GitHub Actions secret, and only that one job step can see it. The Vercel site holds no key at all, because it never calls the model.
- **No public endpoint calls the model.** Labeling runs as a scheduled job, and the site serves a static `results.json`. Visitors can't trigger a Jev call, so nobody can run up the bill.
- **Spend is capped in code.** `pipeline/label.mjs` estimates the cost of uncached calls before it runs. It refuses to run above a $0.25 cap (raised only with an explicit `--max-usd`) or if Gateway credit is short.
- **Scraped text is untrusted.** Job descriptions come from public boards and are treated as content to judge, never as instructions. Jev can only return one of the listed options.
- **`main` is protected** against force-pushes and deletion. The default GitHub Actions token is read-only. Only the refresh job gets write access, and only to commit the new snapshot. Every third-party action is pinned to a commit SHA.
- **The site is static.** It has no API routes, forms or database. A strict Content-Security-Policy blocks framing and scripts loaded from other sites.
