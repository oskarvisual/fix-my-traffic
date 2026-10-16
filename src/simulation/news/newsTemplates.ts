import type { NewsItem, NewsSeverity } from '../state';

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
  lima: ['Diario El Comercio', 'RPP Noticias', 'Diario Gestión', 'La República', 'Canal N', 'Exitosa Noticias'],
  buenos_aires: ['Diario Clarín', 'La Nación', 'Infobae', 'TN Noticias', 'Ámbito Financiero', 'Radio Mitre'],
  santiago: ['El Mercurio', 'La Tercera', 'Radio Bío-Bío', 'Emol', 'DF Financiero', 'Canal 13 Central'],
  cdmx: ['El Universal', 'Reforma', 'Milenio Diario', 'El Financiero', 'W Radio', 'Noticieros Televisa'],
};

const DEFAULT_OUTLETS = ['El Diario Metropolitano', 'Cadena 24 Horas', 'Semanario Económico', 'Voz del Ciudadano'];

const POLLSTERS = ['Ipsos Opinión Pública', 'Datum Internacional', 'Instituto de Estudios Urbanos', 'GfK Sondeos', 'Encuestadora Pulso'];

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
  const name = ctx.playerName || 'el Ministro';
  const city = ctx.cityName || 'la ciudad';
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
        outlet: `${outlet} · Portada Principal`,
        outletIcon: '🏛️',
        category: 'politica',
        headline: `JURAMENTA ${name.toUpperCase()} COMO NUEVO MINISTRO DE TRANSPORTE`,
        snippet: `En ceremonia oficial, ${name} asumió hoy el control de la red vial en ${city}. Enfrenta un déficit histórico de infraestructura y la promesa urgente de descongestionar las principales avenidas.`,
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
        outlet: `📊 ${pollster} · Último Barómetro`,
        outletIcon: '📈',
        category: 'encuesta',
        headline: `SUBE LA APROBACIÓN: ${app}% DE LA POBLACIÓN RESPALDA LA GESTIÓN DE ${name.toUpperCase()}`,
        snippet: `El último estudio de opinión revela un repunte en la confianza ciudadana hacia ${name}. Usuarios destacan los nuevos corredores y la reducción gradual en las horas de atasco en ${city}.`,
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
        outlet: `📊 ${pollster} · Sondeo Nacional`,
        outletIcon: '📉',
        category: 'encuesta',
        headline: `CAE EL RESPALDO: APROBACIÓN DE ${name.toUpperCase()} RETROCEDE A ${app}%`,
        snippet: `Crece el escepticismo entre choferes y pasajeros. ${app}% de los encuestados reprueba la lentitud en habilitar rutas alternas y exige mano dura contra el desorden vehicular.`,
      };
    }

    case 'news.censureWarning': {
      const app = ctx.approvalPct ?? 22;
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { approval: app, name },
        outlet: `${outlet} · URGENTE`,
        outletIcon: '🚨',
        category: 'politica',
        isBreaking: true,
        headline: `¡ULTIMÁTUM EN EL CONGRESO! PREPARAN MOCIÓN DE CENSURA CONTRA ${name.toUpperCase()}`,
        snippet: `Con la aprobación en un crítico ${app}%, diversas bancadas parlamentarias firmaron una moción para interpelar a ${name}. "No permitiremos que la ciudad siga paralizada", advirtió la comisión fiscalizadora.`,
        breakingData: {
          speaker: 'CONG. VÍCTOR BUSTAMANTE · COMISIÓN DE TRANSPORTES',
          chyronHeadline: `EXIGIMOS LA RENUNCIA DE ${name.toUpperCase()}: LA CIUDAD HA COLAPSADO`,
          chyronColor: 'red',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'Comparecer ante el Congreso y ejecutar medidas viales urgentes',
        },
      };
    }

    case 'news.impeached': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · EDICIÓN EXTRAORDINARIA`,
        outletIcon: '⚡',
        category: 'politica',
        isBreaking: true,
        headline: `HISTÓRICO: CONGRESO APRUEBA LA CENSURA Y DESTITUYE A ${name.toUpperCase()}`,
        snippet: `Con una votación abrumadora en el pleno, el parlamento revocó el mandato ministerial de ${name}. Se nombra una comisión de transición inmediata ante la indignación social.`,
        breakingData: {
          speaker: 'PLENO DEL CONGRESO · MOCIÓN DE CENSURA APROBADA',
          chyronHeadline: `DESTITUIDO: CONGRESO VOTA CENSURA CONTRA EL MINISTRO ${name.toUpperCase()}`,
          chyronColor: 'red',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'El mandato ministerial ha concluido por destitución política.',
        },
      };
    }

    case 'news.trafficIncreased': {
      const road = ctx.roadName || 'Avenida Central';
      const pct = ctx.pctDelta ?? 15;
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { road, pct },
        outlet: `${outlet} · Tránsito en Vivo`,
        outletIcon: '🚗',
        category: 'trafico',
        headline: `EMBOTELLAMIENTO CRÍTICO EN ${road.toUpperCase()}: RETRASOS AUMENTAN EN ${pct}%`,
        snippet: `Conductores reportan colas kilométricas en ${road}. Choferes de buses expresan su frustración por la falta de fiscalización y desvíos mal señalizados.`,
      };
    }

    case 'news.trafficDecreased': {
      const road = ctx.roadName || 'Avenida Principal';
      const pct = ctx.pctDelta ?? 18;
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { road, pct },
        outlet: `${outlet} · Movilidad Urbana`,
        outletIcon: '🛣️',
        category: 'trafico',
        headline: `ALIVIO EN ${road.toUpperCase()}: FLUIDEZ VEHICULAR MEJORA EN ${pct}%`,
        snippet: `Las reformas implementadas por el despacho de ${name} comienzan a rendir frutos en ${road}. Los tiempos de traslado promedio cayeron notablemente durante la hora punta.`,
      };
    }

    case 'news.gridlockCrisis': {
      const cong = ctx.congestionPct ?? 76;
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { congestion: cong, name },
        outlet: `${outlet} · ÚLTIMA HORA`,
        outletIcon: '🚨',
        category: 'trafico',
        isBreaking: true,
        headline: `PARÁLISIS TOTAL: CONGESTIÓN SUPERA EL ${cong}% Y AMENAZAN CON PARO`,
        snippet: `Los gremios de transporte público de ${city} exigen la salida de ${name} tras registrarse el peor colapso circulatorio del año. Intersecciones bloqueadas y ambulancias atrapadas en el tráfico.`,
        breakingData: {
          speaker: 'CONG. VÍCTOR BUSTAMANTE · PRONUNCIAMIENTO DE URGENCIA',
          chyronHeadline: `CAOS EN LA CIUDAD: CONGRESO EXIGE EXPLICACIONES A ${name.toUpperCase()}`,
          chyronColor: 'red',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'Aprobar proyectos de transporte masivo y despejar corredores',
        },
      };
    }

    case 'news.projectApproved': {
      const road = ctx.roadName || 'la arteria vial';
      const cost = ctx.costFormatted || '$100M';
      return {
        day: ctx.day,
        severity: 'info',
        key,
        params: { name: road, cost },
        outlet: `${outlet} · Obras Públicas`,
        outletIcon: '📋',
        category: 'obras',
        headline: `MINISTERIO DA LUZ VERDE A OBRA EN ${road.toUpperCase()} POR ${cost}`,
        snippet: `El ministro ${name} firmó la resolución que autoriza el inicio de obras en ${road}. El proyecto contempla optimización de carriles y señalización inteligente.`,
      };
    }

    case 'news.constructionStarted': {
      const road = ctx.roadName || 'la avenida';
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { name: road },
        outlet: `${outlet} · Tránsito Local`,
        outletIcon: '🚧',
        category: 'obras',
        headline: `CIERRAN CARRILES EN ${road.toUpperCase()}: MAQUINARIA INICIA TRABAJOS`,
        snippet: `Comenzaron las excavaciones en ${road}. Autoridades recomiendan tomar rutas alternas ante la inevitable reducción de capacidad durante la fase constructiva.`,
      };
    }

    case 'news.projectHalfway': {
      const road = ctx.roadName || 'la vía';
      return {
        day: ctx.day,
        severity: 'info',
        key,
        params: { name: road },
        outlet: `${outlet} · Seguimiento de Infraestructura`,
        outletIcon: '🏗️',
        category: 'obras',
        headline: `OBRA EN ${road.toUpperCase()} ALCANZA EL 50% DE EJECUCIÓN`,
        snippet: `Supervisores del ministerio confirman que los trabajos en ${road} avanzan de acuerdo al cronograma previsto por ${name}, a la espera de la pavimentación final.`,
      };
    }

    case 'news.subwayCompleted': {
      const road = ctx.roadName || 'Línea de Metro';
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { name: road, minister: name },
        outlet: `${outlet} · TRANSMISIÓN ESPECIAL`,
        outletIcon: '🚇',
        category: 'obras',
        isBreaking: true,
        headline: `DÍA HISTÓRICO: ${name.toUpperCase()} INAUGURA LA NUEVA LÍNEA DE METRO EN ${city.toUpperCase()}`,
        snippet: `En medio de aplausos ciudadanos, entró en operación oficial la megaobra subterránea en ${road}. Cientos de miles de pasajeros viajarán bajo tierra en minutos.`,
        breakingData: {
          speaker: 'TRANSMISIÓN EN CADENA · MINISTRO DE TRANSPORTES',
          chyronHeadline: `HISTÓRICO: ${name.toUpperCase()} CORTA CINTA DE NUEVA LÍNEA SUBTERRÁNEA`,
          chyronColor: 'blue',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'Celebrar el éxito y continuar la expansión de la red',
        },
      };
    }

    case 'news.projectCompleted': {
      const road = ctx.roadName || 'la avenida';
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { name: road },
        outlet: `${outlet} · Portada`,
        outletIcon: '🎉',
        category: 'obras',
        headline: `INAUGURACIÓN: CORREDOR VIAL EN ${road.toUpperCase()} ABRE AL PÚBLICO`,
        snippet: `Corte de cinta en ${road}. El ministro ${name} entregó la infraestructura terminada. Se espera un alivio sustancial en el flujo vehicular desde hoy.`,
      };
    }

    case 'news.projectCancelled': {
      const road = ctx.roadName || 'la obra';
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { name: road },
        outlet: `${outlet} · Economía y Negocios`,
        outletIcon: '🛑',
        category: 'obras',
        headline: `RESCISIÓN DE CONTRATO: MINISTERIO CANCELA OBRAS EN ${road.toUpperCase()}`,
        snippet: `Por discrepancias técnicas y retrasos injustificados, el despacho de ${name} anuló el contrato en ${road}. Se liquidarán penalidades contractuales.`,
      };
    }

    case 'news.contractAwardedSuspicion': {
      const company = ctx.companyName || 'la constructora ganadora';
      return {
        day: ctx.day,
        severity: 'warning',
        key,
        params: { company },
        outlet: `${outlet} · Unidad de Investigación`,
        outletIcon: '🔍',
        category: 'fiscalia',
        headline: `DENUNCIAN PRESUNTO FAVORITISMO A ${company.toUpperCase()}`,
        snippet: `Reportaje revela sospechas en la licitación otorgada a ${company}. Bancadas opositoras exigen auditar las reuniones previas del ministro ${name}.`,
      };
    }

    case 'news.investigationStarted': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · FISCALÍA DE LA NACIÓN`,
        outletIcon: '⚖️',
        category: 'fiscalia',
        isBreaking: true,
        headline: `FISCALÍA ABRE INVESTIGACIÓN PENAL CONTRA EL DESPACHO DE ${name.toUpperCase()}`,
        snippet: `El Ministerio Público dispuso diligencias preliminares tras recibir audios y testimonios sobre presuntos sobornos en adjudicación de contratos viales.`,
        breakingData: {
          speaker: 'DR. CARLOS ALFARO · FISCAL PROVINCIAL ANTICORRUPCIÓN',
          chyronHeadline: `FISCALÍA INVESTIGA PRESUNTAS COIMAS EN CONTRATOS DEL MINISTRO ${name.toUpperCase()}`,
          chyronColor: 'red',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'Cooperar con la fiscalía y transparentar licitaciones',
        },
      };
    }

    case 'news.arrestedCorruption': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · ALLANAMIENTO EN VIVO`,
        outletIcon: '🚨',
        category: 'fiscalia',
        isBreaking: true,
        headline: `ORDEN DE DETENCIÓN: POLICÍA INTERVIENE DESPACHO DE ${name.toUpperCase()}`,
        snippet: `Mandato judicial detiene la gestión ministerial de ${name} por pruebas contundentes de enriquecimiento ilícito y cobro sistemático de coimas.`,
        breakingData: {
          speaker: 'POLICÍA ANTICORRUPCIÓN · INTERVENCIÓN JUDICIAL',
          chyronHeadline: `DETIENEN A ${name.toUpperCase()} POR GRAVES CARGOS DE CORRUPCIÓN`,
          chyronColor: 'red',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'El mandato ministerial ha concluido por intervención judicial.',
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
        outlet: `${outlet} · Economía Fiscal`,
        outletIcon: '💰',
        category: 'economia',
        headline: `TESORO PÚBLICO TRANSFIERE ${amount} PARA EL PRESUPUESTO ANUAL VIAL`,
        snippet: `El Ministerio de Economía transfirió la partida presupuestaria anual a las cuentas de ${name}. Se priorizarán megaobras de alto impacto y mantenimiento de vías.`,
      };
    }

    case 'news.electionWon': {
      return {
        day: ctx.day,
        severity: 'success',
        key,
        params: { name },
        outlet: `${outlet} · RESULTADOS ELECTORALES`,
        outletIcon: '🗳️',
        category: 'politica',
        isBreaking: true,
        headline: `RESPALDO EN LAS URNAS: CIUDADANÍA RATIFICA LA GESTIÓN DE ${name.toUpperCase()}`,
        snippet: `En elecciones generales, los votantes respaldaron la transformación vial lograda por ${name}. Inicia un nuevo mandato quinquenal con bono presupuestario.`,
        breakingData: {
          speaker: 'CENTRO DE CÓMPUTO ELECTORAL · RESULTADOS OFICIALES',
          chyronHeadline: `VICTORIA ELECTORAL: ${name.toUpperCase()} CONTINUARÁ EN EL CARGO`,
          chyronColor: 'blue',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'Iniciar el nuevo mandato quinquenal con fuerza renovada',
        },
      };
    }

    case 'news.electionLost': {
      return {
        day: ctx.day,
        severity: 'danger',
        key,
        params: { name },
        outlet: `${outlet} · ELECCIONES GENERALES`,
        outletIcon: '🗳️',
        category: 'politica',
        isBreaking: true,
        headline: `DERROTA EN LAS URNAS: CIUDADANÍA VOTA POR EL CAMBIO Y PONE FIN AL MANDATO DE ${name.toUpperCase()}`,
        snippet: `El descontento por el persistente caos en el tránsito inclinó la balanza electoral en contra de ${name}. Concluye su periodo en el Ministerio.`,
        breakingData: {
          speaker: 'FLASH ELECTORAL · ELECCIONES GENERALES',
          chyronHeadline: `ELECTORADO RECHAZA RÉCORD VIAL: ${name.toUpperCase()} DEJA EL CARGO`,
          chyronColor: 'red',
          image: '/assets/congressman.png',
          urgentActionPrompt: 'El mandato ministerial ha concluido por vía electoral.',
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
        outlet: `${outlet} · Columna de Opinión`,
        outletIcon: '📰',
        category: 'politica',
        headline: `BALANCE DE LA SEMANA: LOS DESAFÍOS DEL MINISTRO ${name.toUpperCase()}`,
        snippet: `Analistas urbanos debaten el rumbo del transporte en ${city}. Con obras en ejecución y una demanda creciente, la gestión de ${name} entra en semanas decisivas.`,
      };
    }
  }
}
