# IndexNow

IndexNow tells Bing, Yandex and other participating engines that URLs changed, so they crawl
them now instead of waiting. Google does not use it; Google relies on the sitemap and Search
Console (see `docs/distribution/SEARCH-CONSOLES.md`).

## What is in the repo

- **Key file:** `apps/site/public/<key>.txt`. The file name is the key and the file contains the
  same key. It ships at the site root (`https://design.ramoslabs.com/<key>.txt`). The key is
  public by design; it only proves you control the domain. To rotate it, delete the file, create
  a new 32-character hex one the same way, and deploy.
- **Script:** `scripts/indexnow.mjs` (`bun run indexnow`). It reads the sitemap and sends every
  URL for the host in one request (the protocol allows up to 10,000).

## Run it after a deploy

The engines fetch the key file from the live site, so submit only once the deploy is live.

```
bun run indexnow                      # dry run against the live sitemap: lists the URLs
bun run indexnow -- --submit          # POST them to https://api.indexnow.org/IndexNow
bun run indexnow -- --local           # read apps/site/dist instead of the live sitemap
```

`--submit` first checks that the key file answers on the live site and refuses to continue if
it does not. A `200` or `202` response means the request was accepted (`202` = key validation
pending). Anything else exits non-zero, so the script can gate a CI step.

Nothing runs it automatically. Cloudflare Workers Builds deploys from git, so call it from a CI
job that runs after the deploy, or by hand. It needs no secrets.

## Notes

- If Cloudflare Bot Fight Mode blocks the engines, they cannot fetch the key file and the
  submission is rejected. See `docs/distribution/SEARCH-CONSOLES.md`, section 0.
- Submitting unchanged URLs is allowed but wasteful. The sitemap carries `lastmod`, so a future
  refinement can send only pages whose `lastmod` is newer than the last run.
