# Olga Kalinina: portfolio

Source of the portfolio site at https://olgakalinina.me, published with Cloudflare Pages from the `main` branch.

## Layout
- `*.html`, `style.css`, `theme.css`, `fonts/`, `images/`, `js/`: the public website (static files).
- `functions/`: server code (Cloudflare Pages Functions) for the protected case studies and the admin page.
- `migrations/`: database layout for the access codes (Cloudflare D1).
- `tests/`: security tests and the private-text scanner. See the comments at the top of each file.
- `wrangler.toml`: Cloudflare configuration. It contains no secrets.

## Protected case studies
NDA case studies are not in this repository. Their text and images live in private Cloudflare storage and are delivered
only after a valid one-time access code is redeemed. The public pages only contain the locked cards.

## Secrets
None are stored in the repository. The key that scrambles access codes (`CODE_PEPPER`) is a Cloudflare secret.
The admin page is only reachable by the site owner through Cloudflare Access.

## Checks before publishing
```
tests/run-local.sh                                  # full security suite against a throwaway local copy
node tests/security.mjs remote https://olgakalinina.me
node tests/scan-leaks.mjs private-content/markers.txt https://olgakalinina.me
```

Important: the project folder is published as is, so only add files that are meant to be public. Internal files
(this README, `tests/`, `migrations/`, `wrangler.toml`) are blocked from download by `functions/_middleware.js`.
