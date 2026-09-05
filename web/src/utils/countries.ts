export interface Country {
  code: string;
  name: string;
  nameEn: string;
  dialCode: string;
  flag: string;
}

export const ALL_COUNTRIES: Country[] = [
  { code: "CM", name: "Cameroun",        nameEn: "Cameroon",          dialCode: "+237", flag: "🇨🇲" },
  { code: "CI", name: "Côte d'Ivoire",   nameEn: "Ivory Coast",       dialCode: "+225", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal",         nameEn: "Senegal",           dialCode: "+221", flag: "🇸🇳" },
  { code: "CD", name: "Congo (RDC)",     nameEn: "Congo (DRC)",       dialCode: "+243", flag: "🇨🇩" },
  { code: "CG", name: "Congo",           nameEn: "Congo",             dialCode: "+242", flag: "🇨🇬" },
  { code: "GA", name: "Gabon",           nameEn: "Gabon",             dialCode: "+241", flag: "🇬🇦" },
  { code: "TD", name: "Tchad",           nameEn: "Chad",              dialCode: "+235", flag: "🇹🇩" },
  { code: "CF", name: "Centrafrique",    nameEn: "Central Africa",    dialCode: "+236", flag: "🇨🇫" },
  { code: "GQ", name: "Guinée équat.",   nameEn: "Equatorial Guinea", dialCode: "+240", flag: "🇬🇶" },
  { code: "BJ", name: "Bénin",           nameEn: "Benin",             dialCode: "+229", flag: "🇧🇯" },
  { code: "BF", name: "Burkina Faso",    nameEn: "Burkina Faso",      dialCode: "+226", flag: "🇧🇫" },
  { code: "ML", name: "Mali",            nameEn: "Mali",              dialCode: "+223", flag: "🇲🇱" },
  { code: "NE", name: "Niger",           nameEn: "Niger",             dialCode: "+227", flag: "🇳🇪" },
  { code: "TG", name: "Togo",            nameEn: "Togo",              dialCode: "+228", flag: "🇹🇬" },
  { code: "GN", name: "Guinée",          nameEn: "Guinea",            dialCode: "+224", flag: "🇬🇳" },
  { code: "NG", name: "Nigeria",         nameEn: "Nigeria",           dialCode: "+234", flag: "🇳🇬" },
  { code: "GH", name: "Ghana",           nameEn: "Ghana",             dialCode: "+233", flag: "🇬🇭" },
  { code: "FR", name: "France",          nameEn: "France",            dialCode: "+33",  flag: "🇫🇷" },
  { code: "BE", name: "Belgique",        nameEn: "Belgium",           dialCode: "+32",  flag: "🇧🇪" },
  { code: "CH", name: "Suisse",          nameEn: "Switzerland",       dialCode: "+41",  flag: "🇨🇭" },
];

export const getCountryByCode = (code: string) =>
  ALL_COUNTRIES.find((c) => c.code === code);

export const filterCountries = (search: string) =>
  ALL_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search),
  );

export const cleanPhone = (n: string) =>
  n.replace(/\s+/g, "").replace(/[^0-9]/g, "").replace(/^0+/, "");

export const getDialCode = (countryCode: string) =>
  getCountryByCode(countryCode)?.dialCode ?? "+237";
