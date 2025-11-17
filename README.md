# Bangladesh Stock Glossary

A mobile-first glossary built for long-term value investors focused on the Dhaka Stock Exchange (DSE). It explains common terms and short forms (P/E, EPS, ROE, NAV, etc.) and makes them searchable.

## Features

- Mobile-first responsive UI
- Instant search with token matching
- Highlight matched words in results
- Installable PWA with offline cache (manifest + service worker)
- Small, dependency-free static site — ideal for GitHub Pages

## Local development

Serve the project locally and open http://localhost:8000

```bash
# from repo root
python3 -m http.server 8000
# or (if you prefer node)
# npx http-server -p 8000
```

While the server is running, open Chrome DevTools → Application → Service Workers to confirm the worker (`sw.js`) registers correctly. Toggle “Offline” to simulate no connectivity; the glossary should still load thanks to the precache.

## Deploy to GitHub Pages

If you already created a GitHub repository for this project, follow this checklist to publish it on GitHub Pages:

1. **Commit & push the site**
	```bash
	git add .
	git commit -m "Deploy glossary to GitHub Pages"
	git push origin main   # replace with your default branch name
	```
2. **Enable Pages**
	- Navigate to your repository on github.com.
	- Open **Settings → Pages** (or **Settings → Code & Automation → Pages**).
	- Under *Build and deployment*, set **Source** to `Deploy from a branch`.
	- Pick the branch you pushed (usually `main`) and select the **`/ (root)`** folder since `index.html` lives at the repo root.
	- Click **Save**. GitHub will kick off a deployment workflow automatically.
3. **Wait for the green check**
	- A Pages status badge appears near the top of the Pages settings page. Wait until it says *Your site is live* (typically under a minute).
4. **Visit your site**
	- The live URL is `https://<your-username>.github.io/<repository-name>/`.
	- Because all assets are referenced with relative paths (e.g., `./src/app.js`), the site loads correctly even from a subdirectory.
5. **(Optional) Add a custom domain**
	- Still under Pages settings, add your domain in the *Custom domain* box and follow GitHub’s DNS instructions.

No build step or CI workflow is needed—the site is a static bundle, so GitHub Pages serves it as-is.

## Install as a PWA

1. Visit the GitHub Pages URL on Chrome (desktop or Android).
2. Open the browser menu and choose **Install app** / **Add to Home screen**.
3. On mobile, launch it from your home screen for a standalone experience.
4. When you make code changes, bump the `CACHE_NAME` in `sw.js` to ensure users receive the latest assets.

## Next steps (ideas)

- Add categories/tags filters and sorting
- Add examples & company-specific notes for popular blue-chip names
- Add a small admin UI to suggest new terms or edits
- Add unit tests for search logic (Jest) and automated accessibility checks

If you want, I can implement any of the next steps above — tell me which one to pick first.
