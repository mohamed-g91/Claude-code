# Asthma diagnosis — NG245 screening pass

A prerequisite to writing asthma diagnosis cases. Source: **[NICE NG245,
_Asthma: diagnosis, monitoring and chronic asthma management (BTS, NICE,
SIGN)_](https://www.nice.org.uk/guidance/ng245), 27 November 2024** — the full
guideline PDF, read directly. Recommendation numbers below are NG245's own.

This guideline replaces NG80 for diagnosis. It does **not** cover acute asthma
attacks — see [the acute pass](acute-asthma-bts-sign-158.md) for that, and for
why citing NG245 on an acute question would name a document that does not
contain the recommendation.

## Part 1 — the adult pathway, verbatim

An **ordered** sequence, which is what makes it good pivot material: each step
is only reached because the one before it did not confirm.

| step | rec | test | diagnose asthma if |
|---|---|---|---|
| 1 | 1.2.1 | blood eosinophil count **or** FeNO | eosinophil count **above the laboratory reference range**, or FeNO **≥50 ppb** |
| 2 | 1.2.2 | bronchodilator reversibility on spirometry | FEV₁ increase **≥12% *and* ≥200 ml** from pre-bronchodilator — **or** FEV₁ increase **≥10% of predicted normal FEV₁** |
| 3 | 1.2.3 | PEF twice daily for 2 weeks (if spirometry unavailable or delayed) | PEF variability (amplitude percentage mean) **≥20%** |
| 4 | 1.2.4 | bronchial challenge, by referral, if still suspected clinically | bronchial hyper-responsiveness present |

**Children aged 5 to 16 are a different pathway** (1.2.5–1.2.9): FeNO **≥35 ppb**
first, and their BDR threshold is **≥12% from baseline with no volume
requirement**. The 200 ml is adults only. This deck is adult medicine, so the
paediatric thresholds are here to be avoided, not used.

## Part 2 — the interpretive rules that do the real work

These are where a candidate goes wrong, and each is a recommendation in its own
right rather than a threshold.

- **1.1.2 — Do not confirm asthma without a suggestive clinical history *and* a supporting objective test.** Code as **suspected asthma** until confirmed.
- **1.1.4 — A normal examination does not exclude asthma.**
- **1.1.7 — Spirometry and FeNO results may be affected by inhaled corticosteroids: "the test results are more likely to be normal".** A normal test in someone already on an ICS is close to uninformative.
- **1.1.5 / 1.1.6 — Treat first if acutely unwell**, and do the objective tests once acute symptoms are controlled.
- **1.4.1 — In adult-onset asthma, poorly controlled established asthma, or reappearance of childhood asthma, check for an occupational component**: are symptoms better on days away from work, on holiday, at weekends, between shifts? **1.4.2 — refer suspected occupational asthma to an occupational asthma specialist.**
- **1.5.3 — Do not use regular PEF monitoring to assess asthma control** unless there are person-specific reasons.

### The committee's own reasoning, which resolutions should borrow

Recorded verbatim because it explains the pathway rather than asserting it, and
a resolution that can say *why* beats one that recites a number:

> "no test showed high enough values of both sensitivity and specificity to be
> diagnostic in all cases. However, some of them showed high specificity and
> were potentially useful as **rule-in** tests with a suitably high cut-off
> value."

And on FeNO specifically:

> "because FeNO is the first, and possibly the only, test in the recommended
> sequences in both adults and children they agreed that the value should be
> reasonably high so that it would be **specific, acknowledging that this
> sacrifices a degree of sensitivity**."

**This is the single most useful fact in the document.** The first-line tests
are rule-*in* tests with deliberately high cut-offs. A FeNO below 50 does not
exclude asthma — it means the algorithm continues. A candidate who reads a
negative first-line test as a negative diagnosis has misunderstood the design of
the pathway, not just missed a number.

On the eosinophil count, the committee deliberately declined to give a figure:
"normal ranges for blood tests may vary slightly between laboratories… a raised
measurement should be regarded as one above the upper end of the **local
reference range**". A stem must therefore say *above the laboratory reference
range*, never invent a cut-off.

## Part 3 — the four buckets

Per [the rubric](../fact-screening-rubric.md). Pivot-worthy only if a candidate
who did not know it would take a different action.

| fact | bucket | the action it changes |
|---|---|---|
| Adult BDR of ≥12% but **under 200 ml**, read as diagnostic | **Pivot** | Diagnose → do not diagnose; continue the pathway. Adults need both, children need neither |
| Normal FeNO or spirometry in someone **already on an ICS**, read as excluding asthma | **Pivot** | Exclude → the test is uninformative here; continue |
| FeNO below 50 read as **excluding** asthma | **Pivot** | Stop → continue to BDR. These are rule-in tests |
| Asthma **coded as confirmed on history alone** | **Pivot** | Confirm → code as suspected and test |
| Adult-onset asthma, symptoms better away from work | **Pivot** | Escalate inhalers → refer to an occupational asthma specialist |
| Regular PEF monitoring used to assess control | **Pivot** | Continue → stop; not recommended without a person-specific reason |
| Suggestive history: wheeze, nocturnal or seasonal variation, triggers | Contributory | Gets you into the pathway; never confirms |
| Personal or family history of atopy or allergic rhinitis | Contributory | Raises suspicion, confirms nothing |
| Expiratory polyphonic wheeze on examination | Contributory | Supports, does not confirm |
| A normal physical examination | Noise | Explicitly does not exclude (1.1.4) |
| Age, sex | Noise | Not in the pathway |
| **Choosing** eosinophils vs FeNO at step 1 | **Reject** | The guideline permits either — no single right answer, so no clean pivot |
| Paediatric thresholds (FeNO 35, IgE/skin prick route) | **Reject** | Not adult medicine; would teach the wrong number to this audience |
| Bronchial challenge method and its cut-off | **Reject** | "the definition of bronchial hyperresponsiveness will be dependent on the method used" — no single value to test |

## Part 4 — candidate cases

One pivot each. All three model a wrong step already in motion, per the rubric.

1. **The 200 ml.** Adult, suggestive history, FeNO not diagnostic, spirometry
   showing an FEV₁ rise of 12% but under 200 ml, and asthma about to be
   confirmed on it. The pivot is the volume. It is a single number, it is
   adult-specific, and the same figures in a 12-year-old would be diagnostic —
   which is exactly the shape of twist this deck exists for. The stem must give
   predicted FEV₁ so the 10%-of-predicted alternative can be seen to fail too.
2. **The steroid already started.** Adult with a suggestive history who was
   started on an ICS empirically weeks ago, now with a normal FeNO, and the
   plan is to stop treatment and call it not-asthma. The pivot is the ICS in the
   drug history, not the FeNO.
3. **The Monday cough.** Adult-onset asthma, poorly controlled on escalating
   inhaled therapy, symptoms better at weekends and clear on a two-week
   holiday. The pivot is the pattern away from work; the action is referral to
   an occupational asthma specialist rather than another step up.

Cases 1 and 2 both turn on a test result being over-read, which is the
guideline's own stated worry. If only two are wanted, take 1 and 3 — they
change different kinds of action, a diagnosis and a referral.
