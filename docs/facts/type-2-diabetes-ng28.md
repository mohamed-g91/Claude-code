# Type 2 diabetes — NG28 screening pass

Run of the [fact-screening rubric](../fact-screening-rubric.md) against type 2
diabetes, for batch 02. Source: **NICE guideline NG28, *Type 2 diabetes in
adults: management*** — 131 pages, 142 numbered recommendations across 44
sections. Facts below are concepts pulled from the recommendations and the
committee's stated reasoning, not verbatim exam text.

<https://www.nice.org.uk/guidance/ng28>

## Why this pass has no concordance axis

Batch 1 sorted stable-angina facts on a second axis before the four buckets:
[NICE against ESC](stable-angina-nice-vs-esc.md), on the principle that a
finding whose decision depends on which guideline the reader learned is a
jurisdiction question wearing a pivot's clothes.

That axis is **deliberately absent here.** This pass is NICE-only by decision,
so no second body is consulted and no fact is screened for concordance. The
consequence is worth stating plainly rather than discovering later: some of
what follows would very likely diverge from ADA/EASD, particularly the
comorbidity streams, the metformin-first sequencing and the SGLT-2 inhibitor
eligibility. Cases built from this pass teach the NICE pathway. Where a case
needs a fact NG28 does not supply, the pass says so rather than reaching
outside.

## Provenance

Cover states *published 2 December 2015, last updated 18 February 2026*. The
change log on p131 records a later change than its own cover date:

> September 2026: We have amended the descriptions of the estimated glomerular
> filtration rate (eGFR) ranges in recommendations 1.18.1 and 1.18.2 to clarify
> when each of these recommendations would apply.

Those two recommendations underpin case 2 below, and the amendment lands on the
exact boundary that case turns on.

## Step 1–2: enumerate and classify

The full enumeration of all 142 recommendations — id, page, NICE's own
year-of-evidence tag, and each recommendation's opening sentence verbatim — is
not reproduced here. The recommendations these cases actually cite are quoted in
full in [type-2-diabetes-ng28-reference.md](type-2-diabetes-ng28-reference.md),
and the item-by-item screening record, including writing constraints, is in
[type-2-diabetes-ng28-ledger.md](type-2-diabetes-ng28-ledger.md).

From that enumeration, 24 candidates were selected and walked one by one. Of
those: **12 pivot-worthy**, yielding 13 cases; 1 held for a future pass; 9
passed over; 1 undecided; and 1 approved at screening then discarded once
drafted.

### Pivot-worthy

| id | pg | yr | pivot clause | what it changes |
|---|---|---|---|---|
| **1.15.1** | 45 | 2026 | the ASCVD history | Adds subcutaneous semaglutide to an otherwise identical MR metformin + SGLT-2 inhibitor base. Contrast 1.13.1, no relevant comorbidity |
| **1.18.2** | 62 | 2026 | the eGFR value, and that it is **above** 30 | Below 30, metformin drops out, the SGLT-2 inhibitor narrows to dapagliflozin or empagliflozin, and a DPP-4 inhibitor is added. Above it, none of that applies |
| **1.19.1** | 65 | 2026 | the postural drop | Frailty makes the SGLT-2 inhibitor conditional rather than automatic. NG28 names the mechanism — volume depletion, hypotension — but defines no threshold and no frailty scale |
| **1.22.2** | 73 | 2022, amended 2026 | the submaximal metformin dose | Optimise the current regimen before changing it. Restraint decision |
| **1.23.1** | 74 | 2026 | standard-release metformin as the preparation | Intolerance triggers a switch to modified-release, not abandonment of the drug |
| **1.24.3** | 77 | 2026 | BMI <18.5 kg/m² | Unconditional stop of a GLP-1 receptor agonist or tirzepatide. The only hard threshold in its section |
| **1.24.4** | 77 | 2026 | the absence of any cardiovascular indication | Glycaemic failure stops the drug only where nothing else justifies it |
| **1.24.6** | 77 | 2026 | the co-prescription itself | The only outright prohibition in the selection: never a GLP-1 receptor agonist or tirzepatide together with a DPP-4 inhibitor |
| **1.27.1** | 87 | 2026 | the new MI after starting treatment | 1.15.1 displaced in time — ASCVD developing later adds semaglutide to existing treatment |
| **1.28.2** | 92 | 2026 | the childbearing potential | "Not appropriate" for a GLP-1 receptor agonist routes to a DPP-4 inhibitor. Used only here in NG28 |
| **1.29.2 (a)** | 96 | 2026 | the 3 months on initial therapy | The only duration threshold in the selection |
| **1.29.2 (b)** | 96 | 2026 | HbA1c already within target | The second ANDed condition fails, so the answer is not to add |
| **1.32.2** | 107 | 2015, amended 2026 | the patient with ASCVD starting insulin | Metformin continues unconditionally; drugs there *solely* for glucose stop; drugs there for cardiovascular or weight benefit are discussed, not reflexively stopped |

Four definitions from NG28's Terms section are load-bearing across these cases
and are worth quoting, because several of them turn on the definition rather
than on the recommendation:

> **Atherosclerotic cardiovascular disease.** …It includes: coronary artery
> disease such as myocardial infarction and unstable angina; cerebrovascular
> disease such as transient ischaemic attack and ischaemic stroke; peripheral
> arterial disease.

> **Early onset type 2 diabetes.** Diabetes that has been diagnosed before the
> age of 40.

> **Maximum tolerated dose.** The highest dose of the medicine someone can take
> to experience positive effects without experiencing adverse effects.

> **No relevant comorbidity.** People with none of the comorbidities covered in
> the guideline, that is, people who do not have heart failure, atherosclerotic
> cardiovascular disease, obesity, chronic kidney disease, or frailty that puts
> them at risk of adverse events from certain medicines.

### Held for a future pass

| id | why |
|---|---|
| 1.18.3 | Decisive — below eGFR 20 the regimen collapses to DPP-4 monotherapy — but the same reasoning move and the same lab value as 1.18.2. Held so the batch does not repeat itself, as batch 1 held verapamil+beta-blocker and nicorandil |

### Passed over

`1.20.2`, `1.21.1`, `1.29.3`, `1.33.1`, `1.33.2`, `1.35.1`, `1.35.2`, `1.37.1`,
`1.38.3`. `1.43.3` remains undecided.

`1.24.2` (continue an SGLT-2 inhibitor despite glycaemic failure) was
pivot-worthy at screening and discarded once drafted.

## Two places NG28 does not supply what a case would need

**Previous DKA has no specified action.** `1.21.1` says to *check* for previous
DKA before starting an SGLT-2 inhibitor; `1.21.2` then says to address
**modifiable** risks — and a previous episode is not modifiable, so it falls
through without landing on an instruction. Across all 17 DKA mentions there is
no "do not offer", no threshold, no dose change and no monitoring interval tied
to it. The committee declined deliberately (p71): the factor list "is not
intended to be exhaustive", and taking factors into account was "more important
than providing a specific HbA1c threshold from which to avoid prescribing
SGLT-2 inhibitors". The only DKA risk factor carrying a concrete action is the
very low carbohydrate or ketogenic diet — delay starting, or suspend an
existing SGLT-2 inhibitor for the diet's duration.

**No GLP-1 eye contraindication exists.** NAION appears exactly twice in 131
pages (p49, p55), both in committee rationale, never in a numbered
recommendation, and both times only as a pointer to MHRA guidance. NG28 never
defines what contraindicates a GLP-1 at all — all eight uses are the
conditional form. So a case may end in emergency ophthalmology referral, which
`1.43.3` supports drug-agnostically; a case may **not** end in "stop the
semaglutide".

Related and also outside NG28's own text: there is **no stopping rule for a
GLP-1 failing to produce weight loss.** The only weight-triggered stop is
`1.24.3`, and it fires on becoming underweight. `1.29.1` sends weight-management
prescribing to NICE's overweight and obesity guideline.

## Step 3–4: cases

Seven of the thirteen have been written and are in
[`type-2-diabetes-ng28-cases-draft.json`](type-2-diabetes-ng28-cases-draft.json),
validated against `tools/validate-cases.mjs`. They are **not** yet in
`src/cases.json` — a half-written batch should not ship.

| # | id | from | pivot |
|---|---|---|---|
| 1 | `endo_t2dm_ascvd_semaglutide` | 1.15.1 | ischaemic stroke three years ago |
| 2 | `endo_t2dm_egfr_above_30` | 1.18.1/1.18.2 | **None** — the plan is already right |
| 3 | `endo_t2dm_frailty_sglt2_withheld` | 1.19.1 | postural hypotension on examination |
| 4 | `endo_t2dm_optimise_before_escalating` | 1.22.2 | metformin 500 mg twice daily |
| 5 | `endo_t2dm_modified_release_switch` | 1.23.1 | standard-release metformin |
| 6 | `endo_t2dm_glp1_underweight_stop` | 1.24.3 | body mass index 18.1 kg/m² |
| 7 | `endo_t2dm_glp1_glycaemic_failure` | 1.24.4 | **None** — the plan is already right |

Remaining to write: `1.24.6`, `1.27.1`, `1.28.2`, `1.29.2` (two cases),
`1.32.2`.

Prose is original per the repo's rule against lifting stems from PassMedicine,
Pastest or any other commercial bank; the rubric decides which facts and what
role, never the wording. Stems follow [stem-style.md](../stem-style.md).

## Open questions for batch composition

1. **ASCVD carries three of the thirteen** — 1.15.1, 1.27.1 and 1.32.2 — and
   1.24.4 turns on the same cardiovascular-benefit distinction. Batch 1 used
   exactly this repetition test to hold 1.18.3 back.
2. **Restraint cases.** Two of the seven written are None-answers, with
   1.29.2 (b) still to come as a third. Batch 1 shipped one in nine.
3. **Thirteen against batch 1's nine.** No decision yet on whether batch 02
   ships whole or splits.
4. **Topic spread.** Batch 1 was Cardiology 7 / Clinical Pharmacology 2. These
   are all tagged Endocrinology, though 1.24.6, 1.23.1 and 1.38.3 are
   pharmacology in substance.
5. `1.43.3` undecided; `1.18.3` held.
