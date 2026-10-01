// Hand-authored "government graph" reference data — a map of the people and
// positions of power for a handful of nations, inspired by civlab.org's US Gov
// Graph. Each government is a small network of nodes (offices, institutions and
// the people who hold them) connected by power relations (who appoints, commands,
// confirms or reports to whom).
//
// This is curated reference data, NOT part of the live/fork simulation. Holder
// names reflect the game's 2026 setting and are meant to be edited by hand as the
// real world moves — treat them as illustrative, structure as the durable part.
// To add a country: append an entry to GOVERNMENTS keyed by its ISO3 code; the
// /gov/:code page and the "View Government" link surface it automatically.

export type GovBranch =
  | 'head_of_state'
  | 'executive'
  | 'legislative'
  | 'judicial'
  | 'security'
  | 'economic'
  | 'party';

export type GovNodeKind = 'person' | 'office' | 'institution';

export type GovRelation =
  | 'appoints'
  | 'confirms'
  | 'commands'
  | 'reports_to'
  | 'oversees'
  | 'advises'
  | 'member_of'
  | 'leads';

export interface GovNode {
  /** Unique within a single government. */
  id: string;
  /** The office or institution title, e.g. "President" or "Supreme Court". */
  label: string;
  /** The person currently holding the office, when applicable. */
  holder?: string;
  kind: GovNodeKind;
  branch: GovBranch;
  /** 0 = apex of power. Drives node size and gravity in the graph. */
  rank: number;
  /** One-line description of the role's power. */
  note?: string;
}

export interface GovEdge {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  relation: GovRelation;
}

export interface Government {
  countryCode: string;
  /** Short description of the system of government. */
  system: string;
  /** The date this snapshot describes, e.g. "2026". */
  asOf: string;
  nodes: GovNode[];
  edges: GovEdge[];
}

// Human-readable labels + accent colors (theme tokens) per branch.
export const BRANCH_META: Record<GovBranch, { label: string; color: string }> = {
  head_of_state: { label: 'Head of State', color: 'var(--rs-branch-head)' },
  executive:     { label: 'Executive',     color: 'var(--rs-branch-executive)' },
  legislative:   { label: 'Legislative',   color: 'var(--rs-branch-legislative)' },
  judicial:      { label: 'Judiciary',     color: 'var(--rs-branch-judicial)' },
  security:      { label: 'Security',      color: 'var(--rs-branch-security)' },
  economic:      { label: 'Economic',      color: 'var(--rs-branch-economic)' },
  party:         { label: 'Party',         color: 'var(--rs-branch-party)' },
};

export const RELATION_LABELS: Record<GovRelation, string> = {
  appoints:  'appoints',
  confirms:  'confirms',
  commands:  'commands',
  reports_to:'reports to',
  oversees:  'oversees',
  advises:   'advises',
  member_of: 'member of',
  leads:     'leads',
};

// ---------------------------------------------------------------------------
// United States — presidential federal republic
// ---------------------------------------------------------------------------
const USA: Government = {
  countryCode: 'USA',
  system: 'Federal presidential constitutional republic',
  asOf: '2026',
  nodes: [
    { id: 'potus', label: 'President', holder: 'Donald J. Trump', kind: 'person', branch: 'head_of_state', rank: 0, note: 'Head of state and government; Commander-in-Chief.' },
    { id: 'vpotus', label: 'Vice President', holder: 'JD Vance', kind: 'person', branch: 'executive', rank: 1, note: 'President of the Senate; first in line of succession.' },
    { id: 'cos', label: 'White House Chief of Staff', holder: 'Susie Wiles', kind: 'person', branch: 'executive', rank: 2, note: 'Manages the Executive Office of the President.' },
    { id: 'state', label: 'Secretary of State', holder: 'Marco Rubio', kind: 'person', branch: 'executive', rank: 2, note: 'Leads U.S. foreign policy.' },
    { id: 'treasury', label: 'Secretary of the Treasury', holder: 'Scott Bessent', kind: 'person', branch: 'economic', rank: 2, note: 'Chief economic and fiscal officer.' },
    { id: 'defense', label: 'Secretary of Defense', holder: 'Pete Hegseth', kind: 'person', branch: 'security', rank: 2, note: 'Civilian head of the armed forces.' },
    { id: 'ag', label: 'Attorney General', holder: 'Pam Bondi', kind: 'person', branch: 'judicial', rank: 2, note: 'Head of the Department of Justice.' },
    { id: 'jcs', label: 'Chairman, Joint Chiefs', holder: 'Gen. Dan Caine', kind: 'person', branch: 'security', rank: 3, note: 'Highest-ranking military officer.' },
    { id: 'congress', label: 'Congress', kind: 'institution', branch: 'legislative', rank: 1, note: 'Bicameral federal legislature.' },
    { id: 'senate', label: 'Senate', holder: 'Maj. Leader John Thune', kind: 'institution', branch: 'legislative', rank: 2, note: 'Upper chamber; confirms appointments and treaties.' },
    { id: 'house', label: 'House of Representatives', holder: 'Speaker Mike Johnson', kind: 'institution', branch: 'legislative', rank: 2, note: 'Lower chamber; originates spending bills.' },
    { id: 'scotus', label: 'Supreme Court', holder: 'Chief Justice John Roberts', kind: 'institution', branch: 'judicial', rank: 1, note: 'Highest court; judicial review.' },
    { id: 'fed', label: 'Federal Reserve', holder: 'Chair Jerome Powell', kind: 'institution', branch: 'economic', rank: 2, note: 'Independent central bank; sets monetary policy.' },
  ],
  edges: [
    { source: 'potus', target: 'vpotus', relation: 'leads' },
    { source: 'potus', target: 'cos', relation: 'appoints' },
    { source: 'potus', target: 'state', relation: 'appoints' },
    { source: 'potus', target: 'treasury', relation: 'appoints' },
    { source: 'potus', target: 'defense', relation: 'appoints' },
    { source: 'potus', target: 'ag', relation: 'appoints' },
    { source: 'potus', target: 'jcs', relation: 'appoints' },
    { source: 'potus', target: 'defense', relation: 'commands' },
    { source: 'defense', target: 'jcs', relation: 'oversees' },
    { source: 'congress', target: 'senate', relation: 'leads' },
    { source: 'congress', target: 'house', relation: 'leads' },
    { source: 'senate', target: 'state', relation: 'confirms' },
    { source: 'senate', target: 'treasury', relation: 'confirms' },
    { source: 'senate', target: 'defense', relation: 'confirms' },
    { source: 'senate', target: 'ag', relation: 'confirms' },
    { source: 'senate', target: 'scotus', relation: 'confirms' },
    { source: 'potus', target: 'scotus', relation: 'appoints' },
    { source: 'scotus', target: 'congress', relation: 'oversees' },
    { source: 'treasury', target: 'fed', relation: 'advises' },
    { source: 'vpotus', target: 'senate', relation: 'leads' },
  ],
};

// ---------------------------------------------------------------------------
// India — parliamentary federal republic
// ---------------------------------------------------------------------------
const IND: Government = {
  countryCode: 'IND',
  system: 'Federal parliamentary constitutional republic',
  asOf: '2026',
  nodes: [
    { id: 'president', label: 'President', holder: 'Droupadi Murmu', kind: 'person', branch: 'head_of_state', rank: 0, note: 'Ceremonial head of state; Supreme Commander of the armed forces.' },
    { id: 'pm', label: 'Prime Minister', holder: 'Narendra Modi', kind: 'person', branch: 'executive', rank: 0, note: 'Head of government; leads the Union Council of Ministers.' },
    { id: 'cabinet', label: 'Union Council of Ministers', kind: 'institution', branch: 'executive', rank: 1, note: 'Collective executive answerable to the Lok Sabha.' },
    { id: 'mea', label: 'Minister of External Affairs', holder: 'S. Jaishankar', kind: 'person', branch: 'executive', rank: 2, note: 'Leads foreign policy.' },
    { id: 'finance', label: 'Minister of Finance', holder: 'Nirmala Sitharaman', kind: 'person', branch: 'economic', rank: 2, note: 'Union budget and fiscal policy.' },
    { id: 'defence', label: 'Minister of Defence', holder: 'Rajnath Singh', kind: 'person', branch: 'security', rank: 2, note: 'Oversees the armed forces.' },
    { id: 'home', label: 'Minister of Home Affairs', holder: 'Amit Shah', kind: 'person', branch: 'security', rank: 2, note: 'Internal security and policing.' },
    { id: 'parliament', label: 'Parliament', kind: 'institution', branch: 'legislative', rank: 1, note: 'Bicameral Union legislature.' },
    { id: 'loksabha', label: 'Lok Sabha', holder: 'Speaker Om Birla', kind: 'institution', branch: 'legislative', rank: 2, note: 'House of the People; directly elected.' },
    { id: 'rajyasabha', label: 'Rajya Sabha', holder: 'Chair C. P. Radhakrishnan', kind: 'institution', branch: 'legislative', rank: 2, note: 'Council of States; chaired by the Vice-President.' },
    { id: 'sci', label: 'Supreme Court of India', holder: 'CJI Surya Kant', kind: 'institution', branch: 'judicial', rank: 1, note: 'Apex court; guardian of the Constitution.' },
    { id: 'rbi', label: 'Reserve Bank of India', holder: 'Gov. Sanjay Malhotra', kind: 'institution', branch: 'economic', rank: 2, note: 'Central bank; monetary policy.' },
  ],
  edges: [
    { source: 'president', target: 'pm', relation: 'appoints' },
    { source: 'pm', target: 'cabinet', relation: 'leads' },
    { source: 'cabinet', target: 'mea', relation: 'member_of' },
    { source: 'cabinet', target: 'finance', relation: 'member_of' },
    { source: 'cabinet', target: 'defence', relation: 'member_of' },
    { source: 'cabinet', target: 'home', relation: 'member_of' },
    { source: 'cabinet', target: 'loksabha', relation: 'reports_to' },
    { source: 'parliament', target: 'loksabha', relation: 'leads' },
    { source: 'parliament', target: 'rajyasabha', relation: 'leads' },
    { source: 'loksabha', target: 'pm', relation: 'confirms' },
    { source: 'president', target: 'sci', relation: 'appoints' },
    { source: 'sci', target: 'parliament', relation: 'oversees' },
    { source: 'finance', target: 'rbi', relation: 'oversees' },
    { source: 'president', target: 'defence', relation: 'commands' },
  ],
};

// ---------------------------------------------------------------------------
// United Kingdom — parliamentary constitutional monarchy
// ---------------------------------------------------------------------------
const GBR: Government = {
  countryCode: 'GBR',
  system: 'Unitary parliamentary constitutional monarchy',
  asOf: '2026',
  nodes: [
    { id: 'monarch', label: 'Monarch', holder: 'King Charles III', kind: 'person', branch: 'head_of_state', rank: 0, note: 'Ceremonial head of state; royal assent.' },
    { id: 'pm', label: 'Prime Minister', holder: 'Keir Starmer', kind: 'person', branch: 'executive', rank: 0, note: 'Head of government; leads the Cabinet.' },
    { id: 'cabinet', label: 'Cabinet', kind: 'institution', branch: 'executive', rank: 1, note: 'Senior ministers; collective responsibility.' },
    { id: 'chancellor', label: 'Chancellor of the Exchequer', holder: 'Rachel Reeves', kind: 'person', branch: 'economic', rank: 2, note: 'Head of HM Treasury.' },
    { id: 'foreign', label: 'Foreign Secretary', holder: 'Yvette Cooper', kind: 'person', branch: 'executive', rank: 2, note: 'Leads the Foreign, Commonwealth & Development Office.' },
    { id: 'homesec', label: 'Home Secretary', holder: 'Shabana Mahmood', kind: 'person', branch: 'security', rank: 2, note: 'Internal affairs, policing and immigration.' },
    { id: 'defence', label: 'Defence Secretary', holder: 'John Healey', kind: 'person', branch: 'security', rank: 2, note: 'Ministry of Defence.' },
    { id: 'parliament', label: 'Parliament', kind: 'institution', branch: 'legislative', rank: 1, note: 'Sovereign bicameral legislature.' },
    { id: 'commons', label: 'House of Commons', holder: 'Speaker Lindsay Hoyle', kind: 'institution', branch: 'legislative', rank: 2, note: 'Elected lower house; confidence chamber.' },
    { id: 'lords', label: 'House of Lords', kind: 'institution', branch: 'legislative', rank: 2, note: 'Appointed revising chamber.' },
    { id: 'uksc', label: 'Supreme Court', holder: 'Pres. Lord Reed', kind: 'institution', branch: 'judicial', rank: 1, note: 'Final court of appeal.' },
    { id: 'boe', label: 'Bank of England', holder: 'Gov. Andrew Bailey', kind: 'institution', branch: 'economic', rank: 2, note: 'Central bank; independent monetary policy.' },
  ],
  edges: [
    { source: 'monarch', target: 'pm', relation: 'appoints' },
    { source: 'pm', target: 'cabinet', relation: 'leads' },
    { source: 'cabinet', target: 'chancellor', relation: 'member_of' },
    { source: 'cabinet', target: 'foreign', relation: 'member_of' },
    { source: 'cabinet', target: 'homesec', relation: 'member_of' },
    { source: 'cabinet', target: 'defence', relation: 'member_of' },
    { source: 'parliament', target: 'commons', relation: 'leads' },
    { source: 'parliament', target: 'lords', relation: 'leads' },
    { source: 'commons', target: 'pm', relation: 'confirms' },
    { source: 'cabinet', target: 'commons', relation: 'reports_to' },
    { source: 'monarch', target: 'uksc', relation: 'appoints' },
    { source: 'chancellor', target: 'boe', relation: 'oversees' },
    { source: 'uksc', target: 'parliament', relation: 'advises' },
  ],
};

// ---------------------------------------------------------------------------
// China — one-party socialist republic (party leads the state)
// ---------------------------------------------------------------------------
const CHN: Government = {
  countryCode: 'CHN',
  system: 'One-party socialist republic; the CCP leads the state',
  asOf: '2026',
  nodes: [
    { id: 'xi', label: 'Paramount Leader', holder: 'Xi Jinping', kind: 'person', branch: 'party', rank: 0, note: 'CCP General Secretary, President and CMC Chairman.' },
    { id: 'psc', label: 'Politburo Standing Committee', kind: 'institution', branch: 'party', rank: 1, note: 'Apex decision-making body of the CCP.' },
    { id: 'premier', label: 'Premier of the State Council', holder: 'Li Qiang', kind: 'person', branch: 'executive', rank: 1, note: 'Head of government; runs the state bureaucracy.' },
    { id: 'statecouncil', label: 'State Council', kind: 'institution', branch: 'executive', rank: 2, note: 'Chief administrative authority (cabinet).' },
    { id: 'mfa', label: 'Minister of Foreign Affairs', holder: 'Wang Yi', kind: 'person', branch: 'executive', rank: 3, note: 'Leads diplomacy.' },
    { id: 'mnd', label: 'Minister of National Defense', holder: 'Dong Jun', kind: 'person', branch: 'security', rank: 3, note: 'State liaison for the military.' },
    { id: 'cmc', label: 'Central Military Commission', kind: 'institution', branch: 'security', rank: 1, note: 'Commands the People’s Liberation Army.' },
    { id: 'npc', label: 'National People’s Congress', holder: 'Chair Zhao Leji', kind: 'institution', branch: 'legislative', rank: 1, note: 'Highest organ of state power (de jure).' },
    { id: 'spc', label: 'Supreme People’s Court', kind: 'institution', branch: 'judicial', rank: 2, note: 'Highest court; under Party and NPC oversight.' },
    { id: 'pboc', label: 'People’s Bank of China', holder: 'Gov. Pan Gongsheng', kind: 'institution', branch: 'economic', rank: 2, note: 'Central bank.' },
  ],
  edges: [
    { source: 'xi', target: 'psc', relation: 'leads' },
    { source: 'xi', target: 'cmc', relation: 'commands' },
    { source: 'psc', target: 'premier', relation: 'appoints' },
    { source: 'premier', target: 'statecouncil', relation: 'leads' },
    { source: 'statecouncil', target: 'mfa', relation: 'oversees' },
    { source: 'statecouncil', target: 'mnd', relation: 'oversees' },
    { source: 'statecouncil', target: 'pboc', relation: 'oversees' },
    { source: 'cmc', target: 'mnd', relation: 'oversees' },
    { source: 'npc', target: 'statecouncil', relation: 'oversees' },
    { source: 'npc', target: 'spc', relation: 'oversees' },
    { source: 'psc', target: 'npc', relation: 'leads' },
    { source: 'psc', target: 'spc', relation: 'oversees' },
  ],
};

// ---------------------------------------------------------------------------
// Russia — semi-presidential federal republic
// ---------------------------------------------------------------------------
const RUS: Government = {
  countryCode: 'RUS',
  system: 'Federal semi-presidential republic',
  asOf: '2026',
  nodes: [
    { id: 'president', label: 'President', holder: 'Vladimir Putin', kind: 'person', branch: 'head_of_state', rank: 0, note: 'Head of state; Commander-in-Chief; dominant executive.' },
    { id: 'pm', label: 'Prime Minister', holder: 'Mikhail Mishustin', kind: 'person', branch: 'executive', rank: 1, note: 'Chairman of the Government; economic administration.' },
    { id: 'government', label: 'Government (Cabinet)', kind: 'institution', branch: 'executive', rank: 2, note: 'Federal executive ministries.' },
    { id: 'seccouncil', label: 'Security Council', holder: 'Sec. Sergei Shoigu', kind: 'institution', branch: 'security', rank: 1, note: 'Coordinates national security under the President.' },
    { id: 'mfa', label: 'Minister of Foreign Affairs', holder: 'Sergey Lavrov', kind: 'person', branch: 'executive', rank: 2, note: 'Leads diplomacy.' },
    { id: 'defence', label: 'Minister of Defence', holder: 'Andrei Belousov', kind: 'person', branch: 'security', rank: 2, note: 'Runs the armed forces.' },
    { id: 'assembly', label: 'Federal Assembly', kind: 'institution', branch: 'legislative', rank: 1, note: 'Bicameral national legislature.' },
    { id: 'duma', label: 'State Duma', holder: 'Chair Vyacheslav Volodin', kind: 'institution', branch: 'legislative', rank: 2, note: 'Elected lower house.' },
    { id: 'council', label: 'Federation Council', holder: 'Chair Valentina Matviyenko', kind: 'institution', branch: 'legislative', rank: 2, note: 'Upper house of the regions.' },
    { id: 'court', label: 'Constitutional Court', kind: 'institution', branch: 'judicial', rank: 2, note: 'Reviews constitutionality of laws.' },
    { id: 'cbr', label: 'Central Bank of Russia', holder: 'Gov. Elvira Nabiullina', kind: 'institution', branch: 'economic', rank: 2, note: 'Independent central bank.' },
  ],
  edges: [
    { source: 'president', target: 'pm', relation: 'appoints' },
    { source: 'president', target: 'seccouncil', relation: 'leads' },
    { source: 'president', target: 'defence', relation: 'commands' },
    { source: 'president', target: 'mfa', relation: 'appoints' },
    { source: 'pm', target: 'government', relation: 'leads' },
    { source: 'government', target: 'cbr', relation: 'advises' },
    { source: 'assembly', target: 'duma', relation: 'leads' },
    { source: 'assembly', target: 'council', relation: 'leads' },
    { source: 'duma', target: 'pm', relation: 'confirms' },
    { source: 'president', target: 'court', relation: 'appoints' },
    { source: 'court', target: 'assembly', relation: 'oversees' },
    { source: 'seccouncil', target: 'defence', relation: 'member_of' },
  ],
};

export const GOVERNMENTS: Record<string, Government> = { USA, IND, GBR, CHN, RUS };

/** ISO3 codes that have a hand-authored government graph. */
export const GOV_COUNTRIES = Object.keys(GOVERNMENTS);

export function hasGovernment(iso3: string | null | undefined): boolean {
  return !!iso3 && iso3 in GOVERNMENTS;
}

export function getGovernment(iso3: string | null | undefined): Government | undefined {
  if (!iso3) return undefined;
  return GOVERNMENTS[iso3];
}
