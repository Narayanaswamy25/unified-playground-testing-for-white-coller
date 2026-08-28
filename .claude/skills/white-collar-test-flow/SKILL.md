---
name: white-collar-test-flow
description: Reference for this project's white-collar workflow/campaign/candidate Selenium E2E flow — login caching, workflow reuse, and the Hire/Reject verdict test. Use when working on or explaining src/tests/app/whiteCollarFlow.test.ts and its supporting utils/pages.
---

# White-Collar Flow Test Suite

## Flow

1. **Login** — `useSharedSession()` reuses a cached token (memory → disk `.cache/shared-session.json`) across separate process runs; only does a real UI login when both are missing or expired.
2. **Workflow** — `ensureWorkflow()` reuses `TEST_WORKFLOW_ID` from `.env` if set; otherwise creates a recruiter-led workflow and prints its ID to paste back into `.env`.
3. **Campaign** — one campaign, two candidates (`TEST_CANDIDATE_EMAIL` = Hire, `TEST_CANDIDATE_EMAIL_2` = Reject), one AI-generated question set, one send — not a separate pipeline per outcome.
4. **Candidate journey** (opt-in, needs a real webcam + live face) — invite link → identity verification → screen/camera proctoring grant → answer all questions (correctly, or wrong on purpose) → submit.
5. **Verdict** — checks `candidatesessions.passed` in MongoDB and the campaign page's "Hire"/"Reject" badge for each candidate.

## Files

- `src/tests/app/whiteCollarFlow.test.ts` — the whole flow (staff + candidate specs)
- `src/tests/auth/deleteAccount.test.ts` — destructive, opt-in "Leave organization" test (own dedicated login, not the shared session)
- `src/utils/ensureWorkflow.ts` / `campaignLookup.ts` / `sharedSession.ts` — supporting logic
- `src/pages/Assessment{Entry,Verify,Start}Page.ts` — candidate-facing app page objects
- `src/config/driver.ts` — `buildDriverWithRealMedia()` grants real camera/screen-share without fake-device flags

## npm scripts

| Script | Runs |
|---|---|
| `npm test` | Everything except opt-in specs (headed) |
| `npm run test:auth` / `test:app` | Just that subfolder |
| `npm run test:candidate-assessment` | Full webcam flow — needs a live face at the camera |
| `npm run test:delete` | Destructive leave-org test |

## Key env vars

- `TEST_WORKFLOW_ID` — paste in after a run to reuse that workflow instead of recreating one every time
- `TEST_CANDIDATE_EMAIL` / `TEST_CANDIDATE_EMAIL_2` — the Hire / Reject candidates
- `ASSESSMENT_BASE_URL` — must be a deployment whose backend reaches the same staging Mongo cluster (not the production `skill-verification.userecord.io` domain)
- `RUN_CANDIDATE_ASSESSMENT_TEST`, `RUN_DELETE_ACCOUNT_TEST` — opt-in gates, both default `false`

## Known gotchas

- Every candidate-side session is single-use per (campaignId, candidateId) — retrying the same candidate on a failed run needs a fresh campaign, not a re-run.
- The exam-answering loop watches for a "no face detected" pause overlay (`resumeIfPaused()` in `AssessmentStartPage.ts`) and auto-retries; other proctoring lock overlays (multiple faces, tab switch) aren't yet handled the same way.
- `answerCurrentQuestion`'s MCQ branch queries every `button` on the page, not just the answer options — the exam page always has chrome buttons (header "Submit Assessment", "Next Question", etc.) visible alongside them. `NON_OPTION_BUTTON_TEXTS` filters those out; if the app adds a new always-visible button, add its text there too, or the wrong-answer path (`wantCorrect=false`, used by the Reject spec) can click it before any real option — which is what silently auto-opened the submit dialog with 0 of N answered before this fix. `throwIfAutoSubmitted()` catches that class of failure early with a clear error instead of a confusing `ElementClickIntercepted` + downstream timeout.
- `saveScreenshotOnFailure` only captures when called from a real `afterEach` hook, or in a spec that instead builds its own driver — it now falls back to `mochaContext.test` so an inline `catch` block inside the test body still captures a screenshot.
- The Reject-verdict assertion (`waitForCandidatePassed(sentCampaignName, env.testCandidateEmail2).to.equal(false)`) can fail even when every answer is genuinely wrong: short/long-answer grading in record-assessment-backend appears to award full marks regardless of content. Confirmed 2026-08-28 — the reject candidate's session scored exactly the campaign's short+long-answer point total (52/52) despite all 21 answers (including the free-text ones, which were literally the placeholder "This answer is deliberately wrong...") mismatching `correctAnswer`, pushing total score past `passMark` and flipping `passed` to `true`. This is a backend grading bug, not a test bug — out of scope to fix in this repo; file against record-assessment-backend.
