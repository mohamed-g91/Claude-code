# Explanation style

The house rules for everything the candidate reads *after* they tap: the
per-clause feedback, and the resolution that opens once the case is solved.

[stem-style.md](stem-style.md) governs the half of a case the candidate reads
before answering. This governs the half they read after. That half had no rules
until batch 02 shipped, and it showed: resolutions reached 243 words, roughly
double batch 01, and candidates from both batches said the same two things —
too hard to follow, and too pleased with itself.

## The shape

A resolution is three parts, and `src/game.js` renders each one differently so
they read as three beats rather than a paragraph:

1. **One sentence stating the rule.** What the guideline actually says. Where
   there is a safe alternative, it belongs in this sentence — a candidate who
   learns only that the plan is wrong has learnt half of what they came for.
2. **Two to four bullets** breaking the rule into parts that can be checked one
   at a time. A bullet may carry `"state": "met"` or `"state": "failed"`, which
   renders as a chip, for the case type this was built for: a guideline
   condition list where the reader has to hold three conditions at once to see
   which one fails.
3. **One closing paragraph** carrying what the clause feedback could not.

```json
"resolution": {
  "lead": "…the rule, in one sentence…",
  "points": [
    { "text": "…", "state": "met" },
    { "text": "…", "state": "failed" },
    "…a bullet with no met/failed axis is a plain string…"
  ],
  "trap": "…the tempting finding, and why it loses…"
}
```

`lead`, `points` and `trap` are field names in the data. **They are never shown
to the candidate** — no heading, no label, nothing that makes the panel look
like a form. The reader sees a sentence, a list, and a paragraph.

The schema permits chipped and plain bullets in one list, but **do not mix them
within a case**. A list where some bullets carry a met/not-met chip and others
do not reads as though the unchipped ones failed to be assessed. A case is a
condition checklist or it is not.

A resolution may still be a plain string. The mixed deck is written that way and
renders as it always did.

## Budgets

Warnings from `npm run validate`, not gates — a genuinely tangled case is
allowed to need the words, and an author who goes over should have to weigh it
rather than be blocked.

| part | budget |
|---|---|
| the rule sentence | 45 words |
| each bullet | 25 words |
| the closing paragraph | 55 words |
| the whole resolution | 130 words |
| a clause's feedback | 25 words |

For scale: the case that drew the complaint ran to 243 words.

## Rules

1. **Plain words for everything except the medicine.** Keep the clinical terms
   exact — `HbA1c`, `dihydropyridine`, `eGFR`, `complete heart block`. Simplify
   the English around them, never the medicine.

2. **No metaphors for the verdict.** Banned outright: *right thread*, *right
   line*, *the stream she is in*, *the real pull*, *reverses your reflexes*,
   *the tempting one*, *repays reading as a pair*, *worth naming*, *does real
   work by exclusion*. Every one of these was in shipped copy, and each one asks
   the reader to decode a figure of speech to reach a fact.

   What is banned is the construction, not the vocabulary. *Stream* is the
   working term in `docs/facts/` for NG28's comorbidity groups, so *"puts him
   in the obesity stream"* is the plainest available phrasing and stays; *"the
   stream she is in"*, standing in for a verdict, does not.

3. **The tag already gave the verdict.** The coloured chip above the feedback
   says `Pivot`, `Contributory` or `Not decisive` before the candidate reads a
   word. Opening with "Right thread." or "The tempting one." says it a second
   time in code. Use the sentence for the fact instead.

4. **Numbers are numerals.** `46`, `3 months`, `4 kg`. Not *forty-six*, not
   *three months*. The candidate is scanning for the number.

5. **Formal, not chatty.** *"if her HbA1c is not controlled"*, never *"if her
   diabetes needs it too"*. The register is a consultant explaining on a ward
   round: direct, unhurried, and not casual.

6. **A contributory clause must say what is still missing.** Otherwise the
   candidate knows they were close and has no idea where to look next. Say it
   plainly — *"That is one of three conditions met — two left to check"* — and
   without naming the pivot.

7. **A noise clause says why it does not matter**, and stops. *"Her age does
   not affect this decision."*

   One sentence where the finding is inert. Two where it is a real finding that
   simply does not bear on *this* decision — it gets its credit first, then the
   reason it changes nothing: *"Smoking and family history raise the chance of
   coronary disease, but they add nothing in a man whose disease is already
   known."* Refusing the credit reads as a scolding, and the candidate was not
   wrong to notice.

8. **The plan clause is not a finding.** Where the stem ends on an inherited
   plan, its feedback says so: *"This is the plan you are being asked to judge,
   not a finding about the patient."*

9. **Name the guideline where it carries weight, not everywhere.** `NG28`,
   `NICE`, `ESC 2024` belong in the rule sentence. Repeating the name in every
   bullet turns the panel into a citation list; second references become "the
   guideline".

   Not a hard count. Where the guideline is the actor in a second sentence —
   *"NG28 sends prescribing aimed primarily at weight out to its obesity
   guideline"* — naming it again is what makes the sentence true, and the
   worked example below does exactly that.

   Clause feedback is read on its own, hours or days from the rest, so it may
   name a guideline where the fact does not stand up without one — and should
   leave it out where the fact stands alone: *"A normal resting ECG does not
   exclude angina"* needs no citation.

10. **The closing paragraph must not recap the clauses.** Every finding in the
    stem already has feedback, delivered at the moment the candidate tapped it.
    Saying it again after they have solved the case adds nothing and costs them
    the attention the paragraph actually needs.

    So it is not a summary. It carries what no clause feedback could: the wrong
    turn that is *not in the stem*. Ivabradine, in the verapamil case — nobody
    tapped it, nothing warned them, and it is the next thing a candidate reaches
    for once they know a beta-blocker is out. That is the paragraph's job.

    The test: delete the closing paragraph. If nothing is lost that the clause
    feedback did not already say, it was a recap and should not have been
    written.

11. **No new clinical claims when rewriting.** Every fact in a revised
    resolution must already be in the resolution it replaces or in
    `docs/facts/`. Those facts were checked against the guidelines before they
    shipped; a rewrite is a compression job, not a fresh authoring pass.

## Worked example

`endo_t2dm_glycaemic_target_met`, 243 words before, 102 after.

> NG28 only considers a GLP-1 receptor agonist or tirzepatide for obesity if
> all three of these hold at once:
>
> - **met** — At least 3 months on initial therapy. She is two years in.
> - **not met** — Further medicine needed to reach her glycaemic target. Her
>   HbA1c is 46, and target is 48.
> - **met** — Not already taking one of these drugs.
>
> NG28 sends prescribing aimed primarily at weight out to its obesity
> guideline — it is not a diabetes indication. The 4 kg gain is worth
> addressing, but not with this drug.

And its clause feedback, before and after:

| before | after |
|---|---|
| "Right thread. Two years is well past the three months NG28 asks for before this class of drug is considered, so nothing about the timing stands in the way. That is one condition met, and there are three." | "Two years on treatment is well over the 3 months NG28 asks for. That is one of three conditions met — two left to check." |
| "The tempting one. Obesity is the stream she is in, and four kilograms gained is what a drug like this looks built to answer…" | "Her weight is the strongest reason to want this drug. But NG28 only allows it here if her HbA1c is not controlled." |
| "Right line, and it is the strongest single reason to leave things alone. Forty-six is inside the target NG28 supports for a regimen not associated with hypoglycaemia…" | "46 is below the 48 target for a regimen that does not cause hypoglycaemia. She does not need another drug." |

## A case with no checklist

`pharm_verapamil_betablocker`, 163 words before, 121 after. Not every case is a
guideline condition list, so the bullets here are plain strings and carry no
chips. The plain risk leads each one and the mechanism follows the dash — the
candidate should not have to translate *negative dromotropy* to find out what
happens to the patient.

> A calcium channel blocker can only be combined with a beta-blocker if it is a
> dihydropyridine such as amlodipine — so either switch verapamil to
> amlodipine, or add a long-acting nitrate or nicorandil instead. Adding
> bisoprolol to verapamil increases the risk of:
>
> - Profound bradycardia — both drugs slow the heart rate
> - Complete heart block — both slow conduction through the AV node
> - Decompensated heart failure — both reduce the force of contraction
>
> He is already on verapamil, a non-dihydropyridine, and adding a beta-blocker
> to it is contraindicated because of the risk of complete heart block.
> Ivabradine is not an alternative either — it is also contraindicated with
> verapamil.

An earlier draft of that last paragraph opened by observing that his normal
pulse, normal blood pressure and normal ejection fraction all look like room to
add a beta-blocker. Every one of those findings is a clause with its own
feedback saying exactly that, so the sentence was cut under rule 10 — it spent
the paragraph on what the candidate had already been told, and left no room for
the ivabradine trap, which nothing else in the case could warn them about.

## The test

Read the resolution out loud at the speed a candidate reads it — once, without
going back. If you have to re-read a sentence to hold the argument together, it
is still doing the writer's thinking on the page instead of the reader's.
