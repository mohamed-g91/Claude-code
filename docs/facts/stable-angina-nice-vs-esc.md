# Stable angina — NICE vs ESC concordance pass

A prerequisite to writing stable-angina cases. Every candidate pivot is
checked against **both** [NICE CG95 (2016 update)](https://www.nice.org.uk/guidance/cg95/chapter/recommendations)
/ [CG126](https://www.nice.org.uk/guidance/cg126/chapter/Recommendations) and the
[ESC 2024 chronic coronary syndromes guideline](https://academic.oup.com/eurheartj/article/45/36/3415/7743115)
before it is allowed to become a `pivot` clause.

## Why this pass exists

A pivot is *a finding that changes the investigation or management decision*.
If the decision it changes depends on which guideline the reader learned, the
finding is not a pivot — it is a jurisdiction question wearing a pivot's
clothes. Candidates read both bodies. A case whose answer flips between them
teaches allegiance, not reasoning.

So this pass sorts stable-angina facts on a second axis, applied **before**
the four buckets in [the rubric](../fact-screening-rubric.md):

| axis | meaning | may become a `pivot`? |
|---|---|---|
| **Concordant** | NICE and ESC drive the same next action | Yes |
| **Divergent** | the two guidelines give different next actions | No — `contributory`/`noise` only, or the stem must name its frame |

## Part 1 — the two pathways side by side

### Assessment and diagnosis

| Step | NICE CG95 (2016 update) | ESC 2024 CCS |
|---|---|---|
| Symptom classification | Three features (constricting chest/neck/jaw/arm discomfort; precipitated by exertion; relieved by rest or GTN in ~5 min) → typical (3), atypical (2), non-anginal (0–1) | Same three features, but they feed a continuous model rather than driving the pathway by category |
| Pre-test probability | **Abolished in the 2016 update.** No PTP table, no risk-factor weighting, no age/sex weighting | **Central.** Risk factor-weighted clinical likelihood (RF-CL): age, sex, symptom type + five risk factors (family history, smoking, dyslipidaemia, hypertension, diabetes) |
| Defer testing entirely | Not a concept in the pathway | **Explicit.** Clinical likelihood ≤5% → defer testing. Reclassifies roughly half of chest-pain presentations into that band |
| Coronary artery calcium score | No role | CACS considered in **low** RF-CL to reclassify to very low if 0 (or 1–9 in selected cases) — Class IIa |
| First-line test | **CTCA (64-slice or above) for nearly everyone**: typical or atypical angina, or non-anginal pain with ST-T changes or pathological Q waves on resting ECG | Test chosen **by likelihood**: CCTA for low–moderate (5–50%), functional imaging for moderate–high; both Class I |
| Second-line | Functional imaging when CTCA shows CAD of uncertain functional significance, or is non-diagnostic | Same principle; ICA with FFR where anatomy warrants |
| Third-line | Invasive coronary angiography when functional imaging is inconclusive | ICA reached earlier where likelihood is high with refractory symptoms or high-risk features |
| Exercise ECG | **"Do not use to diagnose or exclude stable angina in people without known CAD."** An option in people with known CAD | **Class IIb** for diagnosis where imaging is available — discouraged, not prohibited. Retained for symptoms, exercise tolerance, arrhythmia and risk |
| FFR-CT | [MTG32](https://www.nice.org.uk/guidance/mtg32/chapter/2-The-technology) supports HeartFlow FFR<sub>CT</sub> for stenoses of uncertain functional significance | Supported within the anatomical strategy |
| ANOCA / INOCA | Not addressed in CG95 | **Class I B** invasive coronary function testing for persistent angina with non-obstructive arteries, and to confirm/exclude ANOCA where non-invasive testing is uncertain; acetylcholine provocation for suspected vasospasm |
| Exacerbating conditions | Arrange blood tests for conditions that exacerbate angina, anaemia among them | Baseline FBC/Hb in all |
| Significant stenosis | ≥70% diameter stenosis in a major epicardial segment, or ≥50% in left main (defined for **invasive** angiography) | Same thresholds; FFR ≤0.80 / iFR ≤0.89 for physiological significance |

### Management

| | NICE CG126 | ESC 2024 CCS |
|---|---|---|
| First-line antianginal | Beta-blocker **or** CCB, chosen on comorbidity, contraindication and preference | **The first/second-line hierarchy is removed.** Choice driven by haemodynamic profile (heart rate, BP, LV function), comorbidity, co-medication and ischaemia mechanism |
| Combination | BB + **dihydropyridine** CCB (never verapamil/diltiazem) | BB + DHP CCB when monotherapy is insufficient |
| Both intolerated or contraindicated | Monotherapy with long-acting nitrate, ivabradine, nicorandil or ranolazine | Same agents, positioned as interchangeable rather than a ranked third line |
| Third drug | Only when two are insufficient **and** the person is awaiting revascularisation or it is unsuitable. Explicitly do **not** add a third to someone controlled on two | Similar restraint, less prescriptive |
| Antiplatelet | Aspirin 75 mg considered, weighing bleeding risk and comorbidity | Aspirin 75–100 mg **or clopidogrel 75 mg as an equivalent alternative (Class I A)** after prior MI/PCI |
| Lipid target | [NG238](https://www.nice.org.uk/guidance/ng238/chapter/Recommendations): LDL-C ≤2.0 mmol/L or non-HDL ≤2.6 mmol/L | LDL-C **<1.4 mmol/L and ≥50% reduction** from baseline (Class I A) |
| ACE inhibitor | Consider in stable angina with type 2 diabetes | Broader: HF/LV dysfunction, diabetes, hypertension, CKD |
| Beta-blocker late post-MI, preserved EF | Not addressed | Indication for long-term (>1 year) use reassessed post-REDUCE-AMI; the firm indication remains LVEF ≤40% |

## Part 2 — Concordant. Safe to build pivots on.

These change the decision identically under both guidelines, because they turn
on pharmacology, physiology or a shared numeric definition rather than on
pathway policy.

| Pivot fact | Decision it changes | Category |
|---|---|---|
| Adenosine/dipyridamole contraindicated in asthma and high-grade AV block (and caffeine/theophylline within 24 h) | Stress agent switches to dobutamine, or the modality changes | comorbidity → contraindication |
| Inability to exercise | Pharmacological stress instead of treadmill; dobutamine for stress echo and MR wall motion, vasodilator for perfusion imaging | comorbidity → test choice |
| Verapamil or diltiazem alongside a beta-blocker | Do not combine — risk of complete heart block; DHP CCB instead | drug–drug |
| Rest pain with transient ST elevation, unobstructed arteries (vasospastic) | CCB first, beta-blocker actively harmful | significant clinical data → drug reversal |
| Ivabradine in atrial fibrillation | No benefit — the mechanism requires sinus rhythm | comorbidity → drug futility |
| Severe anaemia with exertional angina | Correct supply before escalating antianginals; do not reflex-start aspirin before the bleeding source is known; compensatory tachycardia makes rate-limiting therapy a caution | significant clinical data |
| Crescendo, rest, or newly accelerating symptoms | Leaves the stable pathway entirely for same-day acute assessment | significant clinical data → pathway exit |
| Already controlled on two antianginals | Do not add a third | significant clinical data → restraint |
| ≥70% epicardial / ≥50% left main; FFR ≤0.80 | Anatomical/physiological significance thresholds | shared numeric definition |
| Persistent angina with non-obstructive arteries | Not "non-cardiac" — secondary prevention continues and coronary function testing is the next step | significant clinical data |

## Part 3 — Divergent. Not pivot material.

| Question | NICE | ESC | Consequence |
|---|---|---|---|
| Do risk factors or age change which test? | No — removed in 2016 | Yes, centrally (RF-CL) | Any stem where "young, no risk factors" is meant to be decisive flips between guidelines |
| Is anyone left untested? | No deferral threshold | ≤5% likelihood → defer | "Should we investigate at all?" has two answers |
| Which test first? | CTCA almost always | CCTA or functional, by likelihood band | The strength of "CTCA is first-line" is NICE-specific |
| Exercise ECG in CAD-naive patients | Prohibited — "do not use" | Class IIb — discouraged, not forbidden | An ESC-trained candidate says "poor test", not "must not". A case marked on the prohibition marks jurisdiction |
| Calcium score | No role | Class IIa in low likelihood | — |
| Which antiplatelet? | Aspirin | Clopidogrel equivalent, Class I A | — |
| LDL target | ≤2.0 mmol/L (NG238) | <1.4 mmol/L | Never build a numeric lipid-target pivot |
| Aspirin while awaiting diagnosis | "Consider aspirin only if the chest pain is likely to be stable angina, until a diagnosis is made" | Not framed this way | NICE-specific |

## Part 4 — Note on age cutoffs

Age cutoffs are one of the three pivot shapes worth hunting in general, but
**stable angina is the wrong topic for them.** NICE deleted age from the
pathway in 2016; ESC uses it as a continuous input to RF-CL, not a threshold.
There is no age at which the stable-angina decision flips under both
guidelines. Age-cutoff pivots belong to other cardiology topics, not this one.
