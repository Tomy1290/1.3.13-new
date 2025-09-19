export function safeDateLabel(date: Date, lang: 'de'|'en'|'pl'): string {
  try {
    const locale = lang === 'en' ? 'en-GB' : (lang === 'pl' ? 'pl-PL' : 'de-DE');
    return date.toLocaleDateString(locale as any, { weekday: 'short', day: '2-digit', month: '2-digit' } as any);
  } catch {
    const wd = date.getDay();
    const weekdaysDe = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdaysPl = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
    const w = lang === 'en' ? weekdaysEn : (lang === 'pl' ? weekdaysPl : weekdaysDe);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${w[wd]} ${dd}.${mm}`;
  }
}

export function safeTimeHM(input: number | Date, lang: 'de'|'en'|'pl'): string {
  try {
    const d = input instanceof Date ? input : new Date(input);
    const locale = lang === 'en' ? 'en-GB' : (lang === 'pl' ? 'pl-PL' : 'de-DE');
    return d.toLocaleTimeString(locale as any, { hour: '2-digit', minute: '2-digit' } as any);
  } catch {
    const d = input instanceof Date ? input : new Date(input);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}