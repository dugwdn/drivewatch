# Doug's quick edits without Claude

DriveWatch is a phone app (built with Expo and React Native). Right now it is the empty starter app: its one screen says "Open up App.tsx to start working on your app!". It has no web pages, no ads and no price list, so most of the usual quick edits do not apply yet.

## Where things live

| What you want to change | Where it is |
|---|---|
| The words on the one screen | `App.tsx`, the line inside `<Text>...</Text>`. |
| App name, version, bundle identifiers | `app.json` (`name`, `version`, and the `bundleIdentifier` and `package` lines). |
| App icon, splash picture, Android icon, web favicon | The `assets/` folder: `icon.png`, `splash-icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `favicon.png`. |
| Footer links, prices, contact details | None. The repo has none of these yet. |
| Ads IDs | None. The repo has no ads. |
| Google Analytics (GA4) ID | None, and on purpose: this app handles location data, so it uses its own counts and never Google Analytics. |

## How to edit in the browser

1. Go to https://github.com/dugwdn/drivewatch and sign in.
2. Click the file you want, for example `App.tsx`.
3. Click the pencil icon with the label "Edit this file" at the top right of the file.
4. Change the words between the tags. Leave everything that looks like code exactly as it is.
5. Click the green "Commit changes..." button at the top right.
6. In the box that opens, leave the message or type a short one. Choose "Commit directly to the main branch".
7. Click "Commit changes".

## What happens next

Nothing is published automatically. The repo has no deploy setup: there is no website, no GitHub Actions file and no `eas.json`, and no phone build is started by a commit. An edit on GitHub only changes the saved code. To get it onto a phone, someone has to start a build with a computer (the Expo build service, `eas build`, needs the laptop or a Claude session). Ask Claude when you want that.

## How to undo

On GitHub, open the repo, click Commits, click the commit you made, and click "Revert". GitHub opens a pull request for the revert. Click "Create pull request", then "Merge pull request". There is no live site to roll back.

## What not to touch

- `package.json` and `package-lock.json` (the list of parts the app is built from).
- `index.ts`, `tsconfig.json`, `app.json` apart from the app name.
- The `bundleIdentifier`, `package` and `eas` `projectId` lines in `app.json`. They tie the app to its store listings and build project.
- `CLAUDE.md` and `AGENTS.md`.
