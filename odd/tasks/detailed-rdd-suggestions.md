# Detailed RDD suggestions

The `agent_end` review-preflight reminder states why a native review is due and what the change touched,
and an opt-in "Detailed RDD suggestions" setting lets it be longer and laid out as a list.
When the reminder is sent never changes. Branch `feat/review-preflight-context`, one pull request.

## Specs

S1. Trigger unchanged. User: "actualmente, el rdd salta por casi cualquier cosa, eso no me parece bien pero es como esta hecho y eso NO lo quiero cambiar". The conditions under which the reminder is sent stay exactly as at base `a9b972044`: only an explicit native `reviewDue === false` suppresses it; an assessment that fails, resolves null, or carries no `reviewDue` keeps it.

S2. Context in the reminder. User: "lo que quiero es agregar mas contexto de porque propone revisar con RDD la tarea que acaba de hacer, y sobre que la acaba de hacer" and "actualmente el texto que escribe el agente trae muy poca info de \"por que\" eso deberia revisarse". After its first line the reminder states `Why review is due: …` and `What it touched: …` from the same native assessment, then asks the agent to open its proposal to the human with that reason and scope. A reason the assessment did not give is reported as missing, never invented.

S3. Opt-in detailed mode. User: "Y si mejor agregamos alguna opcion para activar esto y que supere los 160 chars? Algo como \"Detailed RDD suggestions\", que permita alargar el mensaje y que quede estetico y bien explicado". Off by default. Agreed layout when on:

```
Why review is due: the native assessment rates this change high risk (review_due_reason: high_risk).
What it touched: 4 changed paths, 186 changed lines.
Flagged by the assessment:
  • "extensions/gentle-ai.ts": an executable change (executable_change)
  • "internal/runner/runner.go": code that starts other processes (process_boundary)
```

One flagged reason per line with a two-space indent and a `•` bullet; up to 20 reasons (then `  • and N more`); each native value bounded to 400 code points. The `Flagged by the assessment:` header is omitted when no reason is reported. In detailed mode the instruction sentence also asks the agent to explain each flagged item in one sentence. Default mode keeps one `Flagged: …` line, 5 reasons, 160 code points.

S4. Activation. User chose "Fila en Customize (recomendado)": a per-feature JSON file in the Gentle Pi config home plus a Customize row next to the existing RDD row, following the repository's existing settings pattern. No slash command, no environment variable.

S5. Explained codes in both modes. User chose "En los dos modos (recomendado)". A reason code is shown with the human phrase the repository already holds for it (`REVIEW_RISK_SUBJECT_BY_CODE` in `lib/native-review-cli.ts`, mirrored from gentle-ai), as `<phrase> (<code>)`. A code with no phrase there shows the code alone. No phrase is invented in this repository.

S6. Native text stays guarded in both modes. Every native value is flattened to a single line and bounded; path and detail are JSON-quoted, and a code that is not a plain identifier (`^[a-z0-9_]+$`) is JSON-quoted too and gets no phrase; rendering never throws, so a malformed assessment never loses the reminder: if rendering the context fails for any reason the reminder is still sent with the no-assessment context. The flagged list as a whole is bounded: entries are added in order while their rendered text stays within 2,000 code points in default mode and 8,000 in detailed mode (the first entry is always shown), and the rest are counted in `and N more`.

S7. Paths keep their ordinary spaces (native review findings R2-002 and R3-001). A path is not trimmed and its repeated ordinary spaces are not collapsed; only control, format, line-separator, lone-surrogate and non-U+0020 whitespace characters are replaced, one `\uFFFD` per character, so two distinct file names never render as the same name.

S8. Missing reason is not a missing verdict (native review finding R2-001). When the assessment reports `reviewDue: true` without a reason, the reminder says the assessment reports the change due without a reason; it says the assessment failed or predates `review_due` only when it did not answer.

S9. Delivery. User chose "Todo junto en un PR" and "No commitear todavía": one pull request, nothing committed until the user asks.

## Tasks

- [x] T0 (S1, S2, S6) inline + worker: reminder context, guard, tests, docs. Uncommitted; native review `review-1ef291647878fab5` approved that tree before T1-T3.
- [x] T1 (S4) worker: settings policy module and its test. Uncommitted.
- [x] T2 (S3, S5, S6, S7, S8) worker (uncommitted): renderer for both modes, phrases, path formatter, missing-reason wording, `agent_end` reads the policy, handler-level tests, `docs/readme-reference.md`.
- [x] T3 (S4) worker (uncommitted): Customize row, its test, `docs/gentle-shell.md`.
- [ ] T4 (S1-S8) verify + native review of the whole candidate.
- [x] T5 (S1, S6) worker (uncommitted): verifier advisories A1-A3, A5 and the three regression tests.

## Log

L1. Original request, verbatim: "Quiero abrir un pr para realizar algunas mejoras al proyecto de gentle-shell, para eso, baja el proyecto desde github a este directorio y revisalo". Then: "Si, basicamente, quiero mejorar el contexto de las suggestions del RDD, actualmente, el rdd salta por casi cualquier cosa, eso no me parece bien pero es como esta hecho y eso NO lo quiero cambiar, lo que quiero es agregar mas contexto de porque propone revisar con RDD la tarea que acaba de hacer, y sobre que la acaba de hacer, me entiendes?"

L2. User: "La segunda, actualmente el texto que escribe el agente trae muy poca info de \"por que\" eso deberia revisarse". Scope chosen: "Solo el recordatorio (recomendado para empezar)". Decision: the pull request goes to gentle-shell; the provider's consent envelope and mirrored bundle are not touched.

L3. Environment: `node_modules` is a symlink to an installed gentle-shell (Pi packages match the lockfile, `typebox` and `pi-pretty` do not); `pnpm` and `typescript` are not installed, so `pnpm run typecheck` has not run. Full suite differential against base: 49 failures identical with and without the change; `tests/built-web-guard.test.ts` fails only in this checkout because of `.codegraph/daemon.sock`; `tests/shell-git-runner-stall.test.ts` is flaky at base (4 of 6 passes).

L4. T0 evidence: independent verify found the flattening missed C1, zero-width and bidi characters, unquoted detail, two throw paths, and surrogate splitting; all corrected. `tests/review-agent-end-preflight.test.ts`: 77 tests, 76 pass, 1 skipped, 0 fail. Native review approved with four non-blocking findings (R1-001, R2-001, R2-002, R3-001).

L5. User, verbatim: "Y si mejor agregamos alguna opcion para activar esto y que supere los 160 chars? Algo como \"Detailed RDD suggestions\", que permita alargar el mensaje y que quede estetico y bien explicado". Answers: activation "Fila en Customize (recomendado)"; delivery "Todo junto en un PR"; phrases "En los dos modos (recomendado)"; "No commitear todavía". The 20-reason and 400-code-point bounds and the list layout were proposed by the agent and not objected to. R1-001 (target identity read before the assessment) is left as a follow-up: it predates this change's scope.

L6. T1-T3 evidence (worker): `tests/rdd-suggestions-policy.test.ts` + `tests/review-agent-end-preflight.test.ts` 91 tests, 90 pass, 1 skipped, 0 fail; `tests/gentle-shell.test.ts` + `tests/shell-card.test.ts` 387 pass; native-review-cli family 231 tests, 228 pass, 3 skipped; `build-runtime-modules --check` and `check-provider-contract` pass; differential on `nativeRiskEvidencePhrases` byte-identical against HEAD. Correction to S3's example: the repository phrase for `executable_change` is "an executable change"; the agent's earlier "executable code changed" was not a repository phrase. Worker decisions: the Customize rows read on/off (on = `detailed`) and apply on Enter like their Editor neighbours; a detail with no path or code renders alone, quoted; detailed mode without counts says "not reported by the native assessment" and still lists reasons.

L7. Independent verify of T0-T3: S1-S8 all pass (40 base-versus-candidate cells for S1; 3,200 differential cases for the shared phrase code). Six advisories. Agent decisions: fix A1 (detailed mode could reach about 100 KB in a turn-triggering message; S6 now bounds the list as a whole), A2 (render inside a fallback), A3 (quote non-identifier codes) and A5 (docs and comment overclaim "every invisible character"); leave A4 (two paths sharing their first bounded code points, or differing only in a replaced control character, render alike: inherent to bounding and replacement) and A6 (detailed mode asks to explain flagged items even when none is flagged) as known limitations for the pull request description.

L8. T5 evidence (worker): `tests/rdd-suggestions-policy.test.ts` + `tests/review-agent-end-preflight.test.ts` 102 tests, 101 pass, 1 skipped, 0 fail; `tests/gentle-shell.test.ts` + `tests/shell-card.test.ts` + `tests/rdd-customize.test.ts` 414 pass; runtime-modules check and provider-contract check pass. Measured worst-case reminder through the handler with adversarial four-byte values: 36,589 bytes detailed, 10,415 bytes default (base reminder: 909 bytes); the list budget counts code points, so plain-text reasons stay near 8,000 and 2,000 bytes.
