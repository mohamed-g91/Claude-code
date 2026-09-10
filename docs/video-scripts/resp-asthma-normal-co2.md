# Video script — a normal CO2 in acute asthma

The case: `resp_asthma_normal_co2`, the one the landing page's demo card and the
share clip already show. About 85 seconds, spoken in Arabic, with burned-in
English subtitles.

Showing a case solved spoils it, and this one is already spent by the card and
the clip — so the video costs no case a reader is pointed at. **The next video
takes its case from the mixed deck and never from a published batch.** The same
rule as the demo card.

## Before you record

**Serve the site locally.** The mixed deck is not published: `play.html` and
`src/cases.json` are deliberately withheld from the built site, so this case
cannot be reached on the live URL at all.

```
npm run serve
```

Then open `http://127.0.0.1:8000/play.html` and go to case 2 (Respiratory).

**Open it in a private window.** The deck restores its place and its marks from
`localStorage`. If you have used the site, the case may already be solved and
the stem will be pre-marked before you say a word.

**The setup we agreed on:**

| | |
|---|---|
| frame | vertical 9:16 — a YouTube Short takes up to 3 minutes, and the same file posts to Telegram and WhatsApp status without a re-cut |
| screen | the browser in a phone-width window on a laptop, not a tablet — this is a decision about the microphone, not the picture |
| audio | a wired earphone mic beats any built-in one; people forgive a soft picture and quit on bad sound |
| subtitles | burned-in English, taken from the EN lines below — because the script is written first, nothing has to be transcribed afterwards |

**Do not narrate the interface.** Tap, then talk over a still screen. Ninety
seconds of watching someone use a website is slow; ninety seconds of a
consultant explaining why a normal CO2 is frightening is not.

## How to read this

Six beats. Each carries what is on screen, the Arabic to say, and the English
subtitle for that line. **The timings are the plan, not a stopwatch** — the
beats matter, the seconds do not.

Terms written in Latin script stay in Latin script when you say them: *peak
flow*, *acute severe*, *PaCO2*, *ITU*. That is how the exam writes them and how
a ward round says them. Numbers stay numbers: 24, 40%, 94%, 5.4.

The Arabic below is written to be read aloud rather than read. Softening it
towards your own dialect is fine — keep the beats, the terms and the numbers,
because the subtitles are timed to those.

It runs to about 90 seconds at a normal teaching pace. If a take comes out long,
the *near-fatal* line at the end of beat 5 is the one to lose: it is the only
sentence in the script that is not carrying the argument.

---

## 1 · 0:00–0:07 — the hook

**On screen:** the unmarked stem. Nothing tapped yet, no movement.

> **AR** — في هذه الحالة، الرقم الذي يبدو طبيعيًا هو أخطر ما في السؤال.

**EN** — In this case, the number that looks normal is the most dangerous thing in it.

## 2 · 0:07–0:20 — the case

**On screen:** still the unmarked stem.

> **AR** — سيدة عمرها 24 سنة، معروفة بالربو، تشكو من صفير وضيق في التنفس منذ
> الصباح. أي معلومة هنا هي التي تُغيّر ما ستفعله الآن؟

**EN** — A 24-year-old woman with known asthma, wheezy and breathless since this morning.
**EN** — Which finding changes what you do next?

## 3 · 0:20–0:40 — the two real severity markers

**On screen:** tap *"She cannot complete a sentence in one breath"* → amber.
Then tap *"Peak flow is 40% of her predicted best"* → amber. Talk over the
second feedback panel.

> **AR** — معلومتان واضحتان: لا تستطيع إكمال جملة في نفس واحد، والـ peak flow
> عندها 40% من المتوقع. كلتاهما من معايير الـ acute severe asthma — الـ peak
> flow بين 33 و 50%. علامتان حقيقيتان، لكن العلاج معهما يبقى دوائيًا داخل
> القسم.

**EN** — Two clear findings: she cannot complete a sentence in one breath, and her peak flow is 40% of predicted.
**EN** — Both are acute severe asthma criteria — peak flow between 33 and 50%.
**EN** — Real severity markers. But with both, treatment stays medical, on the ward.

## 4 · 0:40–0:52 — the trap

**On screen:** tap *"Oxygen saturation is 94% on room air"* → red. Talk over
the feedback.

> **AR** — ثم يأتي الـ oxygen saturation: 94% على هواء الغرفة — رقم يبدو
> مطمئنًا. لكن في الربو الحاد يبقى التشبع محفوظًا حتى مرحلة متأخرة جدًا؛
> المشكلة في التهوية، لا في الأكسجة. رقم مقبول لا يخبرك بمقدار المجهود الذي
> تبذله.

**EN** — Then the saturation: 94% — on room air. A number that looks completely reassuring.
**EN** — But in acute asthma the saturation is preserved until very late. The problem is ventilation, not oxygenation.
**EN** — An acceptable number tells you nothing about how hard she is working.

## 5 · 0:52–1:14 — the pivot

**On screen:** tap *"Arterial blood gas shows a PaCO2 of 5.4 kPa"* → green, and
the resolution opens. Scroll just far enough that the four marks and the
explanation are on screen together.

> **AR** — والآن الـ arterial blood gas: الـ PaCO2 يساوي 5.4 — رقم طبيعي
> تمامًا. وهنا الخطر. هي تتنفس بسرعة وبمجهود، فالمفروض أن يكون الـ CO2
> منخفضًا. عودته إلى الطبيعي تعني أنها أُنهكت ولم تعد تُحرّك هواءً
> كافيًا لطرحه. هذا وحده ينقلها من acute severe إلى life-threatening asthma:
> تحويل فوري إلى الـ ITU مع احتمال التنفس الصناعي. ولو كان مرتفعًا، فهذه
> near-fatal asthma.

**EN** — Now the arterial blood gas: a PaCO2 of 5.4 — completely normal. That is the danger.
**EN** — She is breathing fast and hard, so the CO2 should be low.
**EN** — Back to normal means she is tiring, and no longer moving enough air to blow it off.
**EN** — That alone moves her from acute severe to life-threatening asthma: immediate ITU referral, possible ventilation.
**EN** — A raised PaCO2 would be near-fatal asthma.

## 6 · 1:14–1:25 — the lesson, and where to go

**On screen:** rest on the solved case — four marks on the stem and the
explanation below them.

> **AR** — والقاعدة أوسع من هذه الحالة: في مريض يبذل مجهودًا كبيرًا في التنفس،
> الـ CO2 الطبيعي ليس اطمئنانًا — إنه علامة إنهاك. بنك الحالات مجاني، والرابط
> في الوصف.

**EN** — The lesson generalises: in a patient working hard to breathe, a normal CO2 is not reassurance — it is a sign of exhaustion.
**EN** — The full case bank is free. Link in the description.

---

## After you record

The subtitles are the EN lines above, in order — the timings only need nudging
to your actual delivery, not writing from scratch.

The link back to the site goes under the demo card on both landing pages,
labelled for what it is: *Arabic, English subtitles*. An unlabelled link to a
video in a language the reader does not speak is a worse experience than no
link.
