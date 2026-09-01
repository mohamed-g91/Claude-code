# Fact-screening rubric

A gate for candidate facts, applied **before** any case gets written.

Every case here needs exactly one `pivot` clause — the finding that commits
you to a different action — surrounded by clauses that are true but not
decisive (`contributory`, `noise`). Today that split happens inside a case
someone already sat down to write. This rubric moves the split earlier: sort
what a topic tests *first*, then only write a case once a fact has proven
itself decisive.

## Why sort before writing

Not everything a qbank tests is a good fit for this game. A fact can be
correct, high-yield, and still fail here because nothing about the decisive
version of it isolates cleanly into one clause. Screening topic-first, before
prose gets written, avoids two failure modes: building a case around a fact
that turns out not to be decisive, and discovering only at validation time
(`npm run validate`) that a case has no clean single pivot.

## The four buckets

| bucket | test | example |
|---|---|---|
| **Pivot-worthy** | If a candidate didn't know this, would they do something clinically different — a different drug, a different imaging study, admit vs. discharge, a different diagnosis entirely? | Pain radiating to the back with a pulse deficit between arms → dissection, not ACS: different imaging, no thrombolysis |
| **Contributory** | Correct, on-topic, raises or lowers suspicion — but doesn't by itself commit you to a different action | Troponin rise 3–6h post-onset confirms MI but the ECG already drove triage |
| **Noise** | True, commonly mentioned, doesn't move management | Age >65, male — a risk factor, not a decider |
| **Reject** | Doesn't belong in this game at all (see below) | — |

Pivot-worthy facts are usually specific rather than merely sensitive — the
kind of single twist an exam-writer drops into a stem. "If a candidate didn't
know this one fact, would they act differently?" is the whole test; if the
answer is no, it isn't a pivot, whatever else it is.

### Reject: three ways a fact fails to fit

- **Not actually decisive anywhere.** It's always paired with other findings
  in real presentations — no clean scenario exists where it alone flips the
  answer.
- **No clean single differentiator.** The decisive version of this fact
  requires weighing several things at once, so it can't be isolated into one
  clause without the case ending up with two defensible pivots or none. This
  is the same failure the validator already catches at the case level (zero
  or two-plus `pivot` clauses) — Reject is where it gets caught earlier,
  before a case is written around it.
- **Too obscure or vendor-specific.** Some bank likes asking it, but it isn't
  accepted core teaching (Davidson's/guideline level). Using it would teach a
  trivia reflex, not a real differentiator.

A rejected fact isn't wasted — it's just not going to become a `pivot`
clause. It may still resurface later as a `contributory` or `noise` clause
in a case built around something else from the same topic.

## Topic-first workflow

Worked using IHD (ischemic heart disease) as the running example — nothing
here is a committed case, this is the sorting pass that happens before
writing starts.

1. **Enumerate.** List the concepts the topic tests — symptoms, signs, labs,
   imaging, ECG patterns, management branch points — independent of any one
   question's wording.
2. **Classify.** Run each concept through the four buckets above.
3. **Group into candidate cases.** A case needs exactly one Pivot-worthy fact
   plus one or more Contributory clauses (and optionally Noise) that
   plausibly co-occur in a single presentation. Facts that never come out
   Pivot-worthy but keep recurring are still logged — they're candidate
   Contributory/Noise clauses for whichever case ends up using them.
4. **Write original prose.** Once a grouping exists, the case is still
   hand-written from scratch, per the repo's existing rule: no lifting stems
   from PassMedicine, Pastest or any other commercial bank. The rubric only
   decides *which facts* and *what role* — never the wording.

## Intake: where candidate facts come from

The rubric operates on **facts and associations**, never on verbatim exam
text — consistent with the repo's existing copyright rule. The concrete
source can be any of:

- **Raw qbank PDF.** Run the `mrcp-qbank-to-curriculum` skill's
  extract → validate → curriculum-match stages first to get structured,
  topic-tagged question blocks, then pull the underlying clinical facts out
  of the answer/commentary fields (not the stem) as candidate concepts for
  Step 1.
- **Already-extracted/matched data** (e.g. a prior `matched.json`). Skip
  straight to Step 1, using the topic's matched blocks as the concept
  source.
- **General clinical knowledge**, with no qbank file at all. Step 1's
  enumeration is done directly from standard teaching (Davidson's/guideline
  level) — an acceptable input on its own.

## Illustrative example (IHD) — not a committed case list

| fact | bucket | why |
|---|---|---|
| Pain radiating to the back, pulse deficit between arms | Pivot-worthy | Points to dissection over ACS: different imaging, thrombolysis contraindicated |
| Troponin rise 3–6h post-onset | Contributory | Confirms MI but doesn't change the ECG-driven immediate triage |
| Age >65, male | Noise | Risk factor already priced into the presentation, not decisive |
| A rarely-tested ECG nuance with no clean isolated scenario | Reject | No single presentation where it alone is decisive — no clean differentiator |

This table is illustrative only. Turning it into a real case still means
enumerating IHD properly (step 1), running the actual candidate list through
this rubric, and then writing original prose per the repo's existing rule.
