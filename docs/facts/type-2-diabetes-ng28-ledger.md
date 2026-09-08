# Type 2 diabetes (NG28) — screening ledger

Batch 02 candidate screening. **Decisions are the author's**; this file records them.

- Screening pass: [type-2-diabetes-ng28.md](type-2-diabetes-ng28.md)
- Verbatim source extracts: [type-2-diabetes-ng28-reference.md](type-2-diabetes-ng28-reference.md)
- Written cases: [type-2-diabetes-ng28-cases-draft.json](type-2-diabetes-ng28-cases-draft.json)
- Rubric: [fact-screening-rubric.md](../fact-screening-rubric.md)
- Stem style: [stem-style.md](../stem-style.md)
- Batch 1: [stable-angina-nice-vs-esc.md](stable-angina-nice-vs-esc.md), 9 cases tagged
  `batch: "stable-angina"`

The full 142-row enumeration and the complete extracted guideline text are working
files kept outside the repo; NG28 itself is free at <https://www.nice.org.uk/guidance/ng28>.

Working definition in force: **a pivot is the one finding that clearly changes management.**

Source: NICE NG28, *Type 2 diabetes in adults: management*. Cover states last updated
18 February 2026; the change log on p131 records a **September 2026** amendment (see
Provenance below).

## Status — all 24 walked

**13 cases** from 12 recommendations. (1.24.2 was approved at screening then discarded at drafting.) 1 held for a future pass, 9 passed over, 1 undecided.

| # | id | pg | yr | bucket | pivot clause |
|---|---|---|---|---|---|
| 1 | 1.15.1 | 45 | 2026 | **Pivot-worthy** | the ASCVD history |
| 2 | 1.18.2 | 62 | 2026 | **Pivot-worthy** | the eGFR value, and that it is **above** 30 |
| 3 | 1.18.3 | 62 | 2026 | Hold for future pass | — |
| 4 | 1.19.1 | 65 | 2026 | **Pivot-worthy** | the postural drop |
| 5 | 1.20.2 | 69 | 2022, amended 2026 | passed over | — |
| 6 | 1.21.1 | 70 | 2022, updated 2026 | passed over | — |
| 7 | 1.22.2 | 73 | 2022, amended 2026 | **Pivot-worthy** | the submaximal metformin dose |
| 8 | 1.23.1 | 74 | 2026 | **Pivot-worthy** | diarrhoea on standard-release metformin |
| 9 | 1.24.2 | 77 | 2026 | ~~Pivot-worthy~~ **discarded at drafting** | — |
| 10 | 1.24.3 | 77 | 2026 | **Pivot-worthy** | BMI <18.5 kg/m² |
| 11 | 1.24.4 | 77 | 2026 | **Pivot-worthy** | the absence of any cardiovascular indication |
| 12 | 1.24.6 | 77 | 2026 | **Pivot-worthy** | the co-prescription itself |
| 13 | 1.27.1 | 87 | 2026 | **Pivot-worthy** | the new MI after starting treatment |
| 14 | 1.28.2 | 92 | 2026 | **Pivot-worthy** | the childbearing potential |
| 15a | 1.29.2 | 96 | 2026 | **Pivot-worthy** | the 3 months on initial therapy |
| 15b | 1.29.2 | 96 | 2026 | **Pivot-worthy** | HbA1c already within target |
| 16 | 1.29.3 | 96 | 2026 | passed over | — |
| 17 | 1.32.2 | 107 | 2015, amended 2026 | **Pivot-worthy** | patient with ASCVD starting insulin |
| 18 | 1.33.1 | 108 | 2015, amended 2026 | passed over | — |
| 19 | 1.33.2 | 108 | 2015, amended 2026 | passed over | — |
| 20 | 1.35.1 | 111 | 2015, amended 2026 | passed over | — |
| 21 | 1.35.2 | 111 | 2015, amended 2026 | passed over | — |
| 22 | 1.37.1 | 113 | 2022 | passed over | — |
| 23 | 1.38.3 | 116 | 2015 | passed over | — |
| 24 | 1.43.3 | 118 | 2009 | **undecided** | — |

## Open questions for batch composition

1. **ASCVD carries three of the 13** — 1.15.1 (present at initiation), 1.27.1 (develops
   later), 1.32.2 (survives insulin initiation) — and 1.24.4 turns on the same
   cardiovascular-benefit distinction. Batch 1 used exactly this repetition test to hold
   1.18.3 back.
2. **Restraint cases.** 1.22.2 and 1.29.2b, plus two None-answers already written
   (cases 2 and 7). Batch 1
   shipped one restraint case in nine, and it took the None-answer form
   (`none: {role: "pivot"}`).
3. **13 cases against batch 1's nine.** No decision recorded on whether batch 02 ships
   whole or splits.
4. **Topic spread.** Batch 1 spanned Cardiology (7) and Clinical Pharmacology (2). These 13
   are all Endocrinology, though 1.24.6, 1.23.1 and 1.38.3 are pharmacology in substance.
5. **1.43.3 undecided**, and **1.18.3 held**.

## Decided items in detail

### 1.15.1 — Pivot-worthy

**Initial medicines › 1.15 People with atherosclerotic cardiovascular disease**, p45, `[2026]`

> For adults with type 2 diabetes and atherosclerotic cardiovascular disease, offer:
> modified-release metformin, and an SGLT-2 inhibitor, and subcutaneous semaglutide
> (Ozempic), up to 1 mg once a week, for its cardiovascular, renal and glycaemic benefits.

Pivot clause: **the ASCVD history.** Contrast `1.13.1` (p32), no relevant comorbidity: MR
metformin + an SGLT-2 inhibitor. Delta is exactly one agent.

### 1.18.2 — Pivot-worthy

**Initial medicines › 1.18 People with chronic kidney disease**, p62, `[2026]`

> For adults with type 2 diabetes and an eGFR of 20 ml/min/1.73 m² or more and less than
> 30 ml/min/1.73 m², offer: either dapagliflozin or empagliflozin, and a DPP-4 inhibitor.

Pivot clause: **the eGFR value — specifically that it is above 30.**

Case shape: stem carries an eGFR just above threshold (e.g. 32 ml/min/1.73 m²) in a patient
already on an SGLT-2 inhibitor plus a DPP-4 inhibitor — the 20–<30 regimen. The pivot is
recognising the value sits *above* 30, so the renal-adjusted regimen is wrong and MR
metformin + SGLT-2 inhibitor is right.

| eGFR | NG28 offers | id |
|---|---|---|
| ≥30 | MR metformin + SGLT-2 inhibitor | 1.18.1 |
| 20 to <30 | dapagliflozin **or** empagliflozin + DPP-4 inhibitor | 1.18.2 |
| <20 | consider a DPP-4 inhibitor | 1.18.3 |
| DPP-4 CI/not tolerated/not effective | consider pioglitazone or insulin-based treatment | 1.18.4 |

**Note:** these are the two recommendations NICE amended in September 2026 "to clarify when
each of these recommendations would apply" — the exact boundary this case turns on.

### 1.18.3 — Hold for future pass

Decisive, but the same reasoning move and the same lab value as 1.18.2 (eGFR read against a
threshold). Held so the batch does not repeat itself — the disposition batch 1 gave
verapamil+beta-blocker and nicorandil.

### 1.19.1 — Pivot-worthy

**Initial medicines › 1.19 People with frailty**, p65, `[2026]`

> For adults with type 2 diabetes and frailty: Offer modified-release metformin. Only offer
> an SGLT2 inhibitor if the person's level of frailty does not place them at risk of adverse
> events from such a medicine (for example, volume depletion or hypotension).

Pivot clause: **the postural drop.** Frailty does not add an agent — it makes the SGLT-2
inhibitor conditional. NG28 names the mechanism but sets no threshold and names no frailty
scale, so a concrete finding carries it.

### 1.22.2 — Pivot-worthy

**Reviewing medicines › 1.22 Principles**, p73, `[2022, amended 2026]`

> Optimise their current treatment regimen before changing treatments, taking into account
> factors such as: adverse effects; prescribed doses and formulations; adherence to, and
> management of, existing medicines; the need to revisit advice about diet and healthy living.

Pivot clause: **the submaximal metformin dose.** A restraint recommendation — the NG28
analogue of batch 1's `cardio_third_antianginal_restraint`. Decide at writing time whether it
takes the None-answer form. Connects to 1.20.2's "maximum tolerated dose" trigger.

### 1.23.1 — Pivot-worthy

**Reviewing medicines › 1.23 Reviewing metformin**, p74, `[2026]`

> For adults with type 2 diabetes who are already taking standard-release metformin: continue
> with this treatment or switch to modified-release metformin if standard-release metformin is
> not tolerated or if this is the person's preference.

Pivot clause: **diarrhoea on standard-release metformin.** Case shape: the patient has already
been shifted to a DPP-4 inhibitor; the pivot is that the correct move was a switch to
modified-release metformin. Committee reason (p74): "people can experience fewer
gastrointestinal adverse events with modified-release metformin".

**Writing constraint.** Nine recommendations open "If metformin is contraindicated or not
tolerated, offer…" and each routes to another class. A reader can defend the DPP-4 switch —
diarrhoea is "not tolerated". The case has a single defensible answer **only if the stem makes
clear modified-release was never tried**.

### 1.24.2 / 1.24.4 — Pivot-worthy, two separate cases

**Reviewing medicines › 1.24 Reviewing other medicines**, p77, both `[2026]`

> **1.24.2** Consider continuing SGLT-2 inhibitors for their cardiovascular or renal benefits,
> even if they do not help the person reach their individualised glycaemic targets.
>
> **1.24.4** Stop GLP-1 receptor agonists or tirzepatide if they do not help the person reach
> their individualised glycaemic targets and they are not being taken for their cardiovascular
> benefits.

Mirror images: same situation, opposite instructions; the discriminator is why the drug is
there. Committee logic (p78): SGLT-2 inhibitors "provide cardiovascular and renal protection
that cannot be measured by tests"; GLP-1 RA / tirzepatide are continued only where doing
cardiovascular work (ASCVD, early onset), otherwise "stopped if they are not effective".

### 1.24.3 — Pivot-worthy

> Stop GLP-1 receptor agonists or tirzepatide if the person becomes underweight (BMI of less
> than 18.5 kg/m²). `[2026]`

Pivot clause: **BMI <18.5 kg/m².** The only hard number in the section, unconditional.

### 1.24.6 — Pivot-worthy

> Do not offer both a GLP-1 receptor agonist or tirzepatide and a DPP-4 inhibitor together to
> treat type 2 diabetes. `[2026]`

Pivot clause: **the co-prescription itself.** The only outright prohibition among the 24, same
grammatical form as batch 1's verapamil-plus-beta-blocker pivot.

**Known gap:** NG28 gives no reason anywhere — the incretin-axis overlap is not written down.
Statable from NICE, not explainable from NICE.

### 1.27.1 — Pivot-worthy

**Further medication › 1.27 People with atherosclerotic cardiovascular disease**, p87, `[2026]`

> If an adult with type 2 diabetes develops atherosclerotic cardiovascular disease after
> starting initial treatment, offer to add subcutaneous semaglutide (Ozempic), up to 1 mg once
> a week, to their current treatment, for its cardiovascular and renal benefits.

Pivot clause: **the new MI after starting treatment.** 1.15.1 displaced in time. Sibling
`1.27.2` fires on a glycaemic shortfall instead of an event and routes to a sulfonylurea — the
two triggers must not blur in a stem.

### 1.28.2 — Pivot-worthy

**Further medication › 1.28 People with early onset type 2 diabetes**, p92, `[2026]`

> …for whom a GLP-1 receptor agonist or tirzepatide is contraindicated, **not tolerated or not
> appropriate**: offer to add a DPP-4 inhibitor…; if this is contraindicated, not tolerated or
> is not effective, offer to add a sulfonylurea or pioglitazone or an insulin-based treatment.

Pivot clause: **the childbearing potential.**

NG28 defines the group by a hard number — *Early onset type 2 diabetes: diabetes that has been
diagnosed before the age of 40* (Terms). "Not appropriate" is used only here; `1.9.4` supplies
its content (MHRA contraception advice for women, trans men and non-binary people of
childbearing potential), and the committee ties it to this group explicitly (p23).

Watch against `1.24.6`, which prohibits the same two classes **combined**; this case is the
same two classes in **substitution**.

### 1.29.2 — Pivot-worthy, two cases

**Further medication › 1.29 People living with obesity**, p96, `[2026]`

> Consider adding a GLP-1 receptor agonist or tirzepatide for adults with type 2 diabetes who
> are living with obesity, if: they have been taking initial therapy for at least 3 months, and
> further medicines are needed to reach their individualised glycaemic targets, and they are
> not already taking a GLP-1 receptor agonist or tirzepatide.

- **(a)** pivot = **the 3 months on initial therapy.** The only duration threshold in the
  selection. Someone escalated at 6 weeks fails it however high the HbA1c.
- **(b)** pivot = **HbA1c already within the individualised target.** The second condition
  fails, so the answer is not to add. Restraint shape.

Cautions: `1.20.2` (passed over) says add the next agent *as soon as* the previous reaches
maximum tolerated dose, with no waiting period — different step, but a careless stem could read
as having two answers. Obesity is the one comorbidity NG28 does not define itself.

### 1.32.2 — Pivot-worthy

**Insulin-based treatments › 1.32 Starting an insulin-based treatment**, p107,
`[2015, amended 2026]`

> When initiating insulin for adults with type 2 diabetes: continue to offer metformin to
> people already taking it; stop any other medicines being used solely to manage
> hyperglycaemia; discuss with the person the risks and benefits of continuing medicines for
> other benefits such as cardiovascular protection or weight management.

Pivot clause: **the patient with ASCVD starting insulin** — the cardioprotective agent must
survive.

| existing drug | fate |
|---|---|
| metformin | continue, unconditionally |
| anything there *solely* for glucose | stop |
| anything there for cardiovascular or weight benefit | discuss, do not reflexively stop |

Third case turning on "why is the drug there", after 1.24.2 and 1.24.4.

## Notes carried forward

### Previous DKA has no specified action in NG28 (re 1.21.1)

`1.21.1` says to **check** for previous DKA. `1.21.2` says to address **modifiable** risks — a
previous episode is not modifiable, so it falls through without landing on an instruction.
Across all 17 DKA mentions there is no "do not offer", no threshold, no dose change, no
monitoring interval tied to previous DKA. The committee says so deliberately (p71): the factor
list "is not intended to be exhaustive", and taking factors into account was "more important
than providing a specific HbA1c threshold from which to avoid prescribing SGLT-2 inhibitors".

The only DKA risk factor NG28 attaches a concrete action to is the **very low carbohydrate or
ketogenic diet** — delay starting (`1.21.2`), or suspend an existing SGLT-2 inhibitor for the
diet's duration (`1.21.3`). Sick-day handling (`1.10.1`) points outward to MHRA advice on
monitoring ketones during treatment interruption.

### No GLP-1 eye contraindication exists in NG28 (re 1.43.3)

**NAION appears exactly twice in 131 pages** (p49, p55), both in committee rationale, never in
a numbered recommendation, and both times only as a pointer: "See MHRA guidance on… semaglutide
(Wegovy, Ozempic and Rybelsus): risk of non-arteritic anterior ischemic optic neuropathy
(NAION) for more details."

NG28 never defines what contraindicates a GLP-1 at all — all eight uses are the conditional
form ("if a GLP-1 receptor agonist or tirzepatide is contraindicated…"). The only concrete
contraindication named anywhere in the guideline is metformin below eGFR 30.

Consequence: a case may end in **emergency ophthalmology referral** (`1.43.3` supports it
fully, drug-agnostic). A case may **not** end in "stop the semaglutide" — NG28 does not say it,
and nothing NICE-only can be cited for it. Whether MHRA/SmPC treats NAION as a contraindication
or a warning was not checked (outside the NICE-only boundary).

Related: NG28 also notes (p71) that "sudden reductions in HbA1c can increase the risk of
diabetic retinopathy and ischaemic maculopathy, especially with GLP-1 receptor agonists and
tirzepatide", and `1.20.2` cross-references NICE's diabetic retinopathy guideline for this.

### Candidates noticed but not on the list of 24

- `1.18.4` (p62) — DPP-4 CI/not tolerated/not effective → pioglitazone or insulin.
- `1.22.3` (p73, `[2026]`) — if response to medicines suggests type 2 diabetes might not be the
  correct diagnosis, see NICE's guideline on managing type 1 diabetes. The one place NG28
  contemplates the diagnosis being wrong.
- `1.29.4` (p96) — already on GLP-1 RA/tirzepatide → skip the DPP-4 inhibitor, go to
  sulfonylurea / pioglitazone / insulin. Mirror of 1.29.3.
- `1.34.1` / `1.34.2` (p109–110) — the insulin recommendations that *do* carry discriminators
  (nocturnal hypoglycaemia, post-prandial rise → analogue preparations), unlike 1.35.1/1.35.2.
- `1.38.1` (p116) — the diagnostic entry point for gastroparesis.
- `1.31` (p104) — frailty again, under Further medication.

## Provenance and data repairs

Extraction delegated to DeepSeek Harness (`deepseek/deepseek-v4-flash` via openrouter,
40 min, 696k in / 74k out). Verified independently; term counts match the PDF exactly and no
content was lost. **Five defects found past its self-report and repaired:**

1. **18 hyphenation joins** (`insulinbased`, `underprescribed`, `metaanalysis`, `longterm`,
   `nonarteritic`, `costeffective` …) — it self-reported 2. Repaired from the PDF's own
   line-break inventory.
2. **12 of 142 recommendations truncated** at page boundaries, losing their tails and year
   tags (`1.13.2`, `1.25.1`, `1.27.2`, `1.28.1`, `1.29.4`, `1.34.1` and others). Recovered
   from the furniture-stripped PDF text.
3. **21 of 142 carried the wrong section label** — the next heading instead of the current one.
   Rebuilt from the TOC; section count corrected 41 → 44.
4. **19 second-level bullets** left as a raw full-width character instead of nested Markdown.
5. **`m 2` → `m²`** normalised, 24 instances (the PDF breaks the superscript onto its own line;
   no `²` character exists in the source).

Its one self-declared FAIL was an error in the brief, not in its work: the brief guessed ≥150
recommendations; NG28 has 142, and it reported the real number.

**Date provenance.** The cover states *Published 2 December 2015, last updated 18 February
2026*. The change log on p131 records a later change: *"September 2026: We have amended the
descriptions of the estimated glomerular filtration rate (eGFR) ranges in recommendations
1.18.1 and 1.18.2 to clarify when each of these recommendations would apply."* The PDF
therefore carries an amendment newer than its own stated last-updated date, and it lands on the
two recommendations underpinning case 2.
