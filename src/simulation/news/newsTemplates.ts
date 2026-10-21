import type { NewsItem, NewsSeverity } from '../state';
import { getAssetUrl } from '../../config/env';

export interface NewsTemplateContext {
  playerName: string;
  cityName: string;
  day: number;
  approvalPct?: number;
  prevApprovalPct?: number;
  congestionPct?: number;
  roadName?: string;
  pctDelta?: number;
  costFormatted?: string;
  companyName?: string;
  projectTypeTitle?: string;
}

const OUTLETS_BY_CITY: Record<string, string[]> = {
  lima: ['The Lima Times', 'Andean Financial Review', 'Capital Post', 'Metropolitan Daily', 'CityLab Peru', 'National Broadcast Network'],
  buenos_aires: ['Buenos Aires Herald', 'The Daily Clarín', 'La Nación World', 'Infobae English', 'Metropolitan Express', 'Financial Gazette'],
  santiago: ['The Santiago Chronicle', 'El Mercurio Post', 'Andes Transit Review', 'Capital City News', 'Chilean Tribune'],
  cdmx: ['The Mexico City Post', 'Reforma Daily', 'Universal Financial', 'Capital Wire News', 'Metropolitan Monitor'],
};

const DEFAULT_OUTLETS = ['The Metropolitan Gazette', '24H City News', 'Urban Transit Weekly', 'Citizen Press Wire'];

const POLLSTERS = ['Ipsos Public Affairs', 'Gallup Opinion Poll', 'Urban Studies Institute', 'Metropolitan Survey Group', 'National Pulse Index'];

export function getRandomOutlet(cityId: string, seed: number): string {
  const list = OUTLETS_BY_CITY[cityId] || DEFAULT_OUTLETS;
  return list[Math.abs(seed) % list.length];
}

export function getRandomPollster(seed: number): string {
  return POLLSTERS[Math.abs(seed) % POLLSTERS.length];
}

/**
 * Enriches a basic news key or generates a full journalistic NewsItem with headline,
 * snippet, media outlet, and breaking news broadcast attributes.
 */
export function buildRichNewsItem(
  key: string,
  ctx: NewsTemplateContext,
  cityId: string,
  severityOverride?: NewsSeverity,
): Omit<NewsItem, 'id'> {
  const name = ctx.playerName || 'the Minister';
  const city = ctx.cityName || 'the city';
  const seed = (ctx.day * 1337 + key.length * 31) | 0;
  const outlet = getRandomOutlet(cityId, seed);
  const pollster = getRandomPollster(seed);

  switch (key) {
    case 'news.tookOffice': {
      return {
        day: ctx.day,
        severity: 'info',
        key,
        params: { name, city },
        outlet: `${outlet} · Front Page`,
        outletIcon: '🏛️',
        category: 'politics',
        headline: `SWEARING-IN CEREMONY: ${name.toUpperCase()} ASSUMES OFFICE AS TRANSPORTATION MINISTER`,
        snippet: `In an official ceremony, ${name} assumed command of the transit and road network in ${city} today. Faces historic infrastructure deficits and an urgent public mandate to relieve gridlock on major thoroughfares.`,
      };
    }

    case 'news.weeklyPollRise':
    case 'news.approvalRose': {
      const app = ctx.approvalPct ?? 50;
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { pct: app, name },
        outlet: `📊 ${pollster} · Latest Barometer`,
        outletIcon: '📈',
        category: 'poll',
        headline: `PUBLIC APPROVAL RISES: ${app}% OF CITIZENS BACK MINISTER ${name.toUpperCase()}`,
        snippet: `The latest public opinion study shows a surge in citizen confidence toward ${name}. Commuters cite new infrastructure corridors and measurable reductions in rush-hour bottlenecks across ${city}.`,
      };
    }

    case 'news.weeklyPollFall':
    case 'news.approvalFell': {
      const app = ctx.approvalPct ?? 35;
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { pct: app, name },
        outlet: `📊 ${pollster} · National Survey`,
        outletIcon: '📉',
        category: 'poll',
        headline: `APPROVAL SLIPS: PUBLIC SUPPORT FOR ${name.toUpperCase()} FALLS TO ${app}%`,
        snippet: `Frustration is mounting among motorists and transit riders. ${app}% of polled residents express impatience with detour delays and demand decisive action against street gridlock.`,
      };
    }

    case 'news.censureWarning': {
      const app = ctx.approvalPct ?? 22;
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { approval: app, name },
        outlet: `${outlet} · BREAKING NEWS`,
        outletIcon: '🚨',
        category: 'politics',
        isBreaking: true,
        headline: `PARLIAMENTARY ULTIMATUM: CONGRESS PREPARES CENSURE MOTION AGAINST ${name.toUpperCase()}`,
        snippet: `With approval dropping to a perilous ${app}%, opposition lawmakers have tabled a motion to impeach ${name}. "We will not allow our capital to remain paralyzed in gridlock," warned the oversight committee.`,
        breakingData: {
          speaker: 'CONG. VICTOR BUSTAMANTE · TRANSPORTATION COMMITTEE',
          chyronHeadline: `WE DEMAND THE RESIGNATION OF ${name.toUpperCase()}: TRAFFIC GRIDLOCK HAS PARALYZED THE CITY`,
          chyronColor: 'red',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Approve urgent transit relief and infrastructure projects immediately to avert congressional censure.',
        },
      };
    }

    case 'news.impeached': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · SPECIAL BULLETIN`,
        outletIcon: '⚡',
        category: 'politics',
        isBreaking: true,
        headline: `PARLIAMENT VOTES CENSURE: MINISTER ${name.toUpperCase()} OFFICIALLY IMPEACHED`,
        snippet: `In an overwhelming plenary vote, Congress revoked the ministerial mandate of ${name}. A transition commission has been appointed amidst widespread public protests.`,
        breakingData: {
          speaker: 'CONGRESSIONAL PLENARY · CENSURE MOTION PASSED',
          chyronHeadline: `IMPEACHED: PARLIAMENT REMOVES MINISTER ${name.toUpperCase()} FROM OFFICE`,
          chyronColor: 'red',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Ministerial mandate has terminated due to political destitution.',
        },
      };
    }

    case 'news.trafficIncreased': {
      const road = ctx.roadName || 'Central Avenue';
      const pct = ctx.pctDelta ?? 15;
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { road, pct },
        outlet: `${outlet} · Live Traffic Desk`,
        outletIcon: '🚗',
        category: 'traffic',
        headline: `SEVERE CONGESTION ON ${road.toUpperCase()}: COMMUTE DELAYS SURGE BY ${pct}%`,
        snippet: `Drivers report miles-long vehicle queues on ${road}. Bus operators voice frustration over bottlenecks and unmanaged construction spillover.`,
      };
    }

    case 'news.trafficDecreased': {
      const road = ctx.roadName || 'Main Thoroughfare';
      const pct = ctx.pctDelta ?? 18;
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { road, pct },
        outlet: `${outlet} · Urban Mobility`,
        outletIcon: '🛣️',
        category: 'traffic',
        headline: `TRAFFIC RELIEF ON ${road.toUpperCase()}: VEHICLE SPEEDS IMPROVE BY ${pct}%`,
        snippet: `Transit reforms implemented by Minister ${name} are yielding tangible results on ${road}. Average corridor travel times decreased significantly during peak hours.`,
      };
    }

    case 'news.gridlockCrisis': {
      const cong = ctx.congestionPct ?? 76;
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { congestion: cong, name },
        outlet: `${outlet} · LIVE EMERGENCY`,
        outletIcon: '🚨',
        category: 'traffic',
        isBreaking: true,
        headline: `CITYWIDE PARALYSIS: CONGESTION EXCEEDS ${cong}% ACROSS METROPOLITAN CORRIDORS`,
        snippet: `Transit unions and commuters across ${city} demand decisive leadership from ${name} as traffic gridlock hits record highs. Major intersections are blocked and emergency vehicles struggle to pass.`,
        breakingData: {
          speaker: 'CONG. VICTOR BUSTAMANTE · EMERGENCY STATEMENT',
          chyronHeadline: `CITYWIDE CRISIS: CONGRESS SUMMONS ${name.toUpperCase()} OVER RECORD GRIDLOCK`,
          chyronColor: 'red',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Approve mass transit projects immediately and clear blocked thoroughfares.',
        },
      };
    }

    case 'news.projectApproved': {
      const road = ctx.roadName || 'Corridor';
      const cost = ctx.costFormatted || '$100M';
      return {
        day: ctx.day,
        severity: 'info',
        key,
        params: { name: road, cost },
        outlet: `${outlet} · Public Works Desk`,
        outletIcon: '📋',
        category: 'projects',
        headline: `MINISTRY GIVES GREEN LIGHT TO ${road.toUpperCase()} PROJECT (${cost})`,
        snippet: `Minister ${name} approved the procurement resolution authorizing ground-breaking on ${road}. The project includes dedicated transit lanes and smart signaling.`,
      };
    }

    case 'news.constructionStarted': {
      const road = ctx.roadName || 'the avenue';
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { name: road },
        outlet: `${outlet} · Traffic & Roads`,
        outletIcon: '🚧',
        category: 'projects',
        headline: `LANES CLOSED ON ${road.toUpperCase()}: HEAVY MACHINERY MOBILIZES`,
        snippet: `Crews have begun excavation and barricade setup along ${road}. Authorities advise motorists to take designated detour routes due to temporary capacity reduction.`,
      };
    }

    case 'news.projectHalfway': {
      const road = ctx.roadName || 'the corridor';
      return {
        day: ctx.day,
        severity: 'info',
        key,
        params: { name: road },
        outlet: `${outlet} · Infrastructure Tracking`,
        outletIcon: '🏗️',
        category: 'projects',
        headline: `PROJECT ON ${road.toUpperCase()} REACHES 50% COMPLETION MILESTONE`,
        snippet: `Ministry supervisors report that work on ${road} is progressing on schedule under ${name}'s oversight, with final track pouring and paving scheduled next.`,
      };
    }

    case 'news.subwayCompleted': {
      const road = ctx.roadName || 'Subway Line';
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { name: road, minister: name },
        outlet: `${outlet} · SPECIAL BROADCAST`,
        outletIcon: '🚇',
        category: 'projects',
        isBreaking: true,
        headline: `HISTORIC MILESTONE: ${name.toUpperCase()} INAUGURATES NEW METRO LINE IN ${city.toUpperCase()}`,
        snippet: `Amidst cheering crowds, the major underground rapid transit expansion on ${road} officially entered passenger service. Hundreds of thousands will now commute underground in minutes.`,
        breakingData: {
          speaker: 'OFFICIAL INAUGURAL ADDRESS · TRANSPORTATION MINISTER',
          chyronHeadline: `HISTORIC EXPANSION: ${name.toUpperCase()} CUTS RIBBON ON NEW UNDERGROUND METRO`,
          chyronColor: 'blue',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Celebrate the achievement and continue expanding the metropolitan mass transit network.',
        },
      };
    }

    case 'news.projectCompleted': {
      const road = ctx.roadName || 'the avenue';
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { name: road },
        outlet: `${outlet} · Front Page`,
        outletIcon: '🎉',
        category: 'projects',
        headline: `RIBBON-CUTTING: NEW INFRASTRUCTURE OPENS ON ${road.toUpperCase()}`,
        snippet: `Official opening on ${road}. Minister ${name} delivered the completed transit infrastructure to the public today. Significant traffic relief is anticipated immediately.`,
      };
    }

    case 'news.projectCancelled': {
      const road = ctx.roadName || 'the project';
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { name: road },
        outlet: `${outlet} · Business & Politics`,
        outletIcon: '🛑',
        category: 'projects',
        headline: `CONTRACT TERMINATED: MINISTRY RESCINDS CONTRACT ON ${road.toUpperCase()}`,
        snippet: `Citing technical non-compliance and contractor delays, ${name}'s office canceled the contract on ${road}. Allocated funds have been refunded to the public budget.`,
      };
    }

    case 'news.contractAwardedSuspicion': {
      const company = ctx.companyName || 'the winning contractor';
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { company },
        outlet: `${outlet} · Investigative Unit`,
        outletIcon: '🔍',
        category: 'investigation',
        headline: `AUDIT SCRUTINY OVER CONTRACT AWARDED TO ${company.toUpperCase()}`,
        snippet: `Investigative reporting raises questions regarding the procurement process awarded to ${company}. Opposition lawmakers call for an audit into the bidding awards of Minister ${name}.`,
      };
    }

    case 'news.investigationStarted': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · ATTORNEY GENERAL'S DESK`,
        outletIcon: '⚖️',
        category: 'investigation',
        isBreaking: true,
        headline: `SPECIAL PROSECUTOR OPENS CRIMINAL PROBE INTO DESPATCH OF ${name.toUpperCase()}`,
        snippet: `The Anti-Corruption Task Force has initiated formal preliminary proceedings following whistleblower testimony and evidence of contractor kickbacks in transit awards.`,
        breakingData: {
          speaker: 'DR. CARLOS ALFARO · SPECIAL ANTI-CORRUPTION PROSECUTOR',
          chyronHeadline: `PROSECUTOR OPENS PROBE INTO ALLEGED KICKBACKS IN CONTRACTS OF ${name.toUpperCase()}`,
          chyronColor: 'red',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Cooperate transparently with prosecutors and audit all active contracts.',
        },
      };
    }

    case 'news.arrestedCorruption': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · LIVE POLICE ACTION`,
        outletIcon: '🚨',
        category: 'investigation',
        isBreaking: true,
        headline: `ARREST WARRANT EXECUTED: POLICE RAID DESPATCH OF ${name.toUpperCase()}`,
        snippet: `Judicial orders have brought a dramatic halt to ${name}'s ministerial tenure following undeniable evidence of illicit enrichment and systemic contractor bribery.`,
        breakingData: {
          speaker: 'NATIONAL POLICE · JUDICIAL ENFORCEMENT DESK',
          chyronHeadline: `AUTHORITIES ARREST ${name.toUpperCase()} ON SEVERE BRIBERY & CORRUPTION CHARGES`,
          chyronColor: 'red',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Ministerial mandate has terminated following judicial arrest.',
        },
      };
    }

    case 'news.annualBudget': {
      const amount = ctx.costFormatted || '$650M';
      return {
        day: ctx.day,
        severity: 'info',
        key,
        params: { amount },
        outlet: `${outlet} · Fiscal Economy`,
        outletIcon: '💰',
        category: 'economy',
        headline: `NATIONAL TREASURY TRANSFERS ${amount} ANNUAL BUDGET FOR TRANSPORT INFRASTRUCTURE`,
        snippet: `The Treasury transferred the annual public transit allocation to Minister ${name}'s accounts today. Funds are earmarked for high-impact transit corridors and road preservation.`,
      };
    }

    case 'news.electionWon': {
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { name },
        outlet: `${outlet} · ELECTION RESULTS`,
        outletIcon: '🗳️',
        category: 'politics',
        isBreaking: true,
        headline: `ELECTORAL VICTORY: CITIZENS RENEW MANDATE FOR MINISTER ${name.toUpperCase()}`,
        snippet: `In general elections, voters resoundingly endorsed the metropolitan transit modernization achieved under ${name}. A new five-year term begins with a fiscal victory bonus.`,
        breakingData: {
          speaker: 'ELECTORAL COMMISSION · OFFICIAL RESULTS',
          chyronHeadline: `ELECTORAL MANDATE RENEWED: ${name.toUpperCase()} WINS NEW FIVE-YEAR TERM`,
          chyronColor: 'blue',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Commence the new five-year mandate with renewed momentum.',
        },
      };
    }

    case 'news.electionLost': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · GENERAL ELECTIONS`,
        outletIcon: '🗳️',
        category: 'politics',
        isBreaking: true,
        headline: `ELECTION DEFEAT: CITIZENS VOTE FOR CHANGE, OUSTING MINISTER ${name.toUpperCase()}`,
        snippet: `Persistent frustration with vehicular congestion tipped the ballot against ${name}. The minister's tenure concludes following the general election defeat.`,
        breakingData: {
          speaker: 'ELECTORAL BROADCAST · ELECTION NIGHT',
          chyronHeadline: `VOTERS REJECT INCUMBENT TRANSIT RECORD: ${name.toUpperCase()} OUSTED`,
          chyronColor: 'red',
          image: getAssetUrl('/assets/congressman.png'),
          urgentActionPrompt: 'Ministerial mandate has concluded via general election defeat.',
        },
      };
    }

    case 'news.weeklyEditorial':
    default: {
      return {
        day: ctx.day,
        severity: severityOverride || 'info',
        key,
        params: { name },
        outlet: `${outlet} · Editorial Column`,
        outletIcon: '📰',
        category: 'politics',
        headline: `WEEKLY TRANSIT BRIEFING: URBAN MOBILITY CHALLENGES FOR MINISTER ${name.toUpperCase()}`,
        snippet: `Urban policy analysts review transit progress across ${city}. With active roadworks underway and vehicle demand surging, ${name}'s administration enters a crucial phase.`,
      };
    }
  }
}
