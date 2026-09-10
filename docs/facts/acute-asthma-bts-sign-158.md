# Acute asthma in adults — BTS/SIGN 158 screening pass

A prerequisite to writing acute asthma cases, and a debt being paid: the deck
already carried an acute asthma case with **no facts file behind it**, and it
shipped two clinical errors in a row — a peak flow of 32% under a clause
claiming it was acute severe, and a saturation "on high-flow oxygen" that
invited the reader to reason backwards to hypoxia. Both were caught by the
author's eye, not by any process. This file is the process.

Source: **BTS/SIGN 158, British guideline on the management of asthma, Quick
Reference Guide (2019)** — the adult acute asthma pages. Read directly, not
summarised from elsewhere.

## Which guideline to cite

This matters more than usual here, because the obvious citation is the wrong
one. The 2024 **BTS/NICE/SIGN joint guideline (NICE NG245)** covers diagnosis,
monitoring and *chronic* management and **explicitly does not cover acute
asthma attacks**; acute sits in the separate asthma pathway (NG244 / SIGN 244),
which carries the BTS/SIGN acute algorithms forward.

So an acute asthma resolution citing "NICE NG245" is citing a document that
does not contain the recommendation. **Cite BTS/SIGN for acute asthma.** Before
attributing a specific acute threshold to NICE, confirm it against NG244 —
this file is verified against the 2019 BTS/SIGN QRG only.

## Part 1 — severity, verbatim

The four bands, adults. Thresholds are quoted, not paraphrased.

| band | criteria |
|---|---|
| **Moderate** | increasing symptoms; PEF **>50–75%** best or predicted; no features of acute severe asthma |
| **Acute severe** | **any one of**: PEF **33–50%** best or predicted; respiratory rate **≥25/min**; heart rate **≥110/min**; inability to complete sentences in one breath |
| **Life-threatening** | **in a patient with severe asthma**, any one of: PEF **<33%**; SpO₂ **<92%**; PaO₂ **<8 kPa**; **'normal' PaCO₂ (4.6–6.0 kPa)**; altered conscious level; exhaustion; arrhythmia; hypotension; cyanosis; silent chest; poor respiratory effort |
| **Near-fatal** | **raised PaCO₂** and/or requiring mechanical ventilation with raised inflation pressures |

Two things in that table are load-bearing and easy to get wrong.

**Life-threatening is defined *on top of* severe.** The guideline says "in a
patient with severe asthma any one of". A normal PaCO₂ is not a
life-threatening feature in someone who was never severe — it is a normal
blood gas. This is exactly why a case turning on the CO₂ must first establish
acute severe features, and why the peak flow in such a case has to sit inside
33–50% rather than below 33%: at 32% the peak flow is *itself*
life-threatening, and the case has two escalating findings instead of one.

**The bands are "any one of".** One criterion is enough. A stem carrying three
acute severe features has not made the patient more severe than a stem
carrying one — it has just made the classification harder to miss.

## Part 2 — assessment, admission, treatment

**Assessment**
- Oxygen therapy aims to maintain **SpO₂ 94–98%**.
- **ABG required** if SpO₂ **<92%** *or* other features of life-threatening asthma.
- **CXR is not routine.** Indicated only for: suspected pneumomediastinum or pneumothorax; suspected consolidation; life-threatening asthma; failure to respond to treatment satisfactorily; requirement for ventilation.
- Clinical features (breathlessness, tachypnoea, tachycardia, silent chest, cyanosis, collapse) — "none of these singly or together is specific and their absence does not exclude a severe attack".

**Admission**
- Admit any feature of a **life-threatening or near-fatal** attack. *(B)*
- Admit any feature of a **severe** attack **persisting after initial treatment**. *(B)*
- PEF **>75%** best or predicted **one hour after initial treatment** may be discharged from ED, unless other reasons make admission appropriate. *(C)*

**Treatment**
- **Oxygen:** controlled supplementary oxygen to all hypoxaemic patients with acute severe asthma, titrated to SpO₂ 94–98%. Do not delay it for want of an oximeter. *(C)*
- **β₂ agonist:** high-dose inhaled, first line, as early as possible. IV reserved for patients in whom inhaled therapy cannot be used reliably. *(A)* For acute severe or life-threatening features the **oxygen-driven nebulised route** is recommended. Poor response to an initial bolus → consider continuous nebulisation. *(A)*
- **Ipratropium bromide:** nebulised **0.5 mg 4–6 hourly**, added for acute severe or life-threatening asthma, or poor initial response to β₂ agonist. *(B)*
- **Steroids:** to all patients with an acute attack *(A)*; **prednisolone 40–50 mg daily until recovery, minimum 5 days**.
- **Magnesium — the trap.** **Nebulised magnesium sulphate is *not* recommended for adults with acute asthma** *(A)*. A **single dose of IV** magnesium sulphate may be considered for acute severe asthma (**PEF <50%**) with no good initial response to inhaled bronchodilators *(B)* — **1.2–2 g IV over 20 minutes**, and only after consultation with senior medical staff.
- **Antibiotics:** routine prescription **not indicated**. *(B)*

**Referral to intensive care** — refer any patient requiring ventilatory
support, or with acute severe or life-threatening asthma failing to respond,
evidenced by: deteriorating PEF; persisting or worsening hypoxia;
hypercapnia; ABG showing falling pH or rising H⁺; exhaustion or feeble
respiration; drowsiness, confusion, altered conscious state; respiratory
arrest.

**Follow-up** — primary care informed within 24 hours of discharge;
near-fatal attack under specialist supervision **indefinitely**; admission
with a severe attack followed by a respiratory specialist for **at least one
year**.

**Pregnancy**
- Give drug therapy for acute asthma **as for non-pregnant patients**, including systemic steroids and magnesium sulphate. *(C)*
- **Steroid tablets should never be withheld because of pregnancy.**
- High-flow oxygen immediately, saturation **94–98%**. *(D)*
- Acute severe asthma in pregnancy is an emergency; continuous fetal monitoring; early referral to critical care.

## Part 3 — the four buckets

Run per [the rubric](../fact-screening-rubric.md). A fact reaches
**Pivot-worthy** only if a candidate who did not know it would take a
different action.

| fact | bucket | the action it changes |
|---|---|---|
| 'Normal' PaCO₂ in a patient with acute severe features | **Pivot** | Ward therapy → ICU referral. Reclassifies to life-threatening |
| Nebulised magnesium ordered for an adult | **Pivot** | Wrong route, Grade A against. IV is the route with a role, and only for PEF <50% with poor initial response |
| Prednisolone withheld because the patient is pregnant | **Pivot** | Withhold → give. The guideline says never withhold |
| A severe feature still present after initial treatment, with discharge planned | **Pivot** | Discharge → admit |
| Silent chest | **Pivot** | Reassure → escalate. Inverts the reflex that less wheeze means improvement |
| Routine antibiotics started for an asthma attack | **Pivot** | Prescribe → do not. Not indicated without a separate indication |
| SpO₂ <92% | **Pivot** | Triggers ABG that would not otherwise be done |
| PEF 33–50% | Contributory | Establishes acute severe; managed medically on the ward |
| RR ≥25/min | Contributory | Same band, same management |
| HR ≥110/min | Contributory | Same band, same management |
| Inability to complete sentences in one breath | Contributory | Same band, same management |
| Known asthma, atopy, age | Noise | Says which illness, not how severe this episode is |
| Wheeze itself | Noise | Present across every band |
| "Which life-threatening feature is worst" | **Reject** | The list is "any one of" — no single differentiator, so a case built on it has several defensible pivots |
| Continuous nebulisation for poor response | **Reject** | A titration of the same treatment, not a branch point |

## Part 4 — candidate cases

One pivot each, with contributory clauses drawn from the pool above.

1. **`resp_asthma_normal_co2` — keep as it stands.** This pass verifies it
   rather than changing it: acute severe established by two contributory
   features, a saturation above the 92% threshold on room air, and the normal
   PaCO₂ as the single escalating finding. The plan — ICU referral — is what
   the guideline's referral list gives.
2. **Nebulised magnesium.** Acute severe attack, poor response to initial
   nebulised salbutamol and ipratropium, and nebulised magnesium being added.
   The pivot is the route, and the case teaches that IV is the form with
   evidence behind it.
3. **Steroids withheld in pregnancy.** Acute severe attack in a pregnant
   woman with prednisolone deliberately held back. The pivot is the reason
   given for withholding.
4. **Discharge with a severe feature persisting.** One hour after initial
   treatment a severe criterion is still met and discharge is being arranged.
   The pivot is the persisting feature.

Cases 2–4 model the wrong management step already in motion, which the rubric
asks for where a concrete wrong action exists. Prose is still written from
scratch per the repo's rule — this file decides which facts and what role,
never the wording.
