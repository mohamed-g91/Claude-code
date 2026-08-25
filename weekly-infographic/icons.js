// 24x24 stroke icons, one per topic. currentColor so each inherits its card accent.
const ICONS = {
  "Heart failure": '<path d="M12 20.6C6 16.6 3.2 13.2 3.2 9.8A4.6 4.6 0 0 1 12 7.4a4.6 4.6 0 0 1 8.8 2.4c0 3.4-2.8 6.8-8.8 10.8Z"/><path d="M4.6 12.4h3.1l1.4-3 2 6 1.5-3.4h6.8"/>',
  "Pre-eclampsia": '<path d="M3.6 17.4a9 9 0 1 1 16.8 0"/><path d="M12 17.4 16 11.6"/><circle cx="12" cy="17.4" r="1.5"/>',
  "Hyperlipidaemia": '<path d="M12 3.2S5.4 10.9 5.4 14.8a6.6 6.6 0 0 0 13.2 0C18.6 10.9 12 3.2 12 3.2Z"/><path d="M9.2 14.9a2.9 2.9 0 0 0 2.9 2.9"/>',
  "Atrial fibrillation": '<path d="M1.8 12h2.6l1.3-4.2 1.9 8.6 1.5-6.4 1.3 3.4h2l1.5-5.2 1.8 7.6 1.2-3.8h3.3"/>',
  "Aortic stenosis": '<circle cx="12" cy="12" r="8.4"/><path d="M12 12V3.6M12 12 4.7 16.2M12 12l7.3 4.2"/>',
  "Torsades de pointes": '<path d="M13.4 2.4 5.6 13.9h5.5L9.9 21.6l8.4-11.9h-5.6l.7-7.3Z"/>',
};
const ICON_WRAP = (topic) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round">${ICONS[topic] || ''}</svg>`;
