# Search consoles and Cloudflare bot review (steps for the owner)

These steps need the owner's logins, so none of them were performed. Dashboard labels change
over time; if a label below does not match, search the dashboard for the setting name.

Facts used throughout:

- Site: `https://design.ramoslabs.com`
- Sitemap: `https://design.ramoslabs.com/sitemap-index.xml` (generated at build; `/metricas` is excluded on purpose)
- robots.txt: `https://design.ramoslabs.com/robots.txt` (welcomes search and AI crawlers, declares `Content-Signal`)
- DNS and the zone `ramoslabs.com` live in Cloudflare.

## 0. Check that crawlers can reach the site (Cloudflare), and keep checking

A robots.txt that says "welcome" does nothing if the edge answers 403 or a challenge to the
crawler. As of 2026-10-27 a cloud `WebFetch` to `llms.txt` and to a docs page returned content
with no challenge (see `docs/MCP.md`), so this is a **review to monitor**, not a blocker.

1. Cloudflare dashboard, zone `ramoslabs.com`, **Security**, **Bots**. Note the current state of
   **Bot Fight Mode** and of any **Block AI bots** / "AI Scrapers and Crawlers" control. If a
   control blocks AI bots, set it to **Allow**, because robots.txt welcomes them.
2. If a **managed robots.txt** feature is enabled for the zone, check which robots.txt is actually
   served (step 3). A managed block can add its own `Disallow` rules.
3. Compare status codes from your terminal:

   ```
   curl -s -o /dev/null -w "%{http_code}\n" https://design.ramoslabs.com/robots.txt
   curl -s -o /dev/null -w "%{http_code}\n" -A "ClaudeBot" https://design.ramoslabs.com/llms.txt
   curl -s -o /dev/null -w "%{http_code}\n" -A "GPTBot" https://design.ramoslabs.com/llms.txt
   curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 (compatible; bingbot/2.0)" https://design.ramoslabs.com/
   ```

   Expect 200. A spoofed user agent from your own IP is not the real crawler, so a 200 proves the
   rules, not that the real bot is verified. Use step 4 for real traffic.
4. **AI Crawl Control** (in the dashboard sidebar, formerly "AI Audit"): open it and review
   - which crawlers hit the site and how many requests each made,
   - per-crawler **Allow** or **Block** (every crawler listed in robots.txt should be Allow),
   - any robots.txt violations or blocked requests it reports.
   Check it again 7 days after the changes land, and after any change to the zone's Security settings.

## 1. Google Search Console

1. Open https://search.google.com/search-console and sign in with the owner Google account.
2. **Add property**. Recommended: **Domain** property `ramoslabs.com`, which covers
   `design.ramoslabs.com` and any future subdomain.
3. Verify with the **DNS TXT** record it gives you. Add it in Cloudflare, **DNS**, **Records**,
   type `TXT`, name `@`, content exactly as shown, then click Verify.
   (If you prefer a URL-prefix property for `https://design.ramoslabs.com/`, use the HTML file
   or meta tag method; both need a code change in this repo, so ask for it first.)
4. **Sitemaps**, enter `sitemap-index.xml`, Submit. Status should become "Success" and report
   the discovered pages (the 4 Answers pages plus the doc pages).
5. **URL inspection**, paste each URL below, run **Test live URL**, then **Request indexing**:
   - `https://design.ramoslabs.com/`
   - `https://design.ramoslabs.com/answers/muted-text-token/`
   - `https://design.ramoslabs.com/answers/indigo-contrast-wcag/`
   - `https://design.ramoslabs.com/answers/install-tokens-vue-react-html/`
   - `https://design.ramoslabs.com/answers/ramoslabs-ds-vs-material-vs-tailwind/`
6. **Enhancements**: after indexing, check that FAQ and HowTo structured data are detected
   without errors. Google may show fewer rich results for FAQ and HowTo than the markup
   allows; the markup is still valid and still readable by assistants.
7. Re-check **Pages** (indexing) after about a week for "Crawled, not indexed" reasons.

## 2. Bing Webmaster Tools

1. Open https://www.bing.com/webmasters and sign in (Microsoft, Google, or Facebook account).
2. Fastest path: **Import from Google Search Console** and authorize. The property and
   sitemap are carried over, and verification is inherited.
3. Manual path: **Add a site**, enter `https://design.ramoslabs.com`, then verify by **CNAME
   record** (Cloudflare DNS, type `CNAME`, set the proxy to **DNS only**) or by the XML file or
   meta tag (both need a code change in this repo).
4. **Sitemaps**, **Submit sitemap**, enter `https://design.ramoslabs.com/sitemap-index.xml`.
5. **URL Submission**, submit the five URLs listed in the Google section.
6. Optional, **IndexNow**: Bing supports it for instant change notification. It needs a key
   file served from the site root, which is a code change; ask for it if wanted.
7. Because ChatGPT search and several assistants draw on Bing's index, check **Search
   Performance** and **Crawl Information** after about a week.

## 3. Afterwards

- Keep `sitemap-index.xml` as the single sitemap; do not submit page URLs individually later.
- When a new Answers page is added, it appears in the sitemap automatically on the next deploy.
- Record the dates you completed each step in `README.md` (the checklist in this folder).
