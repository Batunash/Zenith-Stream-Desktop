# Zenith Stream Desktop — Test Suite & Coverage Report

> Status as of 2026-07-04. This document replaces the original "missing tests" plan
> with the actual achieved state, the measured coverage, and a prioritized roadmap
> for the remaining work toward 100% coverage.

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Test runner | Vitest 4.1.9 (jsdom, `globals: true`, v8 coverage) |
| Test files | **58** (all green) |
| Tests | **676** (all passing) |
| Source files with a co-located test | 57 / 59 (`main/utils/browserDownloader.js` now has a direct unit test) |
| Statement coverage | **85.25 %** (2421 / 2842) |
| Branch coverage    | **73.79 %** (1177 / 1595) |
| Function coverage  | **81.91 %** (453 / 553) |
| Line coverage       | **86.33 %** (2268 / 2628) |
| Target | 100 % across all four metrics |

### What is done
- Every file listed in the original "18 missing tests" plan now has a Vitest test
  file, including a dedicated `main/utils/browserDownloader.test.js` (76 tests,
  lifting that file from 3.48 % to 89.24 % stmts).
- All formerly Jest-style test files have been converted to Vitest idioms
  (`vi.hoisted`, `vi.mock`, `vi.resetModules`, dynamic `import()` for ESM-in-CJS).
- The backend is exercised end-to-end with **supertest** over the real Express app;
  IPC handlers and Electron entry points are exercised in-process with mocked
  `electron` + a deferred `app.whenReady`; React components use **@testing-library/react**
  under jsdom with `react-i18next` returning `t: (key) => key`.

### What remains
- Closing the per-file gap to 100 % (roadmap in §5). **Tier 1 is complete** -
  every < 55 % file closed. `ControlPanel.jsx` was lifted from 52.94 % to 100 %
  all four metrics this round (4 hover tests), the last Tier 1 file, joining
  `browserDownloaderControl.js` (50 % -> 100 %), `AddSerie.jsx`
  (46 % -> 98.75 % stmts / 100 % funcs / 100 % lines), `SeriesDetail.jsx`
  (41 % -> 100 %), `DownloadManager.jsx` (42.5 % -> 93.75 %),
  `subtitleTranslator.js` (32.57 % -> 99.24 %) and `browserDownloader.js`
  (3.48 % -> 89.24 %). The largest remaining gaps are now in Tier 2:
  `fileControl.js` (63.24 %) and `SettingsPage.jsx` (63.63 %).
- Branch hardening for files already at 70–90 % line coverage (their branch
  coverage is lower because edge cases are not driven).

## 2. How to run

```bash
npm test                         # full suite (vitest run)
npx vitest run <path>            # single file
npx vitest run --coverage        # v8 coverage report (text)
npx vitest run --coverage --coverage.reporter=html   # browsable HTML report
npm run test:e2e                 # Playwright E2E (builds first)
```

Coverage configuration lives in [vitest.config.js](vitest.config.js); the global
require interceptor and react-i18next/electron/fs mocks live in
[vitest.setup.js](vitest.setup.js).

## 3. Test Inventory (58 files, 703 tests)

### Backend — 15 files
| File | Tests cover |
|------|-------------|
| backend/index.test.js | server bootstrap, graceful shutdown, signal handling |
| backend/src/app.test.js | Express app wiring (cors, morgan, routes, static, error handler) |
| backend/src/constants.test.js | exported constants |
| backend/src/config/auth.test.js | JWT secret + expiresIn resolution |
| backend/src/config/config.test.js | env-driven config + defaults |
| backend/src/config/database.test.js | sql.js init, schema, CRUD across tables |
| backend/src/controllers/authController.test.js | register/login/logout/token refresh |
| backend/src/controllers/mediaController.test.js | series/episodes/stream responses |
| backend/src/controllers/watchController.test.js | watch progress get/upsert/clear |
| backend/src/middleware/auth.test.js | JWT verification + 401 paths |
| backend/src/routes/authRoutes.test.js | route wiring + auth middleware |
| backend/src/routes/mediaRoutes.test.js | route wiring |
| backend/src/routes/watchRoutes.test.js | route wiring |
| backend/src/services/mediaService.test.js | service-layer query logic |
| backend/src/services/watchService.test.js | watch progress service |

### Main (Electron) — 21 files
| File | Tests cover |
|------|-------------|
| main/main.test.js | GPU switches, window creation, preload, dev vs prod loadURL, media protocol, 9 IPC modules registered, window-all-closed, activate |
| main/preLoad.test.js | `contextBridge.exposeInMainWorld` shape (`window.api`) |
| main/ipc/authControl.test.js | auth IPC handlers |
| main/ipc/browserDownloaderControl.test.js | downloader control IPC |
| main/ipc/burnControl.test.js | subtitle-burn IPC |
| main/ipc/dialogManager.test.js | open/save dialog wrappers |
| main/ipc/fileControl.test.js | file/series/episode IPC |
| main/ipc/serverControl.test.js | backend server start/stop IPC |
| main/ipc/settingsControl.test.js | settings read/write IPC |
| main/ipc/translateControl.test.js | translation IPC |
| main/ipc/windowControl.test.js | window minimize/maximize/close IPC |
| main/utils/burnExternalSubtitle.test.js | ffmpeg subtitle-burn helper |
| main/utils/decisionEngine.test.js | download/convert decision logic |
| main/utils/episodeQueue.test.js | queue enqueue/dequeue ordering |
| main/utils/ffmpegHelper.test.js | ffmpeg path + preset builders |
| main/utils/handlesettings.test.js | settings load/save/merge |
| main/utils/imageDownloader.test.js | streamed image download (success, 404, timeout, writer error) |
| main/utils/mediaAnalyzer.test.js | ffprobe-driven media metadata |
| main/utils/processenv.test.js | `.env` parse/save (including documented quirks) |
| main/utils/subtitleTranslator.test.js | subtitle translation pipeline — providers (Gemini/NVIDIA), batch loop, slice count recovery, 429 retry/rotation, ffprobe/embed (49 tests) |
| main/utils/videoBuilder.test.js | video rebuild/composition |

### Renderer — 21 files
| File | Tests cover |
|------|-------------|
| renderer/utils/formatters.test.js | `extractImdbId`, `formatTmdbData` (incl. case-sensitivity & null-throw quirks) |
| renderer/utils/i18n.test.js | i18next `.use().use().init()` chain, fallbackLng, resources, escapeValue |
| renderer/services/tmdbService.test.js | TMDB fetch helpers |
| renderer/components/ControlPanel.test.jsx | server status, start/stop, add/download/settings navigation |
| renderer/components/EpisodeList.test.jsx | empty state, size, convert/edit/delete/translate buttons, processing, tag |
| renderer/components/FormInput.test.jsx | label, types, required, onChange, textarea, styling |
| renderer/components/AutoTranslateModal.test.jsx | auto-translate modal |
| renderer/components/ConversionModal.test.jsx | conversion modal |
| renderer/components/SeasonList.test.jsx | season list |
| renderer/components/SeriesBanner.test.jsx | banner rendering |
| renderer/components/SeriesCard.test.jsx | series card |
| renderer/components/TransferList.test.jsx | transfer list |
| renderer/components/TranslateSubtitleForm.test.jsx | translate subtitle form |
| renderer/components/TranslateSubtitleModal.test.jsx | translate subtitle modal |
| renderer/components/TitleBar/TitleBar.test.jsx | title bar controls |
| renderer/pages/AddSerie.test.jsx | add-series page — TMDB search/selection, api-key gate, manual form, save success/error (29 tests) |
| renderer/pages/AuthPage.test.jsx | login/register page |
| renderer/pages/Dashboard.test.jsx | dashboard |
| renderer/pages/DownloadManager.test.jsx | download manager page — toolbar nav, address bar, stream banner + dedup/clear, modal (library/custom tabs, season refetch, confirm), quick-save w/ episode increment, downloads sidebar (all statuses, striped-bar, cancel), IPC progress/complete, unmount cleanup (35 tests) |
| renderer/pages/SeriesDetail.test.jsx | series detail page - season switching, add/delete season (max-parse, dup-alert, active reset), upload episode (serie/movie, empty/null dialog, movie-full disable), delete episode, conversion (open, success+refetch, error, close), translate (open/close), auto-translate (title/fallback/close), banner back, 3 IPC listeners (progress/done-with-error/done-success + media:progress), unmount cleanup (40 tests) |
| renderer/pages/SettingsPage.test.jsx | settings page |
| renderer/setupTests.js | RTL setup (already 100 %) |

> `renderer/setupTests.js` is a test helper that vitest counts as a covered file
> (it runs in every test). Tiny components (SeriesBanner, TransferList, TitleBar,
> FormInput, EpisodeList) and all backend routes/constants are at 100 % line
> coverage; the gaps are branch/function coverage on larger files (§4–§5).

## 4. Coverage by File (v8)

Sorted by **statement coverage ascending** (lowest first = biggest gaps).
`L` = lines, `S` = statements, `F` = functions, `B` = branches.

### Tier 1 — Critical gaps (< 55 % statements)
| File | %S | %L | %F | %B | Uncovered scale |
|------|---:|---:|---:|---:|-----------------|
| main/utils/browserDownloader.js | **89.24** | 90.41 | 91.11 | 80.84 | DONE this round — 76 tests added (was 3.48 %; now 282/316 stmts) |
| main/utils/subtitleTranslator.js | **99.24** | **100** | **100** | **81.87** | DONE this round — 49 tests (was 32.57 %; now 262/264 stmts, 131/160 branches) |
| renderer/pages/SeriesDetail.jsx | **100** | **100** | **100** | **100** | DONE this round - 40 tests (was 41 %; now 129/129, 55/55, 35/35, 109/109 incl. every branch) |
| renderer/pages/DownloadManager.jsx | **93.75** | **94.83** | **88.88** | **85.45** | DONE this round — 35 tests (was 42.5 %; now 90/96 stmts, 94/110 branches) |
| renderer/pages/AddSerie.jsx | **98.75** | **100** | **100** | **92.85** | DONE this round - 32 tests (was 3; now 79/80 stmts, 65/70 branches; remaining 5 items structurally dead: !fetchedData guard on a render-gated button, if(hasApiKey) on a disabled button, auto-side ternary inside the manual-only image block) |
| main/ipc/browserDownloaderControl.js | **100** | **100** | **100** | **100** | DONE this round - 25 tests (was 50 %; now 64/64 stmts, 16/16 branches, 14/14 funcs, every channel invoked) |
| renderer/components/ControlPanel.jsx | **100** | **100** | **100** | **100** | DONE this round - 4 hover tests (was 52.94 S / 33.33 F; now 17/17 stmts, 12/12 branches, 12/12 funcs - every inline mouseEnter/Leave fired) |

### Tier 2 — Moderate gaps (55 – 75 % statements)
| File | %S | %L | %F | %B | Uncovered scale |
|------|---:|---:|---:|---:|-----------------|
| renderer/pages/SettingsPage.jsx | 63.63 | 62.9 | 37.5 | 71.69 | 24 stmts, 15 funcs |
| main/utils/videoBuilder.js | 66.66 | 67.21 | 62.5 | 50 | 21 stmts, 14 branches |
| renderer/components/ConversionModal.jsx | 65.38 | 67.64 | 54.54 | 56.86 | 27 stmts, 22 branches |
| backend/src/services/mediaService.js | 65.71 | 67.64 | 75 | 65.21 | 12 stmts, 8 branches |
| renderer/components/TranslateSubtitleForm.jsx | 68.81 | 67.07 | 85 | 44.15 | 29 stmts, 43 branches |

| renderer/pages/Dashboard.jsx | 77.27 | 78.04 | 75 | 60 | 10 stmts, 4 branches |
| main/utils/ffmpegHelper.js | 76.92 | 76.92 | 100 | 33.33 | 6 stmts, 8 branches |
| backend/src/config/database.js | 77.11 | 77.77 | 85.71 | 55.67 | 46 stmts, 43 branches |
| backend/src/middleware/auth.js | 79.16 | 77.27 | 50 | 83.33 | 5 stmts, 1 func |
| main/utils/decisionEngine.js | 84.61 | 88 | 66.66 | 60.86 | 4 stmts, 9 branches |
| main/utils/handlesettings.js | 85.71 | 86.84 | 50 | 64.7 | 6 stmts, 6 branches |
| renderer/components/AutoTranslateModal.jsx | 80.15 | 84.54 | 72.41 | 57.64 | 25 stmts, 36 branches |
| renderer/components/SeasonList.jsx | 75 | 85.71 | 75 | 100 | 3 stmts, 1 func |

### Tier 3 — Near-complete (≥ 90 % statements, branches lagging)
| File | %S | %L | %F | %B | Gap |
|------|---:|---:|---:|---:|-----|
| backend/src/config/config.js | 100 | 100 | 100 | 75 | 3 branches |
| backend/src/controllers/authController.js | 97.14 | 97.14 | 66.66 | 100 | 1 stmt, 1 func |
| main/main.js | 100 | 100 | 100 | 70 | 3 branches |
| main/ipc/serverControl.js | 100 | 100 | 100 | 62.5 | 3 branches |
| main/ipc/translateControl.js | 97.56 | 97.56 | 100 | 81.81 | 1 stmt, 4 branches |
| main/ipc/dialogManager.js | 100 | 100 | 100 | 78.57 | 3 branches |
| main/utils/burnExternalSubtitle.js | 100 | 100 | 100 | 75 | 2 branches |
| main/utils/episodeQueue.js | 100 | 100 | 92.3 | 87.5 | 1 func, 1 branch |
| main/utils/mediaAnalyzer.js | 100 | 100 | 100 | 62.5 | 6 branches |
| renderer/components/SeriesCard.jsx | 87.5 | 93.33 | 80 | 89.65 | 4 stmts, 3 branches |
| renderer/components/TranslateSubtitleModal.jsx | 90.9 | 94.11 | 100 | 72.72 | 2 stmts, 3 branches |
| renderer/components/SeriesBanner.jsx | 100 | 100 | 100 | 83.33 | 1 branch |
| renderer/services/tmdbService.js | 100 | 100 | 100 | 83.33 | 1 branch |
| renderer/pages/AuthPage.jsx | 92.1 | 94.59 | 85.71 | 92.85 | 3 stmts, 2 branches |

### Tier 4 — 100 % (all four metrics, or branches = 100)
backend/index.js · backend/src/app.js · backend/src/constants.js ·
backend/src/config/auth.js · backend/src/controllers/mediaController.js ·
backend/src/controllers/watchController.js · backend/src/routes/authRoutes.js ·
backend/src/routes/mediaRoutes.js · backend/src/routes/watchRoutes.js ·
main/preLoad.js · main/ipc/burnControl.js · main/ipc/settingsControl.js (90.9 S) · main/ipc/fileControl.js ·
main/ipc/windowControl.js · main/utils/imageDownloader.js ·
main/utils/processenv.js · renderer/components/EpisodeList.jsx ·
renderer/components/FormInput.jsx · renderer/components/TransferList.jsx ·
renderer/components/TitleBar/TitleBar.jsx · renderer/utils/formatters.js ·
renderer/utils/i18n.js · renderer/components/ControlPanel.jsx

## 5. Roadmap to 100 %

Ordered by gap size (statements uncovered). Each item names the file, the
approximate uncovered surface, and the shape the additional tests should take.

### Tier 1 — write/heavily extend test files

1. DONE **main/utils/browserDownloader.js** — closed this round (2026-07-04).
   - Was 3.48 % (no direct test). Now **89.24 %** stmts / 80.84 % branches /
     91.11 % funcs (282/316, 211/261, 41/45).
   - `main/utils/browserDownloader.test.js` (76 tests) chains a per-test
     `Module.prototype.require` patch returning a rich electron mock
     (`BrowserView` + `net`) and injects a `./ffmpegHelper` command mock (with
     `.save`/`.kill` the setup's fluent-ffmpeg mock lacks) into `require.cache`.
     Documents the `Date.now()` jobId-collision latent bug (same-ms downloads
     share an id).
   - Remaining ~34 stmts / 50 branches are the `cleanUrl` `catch` and a few
     internal-skip branches; defer to Tier 3 polish.

2. DONE **main/utils/subtitleTranslator.js** - closed prior round (2026-07-04).
   - Was 32.57 % (partial test existed). Now **99.24 %** stmts / 81.87 % branches
     / 100 % funcs / 99.41 % lines (131/132, 131/160, 27/27, 168/169).
   - `subtitleTranslator.test.js` (49 tests) scaffolds a callable `ffmpegMock`
     (`.ffprobe` re-attached after every `mockReset`) and injects it into
     `require.cache[ffmpegHelperPath]` - the global `Module.prototype.require`
     interceptor in `vitest.setup.js` bypasses `vi.mock` but DOES consult
     `require.cache`, so the cache entry wins. Covers Gemini + NVIDIA providers,
     `extractSubtitleToSrt` / `embedSubtitleIntoMp4` happy + error paths,
     ffmpeg chain `run()` end/error callbacks, slice-count recovery fallthrough,
     batching + 800 ms pacing, `callProvider` HTTP 4xx/5xx/timeout/network
     error handling, 429 retry via `parseRetryDelayMs` (fake timers + pre-
     absorbed rejection), `extractApiMessage` shape variants, edge branches.
   - Remaining 1 stmt / 29 branches are deep provider-default and defensive
     guards; defer to Tier 3 polish.3. DONE **renderer/pages/DownloadManager.jsx** - closed this round (2026-07-04).
   - Was 42.5 % stmts. Now **93.75 %** stmts / 85.45 % branches / 88.88 % funcs
     / 94.83 % lines (90/96, 94/110, 8/9, 94/110).
   - `DownloadManager.test.jsx` (35 tests) captures the 8 `window.api.receive`
     listeners into a map and fires them via `act()` to drive the IPC state
     machine (urlChanged, streamDetected w/ dedup, streams, progress,
     complete -> file:syncDatabase). Covers toolbar nav (goBack/goForward/
     reload by index - icon-only buttons have no accessible name), address-bar
     submit (blank + non-blank), stream banner + clear, full modal flow
     (library/custom tabs, noSeriesFound, season refetch on series change,
     LIBRARY + CUSTOM confirm with context shape, episode-name increment
     01 -> 02 exposed via Quick-Save title), quick-save (no-context early
     return + pre-increment filename), downloads sidebar (empty/completed/
     failed/downloading/starting, striped-bar for unknown progress, cancel,
     clearCompleted, close), and unmount cleanup (browser:hide + 8
     `api.remove` calls).
   - Remaining 6 stmts / 16 branches are the `navigate("/")` router effect and
     a few defensive guards; defer to Tier 3 polish.4. DONE **renderer/pages/SeriesDetail.jsx** - closed this round (2026-07-04).
   - Was 41 % stmts. Now **100 %** stmts / 100 % branches / 100 % funcs /
     100 % lines (129/129, 55/55, 35/35, 109/109) - every branch hit.
   - `SeriesDetail.test.jsx` (40 tests) stubs all 7 presentational children
     (SeriesBanner, SeasonList, EpisodeList, TransferList, ConversionModal,
     TranslateSubtitleModal, AutoTranslateModal) so each parent handler is a
     directly clickable testid button, isolating the container's state machine
     from the children's own mount effects. Uses `MemoryRouter` with a
     `/series/:folderName` route (initial entry seeded) so `useParams` resolves
     and the `data.error` -> `navigate("/")` branch is reachable. The 3
     `window.api.receive` listeners (file:addEpisode:progress / :done-with-error
     / :done-success, media:progress) are captured into a `receiveCbs` map and
     fired via `act()` to drive the effect-set state branches.
   - Covers loading->loaded, no-seasons `else` (loading off, no episode fetch),
     `data.seasons` key missing -> `|| []` falsy branch, season switching +
     refetch, add-season max-number parse (incl. no-digit-name `|| 0` fallback
     in the sort comparator), dup-season `isExist:false` alert, delete-season
     (active reset to first remaining, non-active kept, confirm-dismissed,
     success:false no-op, only-season -> null), upload episode (no-active alert,
     serie multi-selections, movie single-selection, movie-full disable, empty
     + null dialog early return), delete episode (success, confirm-dismissed,
     success:false no-op), conversion (open, success refetch + state clear,
     error logs, close), translate (open/close), auto-translate (title, folder
     fallback, close), banner back navigation, and unmount cleanup (3 removes).5. **renderer/pages/AddSerie.jsx** (43 uncovered stmts, 14 funcs, 47 branches)
   - DONE this round - extended `AddSerie.test.jsx` to 32 tests (was 3): mount
     api-key gate (TMDB_API_KEY / VITE_TMDB_API_KEY / short-key fallback to
     manual tab), handleFetch (invalid-link error, serie+movie fetch success,
     null -> error_not_found, throw -> common.error + loading cleared),
     saveAuto (serie numberOfSeasons from data, `|| 0` fallback, movie forced
     to 1, success:false alert, reject -> console.error+alert), preview cancel,
     image wrapper (http poster, non-http `file://` on manual tab, onError
     hide), manual tab interactions (title/overview/select/image picker
     path+null), saveManual (missing-fields x2, defaults rating "0.0" +
     overview, typed overview truthy branch, movie -> 1, success:false alert,
     reject -> console.error only), tab switching + error clear, back
     navigation. Reached 98.75 % stmts / 100 % funcs / 100 % lines /
     92.85 % branches; the 5 residual items are structurally dead via the UI
     (render-gated/disabled-button guards + an auto-side ternary inside the
     manual-only image block) - not reachable without a source refactor, so
     AddSerie is treated as DONE.

6. DONE **main/ipc/browserDownloaderControl.js** - closed this round (2026-07-05).
   - Was 50 % (13 channels registered but only 1 invoked). Now **100 %** stmts
     / 100 % branches / 100 % funcs / 100 % lines (64/64, 16/16, 14/14, 64/64).
   - `browserDownloaderControl.test.js` (25 tests) builds a `channel -> handler`
     map from `ipcMain.handle.mock.calls` in `beforeEach` and invokes each one.
     Every `browserDownloader` method is `vi.spyOn`-stubbed (navigateTo,
     resize/show/hideBrowserView, goBack/forward, reload, get/clearCaptured
     Streams, getDownloads, clearCompleted, cancelDownload, downloadStream).
     The 7 `browser:downloadStream` branches: library mode w/ VIDEO (.mkv) vs
     SUBTITLE (.vtt) filename sanitization, mkdir-when-dir-missing, no-MEDIA_DIR
     early return, custom save-dialog (video + subtitle filters/titles), dialog
     cancelled, null libraryContext -> custom path, and outer try/catch for sync
     throws + mkdirSync throws.
   - Note: the `vi.mock('fs')` factory's `existsSync: vi.fn(() => true)` default
     is cleared by `vi.clearAllMocks()` (Vitest 4), so `beforeEach` re-establishes
     `fs.existsSync.mockReturnValue(true)` - otherwise `existsSync()` returns
     undefined (falsy), every library-mode test enters the mkdir branch, and the
     skip-mkdir branch is never hit. Two tests override with `mockReturnValueOnce
     (false)` to drive the mkdir branch; both branches -> 100 %.

7. DONE **renderer/components/ControlPanel.jsx** - closed this round (2026-07-05).
   - Was 52.94 % (branches already 100 % but 8 stmts / 8 funcs uncovered: the
     inline `onMouseEnter`/`onMouseLeave` handlers on all 4 buttons that mutate
     `e.target.style` directly). Now **100 %** all four metrics (17/17 stmts,
     12/12 branches, 12/12 funcs, 16/16 lines).
   - Added 4 tests to `ControlPanel.test.jsx` (13 -> 17) firing
     `fireEvent.mouseEnter`/`mouseLeave` on each button and asserting the style
     mutation: server btn opacity 0.9<->1, add/download/settings btns
     backgroundColor #444<->#333. Color assertions use jest-dom `toHaveStyle`
     (jsdom normalizes hex to `rgb()`, so `btn.style.backgroundColor === '#444'`
     would fail; `toHaveStyle({ backgroundColor: '#444' })` matches the normalized
     `rgb(68, 68, 68)`). Note: React's `onMouseEnter` is synthesized from native
     `mouseover`/`mouseout`, but `fireEvent.mouseEnter` works in this repo's
     jsdom+RTL setup (already used at `Dashboard.test.jsx:101`).
   - **Tier 1 complete.** Next: Tier 2 branch/function hardening, starting with
     `fileControl.js` (86 stmts, 49 branches) and `SettingsPage.jsx` (24 stmts,
     15 funcs).

### Tier 2 — branch & function hardening
- `fileControl.js` (86 stmts, 49 branches) — drive remaining series/episode
  IPC branches incl. error returns and `null`/missing-file guards.
- `mediaService.js` (12 stmts, 8 branches) — cover query-result shapes.
- `database.js` (46 stmts, 43 branches) — cover each prepared-statement branch
  and the init/upgrade paths.
- `videoBuilder.js` (21 stmts, 14 branches), `ffmpegHelper.js` (8 branches),
  `handlesettings.js` (6 branches), `decisionEngine.js` (9 branches) — edge-case
  inputs.
- `ConversionModal.jsx`, `TranslateSubtitleForm.jsx`, `AutoTranslateModal.jsx` —
  remaining modal interaction branches.
- `SettingsPage.jsx`, `Dashboard.jsx`, `ControlPanel.jsx` — remaining effect and
  handler branches.

### Tier 3 — small branch polish to reach 100 %
- 3 branches in `config.js`, `main.js`, `serverControl.js`, `mediaAnalyzer.js`,
  `dialogManager.js`, `burnExternalSubtitle.js`, `SeriesBanner.jsx`,
  `tmdbService.js`, `SeriesCard.jsx`, `TranslateSubtitleModal.jsx`, `AuthPage.jsx`,
  `episodeQueue.js`, `settingsControl.js`, `authController.js`, `translateControl.js`.

## 6. Testing Conventions Used

These patterns are load-bearing for the suite; reuse them when adding the
roadmap tests so mocking stays consistent.

- **`vi.hoisted()`** for any variable referenced inside a `vi.mock()` factory
  (Vitest hoists mock factories above imports and throws on out-of-scope refs).
- **`vi.resetModules()` + `delete require.cache[require.resolve(path)]`** to
  re-evaluate stateful CJS module-load logic (e.g. env-driven config, IPC
  registration) between tests. `vi.resetModules` clears Vitest's registry; the
  `require.cache` delete clears Node's, which Vitest does not reset.
- **Deferred `app.whenReady`** (main.test.js): `app.whenReady: vi.fn(() => ({
  then: (cb) => { readyCb = cb; } }))` so `createWindow` / `registerIpcHandlers`
  run only when a `fireReady()` helper fires — letting assertions observe side
  effects deterministically.
- **Dynamic `import()` for ESM-in-CJS source**: `renderer/utils/i18n.js` uses
  `import i18n from 'i18next'` while the package is `"type": "commonjs"`; a
  `require('./i18n')` throws `SyntaxError: Cannot use import statement outside a
  module`. Tests use `await import('./i18n')` so vitest's transformer applies
  the `vi.mock` mocks.
- **`getByRole('button', { name })`** for icon+label buttons: `react-icons`
  renders `<svg aria-hidden>` as a sibling of the text node, so `getByText`
  fails ("text broken up by multiple elements"). The accessible-name query is
  robust to that split.
- **Supertest** for backend HTTP: `await request(app).post('/api/auth/login')…`
  over the real Express app (no mocked routes).
- **Global require interceptor** in `vitest.setup.js` returns mocks for
  `electron`, `fs` (`global.__fsMock`), `bcryptjs`, `sql.js`, `axios`,
  `fluent-ffmpeg`; `react-i18next` is globally mocked with
  `t: (key) => key`. Per-file `vi.mock` is preferred for local modules.
- **Defensive assertions document real (sometimes buggy) source behavior** — e.g.
  `processenv.js` splits on every `=` and drops empty values; `extractImdbId`
  has no null guard and a case-sensitive `/tt\d+/` regex. Tests assert the actual
  behavior rather than an idealized one, so a future fix surfaces as a failing
  test instead of silently passing.

## 7. Migration Notes (Jest → Vitest)

All test files are Vitest-native (`import { describe, it, expect, vi,
beforeEach } from 'vitest'`). No `jest` globals remain. Key migration fixes
applied during this work:

- Replaced `jest.fn()`/`jest.mock()` with `vi.fn()`/`vi.mock()`; removed any
  `jest` import.
- Replaced `jest.hoisted` with `vi.hoisted`.
- Replaced Enzyme-style `wrapper.find`/`screen.getByType` with RTL queries
  (`getByRole`, `getByTitle`, `container.querySelector`).
- Replaced `screen.getByTestId('…')` that relied on Enzyme-injected props with
  real DOM class/role queries (e.g. `.icon-spin`).
- Fixed ESM/CJS boundary for `i18n.js` via dynamic `import()`.
- Fixed icon+label `getByText` failures via accessible-name queries.