# IHD — topic-first pass

Run of the [fact-screening rubric](../fact-screening-rubric.md) against
ischaemic heart disease. Source: 60 IHD-relevant question blocks (topics
`Angina pectoris: drug management`, `Myocardial infarction: complications`,
`Myocardial infarction: STEMI management`, `Chest pain: assessment of
patients with suspected`, `ECG: coronary territories`, `Acute coronary
syndrome: initial management`, `Percutaneous coronary intervention`,
`Cardiac enzymes and protein markers`, `Myocardial infarction: secondary
prevention`, `Coronary circulation`, `Thrombolysis`, `Syndrome X`,
`Nicorandil`, `ECG: ST elevation`, `ECG: ST depression`) filtered out of a
674-question combined PassMedicine cardiology bank. Facts below are
concepts/associations pulled from the answers and explanations, not
verbatim question text.

## Step 1–2: enumerate and classify

### Diagnosis / ECG pattern recognition

| fact | bucket | why |
|---|---|---|
| Deep, symmetrical T-wave inversion in V2–3 in a pain-free patient after recent unstable angina (Wellens' syndrome) signals critical proximal LAD stenosis | **Pivot-worthy** | Normal troponin, no current pain — everything *else* looks reassuring. Missing the ECG pattern, or worse, sending the patient for exercise testing, can precipitate a large anterior MI |
| Provocative testing (exercise ECG, stress imaging) is contraindicated once Wellens' pattern is recognised | Contributory | Same decision as above; folded into the Wellens' case as the trap rather than a standalone fact |
| Chest pain at rest with transient ST elevation that fully resolves, and a coronary angiogram taken during symptoms shows no significant stenosis (Prinzmetal's / variant angina) | **Pivot-worthy** | Flips the drug plan: CCB first-line, beta-blockers avoided (can worsen vasospasm) — the opposite of ordinary stable angina |
| ST depression on exercise testing with normal coronary arteries at angiography (cardiac syndrome X / microvascular angina) | **Pivot-worthy** | No stenosis to stent — management is medical, not revascularisation. Genuinely changes the pathway, not just the label |
| ST depression in V1–3 that is reciprocal to a true posterior infarct — a STEMI-equivalent, not "just ischaemia" | **Pivot-worthy** | Easy to under-triage as NSTEMI/ischaemia when it is actually an emergency reperfusion case |
| Diffuse, concave ("saddle-shaped") ST elevation with PR depression, sparing aVR/V1, no reciprocal ST depression = pericarditis, not MI | Contributory | A genuine, well-known differentiator, but it duplicates ground already covered structurally by other topics rather than being IHD-specific; logged, not built into a case this pass |
| ST elevation in aVR predicts left main / proximal LAD disease | Contributory | Diagnostically important but usually accompanies other widespread changes rather than standing alone as the single decisive clause |
| Widespread ST elevation across I, aVL, V1–6 = left main occlusion | Noise | Dramatic, but the action is unchanged — still emergency PCI, same as any STEMI |
| Territory-to-artery correlation (inferior=RCA, anterior=LAD, lateral=LCx, mixed=left main) | Reject — not actually decisive anywhere | Heavily tested anatomy, but it doesn't itself branch the management; the branch point is "this is a STEMI," which the ECG has already told you before the territory is worked out |

### Post-MI complications (timeline-dependent)

| fact | bucket | why |
|---|---|---|
| New pansystolic murmur loudest at the apex, days (1–7) after MI, with acute pulmonary oedema and hypotension = papillary muscle rupture / acute severe MR | **Pivot-worthy** | Reroutes from standard heart-failure therapy to emergency surgical referral; the murmur is the finding that tells you which emergency you're in |
| Persistent ST elevation with Q waves, weeks post-STEMI, painless and afebrile = LV aneurysm | **Pivot-worthy** | The *absence* of pain/fever is what discriminates it from Dressler's and from reinfarction — same "negative finding as pivot" shape as the RV-infarct case already in the game |
| Dressler's syndrome (2–5 weeks post-MI): fever, pleuritic pain, widespread saddle ST elevation | Contributory | The alternate diagnosis inside the LV-aneurysm differential, not built as its own case this pass — high overlap risk |
| AV block complicating inferior MI (RCA supplies AV nodal artery in ~90%) | Reject — no clean single differentiator beyond what's covered | The repo's existing `cardio_complete_heart_block` case already trains "adverse features, not the rhythm, decide urgency"; the MI-specific mechanism doesn't add a new branch point |
| VF is the most common cause of death post-MI | Reject — not actually decisive anywhere | True, but any VT/VF arrest gets the same ALS algorithm regardless of cause; doesn't change what you do |
| Stent thrombosis (~2 weeks post-PCI, often after early DAPT discontinuation): pain matching the patient's usual angina but refractory to GTN | **Pivot-worthy** | The nitrate-refractoriness is what reclassifies apparently-routine recurrent angina as a re-occlusion emergency |
| Failed thrombolysis (e.g. <50–70% ST resolution at 60–90 min) needs rescue PCI, not a repeat ECG later | **Pivot-worthy** | A single number on a repeat ECG flips the pathway from "wait" to "urgent rescue PCI" |
| Recent major surgery (within days) is a relative contraindication to thrombolysis (bleeding risk), favouring primary PCI | **Pivot-worthy** | Same shape as the existing RV-infarct/aortic-dissection cases — one line of history reroutes the reperfusion strategy |
| CK-MB normalises by day 3–4 post-MI; troponin stays elevated up to 2 weeks — so a raised CK-MB days later indicates reinfarction where troponin can't distinguish it | **Pivot-worthy** | Genuine lab-choice differentiator: picking the right marker changes whether you call it reinfarction |
| Myoglobin rises earliest post-MI but is non-specific | Reject — not actually decisive anywhere | Not used to trigger any specific action in current practice |
| Reduced LVEF / new systolic heart failure is the strongest predictor of post-STEMI mortality | Reject — not actually decisive anywhere | Prognostic, not something that changes today's action |

### Drug management

| fact | bucket | why |
|---|---|---|
| Verapamil (or diltiazem) must not be combined with a beta-blocker — risk of complete heart block | **Pivot-worthy**, logged for a future pass | Decisive and dangerous, but this pass already has an existing complete-heart-block case in the bank and four strong diagnostic pivots — held back to avoid the batch reading as "drug safety" rather than "diagnostic reasoning" |
| Nicorandil causes GI ulceration anywhere from mouth to anus, sometimes refractory, requiring permanent discontinuation once recognised | **Pivot-worthy**, logged for a future pass | Same shape as the existing lithium-toxicity case (a drug history explains an otherwise-inexplicable new problem) — good candidate for the next batch |
| First-line stable angina therapy is beta-blocker or CCB depending on comorbidity (e.g. avoid beta-blocker in asthma) | Reject — no clean single differentiator | Standard-of-care sequencing, not a single decisive finding |
| Third-line add-ons (long-acting nitrate, ivabradine, nicorandil, ranolazine) are chosen individually, not stacked | Reject — no clean single differentiator | Protocol sequencing |
| Nitrate tolerance is managed with an asymmetric, nitrate-free dosing interval | Reject — too obscure/not decisive | Prescribing nuance, not a diagnosis/management-branch fact |
| GRACE score determines IV glycoprotein IIb/IIIa use and angiography timing in NSTEMI | Reject — no clean single differentiator | Risk-scoring protocol, not one isolatable clinical finding |
| Metformin caution in acute tissue ischaemia (lactic acidosis risk) | Reject for this topic | True, but it's a diabetes-medication-safety fact riding along an ACS stem — belongs to an endocrine/pharm pass, not this one |

## Step 3: candidate case groupings written up this pass

Four groupings came out Pivot-worthy, non-overlapping with the three
existing Cardiology cases (`cardio_rv_infarct`, `cardio_aortic_dissection`,
`cardio_complete_heart_block`), and strong enough to write:

1. **Wellens' syndrome** — pain-free patient, recent unstable angina, deep
   symmetrical T-wave inversion V2–3 → urgent angiography, not a stress test.
2. **Stent thrombosis** — ~2 weeks post-PCI, usual-feeling angina refractory
   to GTN → emergency reintervention, not reassurance.
3. **Papillary muscle rupture** — days post-MI, new apical pansystolic
   murmur with acute pulmonary oedema → emergency surgical referral, not
   standard heart-failure therapy.
4. **Prinzmetal's (variant) angina** — rest pain, transient ST elevation,
   normal angiogram during symptoms → CCB first-line, beta-blockers avoided.

Two more Pivot-worthy facts (verapamil+beta-blocker, nicorandil ulceration)
are logged above rather than written up, to keep this batch's four cases
reading as diagnostic-reasoning pivots rather than drifting into a
drug-safety theme — good seeds for the next IHD pass or a
Clinical-Pharmacology one.

## Step 4

Original prose for the four groupings above has been written into
`src/cases.json` as `cardio_wellens_syndrome`, `cardio_stent_thrombosis`,
`cardio_papillary_muscle_rupture` and `cardio_prinzmetal_angina`, per the
repo's existing rule against lifting stems from commercial banks.
