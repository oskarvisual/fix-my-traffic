import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { loadCity, type LoadedCity } from './app/cityLoader';
import { GameSession } from './app/GameSession';
import { createNewGame } from './simulation/game';
import { SaveGameRepository } from './storage/saveGameRepository';
import { IndexedDbStore, isIndexedDbAvailable, MemoryStore } from './storage/keyValueStore';
import { TrafficMap } from './components/TrafficMap';
import { formatCurrency, formatDate, formatKm, formatPercent } from './ui/format';
import { getAllAvenueSegments } from './simulation/traffic/network';
import { estimateProject, type ProjectEstimate } from './simulation/projects/estimate';
import { congestionLevel } from './simulation/traffic/congestion';
import { dateForDay } from './simulation/time/clock';
import { CONGESTION_LEVELS } from './config/traffic';
import { PROJECT_CONFIG, type ProjectTypeId } from './config/projects';
import { generateContractorBids, type ContractorBid } from './simulation/projects/contractors';
import {
  calculateSubwayLengthKm,
  estimateSubwayCost,
  findSubwayCatchmentSegments,
  type SubwayStationPoint,
} from './simulation/projects/subwayHelper';

import { t } from './i18n';
import type { NewsItem } from './simulation/state';
import { getAllCities, findCity, type CityCatalogEntry } from './data/cityCatalog';
import { searchOsmCities, importCity, type OsmCitySearchResult } from './data/cityImporter';
import { TutorialModal } from './components/TutorialModal';
import { GitHubBadge } from './components/GitHubBadge';
import { getAssetUrl } from './config/env';

export default function App() {
  const [screen, setScreen] = useState<'title' | 'city' | 'loading' | 'game'>('title');
  const [loadingCityId, setLoadingCityId] = useState<string>('lima');
  const [loadedCity, setLoadedCity] = useState<LoadedCity | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [saveRepo] = useState<SaveGameRepository>(() => {
    const store = isIndexedDbAvailable()
      ? new IndexedDbStore('fix-my-traffic-saves')
      : new MemoryStore();
    return new SaveGameRepository(store);
  });

  // Interaction State
  const [mapLayerMode, setMapLayerMode] = useState<'surface' | 'subterranean'>('surface');
  const [selectedRoadIndices, setSelectedRoadIndices] = useState<number[]>([]);
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectTypeId>('bikeLane');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftIndices, setDraftIndices] = useState<number[]>([]);
  const [selectedBidIndex, setSelectedBidIndex] = useState<number>(0);

  // Freeform Subway Drafting State
  const [isDraftingSubway, setIsDraftingSubway] = useState(false);
  const [subwayDraftStations, setSubwayDraftStations] = useState<SubwayStationPoint[]>([]);

  // Player Name & Cabinet Appointment State
  const [playerNameInput, setPlayerNameInput] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('fmt_player_name')) || 'Minister';
  });
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [pendingCityId, setPendingCityId] = useState<string | null>(null);

  // Right Panel Tab State: 'news' | 'inspector'
  const [rightPanelTab, setRightPanelTab] = useState<'news' | 'inspector'>('news');

  // TV Breaking News Modal State
  const [activeBreakingNews, setActiveBreakingNews] = useState<NewsItem | null>(null);
  const [dismissedBreakingIds, setDismissedBreakingIds] = useState<Set<string>>(() => new Set());

  // Full Press Archive Modal State
  const [isNewsArchiveModalOpen, setIsNewsArchiveModalOpen] = useState(false);

  // Interactive Tutorial Modal State
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialInitialStep, setTutorialInitialStep] = useState(0);

  // Custom City Importer State
  const [catalogCities, setCatalogCities] = useState<CityCatalogEntry[]>(() => getAllCities());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [searchResults, setSearchResults] = useState<OsmCitySearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importingCityName, setImportingCityName] = useState<string>('');
  const [importStatusMessage, setImportStatusMessage] = useState('');
  const [importProgressPercent, setImportProgressPercent] = useState(0);

  // Debounced Nominatim search for cities
  useEffect(() => {
    if (!isImportModalOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearchingCities(false);
      return;
    }
    setIsSearchingCities(true);
    setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const results = await searchOsmCities(q);
        setSearchResults(results);
      } catch (err: unknown) {
        setSearchError(err instanceof Error ? err.message : 'Error searching cities');
      } finally {
        setIsSearchingCities(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchQuery, isImportModalOpen]);

  const handleSelectAndImportCity = async (selected: OsmCitySearchResult) => {
    setIsImporting(true);
    setImportingCityName(selected.name);
    setImportStatusMessage('Starting import from OpenStreetMap...');
    setImportProgressPercent(5);
    setSearchError(null);
    try {
      const res = await importCity(selected, (msg, pct) => {
        setImportStatusMessage(msg);
        setImportProgressPercent(pct);
      });
      setCatalogCities(getAllCities());
      setIsImporting(false);
      setIsImportModalOpen(false);
      handlePromptPlayerName(res.cityId);
    } catch (err: unknown) {
      setIsImporting(false);
      setSearchError(
        `Error importing ${selected.name}: ${err instanceof Error ? err.message : String(err)}. Please try again or choose another city.`,
      );
    }
  };

  const handlePromptPlayerName = (cityId: string) => {
    setPendingCityId(cityId);
    setIsNameModalOpen(true);
  };

  const handleConfirmPlayerName = () => {
    const name = playerNameInput.trim() || 'Minister';
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('fmt_player_name', name);
    }
    setIsNameModalOpen(false);
    if (pendingCityId) {
      startNewGame(pendingCityId, name);
    }
  };

  const handleDismissBreakingNews = () => {
    if (activeBreakingNews) {
      setDismissedBreakingIds((prev) => new Set(prev).add(activeBreakingNews.id));
      setActiveBreakingNews(null);
      sessionRef.current?.setSpeed(1); // Resume game at 1x
    }
  };

  const handleCloseTutorial = () => {
    setIsTutorialOpen(false);
    sessionRef.current?.setSpeed(1); // Resume simulation at 1x
  };

  const handleOpenTutorial = () => {
    sessionRef.current?.setSpeed(0); // Pause simulation while reading tutorial
    setTutorialInitialStep(0);
    setIsTutorialOpen(true);
  };

  // Initialize storage repository and auto-resume

  useEffect(() => {
    let cancelled = false;
    void saveRepo
      .load()
      .then(async (saved) => {
        if (!saved || cancelled) return;
        setScreen('loading');
        try {
          const city = await loadCity(saved.cityId, saved.datasetVersion);
          if (cancelled) return;
          sessionRef.current?.stop();
          setLoadedCity(city);
          const sess = new GameSession(city.ctx, saved, saveRepo);
          sessionRef.current = sess;
          setSession(sess);
          sess.start();
          setScreen('game');
        } catch (error) {
          if (cancelled) return;
          console.error('Failed to resume game', error);
          setResumeError(error instanceof Error ? error.message : String(error));
          setScreen('title');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load saved game', error);
        setResumeError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [saveRepo]);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
    },
    [],
  );

  // Hook into GameSession state
  const sessionSnapshot = useSyncExternalStore(
    session ? session.subscribe : () => () => {},
    session ? session.getSnapshot : () => null,
  );

  // Automatically pop up Breaking News TV Broadcast when a critical event occurs
  useEffect(() => {
    if (!sessionSnapshot) return;
    const latestBreaking = sessionSnapshot.state.news.find(
      (item) => item.isBreaking && !dismissedBreakingIds.has(item.id),
    );
    if (latestBreaking) {
      setActiveBreakingNews(latestBreaking);
      sessionRef.current?.setSpeed(0); // Pause simulation while watching breaking news
    }
  }, [sessionSnapshot?.state.news, dismissedBreakingIds]);

  // Primary selected road index for inspection
  const primarySelectedRoadIndex = selectedRoadIndices[0] ?? null;

  // Detect if selected road has an active project on it
  const activeProjectOnSegment = useMemo(() => {
    if (selectedRoadIndices.length === 0 || !loadedCity || !sessionSnapshot) return null;
    const segIds = new Set(
      selectedRoadIndices.map((i) => loadedCity.ctx.network.segments[i]?.id).filter(Boolean),
    );
    return sessionSnapshot.state.projects.find((p) => p.segmentIds.some((id) => segIds.has(id))) ?? null;
  }, [selectedRoadIndices, loadedCity, sessionSnapshot]);

  // Recalculate preview estimate when draft changes
  const projectEstimate = useMemo<ProjectEstimate | null>(() => {
    if (!isDrafting || !sessionSnapshot || !loadedCity || draftIndices.length === 0) {
      return null;
    }
    return estimateProject(sessionSnapshot.state, loadedCity.ctx, {
      typeId: selectedProjectType,
      indices: draftIndices,
    });
  }, [isDrafting, selectedProjectType, draftIndices, sessionSnapshot, loadedCity]);

  // Generate 3 contractor bids when estimate exists
  const contractorBids = useMemo<ContractorBid[]>(() => {
    if (!projectEstimate || !sessionSnapshot) return [];
    return generateContractorBids(
      selectedProjectType,
      projectEstimate.cost,
      projectEstimate.constructionDays,
      sessionSnapshot.state.clock.day,
    );
  }, [projectEstimate, selectedProjectType, sessionSnapshot]);

  const selectedBid = contractorBids[selectedBidIndex] ?? contractorBids[0];

  // Freeform Subway length and cost
  const subwayLengthKm = useMemo(() => {
    return calculateSubwayLengthKm(subwayDraftStations);
  }, [subwayDraftStations]);

  const subwayBaseCost = useMemo(() => {
    return estimateSubwayCost(subwayLengthKm, subwayDraftStations.length);
  }, [subwayLengthKm, subwayDraftStations.length]);

  const subwayContractorBids = useMemo<ContractorBid[]>(() => {
    if (!sessionSnapshot || subwayDraftStations.length < 2) return [];
    return generateContractorBids(
      'subway',
      subwayBaseCost,
      Math.max(300, Math.round(subwayLengthKm * 90)),
      sessionSnapshot.state.clock.day,
    );
  }, [sessionSnapshot, subwayDraftStations.length, subwayBaseCost, subwayLengthKm]);

  const selectedSubwayBid = subwayContractorBids[selectedBidIndex] ?? subwayContractorBids[0];

  const allAvenueIndices = useMemo(() => {
    if (primarySelectedRoadIndex === null || !loadedCity) return [];
    return getAllAvenueSegments(loadedCity.ctx.network, primarySelectedRoadIndex);
  }, [primarySelectedRoadIndex, loadedCity]);

  const isFullAvenueSelected = useMemo(() => {
    if (selectedRoadIndices.length <= 1 || allAvenueIndices.length <= 1) return false;
    return allAvenueIndices.every((i) => selectedRoadIndices.includes(i));
  }, [selectedRoadIndices, allAvenueIndices]);

  const selectedTotalKm = useMemo(() => {
    if (!loadedCity || selectedRoadIndices.length === 0) return 0;
    return (
      selectedRoadIndices.reduce((sum, i) => sum + (loadedCity.ctx.network.segments[i]?.lengthM ?? 0), 0) /
      1000
    );
  }, [selectedRoadIndices, loadedCity]);

  const avgCongestion = useMemo(() => {
    if (selectedRoadIndices.length === 0 || !sessionSnapshot) return 0;
    const sum = selectedRoadIndices.reduce((acc, i) => acc + (sessionSnapshot.traffic.congestion[i] ?? 0), 0);
    return sum / selectedRoadIndices.length;
  }, [selectedRoadIndices, sessionSnapshot]);

  const startNewGame = async (cityId: string, customPlayerName?: string) => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setSession(null);
    setSelectedRoadIndices([]);
    setDraftIndices([]);
    setIsDrafting(false);
    setIsDraftingSubway(false);
    setSubwayDraftStations([]);
    setMapLayerMode('surface');
    setResumeError(null);
    setActiveBreakingNews(null);
    setDismissedBreakingIds(new Set());
    setRightPanelTab('news');
    setLoadingCityId(cityId);
    setScreen('loading');
    try {
      const city = await loadCity(cityId);
      setLoadedCity(city);

      const finalPlayerName = customPlayerName || playerNameInput.trim() || 'Minister';
      const newGameState = createNewGame(
        {
          cityId,
          datasetVersion: city.bundle.roads.version.datasetVersion,
          trafficProviderId: city.traffic.providerId,
          seed: Date.now(),
          playerName: finalPlayerName,
        },
        city.ctx,
      );

      const sess = new GameSession(city.ctx, newGameState, saveRepo);
      sessionRef.current = sess;
      setSession(sess);
      sess.start();
      sess.setSpeed(0); // Pause simulation while reading appointment induction & tutorial
      void sess.save();
      setScreen('game');
      setTutorialInitialStep(0);
      setIsTutorialOpen(true);
    } catch (err) {
      console.error(err);
      alert('Failed to load city data: ' + err);
      setScreen('city');
    }
  };

  const handleSelectSegment = (index: number | null) => {
    if (isDraftingSubway) return;
    if (index === null) {
      setSelectedRoadIndices([]);
      setDraftIndices([]);
      return;
    }
    if (isDrafting) {
      setDraftIndices((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
      );
    } else {
      setSelectedRoadIndices([index]);
      setRightPanelTab('inspector');
    }
  };

  // Double-click on a segment selects the whole avenue!
  const handleDoubleClickSegment = (index: number) => {
    if (isDraftingSubway) return;
    if (!loadedCity) return;
    setRightPanelTab('inspector');
    const avenueIndices = getAllAvenueSegments(loadedCity.ctx.network, index);
    if (isDrafting) {
      // In drafting mode: toggle or add entire avenue
      setDraftIndices((prev) => {
        const hasAll = avenueIndices.length > 0 && avenueIndices.every((i) => prev.includes(i));
        if (hasAll) {
          const set = new Set(avenueIndices);
          return prev.filter((i) => !set.has(i));
        } else {
          return Array.from(new Set([...prev, ...avenueIndices]));
        }
      });
    } else {
      // In normal mode: if already showing the full avenue, toggle back to single segment
      setSelectedRoadIndices((prev) => {
        const isAlreadyFullAvenue =
          prev.length > 1 && avenueIndices.length > 1 && avenueIndices.every((i) => prev.includes(i));
        return isAlreadyFullAvenue ? [index] : avenueIndices;
      });
    }
  };

  const startDraftingType = (typeId: ProjectTypeId) => {
    setRightPanelTab('inspector');
    if (typeId === 'subway') {
      startDraftingSubway();
      return;
    }
    setIsDraftingSubway(false);
    setSubwayDraftStations([]);
    setMapLayerMode('surface'); // Auto-switch back to surface view for surface tools (bike lane, BRT, etc.)
    setSelectedProjectType(typeId);
    setIsDrafting(true);
    if (selectedRoadIndices.length > 0 && draftIndices.length === 0) {
      setDraftIndices(selectedRoadIndices);
    }
  };


  const handleApproveDraft = () => {
    if (!session || !isDrafting || draftIndices.length === 0 || !selectedBid) return;
    const res = session.approve({
      typeId: selectedProjectType,
      indices: draftIndices,
      contractorBid: selectedBid,
    });
    if (res.ok) {
      setIsDrafting(false);
      const targetIndices = [...draftIndices];
      setDraftIndices([]);
      setSelectedRoadIndices(targetIndices); // Auto-select approved project route!
    } else {
      alert(`Cannot approve project: ${t(`draft.error.${res.reason}` as string)}`);
    }
  };

  const handleCancelDraft = () => {
    setIsDrafting(false);
    setDraftIndices([]);
  };

  const handleAddSubwayStation = (lngLat: [number, number]) => {
    const num = subwayDraftStations.length + 1;
    setSubwayDraftStations((prev) => [
      ...prev,
      { name: `Station ${num}`, coordinates: lngLat },
    ]);
  };

  const startDraftingSubway = () => {
    setRightPanelTab('inspector');
    setIsDrafting(false);
    setDraftIndices([]);
    setIsDraftingSubway(true);
    setSubwayDraftStations([]);
    setSelectedBidIndex(0);
    setMapLayerMode('subterranean'); // auto-switch to subterranean view!
  };


  const handleApproveSubwayDraft = () => {
    if (!session || !loadedCity || subwayDraftStations.length < 2) return;
    const bid = subwayContractorBids[selectedBidIndex] ?? subwayContractorBids[0];
    const tunnelCoordinates = subwayDraftStations.map((s) => s.coordinates);
    const catchmentIndices = findSubwayCatchmentSegments(loadedCity.ctx.network, subwayDraftStations);

    const res = session.approve({
      typeId: 'subway',
      indices: catchmentIndices.length > 0 ? catchmentIndices : [0],
      contractorBid: bid,
      subwayStations: subwayDraftStations,
      subwayAlignment: tunnelCoordinates,
      customName: `Subway Line (${subwayDraftStations.length} stns · ${subwayLengthKm} km)`,
      customCost: subwayBaseCost,
      customStreetKm: subwayLengthKm,
    });

    if (res.ok) {
      setIsDraftingSubway(false);
      setSubwayDraftStations([]);
      setMapLayerMode('surface');
    } else {
      alert(`Cannot approve subway: ${t(`draft.error.${res.reason}` as string)}`);
    }
  };

  const handleCancelSubwayDraft = () => {
    setIsDraftingSubway(false);
    setSubwayDraftStations([]);
    setMapLayerMode('surface');
  };

  if (screen === 'title') {
    return (
      <main className="start-screen">
        <p className="eyebrow">Lima · Transport & Politics Simulation</p>
        <h1>
          FIX MY
          <br />
          <i>TRAFFIC</i>
        </h1>
        <p className="tagline">{t('app.tagline')}</p>
        <p style={{ color: '#889988', marginTop: '-20px', marginBottom: '30px' }}>
          {t('app.subtitle')}
        </p>
        <button className="primary" onClick={() => setScreen('city')}>
          {t('app.newGame')} <span>→</span>
        </button>
        {resumeError && <p className="load-error">{t('city.loadError', { error: resumeError })}</p>}
        <p className="disclaimer">{t('app.simulatedDisclaimer')}</p>
        <GitHubBadge />
      </main>
    );
  }

  if (screen === 'city') {
    const difficultyBadges: Record<string, { label: string; color: string; bg: string }> = {
      easy: { label: 'Easy', color: '#4ade80', bg: 'rgba(34, 197, 94, 0.15)' },
      normal: { label: 'Medium', color: '#fde047', bg: 'rgba(234, 179, 8, 0.15)' },
      hard: { label: 'Hard', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)' },
      extreme: { label: 'Extreme', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)' },
    };

    const cityCoordinates: Record<string, string> = {
      buenos_aires: '34° S · 58° W',
      santiago: '33° S · 70° W',
      lima: '12° S · 77° W',
      cdmx: '19° N · 99° W',
    };

    return (
      <main className="city-screen" style={{ minHeight: '100vh', padding: '6vh max(5vw, 24px)' }}>
        <button className="back" onClick={() => setScreen('title')}>
          ← {t('city.back')}
        </button>
        <p className="eyebrow">{t('city.selectTitle')}</p>
        <h1 style={{ marginBottom: '24px' }}>Select your city</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', maxWidth: '1100px', width: '100%' }}>
          {catalogCities.map((city) => {
            const badge = difficultyBadges[city.difficulty] ?? difficultyBadges.normal;
            const transitSummary =
              city.transitSummaryKey.startsWith('city.') && t(city.transitSummaryKey) !== city.transitSummaryKey
                ? t(city.transitSummaryKey)
                : `Real road network of ${city.name} with ${city.streetsCount.toLocaleString()} corridors and simulated demand model.`;

            return (
              <section key={city.id} className="city-card" style={{ margin: 0, padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div className="map-mark" style={{ minHeight: '90px', width: '90px', padding: '14px', fontSize: '26px', flexShrink: 0 }}>
                    {city.badgeCode}
                    <small style={{ marginTop: '16px', fontSize: '9px' }}>{cityCoordinates[city.id] ?? `${city.badgeCode}`}</small>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          color: badge.color,
                          backgroundColor: badge.bg,
                          border: `1px solid ${badge.color}40`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {badge.label}
                      </span>
                      <small style={{ color: '#88a090', fontSize: '12px' }}>{city.flag}</small>
                    </div>
                    <h2 style={{ fontSize: '22px', margin: '4px 0 6px' }}>{city.name}, {city.country}</h2>
                    <p style={{ fontSize: '12px', margin: 0, color: '#a0b4a4', lineHeight: 1.45 }}>
                      {transitSummary}
                    </p>
                  </div>
                </div>

                <dl style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div>
                    <dt>{t('city.annualBudget')}</dt>
                    <dd style={{ color: '#b8e86c', fontSize: '14px' }}>${(city.initialBudget / 1e6).toFixed(0)}M</dd>
                  </div>
                  <div>
                    <dt>{t('city.roadNetwork')}</dt>
                    <dd style={{ fontSize: '12px' }}>{city.streetsCount.toLocaleString()} Streets</dd>
                  </div>
                  <div>
                    <dt>{t('city.population')}</dt>
                    <dd style={{ fontSize: '12px' }}>{city.population?.value ? (city.population.value / 1e6).toFixed(1) + 'M pop.' : 'N/A'}</dd>
                  </div>
                </dl>

                <button
                  className="primary"
                  style={{ width: '100%', marginTop: '6px', padding: '10px 14px', fontSize: '13px' }}
                  onClick={() => handlePromptPlayerName(city.id)}
                >

                  {t('city.becomeMinister')} <span>→</span>
                </button>
              </section>
            );
          })}

          {/* Interactive Card: Not your city? */}
          <section
            className="city-card custom-city-card"
            style={{
              margin: 0,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'center',
              border: '2px dashed #3a5c44',
              background: 'radial-gradient(ellipse at top, rgba(34, 84, 52, 0.25), rgba(12, 22, 16, 0.6))',
              cursor: 'pointer',
              minHeight: '260px',
              transition: 'border-color 0.2s, transform 0.2s',
            }}
            onClick={() => {
              setIsImportModalOpen(true);
              setSearchQuery('');
              setSearchResults([]);
              setSearchError(null);
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <div style={{ fontSize: '38px', lineHeight: 1 }}>🌍</div>
              <h2 style={{ fontSize: '20px', margin: 0, color: '#e8f4ec', fontWeight: 600 }}>
                Not your city?
              </h2>
              <p style={{ fontSize: '13px', margin: 0, color: '#90a896', maxWidth: '280px', lineHeight: 1.45 }}>
                Search any city worldwide. We will download its real street network so you can take office immediately.
              </p>
            </div>

            <button
              className="primary"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '16px',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsImportModalOpen(true);
                setSearchQuery('');
                setSearchResults([]);
                setSearchError(null);
              }}
            >
              <span>🔍</span> Search & Import Another City
            </button>
          </section>
        </div>

        {/* Modal: Search & Import City */}
        {isImportModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 12, 8, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isImporting) {
                setIsImportModalOpen(false);
              }
            }}
          >
            <div
              style={{
                backgroundColor: '#0e1a13',
                border: '1px solid #284432',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '620px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(74, 222, 128, 0.1)',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #1e3325',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '20px', margin: 0, color: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🌍</span> {isImporting ? `Importing ${importingCityName}` : 'Search & Import City'}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#88a090' }}>
                    {isImporting
                      ? 'Retrieving OpenStreetMap geometry and balancing the network...'
                      : 'Choose any city or metropolis worldwide to become its Minister of Transportation.'}
                  </p>
                </div>
                {!isImporting && (
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#88a090',
                      fontSize: '22px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {isImporting ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 8px', gap: '20px' }}>
                    <div style={{ fontSize: '48px', animation: 'pulse 1.5s infinite' }}>🛰️</div>
                    <div style={{ width: '100%', textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#86efac', marginBottom: '8px' }}>
                        {importStatusMessage}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '10px',
                          backgroundColor: '#162b1e',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid #284432',
                        }}
                      >
                        <div
                          style={{
                            width: `${importProgressPercent}%`,
                            height: '100%',
                            backgroundColor: '#22c55e',
                            transition: 'width 0.4s ease',
                            boxShadow: '0 0 12px rgba(34, 197, 94, 0.6)',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#688272' }}>
                        <span>OpenStreetMap Overpass API</span>
                        <span>{importProgressPercent}%</span>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#14241a', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e3325', fontSize: '12px', color: '#90a896', lineHeight: 1.5, textAlign: 'center' }}>
                      💡 Real street geometry, transit routes, and primary avenues are processed in your browser and saved to local storage.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Input */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g. Montevideo, Bogotá, Madrid, London, Tokyo, Chicago..."
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          paddingLeft: '44px',
                          fontSize: '15px',
                          backgroundColor: '#122218',
                          border: '1px solid #2c4a36',
                          borderRadius: '10px',
                          color: '#e8f4ec',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ position: 'absolute', left: '16px', top: '15px', fontSize: '16px', color: '#688272' }}>
                        🔍
                      </span>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '12px',
                            background: 'transparent',
                            border: 'none',
                            color: '#88a090',
                            fontSize: '16px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Status/Error */}
                    {isSearchingCities && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#86efac', fontSize: '13px', padding: '4px 0' }}>
                        <span>⏳</span> Searching cities on OpenStreetMap Nominatim...
                      </div>
                    )}

                    {searchError && (
                      <div
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          color: '#fca5a5',
                          fontSize: '13px',
                          lineHeight: 1.4,
                        }}
                      >
                        ⚠️ {searchError}
                      </div>
                    )}

                    {/* Search Results List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
                      {searchResults.map((item) => (
                        <div
                          key={item.placeId}
                          style={{
                            backgroundColor: '#14241a',
                            border: '1px solid #233b2a',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h3 style={{ margin: 0, fontSize: '16px', color: '#f0fdf4' }}>
                                {item.name}
                              </h3>
                              <span style={{ fontSize: '12px', color: '#90a896' }}>
                                ({item.country})
                              </span>
                            </div>
                            <p
                              style={{
                                margin: '4px 0 0',
                                fontSize: '11px',
                                color: '#688272',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.displayName}
                            </p>
                          </div>
                          <button
                            className="primary"
                            style={{
                              padding: '8px 16px',
                              fontSize: '12px',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
                            onClick={() => handleSelectAndImportCity(item)}
                          >
                            Import & Play →
                          </button>
                        </div>
                      ))}

                      {searchResults.length === 0 && searchQuery.trim().length >= 2 && !isSearchingCities && !searchError && (
                        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#88a090', fontSize: '13px' }}>
                          No cities found matching that name. Try searching the official or alternate name.
                        </div>
                      )}

                      {searchQuery.trim().length < 2 && (
                        <div style={{ textAlign: 'center', padding: '24px 10px', color: '#688272', fontSize: '13px' }}>
                          Type at least 2 letters to search cities in any country.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}


        {/* Modal: Cabinet Swearing-In & Ministerial Appointment */}
        {isNameModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 12, 8, 0.88)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#0e1a13',
                border: '1px solid #284432',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '480px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(74, 222, 128, 0.15)',
              }}
            >
              <div>
                <div style={{ fontSize: '38px', marginBottom: '8px' }}>🏛️</div>
                <h2 style={{ fontSize: '22px', margin: '0 0 6px', color: '#f0fdf4' }}>
                  Ministry of Transportation
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#88a090', lineHeight: 1.45 }}>
                  You will assume command of the road network in <b>{findCity(pendingCityId || '')?.name || 'the city'}</b>.
                  Enter your official name for executive decrees, cabinet press releases, and newspaper headlines.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: 700 }}>
                  Minister's Full Name
                </label>
                <input
                  type="text"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  placeholder="e.g. Carlos Mendoza, Elena Rostova..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmPlayerName();
                  }}
                  style={{
                    width: '100%',
                    padding: '13px 16px',
                    fontSize: '15px',
                    backgroundColor: '#122218',
                    border: '1px solid #2c4a36',
                    borderRadius: '8px',
                    color: '#e8f4ec',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="advance"
                  style={{ flex: 1, padding: '12px' }}
                  onClick={() => setIsNameModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  style={{ flex: 2, padding: '12px', justifyContent: 'center', fontSize: '14px' }}
                  onClick={handleConfirmPlayerName}
                >
                  Take Office & Swear In ⚖️
                </button>
              </div>
            </div>
          </div>
        )}
        <GitHubBadge />
      </main>
    );
  }



  if (screen === 'loading' || !sessionSnapshot || !loadedCity) {
    return (
      <main className="start-screen">
        <h2>{t('city.loading', { city: findCity(loadingCityId)?.name ?? 'City' })}</h2>
      </main>
    );
  }

  const { state, traffic, speed } = sessionSnapshot;
  const selectedRoad =
    primarySelectedRoadIndex !== null ? loadedCity.ctx.network.segments[primarySelectedRoadIndex] : null;

  // Next elections calculation (5 years = 1825 days)
  const daysInTerm = state.clock.day - state.politics.term.startDay;
  const daysUntilElection = Math.max(0, 1825 - daysInTerm);

  return (
    <main className="game-shell">
      {/* Top HUD */}
      <header className="hud">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            sessionRef.current?.stop();
            sessionRef.current = null;
            setSession(null);
            setScreen('title');
          }}
        >
          FIX MY <i>TRAFFIC</i>
        </a>
        <div className="city-name">
          {loadedCity.bundle.roads.city.name}, {loadedCity.bundle.roads.city.country}{' '}
          <small>{loadedCity.bundle.roads.city.name} · Real OSM Data</small>
        </div>

        <div className="metric">
          <small>{t('hud.date')}</small>
          {formatDate(dateForDay(state.clock.day))}
        </div>

        <div className="metric">
          <small>{t('hud.budget')}</small>
          {formatCurrency(state.finance.publicBudget)}
        </div>

        <div className="metric">
          <small>{t('hud.personal')}</small>
          <span style={{ color: state.finance.totalBribesReceived > 0 ? '#eab308' : '#eef2eb', fontWeight: 600 }}>
            {formatCurrency(state.finance.personalBalance)}
          </span>
        </div>

        <div className="metric approval">
          <small>{t('hud.approval')}</small>
          <b style={{ color: state.politics.approval >= 0.45 ? '#b8e86c' : state.politics.approval >= 0.25 ? '#eab308' : '#ef4444' }}>
            {formatPercent(state.politics.approval)}
          </b>
        </div>

        <div
          className="metric"
          title={`Corruption Suspicion (Prosecutor / Audit Office): ${formatPercent(state.politics.corruption)}.\n${
            state.politics.corruption === 0
              ? '100% clean administration with no audit complaints or bribes. Increases if you accept contractor kickbacks or award tenders to controversial bidders.'
              : state.politics.corruption >= 0.35
              ? 'DANGER! The Anti-Corruption Prosecutor has opened formal criminal inquiries against your office.'
              : 'Warning: Investigative reporters and auditors are scrutinizing your public procurement awards.'
          }`}
          style={{ cursor: 'help' }}
        >
          <small>{t('hud.corruption')}</small>
          <b style={{ color: state.politics.corruption >= 0.50 ? '#ef4444' : state.politics.corruption >= 0.25 ? '#eab308' : '#22c55e' }}>
            {formatPercent(state.politics.corruption)}
          </b>
        </div>

        <div className="metric">
          <small>Term {state.politics.term.number}</small>
          <span>{daysUntilElection}d left</span>
        </div>

        {/* Speed Controls: 60 real seconds = 1 game day at 1x */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 5, 15, 30].map((s) => {
            const isPaused = speed === 0;
            const isPauseButton = s === 0;
            const isSelected = speed === s;

            let background = 'transparent';
            let color = '#dff7a8';
            let border = '1px solid #233728';
            let boxShadow = 'none';

            if (isPauseButton) {
              if (isPaused) {
                background = '#ef4444';
                color = '#ffffff';
                border = '1px solid #dc2626';
                boxShadow = '0 0 14px rgba(239, 68, 68, 0.8)';
              } else {
                background = 'rgba(239, 68, 68, 0.08)';
                color = '#fca5a5';
                border = '1px solid rgba(239, 68, 68, 0.3)';
              }
            } else if (isSelected) {
              background = '#b8e86c';
              color = '#101713';
              border = '1px solid #b8e86c';
              boxShadow = '0 0 8px rgba(184, 232, 108, 0.35)';
            }

            return (
              <button
                key={s}
                className="advance"
                style={{
                  background,
                  color,
                  border,
                  boxShadow,
                  fontWeight: isSelected ? 800 : isPauseButton ? 700 : 500,
                  padding: isPauseButton && isPaused ? '6px 10px' : '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={
                  isPauseButton
                    ? isPaused
                      ? 'Simulation is PAUSED — Click 1× to resume'
                      : 'Pause simulation'
                    : `${s}× Speed`
                }
                onClick={() => session?.setSpeed(s)}
              >
                {isPauseButton ? (isPaused ? '⏸ PAUSED' : '⏸') : `${s}×`}
              </button>
            );
          })}
          <button
            className="advance"
            style={{ padding: '6px 8px' }}
            title="Advance 30 simulated days instantly"
            onClick={() => session?.advanceDays(30)}
          >
            +30d
          </button>
          <button
            className="advance"
            style={{
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(184, 232, 108, 0.08)',
              borderColor: 'rgba(184, 232, 108, 0.35)',
              color: '#dff7a8',
            }}
            title="Open Mayor's Induction Guide & Tutorial"
            onClick={handleOpenTutorial}
          >
            <span style={{ fontSize: '13px' }}>❓</span>
            <span>Tutorial</span>
          </button>
        </div>
      </header>

      {/* Level Switcher (Surface vs Subterranean) */}
      <div className="map-layer-switcher">
        <button
          className={mapLayerMode === 'surface' ? 'active' : ''}
          onClick={() => setMapLayerMode('surface')}
        >
          ☀️ Surface
        </button>
        <button
          className={`subterranean ${mapLayerMode === 'subterranean' ? 'active' : ''}`}
          onClick={() => setMapLayerMode('subterranean')}
        >
          🚇 Underground
        </button>
      </div>

      {/* Main Map with Google Maps Traffic + Public Transit */}
      <TrafficMap
        cityId={loadedCity.bundle.roads.city.id}
        network={loadedCity.ctx.network}
        traffic={traffic}
        transit={loadedCity.bundle.transit}
        activeProjects={state.projects}
        center={loadedCity.bundle.roads.city.center}
        selectedSegmentIndices={selectedRoadIndices}
        corridorIndices={draftIndices}
        mapLayerMode={mapLayerMode}
        isDraftingSubway={isDraftingSubway}
        subwayDraftStations={subwayDraftStations}
        onSelectSegment={handleSelectSegment}
        onDoubleClickSegment={handleDoubleClickSegment}
        onAddSubwayStation={handleAddSubwayStation}
      />

      {/* Left Sidebar: Projects and Infrastructure Tools */}
      <aside className="left-panel">
        <p className="eyebrow">{t('tools.title')}</p>
        <h2>{t('tools.title')}</h2>

        {/* Active Selection / Corridor Indicator with Deselect button */}
        {(selectedRoadIndices.length > 0 || draftIndices.length > 0) && (
          <div
            style={{
              backgroundColor: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: '6px',
              padding: '8px 10px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#00f0ff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              title={
                selectedRoadIndices.length > 1
                  ? `${selectedRoadIndices.length} segments selected`
                  : loadedCity.ctx.network.segments[selectedRoadIndices[0] ?? draftIndices[0]]?.name || '1 segment selected'
              }
            >
              <span>🛣️ </span>
              <strong>
                {selectedRoadIndices.length > 1
                  ? `${selectedRoadIndices.length} segments`
                  : loadedCity.ctx.network.segments[selectedRoadIndices[0] ?? draftIndices[0]]?.name || 'Selected road'}
              </strong>
            </div>
            <button
              className="advance"
              style={{
                fontSize: '10px',
                padding: '3px 8px',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: '#f87171',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: 700,
              }}
              title="Deselect all selected roads"
              onClick={() => {
                setSelectedRoadIndices([]);
                setDraftIndices([]);
                setIsDrafting(false);
              }}
            >
              ✕ Deselect
            </button>
          </div>
        )}

        {/* Bike Lane */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'bikeLane' ? 'active' : ''}`}
          onClick={() => startDraftingType('bikeLane')}
        >
          <span>{PROJECT_CONFIG.bikeLane.icon}</span>
          <span>
            {t('tools.bikeLane')}
            <small>{t('tools.bikeLaneDesc')}</small>
          </span>
        </button>

        {/* BRT Bus Corridor */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'brt' ? 'active' : ''}`}
          onClick={() => startDraftingType('brt')}
        >
          <span>{PROJECT_CONFIG.brt.icon}</span>
          <span>
            {t('tools.brt')}
            <small>{t('tools.brtDesc')}</small>
          </span>
        </button>

        {/* Elevated Metro */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'elevatedMetro' ? 'active' : ''}`}
          onClick={() => startDraftingType('elevatedMetro')}
        >
          <span>{PROJECT_CONFIG.elevatedMetro.icon}</span>
          <span>
            {t('tools.elevatedMetro')}
            <small>{t('tools.elevatedMetroDesc')}</small>
          </span>
        </button>

        {/* Subterranean Metro */}
        <button
          className={`project-type ${isDraftingSubway ? 'active' : ''}`}
          onClick={() => startDraftingSubway()}
        >
          <span>{PROJECT_CONFIG.subway.icon}</span>
          <span>
            {t('tools.subway')}
            <small>Freeform Alignment · TBM</small>
          </span>
        </button>

        {/* Roundabout / Interchange */}
        <button
          className={`project-type ${isDrafting && selectedProjectType === 'roundabout' ? 'active' : ''}`}
          onClick={() => startDraftingType('roundabout')}
        >
          <span>{PROJECT_CONFIG.roundabout.icon}</span>
          <span>
            {t('tools.roundabout')}
            <small>{t('tools.roundaboutDesc')}</small>
          </span>
        </button>

        {/* Legend */}
        <div className="legend">
          <p className="eyebrow">{t('map.legend')}</p>
          {CONGESTION_LEVELS.map((lvl) => (
            <span key={lvl.id}>
              <i style={{ background: lvl.color }} />
              {t(`congestion.${lvl.id}` as string)}
            </span>
          ))}
          {/* Dynamic Real Public Transit for the selected city */}
          {loadedCity.bundle.transit.routes.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #28372b' }}>
              <p className="eyebrow" style={{ fontSize: '9px', marginBottom: '8px', color: '#94a99b' }}>
                Transit Network ({loadedCity.bundle.roads.city.name})
              </p>
              <div className="transit-legend-list">
                {loadedCity.bundle.transit.routes.map((r) => (
                  <div key={r.id} className="transit-legend-item" title={r.name}>
                    <span
                      className="transit-bar"
                      style={{ background: r.colour || '#00e676' }}
                    />
                    <span className="transit-text" style={{ color: r.colour || '#eef2eb' }}>
                      {r.ref ? <b>[{r.ref}] </b> : ''}{r.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Projects List */}
        <div style={{ marginTop: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p className="eyebrow" style={{ margin: 0 }}>{t('tools.activeProjects')}</p>
            <span style={{ fontSize: '10px', color: '#88a090', background: '#132017', padding: '1px 6px', borderRadius: '10px' }}>
              {state.projects.length}
            </span>
          </div>
          {state.projects.length === 0 ? (
            <p className="muted">{t('tools.noProjects')}</p>
          ) : (
            state.projects.map((p) => {
              const projectSegmentIndices = p.segmentIds
                .map((id) => loadedCity.ctx.network.indexById.get(id))
                .filter((idx): idx is number => idx !== undefined);

              const isSelected =
                projectSegmentIndices.length > 0 &&
                selectedRoadIndices.length > 0 &&
                projectSegmentIndices.some((idx) => selectedRoadIndices.includes(idx));

              return (
                <div
                  key={p.id}
                  style={{
                    background: isSelected ? '#1c2e22' : '#0e1711',
                    border: isSelected ? '1px solid #00f0ff' : '1px solid #26382b',
                    padding: '10px 12px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Click to inspect this work site on the map"
                  onClick={() => {
                    if (projectSegmentIndices.length > 0) {
                      setSelectedRoadIndices(projectSegmentIndices);
                    }
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.3, marginBottom: '6px' }}>
                    {PROJECT_CONFIG[p.typeId]?.icon} {p.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#fb923c', fontWeight: 600 }}>
                      🚧 {t(`project.phase.${p.phase}` as string)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#b8e86c', fontWeight: 800 }}>
                      {formatPercent(p.progress)}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#88a090', marginBottom: '8px' }}>
                    Contractor: <span style={{ color: '#d1ded4' }}>{p.contractor?.name ?? 'Ministry'}</span>
                  </div>
                  <button
                    className="advance"
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: '11px',
                      borderColor: '#ef4444',
                      color: '#fca5a5',
                      background: 'rgba(239, 68, 68, 0.08)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Terminate contract for "${p.name}"? Part of the budget will be recovered and closed lanes will reopen.`)) {
                        session?.cancel(p.id);
                      }
                    }}
                  >
                    ✕ Terminate Contract
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Sidebar: Contextual Info & Inspector / Draft Proposal */}
      <aside className="right-panel">
        {/* Tab switcher: News & Opinion vs Road Inspector */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '16px',
            background: '#0d1811',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid #243829',
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              background: rightPanelTab === 'news' ? '#22c55e' : 'transparent',
              color: rightPanelTab === 'news' ? '#05230e' : '#8fa293',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onClick={() => setRightPanelTab('news')}
          >
            <span>📰</span> News & Opinion
            {state.news.some((n) => n.isBreaking) && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 8px #ef4444',
                  display: 'inline-block',
                }}
              />
            )}
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              background: rightPanelTab === 'inspector' ? '#22c55e' : 'transparent',
              color: rightPanelTab === 'inspector' ? '#05230e' : '#8fa293',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
            onClick={() => setRightPanelTab('inspector')}
          >
            <span>🛣️</span> Road Inspector {primarySelectedRoadIndex !== null || isDrafting ? '●' : ''}
          </button>
        </div>

        {rightPanelTab === 'news' ? (
          <div>
            {/* Citizen Opinion Barometer Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, #112218, #182e20)',
                border: '1px solid #2a4432',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eyebrow" style={{ margin: 0, color: '#86efac' }}>
                  📊 Public Opinion Barometer
                </span>
                <small style={{ color: '#688272', fontSize: '10px' }}>Datum / Ipsos</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '32px',
                    fontWeight: 900,
                    color:
                      state.politics.approval >= 0.45
                        ? '#4ade80'
                        : state.politics.approval >= 0.25
                        ? '#facc15'
                        : '#ef4444',
                    fontFamily: 'DM Mono, monospace',
                  }}
                >
                  {formatPercent(state.politics.approval)}
                </span>
                <span style={{ fontSize: '12px', color: '#c4cec5', lineHeight: 1.3 }}>
                  Approval rating for Minister <b>{state.playerName}</b>
                </span>
              </div>
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: state.politics.approval < 0.25 ? '#fca5a5' : '#88a090',
                  fontWeight: state.politics.approval < 0.25 ? 600 : 400,
                }}
              >
                {state.politics.approval >= 0.5
                  ? '🌟 Citizens perceive tangible traffic improvements and strongly back your infrastructure plans.'
                  : state.politics.approval >= 0.25
                  ? '⚠️ Growing impatience. Commuters demand faster works and decongested arterials.'
                  : '🚨 RED ALERT! Massive street protests and imminent congressional censure threat.'}
              </div>
            </div>

            {/* News List */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <p className="eyebrow" style={{ margin: 0 }}>Live Press Dispatches</p>
              <small style={{ color: '#688272', fontSize: '10px' }}>{state.news.length} dispatches</small>
            </div>

            {/* Display only the latest 3 dispatches */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {state.news.slice(0, 3).map((item) => {
                const isCrit = item.isBreaking || item.severity === 'danger';
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.isBreaking || item.breakingData) {
                        setActiveBreakingNews(item);
                        sessionRef.current?.setSpeed(0);
                      }
                    }}
                    style={{
                      backgroundColor: isCrit ? 'rgba(239, 68, 68, 0.08)' : '#101913',
                      border: isCrit ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #233427',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      cursor: (item.isBreaking || item.breakingData) ? 'pointer' : 'default',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#86efac', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{item.outletIcon || '📰'}</span> {item.outlet || 'Official Ministerial Bulletin'}
                      </span>
                      <small style={{ color: '#688272', fontSize: '10px', fontFamily: 'DM Mono, monospace' }}>
                        Day {item.day}
                      </small>
                    </div>

                    <h4
                      style={{
                        margin: '0 0 6px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: isCrit ? '#fca5a5' : '#f0fdf4',
                        lineHeight: 1.35,
                      }}
                    >
                      {item.headline || t(item.key as string, item.params)}
                    </h4>

                    {item.snippet && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#90a896', lineHeight: 1.45 }}>
                        {item.snippet}
                      </p>
                    )}

                    {(item.isBreaking || item.breakingData) && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '10px',
                          color: '#f87171',
                          fontWeight: 700,
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        <span>🔴</span> Live TV Broadcast · View Alert →
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Button to open full press archive modal */}
            <button
              className="advance"
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#122218',
                borderColor: '#2d4c38',
                color: '#86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setIsNewsArchiveModalOpen(true)}
            >
              <span>📜</span> View Full Press Archive ({state.news.length} Articles) →
            </button>
          </div>
        ) : isDraftingSubway ? (

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="eyebrow" style={{ color: '#c084fc', margin: 0 }}>Subterranean · Freeform Mode</p>
              <button
                className="advance"
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={handleCancelSubwayDraft}
              >
                Close ✕
              </button>
            </div>
            <h2>🚇 Underground Subway (TBM)</h2>
            <p className="muted" style={{ fontSize: '12px' }}>
              Click anywhere on the map to place underground stations. The tunnel boring machine (TBM) will excavate between stations freely.
            </p>

            <div className="proposal">
              <span>
                Stations placed: <b>{subwayDraftStations.length}</b>
              </span>
              <span>
                Tunnel alignment: <b>{formatKm(subwayLengthKm)}</b>
              </span>
              <span>
                Estimated cost:{' '}
                <b>{formatCurrency(Math.round(subwayBaseCost * (selectedSubwayBid?.costMultiplier ?? 1)))}</b>
              </span>
              <span>
                Surface disruption: <b style={{ color: '#86efac' }}>Minimal (access shafts only)</b>
              </span>
              <span>
                Projected relief: <b className="positive">-40% area traffic relief</b>
              </span>
            </div>

            {subwayDraftStations.length > 0 && (
              <div style={{ margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <p className="eyebrow" style={{ margin: 0 }}>Station Alignment</p>
                  <button
                    className="advance"
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                    onClick={() => setSubwayDraftStations((prev) => prev.slice(0, -1))}
                  >
                    ↩ Undo last
                  </button>
                </div>
                <div className="subway-stations-list">
                  {subwayDraftStations.map((st, idx) => (
                    <div key={idx} className="station-item">
                      <span>🚇 {st.name}</span>
                      <small style={{ color: '#889988' }}>
                        {st.coordinates[0].toFixed(3)}, {st.coordinates[1].toFixed(3)}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bidding proposals for subway */}
            {subwayContractorBids.length > 0 && (
              <>
                <p className="eyebrow" style={{ margin: '8px 0 4px' }}>Subway Construction Procurement</p>
                <div className="bidding-list">
                  {subwayContractorBids.map((bid, idx) => (
                    <div
                      key={bid.id}
                      className={`contractor-card ${selectedBidIndex === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedBidIndex(idx)}
                    >
                      <div className="contractor-name">
                        <span>{bid.name}</span>
                        {bid.bribeOffer > 0 ? (
                          <span className="bribe-badge">💰 Kickback: +{formatCurrency(bid.bribeOffer)}</span>
                        ) : bid.reputation === 'excellent' ? (
                          <span className="tech-badge">🛡️ Clean Audit Record</span>
                        ) : (
                          <span className="risk-badge">⚠️ Audit Scrutiny Risk</span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11px', color: '#c4cec5' }}>
                        {bid.headline}
                      </p>
                      <ul className="pro-list">
                        {bid.pros.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                      <ul className="con-list">
                        {bid.cons.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#889988' }}>
                        <span>Cost: {Math.round(bid.costMultiplier * 100)}%</span>
                        {bid.corruptionRisk > 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            🚨 Fiscal scrutiny: +{Math.round(bid.corruptionRisk * 100)}%
                          </span>
                        ) : (
                          <span style={{ color: '#86efac' }}>✓ 0% fiscal suspicion</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedSubwayBid && selectedSubwayBid.corruptionRisk > 0 && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid #ef4444',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      margin: '10px 0 8px',
                      fontSize: '11px',
                      color: '#fca5a5',
                      lineHeight: 1.4,
                    }}
                  >
                    🚨 <b>Awarding tender to {selectedSubwayBid.name}:</b> Adds <b>+{Math.round(selectedSubwayBid.corruptionRisk * 100)}%</b> to Corruption Suspicion
                    {selectedSubwayBid.bribeOffer > 0 ? ` and transfers +${formatCurrency(selectedSubwayBid.bribeOffer)} kickback to your personal account.` : '.'}
                  </div>
                )}

                <button
                  className="primary full"
                  disabled={
                    subwayDraftStations.length < 2 ||
                    state.finance.publicBudget < subwayBaseCost * (selectedSubwayBid?.costMultiplier ?? 1)
                  }
                  onClick={handleApproveSubwayDraft}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>
                      {subwayDraftStations.length < 2
                        ? 'Place at least 2 stations on the map'
                        : 'Award Contract & Launch Tunnel Boring'}
                    </span>
                    <span>→</span>
                  </div>
                  {subwayDraftStations.length >= 2 && (
                    <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.85 }}>
                      Contractor: {selectedSubwayBid?.name}
                    </span>
                  )}
                </button>
              </>
            )}

            <button
              className="advance"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={handleCancelSubwayDraft}
            >
              Cancel Subway Tunneling
            </button>
          </div>
        ) : isDrafting ? (
          <div>
            <p className="eyebrow">{t('draft.title')}</p>
            <h2>
              {PROJECT_CONFIG[selectedProjectType]?.icon} {t(`tools.${selectedProjectType}` as string)}
            </h2>
            <p className="muted">{t('draft.hint')}</p>

            {(draftIndices.length > 0 || selectedRoadIndices.length > 0) && (
              <button
                className="advance"
                style={{
                  marginBottom: '12px',
                  width: '100%',
                  borderColor: '#00f0ff',
                  color: '#00f0ff',
                  background: '#0e1c18',
                }}
                onClick={() => {
                  const seed = draftIndices[0] ?? primarySelectedRoadIndex;
                  if (seed !== null && seed !== undefined && loadedCity) {
                    const expanded = getAllAvenueSegments(loadedCity.ctx.network, seed);
                    setDraftIndices(expanded);
                  }
                }}
              >
                🛣️ {t('draft.selectStreet')} ({loadedCity.ctx.network.segments[draftIndices[0] ?? primarySelectedRoadIndex!]?.name || 'Avenida'})
              </button>
            )}

            {projectEstimate ? (
              <div className="proposal">
                <span>
                  {t('draft.length')} <b>{formatKm(projectEstimate.streetKm)}</b>
                </span>
                <span>
                  {t('draft.cost')}{' '}
                  <b>{formatCurrency(Math.round(projectEstimate.cost * (selectedBid?.costMultiplier ?? 1)))}</b>
                </span>
                <span>
                  {t('draft.duration')}{' '}
                  <b>
                    {Math.round(
                      (projectEstimate.planningDays + projectEstimate.constructionDays) *
                        (selectedBid?.durationMultiplier ?? 1),
                    )}{' '}
                    days
                  </b>
                </span>
                <span>
                  {t('draft.disruption')}{' '}
                  <b style={{ color: '#ef4444' }}>
                    +{formatPercent(
                      Math.max(
                        0,
                        projectEstimate.corridor.duringConstruction -
                          projectEstimate.corridor.now,
                      ),
                    )}
                  </b>
                </span>
                <span>
                  {t('draft.predicted')}{' '}
                  <b className="positive">
                    {formatPercent(
                      projectEstimate.corridor.now - projectEstimate.corridor.afterCompletion,
                    )}{' '}
                    relief
                  </b>
                </span>

                <hr style={{ borderColor: '#2d3c30', margin: '12px 0 8px' }} />

                {/* 3 Contractor Proposals (Procurement) */}
                <p className="eyebrow" style={{ margin: '4px 0' }}>{t('bidding.sectionTitle')}</p>
                <div className="bidding-list">
                  {contractorBids.map((bid, idx) => (
                    <div
                      key={bid.id}
                      className={`contractor-card ${selectedBidIndex === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedBidIndex(idx)}
                    >
                      <div className="contractor-name">
                        <span>{bid.name}</span>
                        {bid.bribeOffer > 0 ? (
                          <span className="bribe-badge">💰 Kickback: +{formatCurrency(bid.bribeOffer)}</span>
                        ) : bid.reputation === 'excellent' ? (
                          <span className="tech-badge">🛡️ Clean Audit Record</span>
                        ) : (
                          <span className="risk-badge">⚠️ Audit Scrutiny Risk</span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11px', color: '#c4cec5' }}>
                        {bid.headline}
                      </p>
                      <ul className="pro-list">
                        {bid.pros.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                      <ul className="con-list">
                        {bid.cons.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#889988' }}>
                        <span>Cost: {Math.round(bid.costMultiplier * 100)}%</span>
                        {bid.corruptionRisk > 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            🚨 Fiscal scrutiny: +{Math.round(bid.corruptionRisk * 100)}%
                          </span>
                        ) : (
                          <span style={{ color: '#86efac' }}>✓ 0% fiscal suspicion</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <hr style={{ borderColor: '#2d3c30', margin: '8px 0' }} />

                {selectedBid && selectedBid.corruptionRisk > 0 && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid #ef4444',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      marginBottom: '8px',
                      fontSize: '11px',
                      color: '#fca5a5',
                      lineHeight: 1.4,
                    }}
                  >
                    🚨 <b>Awarding tender to {selectedBid.name}:</b> Adds <b>+{Math.round(selectedBid.corruptionRisk * 100)}%</b> to Corruption Suspicion
                    {selectedBid.bribeOffer > 0 ? ` and transfers +${formatCurrency(selectedBid.bribeOffer)} kickback to your personal account.` : '.'}
                  </div>
                )}

                <button
                  className="primary full"
                  disabled={projectEstimate.error !== null}
                  onClick={handleApproveDraft}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>{t('draft.approve')}</span>
                    <span>→</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.85 }}>
                    Contractor: {selectedBid?.name ?? 'Standard Consortium'}
                  </span>
                </button>
                {projectEstimate.error && (
                  <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 0' }}>
                    {t(`draft.error.${projectEstimate.error}` as string)}
                  </p>
                )}
              </div>
            ) : (
              <p className="muted">{t('draft.error.empty')}</p>
            )}

            <button
              className="advance"
              style={{ marginTop: '8px', width: '100%' }}
              onClick={handleCancelDraft}
            >
              {t('draft.cancel')}
            </button>
          </div>
        ) : selectedRoad ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="eyebrow" style={{ margin: 0 }}>
                {isFullAvenueSelected ? 'Full Corridor' : t('road.inspect')}
              </p>
              <button
                className="advance"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  color: '#f87171',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Deselect this road"
                onClick={() => {
                  setSelectedRoadIndices([]);
                  setDraftIndices([]);
                  setIsDrafting(false);
                }}
              >
                ✕ Deselect
              </button>
            </div>
            <h2>{selectedRoad.name || t('road.unnamed')}</h2>

            {/* Quick Avenue Expand / Collapse Controls */}
            {allAvenueIndices.length > 1 && (
              <div style={{ margin: '6px 0 12px' }}>
                {!isFullAvenueSelected ? (
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      background: 'rgba(0, 240, 255, 0.08)',
                      border: '1px solid #00f0ff',
                      borderRadius: '4px',
                      color: '#00f0ff',
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                    title="Double-click on map also selects the entire corridor"
                    onClick={() => setSelectedRoadIndices(allAvenueIndices)}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#e0f7fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🛣️</span>
                      <span>Select entire corridor ({allAvenueIndices.length} segments)</span>
                    </div>
                    <span style={{ color: '#7dd3fc', fontSize: '10px', opacity: 0.85, lineHeight: 1.2 }}>
                      Double-click any segment on map to select all
                    </span>
                  </button>
                ) : (
                  <div
                    style={{
                      background: '#0e1c18',
                      border: '1px solid #00f0ff',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#00f0ff', lineHeight: 1.3 }}>
                      ✓ Full corridor ({selectedRoadIndices.length} segments · {formatKm(selectedTotalKm)})
                    </span>
                    <button
                      type="button"
                      style={{
                        fontSize: '10px',
                        padding: '4px 8px',
                        background: 'transparent',
                        border: '1px solid #00f0ff',
                        color: '#00f0ff',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => setSelectedRoadIndices([primarySelectedRoadIndex!])}
                    >
                      Single segment only
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Active Project Banner on this Road if present */}
            {activeProjectOnSegment && (
              <div style={{ background: '#19221a', border: '1px solid #ef4444', borderRadius: '4px', padding: '10px', margin: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="eyebrow" style={{ color: '#ef4444', margin: 0 }}>
                    {activeProjectOnSegment.phase === 'construction' ? '🚧 Works in Progress' : 'Approved Project'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#b8e86c' }}>{formatPercent(activeProjectOnSegment.progress)}</span>
                </div>
                <h3 style={{ margin: '4px 0 2px', fontSize: '15px' }}>
                  {PROJECT_CONFIG[activeProjectOnSegment.typeId]?.icon} {activeProjectOnSegment.name}
                </h3>
                {activeProjectOnSegment.phase === 'construction' && (
                  <div style={{ background: 'rgba(249, 115, 22, 0.15)', border: '1px solid #f97316', borderRadius: '4px', padding: '6px 8px', margin: '6px 0', fontSize: '11px', color: '#fed7aa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🚧</span>
                    <span><b>Street closed to traffic:</b> Vehicular traffic diverted to nearby parallel corridors.</span>
                  </div>
                )}
                <p style={{ fontSize: '11px', color: '#a0b0a3', margin: '2px 0 8px' }}>
                  Contractor: <b>{activeProjectOnSegment.contractor?.name ?? 'Standard'}</b> · Phase: {t(`project.phase.${activeProjectOnSegment.phase}` as string)}
                </p>
                <button
                  className="advance"
                  style={{ width: '100%', borderColor: '#ef4444', color: '#fca5a5', padding: '6px' }}
                  onClick={() => {
                    if (confirm(`Do you want to terminate the contract for "${activeProjectOnSegment.name}"? 70% of the allocated budget will be recovered and closed lanes will reopen.`)) {
                      session?.cancel(activeProjectOnSegment.id);
                    }
                  }}
                >
                  ✕ Terminate contract (+70% refund)
                </button>
              </div>
            )}

            <div className="congestion">
              <i
                style={{
                  background:
                    activeProjectOnSegment?.phase === 'construction'
                      ? '#f97316'
                      : CONGESTION_LEVELS.find((l) => l.id === congestionLevel(avgCongestion))?.color ?? '#22c55e',
                }}
              />
              <div>
                <strong>
                  {activeProjectOnSegment?.phase === 'construction'
                    ? '🚧 Closed for Construction'
                    : t(`congestion.${congestionLevel(avgCongestion)}` as string)}
                </strong>
                <small>
                  {activeProjectOnSegment?.phase === 'construction'
                    ? 'Corridor closed · 96% of traffic diverted to detour streets'
                    : t('road.score', { value: avgCongestion.toFixed(2) })}
                </small>
              </div>
            </div>

            {/* Road Key Metrics - 2x2 Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                margin: '12px 0',
              }}
            >
              <div style={{ background: '#0e1711', border: '1px solid #253328', borderRadius: '4px', padding: '8px 10px' }}>
                <span style={{ font: "500 10px 'DM Mono'", color: '#829386', textTransform: 'uppercase', display: 'block' }}>
                  {t('road.length')}
                </span>
                <strong style={{ fontSize: '13px', color: '#eef2eb', display: 'block', marginTop: '2px' }}>
                  {formatKm(selectedTotalKm)}
                </strong>
                <small style={{ font: "9px 'DM Mono'", color: '#829386' }}>
                  {selectedRoadIndices.length} {selectedRoadIndices.length === 1 ? 'segment' : 'segments'}
                </small>
              </div>

              <div style={{ background: '#0e1711', border: '1px solid #253328', borderRadius: '4px', padding: '8px 10px' }}>
                <span style={{ font: "500 10px 'DM Mono'", color: '#829386', textTransform: 'uppercase', display: 'block' }}>
                  {t('road.lanes')}
                </span>
                <strong style={{ fontSize: '13px', color: '#eef2eb', display: 'block', marginTop: '2px' }}>
                  {selectedRoad.lanes} {selectedRoad.lanes === 1 ? 'lane' : 'lanes'}
                </strong>
                <small style={{ font: "9px 'DM Mono'", color: '#829386' }}>
                  {selectedRoad.oneway ? 'One-way' : 'Two-way'}
                </small>
              </div>

              <div style={{ background: '#0e1711', border: '1px solid #253328', borderRadius: '4px', padding: '8px 10px' }}>
                <span style={{ font: "500 10px 'DM Mono'", color: '#829386', textTransform: 'uppercase', display: 'block' }}>
                  {t('road.demand')}
                </span>
                <strong style={{ fontSize: '13px', color: '#eef2eb', display: 'block', marginTop: '2px' }}>
                  {Math.round(traffic.currentDemand[selectedRoad.index])} veh/h
                </strong>
                {activeProjectOnSegment?.phase === 'construction' ? (
                  <span style={{ font: "9px 'DM Mono'", color: '#f97316', display: 'block', marginTop: '2px' }}>
                    ↪️ Detour active
                  </span>
                ) : (
                  <small style={{ font: "9px 'DM Mono'", color: '#829386' }}>
                    Peak flow
                  </small>
                )}
              </div>

              <div style={{ background: '#0e1711', border: '1px solid #253328', borderRadius: '4px', padding: '8px 10px' }}>
                <span style={{ font: "500 10px 'DM Mono'", color: '#829386', textTransform: 'uppercase', display: 'block' }}>
                  {t('road.capacity')}
                </span>
                <strong
                  style={{
                    fontSize: '13px',
                    color: activeProjectOnSegment?.phase === 'construction' ? '#ef4444' : '#eef2eb',
                    display: 'block',
                    marginTop: '2px',
                  }}
                >
                  {activeProjectOnSegment?.phase === 'construction'
                    ? '0 veh/h'
                    : `${Math.round(traffic.capacity[selectedRoad.index])} veh/h`}
                </strong>
                {activeProjectOnSegment?.phase === 'construction' ? (
                  <span style={{ font: "9px 'DM Mono'", color: '#ef4444', display: 'block', marginTop: '2px' }}>
                    ⛔ Closed for works
                  </span>
                ) : (
                  <small style={{ font: "9px 'DM Mono'", color: '#829386' }}>
                    Nominal max
                  </small>
                )}
              </div>
            </div>

            <button
              className="primary full"
              style={{ marginTop: '20px' }}
              onClick={() => {
                startDraftingType('bikeLane');
              }}
            >
              {t('road.proposeProject')} <span>→</span>
            </button>
          </div>
        ) : (
          <div>
            <p className="eyebrow">{t('road.inspect')}</p>
            <h2>Explore Road Network</h2>
            <p className="muted">
              Click any street or avenue on the map to inspect vehicle throughput, lane saturation, and propose infrastructure works.
            </p>
            <p className="muted" style={{ fontSize: '11px', marginTop: '12px' }}>
              Tip: You can also click empty map space to deselect.
            </p>
          </div>
        )}
      </aside>

      {/* TV Breaking News Modal (Noticiero en Vivo) */}
      {activeBreakingNews && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 8, 5, 0.90)',
            backdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#0a130d',
              border: '2px solid #b91c1c',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              overflow: 'hidden',
              boxShadow: '0 0 50px rgba(220, 38, 38, 0.45), 0 25px 60px rgba(0, 0, 0, 0.95)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Broadcast Live Header */}
            <div
              style={{
                background: 'linear-gradient(90deg, #991b1b, #7f1d1d)',
                padding: '10px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '3px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  LIVE
                </span>
                <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  EMERGENCY BROADCAST · BREAKING NEWS
                </span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
                24H NEWS NETWORK
              </div>
            </div>

            {/* TV Screen with Photo & Lower-Third Chyron */}
            <div style={{ position: 'relative', width: '100%', height: '320px', backgroundColor: '#000', overflow: 'hidden' }}>
              <img
                src={getAssetUrl('/assets/congressman.png')}
                alt="Live broadcast"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                }}
              />

              {/* Scanlines broadcast overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 255, 0, 0.03))',
                  backgroundSize: '100% 3px, 6px 100%',
                  pointerEvents: 'none',
                }}
              />

              {/* Lower-Third News Chyron (Franja de Noticiero) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Speaker label tag */}
                <div
                  style={{
                    backgroundColor: activeBreakingNews.breakingData?.chyronColor === 'blue' ? '#1e40af' : '#7f1d1d',
                    color: '#f8fafc',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 14px',
                    alignSelf: 'flex-start',
                    marginLeft: '14px',
                    borderTopLeftRadius: '4px',
                    borderTopRightRadius: '4px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
                  }}
                >
                  {activeBreakingNews.breakingData?.speaker || 'SEN. VICTOR BUSTAMANTE · TRANSPORTATION COMMITTEE'}
                </div>

                {/* Main Headline Franja */}
                <div
                  style={{
                    backgroundColor: activeBreakingNews.breakingData?.chyronColor === 'blue' ? '#1e3a8a' : '#b91c1c',
                    color: '#ffffff',
                    padding: '10px 16px',
                    fontSize: '15px',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderTop: '2px solid #facc15',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                  }}
                >
                  <span style={{ color: '#facc15', fontSize: '18px', flexShrink: 0 }}>🚨</span>
                  <span style={{ lineHeight: 1.25 }}>
                    {activeBreakingNews.breakingData?.chyronHeadline || activeBreakingNews.headline}
                  </span>
                </div>
              </div>
            </div>

            {/* Report Body & Citizen Context */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#88a090', fontSize: '12px' }}>
                  🗞️ {activeBreakingNews.outlet || 'National Press Dispatch'} · Day {activeBreakingNews.day}
                </span>
                <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600 }}>
                  Critical Situation in {loadedCity.bundle.roads.city.name}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#e2e8f0' }}>
                {activeBreakingNews.snippet}
              </p>

              <div
                style={{
                  backgroundColor: '#162319',
                  border: '1px solid #2d4533',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  color: '#94a99b',
                  lineHeight: 1.45,
                }}
              >
                ⚠️ <b>Notice to the Minister's Office:</b>{' '}
                {activeBreakingNews.breakingData?.urgentActionPrompt ||
                  'Take urgent infrastructure and budget decisions to avert a congressional censure vote.'}
              </div>

              <button
                className="primary"
                style={{
                  marginTop: '4px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  background: 'linear-gradient(135deg, #15803d, #22c55e)',
                  border: '1px solid #4ade80',
                  color: '#052e16',
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onClick={handleDismissBreakingNews}
              >
                <span>🏛️</span> Address Emergency & Resume Office
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Press Archive Modal */}
      {isNewsArchiveModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 8, 5, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewsArchiveModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#0d1811',
              border: '1px solid #284432',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(74, 222, 128, 0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #1e3325',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#112217',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', margin: 0, color: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📜</span> Historical Press & Intelligence Archive
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#88a090' }}>
                  Chronological timeline of all ministerial dispatches, investigative reports, and opinion polls ({state.news.length} total)
                </p>
              </div>
              <button
                onClick={() => setIsNewsArchiveModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#88a090',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Scrollable list of all news items */}
            <div
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {state.news.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#88a090' }}>
                  No press dispatches published yet.
                </div>
              ) : (
                state.news.map((item) => {
                  const isCrit = item.isBreaking || item.severity === 'danger';
                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: isCrit ? 'rgba(239, 68, 68, 0.08)' : '#122016',
                        border: isCrit ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #233728',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px' }}>{item.outletIcon || '📰'}</span>
                          <span style={{ fontSize: '12px', color: '#86efac', fontWeight: 600 }}>
                            {item.outlet || 'Official Ministerial Bulletin'}
                          </span>
                          {item.category && (
                            <span
                              style={{
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#1a3322',
                                color: '#a7f3d0',
                                letterSpacing: '0.04em',
                                fontWeight: 700,
                              }}
                            >
                              {item.category}
                            </span>
                          )}
                        </div>
                        <span style={{ color: '#688272', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
                          Day {item.day}
                        </span>
                      </div>

                      <h4
                        style={{
                          margin: '2px 0 0',
                          fontSize: '14px',
                          fontWeight: 700,
                          color: isCrit ? '#fca5a5' : '#f0fdf4',
                          lineHeight: 1.35,
                        }}
                      >
                        {item.headline || t(item.key as string, item.params)}
                      </h4>

                      {item.snippet && (
                        <p style={{ margin: 0, fontSize: '12px', color: '#9cb3a2', lineHeight: 1.5 }}>
                          {item.snippet}
                        </p>
                      )}

                      {(item.isBreaking || item.breakingData) && (
                        <div style={{ marginTop: '4px' }}>
                          <button
                            className="advance"
                            style={{
                              fontSize: '11px',
                              padding: '4px 10px',
                              color: '#f87171',
                              borderColor: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.15)',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                            onClick={() => {
                              setIsNewsArchiveModalOpen(false);
                              setActiveBreakingNews(item);
                              sessionRef.current?.setSpeed(0);
                            }}
                          >
                            <span>🔴</span> Open TV Broadcast Alert →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 24px',
                borderTop: '1px solid #1e3325',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: '#112217',
              }}
            >
              <button
                className="advance"
                style={{ padding: '8px 18px', fontSize: '12px' }}
                onClick={() => setIsNewsArchiveModalOpen(false)}
              >
                Close Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Briefing / News Feed (Ministry Intelligence) */}
      <section className="event-feed">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <p className="eyebrow" style={{ margin: 0 }}>Ministerial Desk · Intelligence Feed</p>
          <small style={{ color: '#6ee7b7', fontSize: '10px' }}>Live</small>
        </div>
        {state.news.slice(0, 3).map((item) => (
          <p className={`event ${item.severity}`} key={item.id}>
            <span>●</span>
            {t(item.key as string, item.params)}
          </p>
        ))}
      </section>

      {/* Interactive Mayor Induction & Game Tutorial Modal */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
        playerName={state.playerName || playerNameInput || 'Mayor'}
        cityName={loadedCity.bundle.roads.city.name}
        initialStep={tutorialInitialStep}
      />

      {/* Game Over Modal */}
      {state.status === 'gameOver' && (
        <div className="game-over-overlay">
          <div className="game-over-box">
            <h1>{t('gameover.title')}</h1>
            <p>
              {state.gameOverReason === 'impeached'
                ? t('gameover.impeached')
                : state.gameOverReason === 'corruptionScandal'
                ? t('gameover.corruptionScandal')
                : t('gameover.electionDefeat')}
            </p>
            <div style={{ background: '#0f1712', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Days in office:</span>
                <b>{state.clock.day} days</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Final approval:</span>
                <b>{formatPercent(state.politics.approval)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                <span>Public funds spent:</span>
                <b>{formatCurrency(state.finance.totalPublicSpent)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Personal bank balance:</span>
                <b style={{ color: '#eab308' }}>{formatCurrency(state.finance.personalBalance)}</b>
              </div>
            </div>
            <button
              className="primary full"
              onClick={() => {
                sessionRef.current?.stop();
                sessionRef.current = null;
                setSession(null);
                setScreen('city');
              }}
            >
              {t('gameover.restart')} <span>↺</span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
