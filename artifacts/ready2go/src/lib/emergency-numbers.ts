export interface EmergencyNumbers {
  country: string;
  flag: string;
  police: string;
  ambulance: string;
  fire: string;
  general?: string;
  embassyNote?: string;
}

export const EMERGENCY_DB: Record<string, EmergencyNumbers> = {
  france: { country: "France", flag: "🇫🇷", police: "17", ambulance: "15 (SAMU)", fire: "18", general: "112" },
  espagne: { country: "Espagne", flag: "🇪🇸", police: "091", ambulance: "061", fire: "080", general: "112" },
  spain: { country: "Espagne", flag: "🇪🇸", police: "091", ambulance: "061", fire: "080", general: "112" },
  barcelona: { country: "Espagne", flag: "🇪🇸", police: "091", ambulance: "061", fire: "080", general: "112" },
  madrid: { country: "Espagne", flag: "🇪🇸", police: "091", ambulance: "061", fire: "080", general: "112" },
  italie: { country: "Italie", flag: "🇮🇹", police: "113", ambulance: "118", fire: "115", general: "112" },
  italy: { country: "Italie", flag: "🇮🇹", police: "113", ambulance: "118", fire: "115", general: "112" },
  rome: { country: "Italie", flag: "🇮🇹", police: "113", ambulance: "118", fire: "115", general: "112" },
  portugal: { country: "Portugal", flag: "🇵🇹", police: "112", ambulance: "112", fire: "112", general: "112" },
  lisbonne: { country: "Portugal", flag: "🇵🇹", police: "112", ambulance: "112", fire: "112", general: "112" },
  allemagne: { country: "Allemagne", flag: "🇩🇪", police: "110", ambulance: "112", fire: "112", general: "112" },
  germany: { country: "Allemagne", flag: "🇩🇪", police: "110", ambulance: "112", fire: "112", general: "112" },
  berlin: { country: "Allemagne", flag: "🇩🇪", police: "110", ambulance: "112", fire: "112", general: "112" },
  royaume_uni: { country: "Royaume-Uni", flag: "🇬🇧", police: "999", ambulance: "999", fire: "999", general: "112" },
  london: { country: "Royaume-Uni", flag: "🇬🇧", police: "999", ambulance: "999", fire: "999", general: "112" },
  londres: { country: "Royaume-Uni", flag: "🇬🇧", police: "999", ambulance: "999", fire: "999", general: "112" },
  etats_unis: { country: "États-Unis", flag: "🇺🇸", police: "911", ambulance: "911", fire: "911", general: "911" },
  usa: { country: "États-Unis", flag: "🇺🇸", police: "911", ambulance: "911", fire: "911", general: "911" },
  new_york: { country: "États-Unis", flag: "🇺🇸", police: "911", ambulance: "911", fire: "911", general: "911" },
  japon: { country: "Japon", flag: "🇯🇵", police: "110", ambulance: "119", fire: "119", general: "110 / 119" },
  japan: { country: "Japon", flag: "🇯🇵", police: "110", ambulance: "119", fire: "119", general: "110 / 119" },
  tokyo: { country: "Japon", flag: "🇯🇵", police: "110", ambulance: "119", fire: "119", general: "110 / 119" },
  maroc: { country: "Maroc", flag: "🇲🇦", police: "19", ambulance: "15", fire: "15", general: "19" },
  marrakech: { country: "Maroc", flag: "🇲🇦", police: "19", ambulance: "15", fire: "15", general: "19" },
  tunisie: { country: "Tunisie", flag: "🇹🇳", police: "197", ambulance: "190", fire: "198", general: "190" },
  grece: { country: "Grèce", flag: "🇬🇷", police: "100", ambulance: "166", fire: "199", general: "112" },
  greece: { country: "Grèce", flag: "🇬🇷", police: "100", ambulance: "166", fire: "199", general: "112" },
  athenes: { country: "Grèce", flag: "🇬🇷", police: "100", ambulance: "166", fire: "199", general: "112" },
  suisse: { country: "Suisse", flag: "🇨🇭", police: "117", ambulance: "144", fire: "118", general: "112" },
  geneve: { country: "Suisse", flag: "🇨🇭", police: "117", ambulance: "144", fire: "118", general: "112" },
  belgique: { country: "Belgique", flag: "🇧🇪", police: "101", ambulance: "100", fire: "100", general: "112" },
  bruxelles: { country: "Belgique", flag: "🇧🇪", police: "101", ambulance: "100", fire: "100", general: "112" },
  pays_bas: { country: "Pays-Bas", flag: "🇳🇱", police: "112", ambulance: "112", fire: "112", general: "112" },
  amsterdam: { country: "Pays-Bas", flag: "🇳🇱", police: "112", ambulance: "112", fire: "112", general: "112" },
  canada: { country: "Canada", flag: "🇨🇦", police: "911", ambulance: "911", fire: "911", general: "911" },
  montreal: { country: "Canada", flag: "🇨🇦", police: "911", ambulance: "911", fire: "911", general: "911" },
  bresil: { country: "Brésil", flag: "🇧🇷", police: "190", ambulance: "192 (SAMU)", fire: "193", general: "190" },
  rio: { country: "Brésil", flag: "🇧🇷", police: "190", ambulance: "192 (SAMU)", fire: "193", general: "190" },
  thaïlande: { country: "Thaïlande", flag: "🇹🇭", police: "191", ambulance: "1669", fire: "199", general: "191" },
  thailand: { country: "Thaïlande", flag: "🇹🇭", police: "191", ambulance: "1669", fire: "199", general: "191" },
  bangkok: { country: "Thaïlande", flag: "🇹🇭", police: "191", ambulance: "1669", fire: "199", general: "191" },
  mexique: { country: "Mexique", flag: "🇲🇽", police: "911", ambulance: "911", fire: "911", general: "911" },
  mexico: { country: "Mexique", flag: "🇲🇽", police: "911", ambulance: "911", fire: "911", general: "911" },
  australie: { country: "Australie", flag: "🇦🇺", police: "000", ambulance: "000", fire: "000", general: "000" },
  sydney: { country: "Australie", flag: "🇦🇺", police: "000", ambulance: "000", fire: "000", general: "000" },
  senegal: { country: "Sénégal", flag: "🇸🇳", police: "17", ambulance: "15", fire: "18", general: "17" },
  dakar: { country: "Sénégal", flag: "🇸🇳", police: "17", ambulance: "15", fire: "18", general: "17" },
  algerie: { country: "Algérie", flag: "🇩🇿", police: "1548", ambulance: "14", fire: "14", general: "1548" },
  alger: { country: "Algérie", flag: "🇩🇿", police: "1548", ambulance: "14", fire: "14", general: "1548" },
  dubai: { country: "Émirats Arabes Unis", flag: "🇦🇪", police: "999", ambulance: "998", fire: "997", general: "999" },
  abu_dhabi: { country: "Émirats Arabes Unis", flag: "🇦🇪", police: "999", ambulance: "998", fire: "997", general: "999" },
  inde: { country: "Inde", flag: "🇮🇳", police: "100", ambulance: "108", fire: "101", general: "112" },
  india: { country: "Inde", flag: "🇮🇳", police: "100", ambulance: "108", fire: "101", general: "112" },
};

const DEFAULT: EmergencyNumbers = {
  country: "International",
  flag: "🌍",
  police: "112",
  ambulance: "112",
  fire: "112",
  general: "112",
};

export function detectCountry(destination: string): EmergencyNumbers {
  const normalized = destination
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  for (const [key, val] of Object.entries(EMERGENCY_DB)) {
    const normKey = key.replace(/_/g, " ");
    if (normalized.includes(normKey) || normKey.includes(normalized.split(" ")[0])) {
      return val;
    }
  }

  return DEFAULT;
}

export const LANGUAGE_MAP: Record<string, { lang: string; name: string; flag: string }> = {
  france: { lang: "fr", name: "Français", flag: "🇫🇷" },
  espagne: { lang: "es", name: "Espagnol", flag: "🇪🇸" },
  spain: { lang: "es", name: "Espagnol", flag: "🇪🇸" },
  barcelona: { lang: "es", name: "Espagnol", flag: "🇪🇸" },
  italie: { lang: "it", name: "Italien", flag: "🇮🇹" },
  italy: { lang: "it", name: "Italien", flag: "🇮🇹" },
  rome: { lang: "it", name: "Italien", flag: "🇮🇹" },
  portugal: { lang: "pt", name: "Portugais", flag: "🇵🇹" },
  lisbonne: { lang: "pt", name: "Portugais", flag: "🇵🇹" },
  allemagne: { lang: "de", name: "Allemand", flag: "🇩🇪" },
  germany: { lang: "de", name: "Allemand", flag: "🇩🇪" },
  berlin: { lang: "de", name: "Allemand", flag: "🇩🇪" },
  londres: { lang: "en", name: "Anglais", flag: "🇬🇧" },
  london: { lang: "en", name: "Anglais", flag: "🇬🇧" },
  etats_unis: { lang: "en", name: "Anglais", flag: "🇺🇸" },
  usa: { lang: "en", name: "Anglais", flag: "🇺🇸" },
  new_york: { lang: "en", name: "Anglais", flag: "🇺🇸" },
  japon: { lang: "ja", name: "Japonais", flag: "🇯🇵" },
  japan: { lang: "ja", name: "Japonais", flag: "🇯🇵" },
  tokyo: { lang: "ja", name: "Japonais", flag: "🇯🇵" },
  maroc: { lang: "ar", name: "Arabe", flag: "🇲🇦" },
  marrakech: { lang: "ar", name: "Arabe", flag: "🇲🇦" },
  tunisie: { lang: "ar", name: "Arabe", flag: "🇹🇳" },
  grece: { lang: "el", name: "Grec", flag: "🇬🇷" },
  greece: { lang: "el", name: "Grec", flag: "🇬🇷" },
  athenes: { lang: "el", name: "Grec", flag: "🇬🇷" },
  suisse: { lang: "de", name: "Allemand/Français", flag: "🇨🇭" },
  belgique: { lang: "fr", name: "Français", flag: "🇧🇪" },
  pays_bas: { lang: "nl", name: "Néerlandais", flag: "🇳🇱" },
  amsterdam: { lang: "nl", name: "Néerlandais", flag: "🇳🇱" },
  canada: { lang: "en", name: "Anglais", flag: "🇨🇦" },
  montreal: { lang: "fr", name: "Français", flag: "🇨🇦" },
  bresil: { lang: "pt", name: "Portugais", flag: "🇧🇷" },
  thaïlande: { lang: "th", name: "Thaï", flag: "🇹🇭" },
  thailand: { lang: "th", name: "Thaï", flag: "🇹🇭" },
  bangkok: { lang: "th", name: "Thaï", flag: "🇹🇭" },
  mexique: { lang: "es", name: "Espagnol", flag: "🇲🇽" },
  australie: { lang: "en", name: "Anglais", flag: "🇦🇺" },
  dubai: { lang: "ar", name: "Arabe", flag: "🇦🇪" },
  inde: { lang: "hi", name: "Hindi", flag: "🇮🇳" },
  senegal: { lang: "fr", name: "Français", flag: "🇸🇳" },
  algerie: { lang: "ar", name: "Arabe", flag: "🇩🇿" },
};

export function detectLanguage(destination: string): { lang: string; name: string; flag: string } {
  const normalized = destination
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  for (const [key, val] of Object.entries(LANGUAGE_MAP)) {
    const normKey = key.replace(/_/g, " ");
    if (normalized.includes(normKey) || normKey.includes(normalized.split(" ")[0])) {
      return val;
    }
  }

  return { lang: "en", name: "Anglais", flag: "🌍" };
}
