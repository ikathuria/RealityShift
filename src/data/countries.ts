// Country reference data — generated, do not hand-edit.
//
// Sources:
//   ISO 3166-1 numeric <-> alpha-3 and formal names:
//     https://github.com/lukes/ISO-3166-Countries-with-Regional-Codes
//   Display names: world-atlas' own labels (friendlier than ISO's formal names
//     — "Russia" not "Russian Federation"), with abbreviations expanded.
//
// NUMERIC_TO_ISO3 previously held 114 hand-written entries while the world-atlas
// TopoJSON ships 177 features, so 60+ countries could never be coloured by the
// choropleth or resolved on click — there was no ISO3 to look up. This covers
// all 174 features carrying an ISO 3166-1 numeric code. The other 3 (N. Cyprus,
// Somaliland, Kosovo) have no ISO numeric code and render as no-data.

/** world-atlas feature id (ISO 3166-1 numeric, unpadded) -> ISO 3166-1 alpha-3 */
export const NUMERIC_TO_ISO3: Record<string, string> = {
  "4": "AFG", "8": "ALB", "10": "ATA", "12": "DZA", "24": "AGO", "31": "AZE", "32": "ARG", "36": "AUS", "40": "AUT", "44": "BHS",
  "50": "BGD", "51": "ARM", "56": "BEL", "64": "BTN", "68": "BOL", "70": "BIH", "72": "BWA", "76": "BRA", "84": "BLZ", "90": "SLB",
  "96": "BRN", "100": "BGR", "104": "MMR", "108": "BDI", "112": "BLR", "116": "KHM", "120": "CMR", "124": "CAN", "140": "CAF", "144": "LKA",
  "148": "TCD", "152": "CHL", "156": "CHN", "158": "TWN", "170": "COL", "178": "COG", "180": "COD", "188": "CRI", "191": "HRV", "192": "CUB",
  "196": "CYP", "203": "CZE", "204": "BEN", "208": "DNK", "214": "DOM", "218": "ECU", "222": "SLV", "226": "GNQ", "231": "ETH", "232": "ERI",
  "233": "EST", "238": "FLK", "242": "FJI", "246": "FIN", "250": "FRA", "260": "ATF", "262": "DJI", "266": "GAB", "268": "GEO", "270": "GMB",
  "275": "PSE", "276": "DEU", "288": "GHA", "300": "GRC", "304": "GRL", "320": "GTM", "324": "GIN", "328": "GUY", "332": "HTI", "340": "HND",
  "348": "HUN", "352": "ISL", "356": "IND", "360": "IDN", "364": "IRN", "368": "IRQ", "372": "IRL", "376": "ISR", "380": "ITA", "384": "CIV",
  "388": "JAM", "392": "JPN", "398": "KAZ", "400": "JOR", "404": "KEN", "408": "PRK", "410": "KOR", "414": "KWT", "417": "KGZ", "418": "LAO",
  "422": "LBN", "426": "LSO", "428": "LVA", "430": "LBR", "434": "LBY", "440": "LTU", "442": "LUX", "450": "MDG", "454": "MWI", "458": "MYS",
  "466": "MLI", "478": "MRT", "484": "MEX", "496": "MNG", "498": "MDA", "499": "MNE", "504": "MAR", "508": "MOZ", "512": "OMN", "516": "NAM",
  "524": "NPL", "528": "NLD", "540": "NCL", "548": "VUT", "554": "NZL", "558": "NIC", "562": "NER", "566": "NGA", "578": "NOR", "586": "PAK",
  "591": "PAN", "598": "PNG", "600": "PRY", "604": "PER", "608": "PHL", "616": "POL", "620": "PRT", "624": "GNB", "626": "TLS", "630": "PRI",
  "634": "QAT", "642": "ROU", "643": "RUS", "646": "RWA", "682": "SAU", "686": "SEN", "688": "SRB", "694": "SLE", "703": "SVK", "704": "VNM",
  "705": "SVN", "706": "SOM", "710": "ZAF", "716": "ZWE", "724": "ESP", "728": "SSD", "729": "SDN", "732": "ESH", "740": "SUR", "748": "SWZ",
  "752": "SWE", "756": "CHE", "760": "SYR", "762": "TJK", "764": "THA", "768": "TGO", "780": "TTO", "784": "ARE", "788": "TUN", "792": "TUR",
  "795": "TKM", "800": "UGA", "804": "UKR", "807": "MKD", "818": "EGY", "826": "GBR", "834": "TZA", "840": "USA", "854": "BFA", "858": "URY",
  "860": "UZB", "862": "VEN", "887": "YEM", "894": "ZMB",
};

/** ISO 3166-1 alpha-3 -> display name. Covers every alpha-3, not only mapped features. */
export const COUNTRY_NAMES: Record<string, string> = {
  ABW: "Aruba", AFG: "Afghanistan", AGO: "Angola", AIA: "Anguilla",
  ALA: "\u00c5land Islands", ALB: "Albania", AND: "Andorra", ARE: "United Arab Emirates",
  ARG: "Argentina", ARM: "Armenia", ASM: "American Samoa", ATA: "Antarctica",
  ATF: "French Southern Territories", ATG: "Antigua and Barbuda", AUS: "Australia", AUT: "Austria",
  AZE: "Azerbaijan", BDI: "Burundi", BEL: "Belgium", BEN: "Benin",
  BES: "Bonaire, Sint Eustatius and Saba", BFA: "Burkina Faso", BGD: "Bangladesh", BGR: "Bulgaria",
  BHR: "Bahrain", BHS: "Bahamas", BIH: "Bosnia and Herzegovina", BLM: "Saint Barth\u00e9lemy",
  BLR: "Belarus", BLZ: "Belize", BMU: "Bermuda", BOL: "Bolivia",
  BRA: "Brazil", BRB: "Barbados", BRN: "Brunei", BTN: "Bhutan",
  BVT: "Bouvet Island", BWA: "Botswana", CAF: "Central African Republic", CAN: "Canada",
  CCK: "Cocos (Keeling) Islands", CHE: "Switzerland", CHL: "Chile", CHN: "China",
  CIV: "C\u00f4te d'Ivoire", CMR: "Cameroon", COD: "DR Congo", COG: "Congo",
  COK: "Cook Islands", COL: "Colombia", COM: "Comoros", CPV: "Cabo Verde",
  CRI: "Costa Rica", CUB: "Cuba", CUW: "Cura\u00e7ao", CXR: "Christmas Island",
  CYM: "Cayman Islands", CYP: "Cyprus", CZE: "Czechia", DEU: "Germany",
  DJI: "Djibouti", DMA: "Dominica", DNK: "Denmark", DOM: "Dominican Republic",
  DZA: "Algeria", ECU: "Ecuador", EGY: "Egypt", ERI: "Eritrea",
  ESH: "Western Sahara", ESP: "Spain", EST: "Estonia", ETH: "Ethiopia",
  FIN: "Finland", FJI: "Fiji", FLK: "Falkland Islands", FRA: "France",
  FRO: "Faroe Islands", FSM: "Micronesia, Federated States of", GAB: "Gabon", GBR: "United Kingdom",
  GEO: "Georgia", GGY: "Guernsey", GHA: "Ghana", GIB: "Gibraltar",
  GIN: "Guinea", GLP: "Guadeloupe", GMB: "Gambia", GNB: "Guinea-Bissau",
  GNQ: "Equatorial Guinea", GRC: "Greece", GRD: "Grenada", GRL: "Greenland",
  GTM: "Guatemala", GUF: "French Guiana", GUM: "Guam", GUY: "Guyana",
  HKG: "Hong Kong", HMD: "Heard Island and McDonald Islands", HND: "Honduras", HRV: "Croatia",
  HTI: "Haiti", HUN: "Hungary", IDN: "Indonesia", IMN: "Isle of Man",
  IND: "India", IOT: "British Indian Ocean Territory", IRL: "Ireland", IRN: "Iran",
  IRQ: "Iraq", ISL: "Iceland", ISR: "Israel", ITA: "Italy",
  JAM: "Jamaica", JEY: "Jersey", JOR: "Jordan", JPN: "Japan",
  KAZ: "Kazakhstan", KEN: "Kenya", KGZ: "Kyrgyzstan", KHM: "Cambodia",
  KIR: "Kiribati", KNA: "Saint Kitts and Nevis", KOR: "South Korea", KWT: "Kuwait",
  LAO: "Laos", LBN: "Lebanon", LBR: "Liberia", LBY: "Libya",
  LCA: "Saint Lucia", LIE: "Liechtenstein", LKA: "Sri Lanka", LSO: "Lesotho",
  LTU: "Lithuania", LUX: "Luxembourg", LVA: "Latvia", MAC: "Macao",
  MAF: "Saint Martin (French part)", MAR: "Morocco", MCO: "Monaco", MDA: "Moldova",
  MDG: "Madagascar", MDV: "Maldives", MEX: "Mexico", MHL: "Marshall Islands",
  MKD: "Macedonia", MLI: "Mali", MLT: "Malta", MMR: "Myanmar",
  MNE: "Montenegro", MNG: "Mongolia", MNP: "Northern Mariana Islands", MOZ: "Mozambique",
  MRT: "Mauritania", MSR: "Montserrat", MTQ: "Martinique", MUS: "Mauritius",
  MWI: "Malawi", MYS: "Malaysia", MYT: "Mayotte", NAM: "Namibia",
  NCL: "New Caledonia", NER: "Niger", NFK: "Norfolk Island", NGA: "Nigeria",
  NIC: "Nicaragua", NIU: "Niue", NLD: "Netherlands", NOR: "Norway",
  NPL: "Nepal", NRU: "Nauru", NZL: "New Zealand", OMN: "Oman",
  PAK: "Pakistan", PAN: "Panama", PCN: "Pitcairn", PER: "Peru",
  PHL: "Philippines", PLW: "Palau", PNG: "Papua New Guinea", POL: "Poland",
  PRI: "Puerto Rico", PRK: "North Korea", PRT: "Portugal", PRY: "Paraguay",
  PSE: "Palestine", PYF: "French Polynesia", QAT: "Qatar", REU: "R\u00e9union",
  ROU: "Romania", RUS: "Russia", RWA: "Rwanda", SAU: "Saudi Arabia",
  SDN: "Sudan", SEN: "Senegal", SGP: "Singapore", SGS: "South Georgia and the South Sandwich Islands",
  SHN: "Saint Helena, Ascension and Tristan da Cunha", SJM: "Svalbard and Jan Mayen", SLB: "Solomon Islands", SLE: "Sierra Leone",
  SLV: "El Salvador", SMR: "San Marino", SOM: "Somalia", SPM: "Saint Pierre and Miquelon",
  SRB: "Serbia", SSD: "South Sudan", STP: "Sao Tome and Principe", SUR: "Suriname",
  SVK: "Slovakia", SVN: "Slovenia", SWE: "Sweden", SWZ: "eSwatini",
  SXM: "Sint Maarten (Dutch part)", SYC: "Seychelles", SYR: "Syria", TCA: "Turks and Caicos Islands",
  TCD: "Chad", TGO: "Togo", THA: "Thailand", TJK: "Tajikistan",
  TKL: "Tokelau", TKM: "Turkmenistan", TLS: "Timor-Leste", TON: "Tonga",
  TTO: "Trinidad and Tobago", TUN: "Tunisia", TUR: "Turkey", TUV: "Tuvalu",
  TWN: "Taiwan", TZA: "Tanzania", UGA: "Uganda", UKR: "Ukraine",
  UMI: "United States Minor Outlying Islands", URY: "Uruguay", USA: "United States", UZB: "Uzbekistan",
  VAT: "Holy See", VCT: "Saint Vincent and the Grenadines", VEN: "Venezuela", VGB: "Virgin Islands (British)",
  VIR: "Virgin Islands (U.S.)", VNM: "Vietnam", VUT: "Vanuatu", WLF: "Wallis and Futuna",
  WSM: "Samoa", YEM: "Yemen", ZAF: "South Africa", ZMB: "Zambia",
  ZWE: "Zimbabwe",
};

/** Display name for a country code, falling back to the raw code. */
export function countryName(iso3: string | null | undefined): string {
  if (!iso3) return 'World';
  return COUNTRY_NAMES[iso3] ?? iso3;
}

export interface GlobeCountry {
  code: string;
  name: string;
}

/** Countries that exist as clickable features on the globe, sorted by name. */
export const GLOBE_COUNTRIES: GlobeCountry[] = Object.values(NUMERIC_TO_ISO3)
  .map(code => ({ code, name: countryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Approximate camera targets (lon, lat) per country.
 *
 * Computed from the world-atlas geometry using a circular mean of longitude, so
 * countries straddling the antimeridian (Russia, Fiji, New Zealand) land in the
 * right hemisphere instead of near 0 degrees, which a bounding-box centre gives.
 * Hand-tuned values for major countries take precedence — a pure geometric mean
 * pulls the USA toward the Aleutians and Russia toward Siberia's midpoint.
 *
 * Used for camera fly-to and for drawing inter-agent event arcs. Previously this
 * covered ~60 countries, so selecting or drawing an arc for anything else did
 * nothing at all.
 */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AFG: [67, 33], AGO: [17, -10], ALB: [20, 41], ARE: [54, 24],
  ARG: [-64, -34], ARM: [45, 40], ATA: [-90, -73], ATF: [69, -49],
  AUS: [133, -27], AUT: [14, 47], AZE: [47, 40], BDI: [30, -3],
  BEL: [4, 51], BEN: [2, 10], BFA: [-2, 12], BGD: [90, 24],
  BGR: [25, 43], BHS: [-78, 26], BIH: [18, 44], BLR: [28, 53],
  BLZ: [-89, 17], BOL: [-64, -17], BRA: [-53, -14], BRN: [115, 5],
  BTN: [90, 27], BWA: [24, -22], CAF: [21, 6], CAN: [-96, 60],
  CHE: [8, 47], CHL: [-71, -41], CHN: [104, 35], CIV: [-6, 8],
  CMR: [12, 6], COD: [23, -4], COG: [15, -1], COL: [-74, 4],
  CRI: [-84, 10], CUB: [-80, 22], CYP: [33, 35], CZE: [16, 50],
  DEU: [10, 51], DJI: [43, 12], DNK: [10, 56], DOM: [-71, 19],
  DZA: [3, 28], ECU: [-79, -2], EGY: [30, 26], ERI: [40, 15],
  ESH: [-12, 25], ESP: [-3, 40], EST: [26, 59], ETH: [40, 9],
  FIN: [26, 64], FJI: [179, -17], FLK: [-60, -52], FRA: [2, 46],
  GAB: [12, 0], GBR: [-2, 54], GEO: [43, 42], GHA: [-2, 8],
  GIN: [-11, 10], GMB: [-15, 13], GNB: [-15, 12], GNQ: [10, 2],
  GRC: [22, 39], GRL: [-41, 74], GTM: [-90, 16], GUY: [-59, 5],
  HND: [-86, 15], HRV: [17, 45], HTI: [-73, 19], HUN: [19, 47],
  IDN: [118, -2], IND: [78, 22], IRL: [-8, 54], IRN: [53, 32],
  IRQ: [44, 33], ISL: [-19, 65], ISR: [35, 31], ITA: [12, 42],
  JAM: [-77, 18], JOR: [36, 31], JPN: [138, 37], KAZ: [67, 48],
  KEN: [38, 1], KGZ: [74, 41], KHM: [105, 12], KOR: [128, 37],
  KWT: [47, 29], LAO: [104, 18], LBN: [36, 34], LBR: [-9, 7],
  LBY: [17, 28], LKA: [81, 8], LSO: [28, -30], LTU: [24, 55],
  LUX: [6, 50], LVA: [25, 57], MAR: [-7, 32], MDA: [28, 47],
  MDG: [47, -18], MEX: [-102, 23], MKD: [22, 42], MLI: [-6, 14],
  MMR: [96, 21], MNE: [19, 43], MNG: [103, 46], MOZ: [35, -18],
  MRT: [-12, 19], MWI: [34, -13], MYS: [110, 4], NAM: [18, -21],
  NCL: [166, -21], NER: [9, 15], NGA: [8, 10], NIC: [-85, 13],
  NLD: [5, 52], NOR: [10, 64], NPL: [84, 28], NZL: [173, -41],
  OMN: [56, 22], PAK: [69, 30], PAN: [-80, 8], PER: [-74, -8],
  PHL: [122, 12], PNG: [150, -6], POL: [20, 52], PRI: [-66, 18],
  PRK: [128, 40], PRT: [-8, 39], PRY: [-58, -23], PSE: [35, 32],
  QAT: [51, 25], ROU: [25, 46], RUS: [105, 61], RWA: [30, -2],
  SAU: [45, 24], SDN: [30, 15], SEN: [-15, 14], SGP: [104, 1],
  SLB: [160, -9], SLE: [-12, 9], SLV: [-89, 14], SOM: [47, 7],
  SRB: [21, 44], SSD: [30, 8], SUR: [-56, 4], SVK: [19, 49],
  SVN: [15, 46], SWE: [18, 62], SWZ: [31, -26], SYR: [38, 35],
  TCD: [18, 13], TGO: [1, 9], THA: [101, 15], TJK: [71, 39],
  TKM: [59, 39], TLS: [126, -9], TTO: [-61, 10], TUN: [10, 34],
  TUR: [35, 39], TWN: [121, 24], TZA: [35, -6], UGA: [32, 1],
  UKR: [32, 49], URY: [-56, -33], USA: [-98, 38], UZB: [63, 41],
  VEN: [-67, 7], VNM: [108, 16], VUT: [167, -16], YEM: [48, 15],
  ZAF: [25, -29], ZMB: [28, -13], ZWE: [30, -19],
};

/** ISO 3166-1 alpha-3 -> lowercase alpha-2, for flag assets. Same source as above,
 *  full ISO list (not just globe features) so tables of every territory get flags. */
export const ISO3_TO_ISO2: Record<string, string> = {
  "ABW": "aw", "AFG": "af", "AGO": "ao", "AIA": "ai", "ALA": "ax", "ALB": "al", "AND": "ad", "ARE": "ae", "ARG": "ar", "ARM": "am",
  "ASM": "as", "ATA": "aq", "ATF": "tf", "ATG": "ag", "AUS": "au", "AUT": "at", "AZE": "az", "BDI": "bi", "BEL": "be", "BEN": "bj",
  "BES": "bq", "BFA": "bf", "BGD": "bd", "BGR": "bg", "BHR": "bh", "BHS": "bs", "BIH": "ba", "BLM": "bl", "BLR": "by", "BLZ": "bz",
  "BMU": "bm", "BOL": "bo", "BRA": "br", "BRB": "bb", "BRN": "bn", "BTN": "bt", "BVT": "bv", "BWA": "bw", "CAF": "cf", "CAN": "ca",
  "CCK": "cc", "CHE": "ch", "CHL": "cl", "CHN": "cn", "CIV": "ci", "CMR": "cm", "COD": "cd", "COG": "cg", "COK": "ck", "COL": "co",
  "COM": "km", "CPV": "cv", "CRI": "cr", "CUB": "cu", "CUW": "cw", "CXR": "cx", "CYM": "ky", "CYP": "cy", "CZE": "cz", "DEU": "de",
  "DJI": "dj", "DMA": "dm", "DNK": "dk", "DOM": "do", "DZA": "dz", "ECU": "ec", "EGY": "eg", "ERI": "er", "ESH": "eh", "ESP": "es",
  "EST": "ee", "ETH": "et", "FIN": "fi", "FJI": "fj", "FLK": "fk", "FRA": "fr", "FRO": "fo", "FSM": "fm", "GAB": "ga", "GBR": "gb",
  "GEO": "ge", "GGY": "gg", "GHA": "gh", "GIB": "gi", "GIN": "gn", "GLP": "gp", "GMB": "gm", "GNB": "gw", "GNQ": "gq", "GRC": "gr",
  "GRD": "gd", "GRL": "gl", "GTM": "gt", "GUF": "gf", "GUM": "gu", "GUY": "gy", "HKG": "hk", "HMD": "hm", "HND": "hn", "HRV": "hr",
  "HTI": "ht", "HUN": "hu", "IDN": "id", "IMN": "im", "IND": "in", "IOT": "io", "IRL": "ie", "IRN": "ir", "IRQ": "iq", "ISL": "is",
  "ISR": "il", "ITA": "it", "JAM": "jm", "JEY": "je", "JOR": "jo", "JPN": "jp", "KAZ": "kz", "KEN": "ke", "KGZ": "kg", "KHM": "kh",
  "KIR": "ki", "KNA": "kn", "KOR": "kr", "KWT": "kw", "LAO": "la", "LBN": "lb", "LBR": "lr", "LBY": "ly", "LCA": "lc", "LIE": "li",
  "LKA": "lk", "LSO": "ls", "LTU": "lt", "LUX": "lu", "LVA": "lv", "MAC": "mo", "MAF": "mf", "MAR": "ma", "MCO": "mc", "MDA": "md",
  "MDG": "mg", "MDV": "mv", "MEX": "mx", "MHL": "mh", "MKD": "mk", "MLI": "ml", "MLT": "mt", "MMR": "mm", "MNE": "me", "MNG": "mn",
  "MNP": "mp", "MOZ": "mz", "MRT": "mr", "MSR": "ms", "MTQ": "mq", "MUS": "mu", "MWI": "mw", "MYS": "my", "MYT": "yt", "NAM": "na",
  "NCL": "nc", "NER": "ne", "NFK": "nf", "NGA": "ng", "NIC": "ni", "NIU": "nu", "NLD": "nl", "NOR": "no", "NPL": "np", "NRU": "nr",
  "NZL": "nz", "OMN": "om", "PAK": "pk", "PAN": "pa", "PCN": "pn", "PER": "pe", "PHL": "ph", "PLW": "pw", "PNG": "pg", "POL": "pl",
  "PRI": "pr", "PRK": "kp", "PRT": "pt", "PRY": "py", "PSE": "ps", "PYF": "pf", "QAT": "qa", "REU": "re", "ROU": "ro", "RUS": "ru",
  "RWA": "rw", "SAU": "sa", "SDN": "sd", "SEN": "sn", "SGP": "sg", "SGS": "gs", "SHN": "sh", "SJM": "sj", "SLB": "sb", "SLE": "sl",
  "SLV": "sv", "SMR": "sm", "SOM": "so", "SPM": "pm", "SRB": "rs", "SSD": "ss", "STP": "st", "SUR": "sr", "SVK": "sk", "SVN": "si",
  "SWE": "se", "SWZ": "sz", "SXM": "sx", "SYC": "sc", "SYR": "sy", "TCA": "tc", "TCD": "td", "TGO": "tg", "THA": "th", "TJK": "tj",
  "TKL": "tk", "TKM": "tm", "TLS": "tl", "TON": "to", "TTO": "tt", "TUN": "tn", "TUR": "tr", "TUV": "tv", "TWN": "tw", "TZA": "tz",
  "UGA": "ug", "UKR": "ua", "UMI": "um", "URY": "uy", "USA": "us", "UZB": "uz", "VAT": "va", "VCT": "vc", "VEN": "ve", "VGB": "vg",
  "VIR": "vi", "VNM": "vn", "VUT": "vu", "WLF": "wf", "WSM": "ws", "YEM": "ye", "ZAF": "za", "ZMB": "zm", "ZWE": "zw",
};
