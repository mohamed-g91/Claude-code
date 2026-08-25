// 24x24 stroke icons, one per topic. currentColor so each inherits its card accent.
//
// Topics arrive from Notion, so an exact-string map would silently render a blank
// square for anything not literally in this file. Lookup is therefore: exact key,
// then keyword match, then a generic fallback that always draws something.
const ICONS = {
  "Heart failure": '<path d="M12 20.6C6 16.6 3.2 13.2 3.2 9.8A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 8.8 2.4c0 3.4-2.8 6.8-8.8 10.8Z"/><path d="M4.6 12.4h3.1l1.4-3 2 6 1.5-3.4h6.8"/>',
  "Pre-eclampsia": '<path d="M3.6 17.4a9 9 0 1 1 16.8 0"/><path d="M12 17.4 16 11.6"/><circle cx="12" cy="17.4" r="1.5"/>',
  "Hyperlipidaemia": '<path d="M12 3.2S5.4 10.9 5.4 14.8a6.6 6.6 0 0 0 13.2 0C18.6 10.9 12 3.2 12 3.2Z"/><path d="M9.2 14.9a2.9 2.9 0 0 0 2.9 2.9"/>',
  "Atrial fibrillation": '<path d="M1.8 12h2.6l1.3-4.2 1.9 8.6 1.5-6.4 1.3 3.4h2l1.5-5.2 1.8 7.6 1.2-3.8h3.3"/>',
  "Aortic stenosis": '<circle cx="12" cy="12" r="8.4"/><path d="M12 12V3.6M12 12 4.7 16.2M12 12l7.3 4.2"/>',
  "Torsades de pointes": '<path d="M13.4 2.4 5.6 13.9h5.5L9.9 21.6l8.4-11.9h-5.6l.7-7.3Z"/>',
  // Generic shapes reused by the keyword table below.
  "Heart": '<path d="M12 20.6C6 16.6 3.2 13.2 3.2 9.8A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 8.8 2.4c0 3.4-2.8 6.8-8.8 10.8Z"/>',
  "Vessel": '<path d="M6.4 3.2v7.2a5.6 5.6 0 0 0 11.2 0V3.2"/><path d="M4 20.8h16"/><circle cx="6.4" cy="3.2" r="1.4"/><circle cx="17.6" cy="3.2" r="1.4"/>',
  "Pressure": '<circle cx="12" cy="13.4" r="7.2"/><path d="M12 13.4 15.6 9.4"/><path d="M12 6.2V3.2"/>',
  "Pill": '<rect x="3.2" y="9.2" width="17.6" height="5.6" rx="2.8" transform="rotate(-45 12 12)"/><path d="M8.4 8.4 15.6 15.6"/>',
  "Lung": '<path d="M12 3.4v8.2"/><path d="M12 11.6 8.6 9.2C6.4 7.6 4 9 4 11.6v4.6c0 2.4 2 4.2 4.2 3.6 1.4-.4 2.2-1.6 2.2-3.1v-5.1Z"/><path d="M12 11.6l3.4-2.4c2.2-1.6 4.6-.2 4.6 2.4v4.6c0 2.4-2 4.2-4.2 3.6-1.4-.4-2.2-1.6-2.2-3.1v-5.1Z"/>',
  "Kidney": '<path d="M14.6 3.4c-3.4 0-6.2 3.8-6.2 8.6s2.8 8.6 6.2 8.6c3 0 5-2.6 5-5.4 0-2-1.4-2.6-1.4-3.2s1.4-1.2 1.4-3.2c0-2.8-2-5.4-5-5.4Z"/><path d="M14.4 12h-3.2"/>',
  "Lab": '<path d="M9.4 3.2v6.1L4.9 17a2.4 2.4 0 0 0 2.1 3.6h10a2.4 2.4 0 0 0 2.1-3.6l-4.5-7.7V3.2"/><path d="M8.2 3.2h7.6"/><path d="M7.2 14.4h9.6"/>',
  "Warning": '<path d="M12 3.4 21 19.4H3L12 3.4Z"/><path d="M12 9.6v4.4"/><circle cx="12" cy="17" r="1"/>',
  "Pulse": '<circle cx="12" cy="12" r="8.8"/><path d="M6.6 12h2l1.3-3.2 2.1 6.4 1.4-3.2h2"/>',
};

// Keyword table: first match wins, so put the specific before the general.
// Matching is on a lower-cased topic, substring, accent-insensitive.
const ICON_KEYWORDS = [
  [["torsade", "long qt", "qtc", "vt", "ventricular tachycardia", "arrhythm"], "Torsades de pointes"],
  [["atrial fibrillation", "af ", "flutter", "svt", "palpitation"], "Atrial fibrillation"],
  [["heart failure", "hfref", "hfpef", "cardiomyopath", "bnp"], "Heart failure"],
  [["aortic", "mitral", "tricuspid", "pulmonary stenosis", "valv", "regurgitat", "endocarditis"], "Aortic stenosis"],
  [["lipid", "cholesterol", "statin", "ldl", "triglycerid"], "Hyperlipidaemia"],
  [["eclampsia", "pregnan", "obstetric", "postpartum"], "Pre-eclampsia"],
  [["hypertens", "blood pressure", "bp ", "shock", "hypotens"], "Pressure"],
  [["infarct", "acs", "angina", "ischaem", "ischem", "coronary", "stemi", "nstemi", "troponin"], "Heart"],
  [["embol", "dvt", "thrombo", "anticoagul", "warfarin", "doac", "bleed", "aneurysm", "dissection", "vascul", "periph"], "Vessel"],
  [["pulmonary", "respirat", "asthma", "copd", "pneumon"], "Lung"],
  [["renal", "kidney", "aki", "ckd", "dialysis", "nephro"], "Kidney"],
  [["electrolyte", "sodium", "potassium", "kalaem", "kalem", "natraem", "natrem", "magnes",
   "calcium", "calcaem", "glucose", "glycaem", "glycem", "diabet", "thyroid", "anaemia", "anemia"], "Lab"],
  [["overdose", "toxic", "poison", "arrest", "resuscitat", "sepsis", "emergenc"], "Warning"],
  [["drug", "dose", "dosing", "therap", "treatment", "prescrib"], "Pill"],
];

const ICON_FALLBACK = "Pulse";

function ICON_FOR(topic) {
  if (ICONS[topic]) return ICONS[topic];
  const t = String(topic || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // ischaemi/ischémi both match
    + " ";                                              // lets "af " match a trailing "AF"
  for (const [words, key] of ICON_KEYWORDS)
    if (words.some(w => t.includes(w))) return ICONS[key];
  return ICONS[ICON_FALLBACK];
}

const ICON_WRAP = (topic) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round">${ICON_FOR(topic)}</svg>`;
