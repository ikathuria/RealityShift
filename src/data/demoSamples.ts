import type { AgentDecision, CountryState, WorldEvent } from '../store/worldStore';
import type { MediaEntry, SimProvenance } from '../lib/mediaIndex';

import usaFrontPage from '../assets/newspapers/newspaper_usa_2026_1785783848253.jpg';
import indFrontPage from '../assets/newspapers/newspaper_ind_2026_1785783861440.jpg';
import gbrFrontPage from '../assets/newspapers/newspaper_gbr_2026_1785783873265.jpg';
import chnFrontPage from '../assets/newspapers/newspaper_chn_2026_1785783885821.jpg';
import rusFrontPage from '../assets/newspapers/newspaper_rus_2026_1785783898047.jpg';

import usaBroadcast from '../assets/broadcasts/usa_broadcast_2026.mp4';
import indBroadcast from '../assets/broadcasts/ind_broadcast_2026.mp4';
import gbrBroadcast from '../assets/broadcasts/gbr_broadcast_2026.mp4';
import chnBroadcast from '../assets/broadcasts/chn_broadcast_2026.mp4';
import rusBroadcast from '../assets/broadcasts/rus_broadcast_2026.mp4';

export const DEMO_2026_REALITY_STATES: Record<string, CountryState> = {
  USA: {
    world_id: '2026-demo',
    country_code: 'USA',
    year: 2026,
    indicators: {
      gdp_per_capita: 81600,
      population: 335000000,
      military_spend: 3.42,
      education_spend: 5.40,
      healthcare_spend: 16.60,
      unemployment: 3.70,
      tax_rate: 26.50,
    },
    policies: { ai_sovereignty: 1.0, chip_subsidies: 0.8, clean_energy_grid: 0.75 },
    relations: { IND: 'strategic_ally', GBR: 'historic_ally', CHN: 'tech_rival', RUS: 'sanctioned' },
    agent_memory_summary: 'Targeting 100% domestic semiconductor self-sufficiency & quantum computing acceleration.',
    last_updated: '2026-08-03T12:00:00Z',
  },
  IND: {
    world_id: '2026-demo',
    country_code: 'IND',
    year: 2026,
    indicators: {
      gdp_per_capita: 2850,
      population: 1430000000,
      military_spend: 2.40,
      education_spend: 4.60,
      healthcare_spend: 3.20,
      unemployment: 4.20,
      tax_rate: 18.20,
    },
    policies: { digital_public_infra: 1.0, tech_export_stack: 0.85, solar_grid: 0.9 },
    relations: { USA: 'strategic_partner', GBR: 'trade_partner', CHN: 'border_vigilance', RUS: 'energy_partner' },
    agent_memory_summary: 'Expanding UPI digital infrastructure globally while accelerating domestic electronics manufacturing.',
    last_updated: '2026-08-03T12:00:00Z',
  },
  GBR: {
    world_id: '2026-demo',
    country_code: 'GBR',
    year: 2026,
    indicators: {
      gdp_per_capita: 48900,
      population: 67500000,
      military_spend: 2.30,
      education_spend: 5.10,
      healthcare_spend: 11.30,
      unemployment: 4.10,
      tax_rate: 33.50,
    },
    policies: { ai_safety_institute: 1.0, offshore_wind_hub: 0.85, fintech_sandbox: 0.9 },
    relations: { USA: 'special_relationship', IND: 'trade_partner', CHN: 'cautious_trade', RUS: 'sanctioned' },
    agent_memory_summary: 'Leading global AI safety verification frameworks and scaling North Sea offshore wind power.',
    last_updated: '2026-08-03T12:00:00Z',
  },
  CHN: {
    world_id: '2026-demo',
    country_code: 'CHN',
    year: 2026,
    indicators: {
      gdp_per_capita: 13700,
      population: 1410000000,
      military_spend: 1.72,
      education_spend: 4.00,
      healthcare_spend: 5.40,
      unemployment: 5.00,
      tax_rate: 20.10,
    },
    policies: { quantum_autonomy: 1.0, belt_and_road_ai: 0.8, clean_tech_export: 0.95 },
    relations: { USA: 'tech_rival', RUS: 'strategic_partner', IND: 'regional_competitor', GBR: 'trade_partner' },
    agent_memory_summary: 'Surpassing domestic 2nm chip & quantum computing self-reliance targets.',
    last_updated: '2026-08-03T12:00:00Z',
  },
  RUS: {
    world_id: '2026-demo',
    country_code: 'RUS',
    year: 2026,
    indicators: {
      gdp_per_capita: 14400,
      population: 1440000000,
      military_spend: 5.90,
      education_spend: 3.70,
      healthcare_spend: 5.10,
      unemployment: 3.00,
      tax_rate: 21.40,
    },
    policies: { eurasian_trade_rail: 0.95, arctic_sea_route: 0.90, defense_industrial_pivot: 1.0 },
    relations: { CHN: 'strategic_ally', IND: 'energy_buyer', USA: 'adversary', GBR: 'sanctioning' },
    agent_memory_summary: 'Pivoting commerce toward Northern Sea Route and Eurasian digital payment settlements.',
    last_updated: '2026-08-03T12:00:00Z',
  },
};

export const DEMO_2026_AGENT_DECISIONS: Record<string, AgentDecision[]> = {
  USA: [
    {
      id: 101,
      world_id: '2026-demo',
      country_code: 'USA',
      year: 2026,
      decision: { education_spend_delta: 0.4, military_spend_delta: 0.15 },
      reasoning: 'Enacted National AI & Semiconductor Sovereignty Act 2026. Allocated $52B in strategic grants for domestic mega-fabs and approved 14 Small Modular Reactor permits to power next-gen AI data centers.',
      historical_parallel: { name: '1958 National Defense Education & Space Act', similarity_score: 0.88 },
      projected_indicators: { gdp_per_capita: 82500, unemployment: 3.6 },
      created_at: '2026-08-01T10:00:00Z',
    },
    {
      id: 102,
      world_id: '2026-demo',
      country_code: 'USA',
      year: 2025,
      decision: { military_spend_delta: 0.25 },
      reasoning: 'Expanded autonomous naval drone interceptors across Pacific corridors and integrated AI threat-detection protocols into national power grid security.',
      historical_parallel: { name: '1983 Strategic Defense Initiative', similarity_score: 0.79 },
      projected_indicators: { gdp_per_capita: 81600, unemployment: 3.7 },
      created_at: '2025-11-15T14:30:00Z',
    },
  ],
  IND: [
    {
      id: 201,
      world_id: '2026-demo',
      country_code: 'IND',
      year: 2026,
      decision: { education_spend_delta: 0.5, tax_rate_delta: -0.3 },
      reasoning: 'Unveiled 2026 Digital Public Infrastructure Stack expansion. Linked UPI real-time payment nodes with 18 international central banks and opened new Electronics City manufacturing hubs.',
      historical_parallel: { name: '1991 Economic Liberalization Policy', similarity_score: 0.91 },
      projected_indicators: { gdp_per_capita: 2980, unemployment: 4.0 },
      created_at: '2026-07-20T08:15:00Z',
    },
  ],
  GBR: [
    {
      id: 301,
      world_id: '2026-demo',
      country_code: 'GBR',
      year: 2026,
      decision: { healthcare_spend_delta: 0.3, education_spend_delta: 0.2 },
      reasoning: 'Established the UK Global AI Safety Verification Institute in London. Issued £850M in North Sea offshore wind contracts to reduce industrial clean energy tariffs.',
      historical_parallel: { name: '1986 Financial Big Bang Reform', similarity_score: 0.82 },
      projected_indicators: { gdp_per_capita: 49400, unemployment: 4.0 },
      created_at: '2026-06-12T13:45:00Z',
    },
  ],
  CHN: [
    {
      id: 401,
      world_id: '2026-demo',
      country_code: 'CHN',
      year: 2026,
      decision: { military_spend_delta: 0.1, education_spend_delta: 0.4 },
      reasoning: 'Achieved 68% domestic silicon self-sufficiency with 2nm photonic wafer breakthroughs in Shanghai. Deployed automated AI logistics hubs across Central Asian Silk Road corridors.',
      historical_parallel: { name: '1980 Special Economic Zone Expansion', similarity_score: 0.87 },
      projected_indicators: { gdp_per_capita: 14200, unemployment: 4.8 },
      created_at: '2026-05-04T09:20:00Z',
    },
  ],
  RUS: [
    {
      id: 501,
      world_id: '2026-demo',
      country_code: 'RUS',
      year: 2026,
      decision: { military_spend_delta: 0.6 },
      reasoning: 'Expanded Northern Sea Route icebreaker fleet capacity, doubling Arctic maritime cargo throughput and settling 88% of Eurasian energy exports in non-dollar digital currencies.',
      historical_parallel: { name: '1974 BAM Railway Construction Push', similarity_score: 0.76 },
      projected_indicators: { gdp_per_capita: 14800, unemployment: 2.9 },
      created_at: '2026-04-18T16:10:00Z',
    },
  ],
};

/**
 * Provenance for the bundled samples, in the same shape the media layer writes.
 * `sample: true` marks them as synthetic demo content: not the live world and
 * not anyone's fork, so there is no real-world cutoff to attest.
 */
function sampleProvenance(nationIso: string): SimProvenance {
  return {
    fork_id: 'sample',
    parent_fork_id: null,
    divergence_date: '2026-01-01',
    sim_date: '2026-11-05',
    real_world_data_cutoff: null,
    live_world: false,
    sample: true,
    nation_iso: nationIso,
    is_counterfactual: true,
    consensus_reality: false,
  };
}

// canonical_hash here is the SHA-256 of the bundled file's raw bytes (what
// `shasum -a 256 src/assets/...` prints), which is exactly what the Verify page
// computes in the browser, so dropping a downloaded sample there finds a match.
export const DEMO_2026_MEDIA_ENTRIES: MediaEntry[] = [
  // 🗞️ Front Pages
  {
    sim_date: '2026-11-05',
    nation_iso: 'USA',
    kind: 'front_page',
    b2_url: usaFrontPage,
    manifest_uri: 'manifest://usa_2026_frontpage',
    canonical_hash: '36fb1a12c5bd99ded416c86cefcdd595bcdeac4515a0d72184dd0debbb4e67a6',
    provenance: sampleProvenance('USA'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'IND',
    kind: 'front_page',
    b2_url: indFrontPage,
    manifest_uri: 'manifest://ind_2026_frontpage',
    canonical_hash: '101b6961dc7eef6373548a8fb1216d421b737d4b6f06a838d4191d9451512c12',
    provenance: sampleProvenance('IND'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'GBR',
    kind: 'front_page',
    b2_url: gbrFrontPage,
    manifest_uri: 'manifest://gbr_2026_frontpage',
    canonical_hash: 'e5234177897c3ff7614a85c2ab375649a5b4a1ae5e7765ee535da52d709a9127',
    provenance: sampleProvenance('GBR'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'CHN',
    kind: 'front_page',
    b2_url: chnFrontPage,
    manifest_uri: 'manifest://chn_2026_frontpage',
    canonical_hash: '932ff967747c991d95cabfbd770ff6ffb12c74f79205093022df860c28c89202',
    provenance: sampleProvenance('CHN'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'RUS',
    kind: 'front_page',
    b2_url: rusFrontPage,
    manifest_uri: 'manifest://rus_2026_frontpage',
    canonical_hash: '633e68f67517d171da95fe7d0215816a530b02a1343faf9b3f0d3cd698cadd3e',
    provenance: sampleProvenance('RUS'),
  },

  // 📺 TV Broadcasts
  {
    sim_date: '2026-11-05',
    nation_iso: 'USA',
    kind: 'broadcast',
    b2_url: usaBroadcast,
    manifest_uri: 'manifest://usa_2026_broadcast',
    canonical_hash: '9ff8e3d59953a98b6b8db1c361e475eea4321276b718eeb7535486fbe47631e1',
    duration: 23,
    provenance: sampleProvenance('USA'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'IND',
    kind: 'broadcast',
    b2_url: indBroadcast,
    manifest_uri: 'manifest://ind_2026_broadcast',
    canonical_hash: '87a06e2b8c2b17c626dea44473290e6d439aced3b0305b54cd2642c08c58e4a7',
    duration: 21,
    provenance: sampleProvenance('IND'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'GBR',
    kind: 'broadcast',
    b2_url: gbrBroadcast,
    manifest_uri: 'manifest://gbr_2026_broadcast',
    canonical_hash: 'f7ae2b393fea9ed840ca3c2dff25e2c8a459f0f36a93959b92a138eb36ede6ad',
    duration: 23,
    provenance: sampleProvenance('GBR'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'CHN',
    kind: 'broadcast',
    b2_url: chnBroadcast,
    manifest_uri: 'manifest://chn_2026_broadcast',
    canonical_hash: '1045aff956915342990b73359e861dcba56d313a5de6265fa68f0a578a749373',
    duration: 21,
    provenance: sampleProvenance('CHN'),
  },
  {
    sim_date: '2026-11-05',
    nation_iso: 'RUS',
    kind: 'broadcast',
    b2_url: rusBroadcast,
    manifest_uri: 'manifest://rus_2026_broadcast',
    canonical_hash: '6d465fbb5c30842a9a0c2d3001420853d4b58efa8a86b090b7bfeee8ccf6d618',
    duration: 21,
    provenance: sampleProvenance('RUS'),
  },
];

export const DEMO_2026_WORLD_EVENTS: WorldEvent[] = [
  {
    id: 1001,
    world_id: '2026-demo',
    from_country: 'USA',
    to_country: 'IND',
    event_type: 'trade_deal',
    details: 'United States and India sign historic 2026 Semiconductor & Digital Infrastructure Accord in Bengaluru.',
    sim_year: 2026,
    created_at: '2026-08-02T14:00:00Z',
  },
  {
    id: 1002,
    world_id: '2026-demo',
    from_country: 'GBR',
    to_country: 'USA',
    event_type: 'military_posture',
    details: 'UK & US deploy joint AI-driven maritime surveillance grid across North Atlantic shipping routes.',
    sim_year: 2026,
    created_at: '2026-07-28T09:30:00Z',
  },
  {
    id: 1003,
    world_id: '2026-demo',
    from_country: 'CHN',
    to_country: 'RUS',
    event_type: 'alliance_formed',
    details: 'China and Russia expand Eurasian digital payment clearance protocol for Arctic energy shipments.',
    sim_year: 2026,
    created_at: '2026-06-15T11:20:00Z',
  },
];
