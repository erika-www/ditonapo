/**
 * StartTripInterface Component (React / JSX)
 * Main interactive dashboard for logged-in passengers with:
 * - Estimated Time of Arrival (ETA) calculation
 * - Profile & Settings section showing user details (Name, Account Used, Passenger Category) and App Preferences (Light/Dark Theme, Text Size, English/Filipino Language)
 * - Realtime live GPS bus tracking & seat availability monitor
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Home, MapPin, Bus, User, Clock, Users, ArrowRight,
  Download, Navigation, CheckCircle, XCircle, AlertTriangle,
  Sliders, LogOut, Sun, Moon, Globe, Type, ShieldCheck, Mail,
  BarChart3, TrendingUp, Leaf, Award, Calendar, Sparkles, DollarSign, Activity, Trash2
} from 'lucide-react';
import { QC_ROUTES } from '../mockData';
import { ROUTE4_STOPS } from '@shared/route4Stops';
import { generateDailyTripId, createPassengerQrPayload, isPriorityCategory } from '@shared/qrPassUtils';
import { drawQRCodeCanvas, downloadQRImage } from '../utils/qrGenerator';
import { InteractiveMap } from './InteractiveMap';
import { fetchGoogleMapsETA } from '../services/googleMapsService';
import { findNearestStop, calculateDistanceKm } from '../utils/geoUtils';
import {
  savePassengerJourney,
  updateJourneyStatus,
  fetchUserJourneys,
  fetchActiveTripForRoute,
  fetchCurrentBusLocation,
  fetchTripOccupancy,
  subscribeToBusLocation,
  subscribeToTripOccupancy,
  fetchConfiguredRoute4Stops
} from '../services/supabaseClient';

const TRANSLATIONS = {
  en: {
    homeTab: 'Selection',
    dashboardTab: 'Passenger Dashboard',
    tripsTab: 'Trips History',
    trackingTab: 'Live Map & Seats',
    profileTab: 'Profile & Settings',
    profileTitle: 'Commuter Profile & App Settings',
    accountDetailsHeader: 'User Details',
    fullNameLabel: 'Full Name',
    accountUsedLabel: 'Account Used',
    categoryLabel: 'Passenger Category',
    updateCategoryLabel: 'Update Passenger Category',
    preferencesHeader: 'App Preferences & Accessibility',
    themeLabel: 'Theme Mode',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    textSizeLabel: 'Text Size',
    smallText: 'Small',
    normalText: 'Normal',
    largeText: 'Large',
    languageLabel: 'Language',
    english: 'English',
    filipino: 'Filipino (Tagalog)',
    logoutBtn: 'Log Out',
    etaTitle: 'Estimated Time of Arrival',
    sameStopWarning: 'Boarding stop and destination stop must be different!',
    selectRoute: 'Select QC Bus Route',
    boardingStop: 'Boarding Stop (From)',
    destinationStop: 'Destination Stop (To)',
    continueBtn: 'Continue to Passenger Selection',
    soloPassenger: 'Solo Passenger',
    withCompanions: 'With Companions',
    confirmAndSummary: 'Confirm & View Digital Boarding Pass',
    digitalPassTitle: 'Your Digital Boarding QR Pass',
    showToConductor: 'Show this pass to the bus conductor upon boarding',
    saveQRBtn: 'Save QR Pass Image',
    redirectTrackingBtn: 'View Live Tracking Map',
    activeJourney: 'Active Journey',
    completedStatus: 'Completed',
    inProgressStatus: 'In Progress',
    plannedStatus: 'Planned'
  },
  fil: {
    homeTab: 'Pagpili',
    dashboardTab: 'Dashboard ng Sakay',
    tripsTab: 'Kasaysayan ng Byahe',
    trackingTab: 'Live na Mapa at Upuan',
    profileTab: 'Profile at Setting',
    profileTitle: 'Profile ng Sakay at Mga Setting',
    accountDetailsHeader: 'Impormasyon ng User',
    fullNameLabel: 'Buong Pangalan',
    accountUsedLabel: 'Ginamit na Account',
    categoryLabel: 'Kategorya ng Abang',
    updateCategoryLabel: 'Baguhin ang Kategorya ng Sakay',
    preferencesHeader: 'Mga Setting at Kagustuhan sa App',
    themeLabel: 'Tema ng App',
    lightMode: 'Liwanag (Light)',
    darkMode: 'Dilim (Dark)',
    textSizeLabel: 'Laki ng Teksto',
    smallText: 'Maliit (Small)',
    normalText: 'Karaniwan (Normal)',
    largeText: 'Malaki (Large)',
    languageLabel: 'Wika (Language)',
    english: 'Ingles (English)',
    filipino: 'Filipino (Tagalog)',
    logoutBtn: 'Mag-Log Out',
    etaTitle: 'Tantyang Oras ng Pagdating',
    sameStopWarning: 'Magkatulad ang napiling sakayan at babaan!',
    selectRoute: 'Pumili ng QC Bus Route',
    boardingStop: 'Sakayan (Mula sa)',
    destinationStop: 'Babaan (Patungo sa)',
    continueBtn: 'Magpatuloy sa Pagpili ng Sakay',
    soloPassenger: 'Nag-iisang Sakay',
    withCompanions: 'May Kasamang Sakay',
    confirmAndSummary: 'Kumpirmahin at Tingnan ang QR Pass',
    digitalPassTitle: 'Inyong Digital Boarding QR Pass',
    showToConductor: 'Ipakita ang pass na ito sa bus conductor pagkasakay',
    saveQRBtn: 'I-save ang Larawan ng QR',
    redirectTrackingBtn: 'Tingnan ang Live na Mapa ng Bus',
    activeJourney: 'Kasalukuyang Byahe',
    completedStatus: 'Kumpleto',
    inProgressStatus: 'Nasa Byahe',
    plannedStatus: 'Plano'
  }
};

export function StartTripInterface({
  initialTab,
  currentUser,
  onUpdateCategory,
  onLogout,
  theme,
  onToggleTheme,
  textSize,
  onChangeTextSize,
  language,
  onChangeLanguage,
  accessibility,
  onToggleAccessibility,
  activeTrip,
  setActiveTrip,
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'home');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Default Route locked strictly to Route 4: QC Hall to General Luis
  const defaultRoute = QC_ROUTES.find(r => r.id === 'route-4') || {
    id: 'route-4',
    name: 'Route 4: QC Hall to General Luis',
    code: 'R4',
    color: '#8b5cf6',
    totalDistanceKm: 14.5,
    stops: ROUTE4_STOPS
  };

  // Form State
  const [selectedRoute, setSelectedRoute] = useState(defaultRoute);
  const [configuredRoute4Stops, setConfiguredRoute4Stops] = useState(ROUTE4_STOPS);
  const [startStop, setStartStop] = useState(ROUTE4_STOPS[0]);
  const [endStop, setEndStop] = useState(ROUTE4_STOPS[1] || ROUTE4_STOPS[0]);

  useEffect(() => {
    let mounted = true;
    fetchConfiguredRoute4Stops().then((result) => {
      if (!mounted || !result.success || !result.data.length) return;
      setConfiguredRoute4Stops(result.data);
      setSelectedRoute((current) => ({ ...current, stops: result.data }));
      setStartStop((current) => result.data.find((stop) => stop.name === current.name) || result.data[0]);
      setEndStop((current) => result.data.find((stop) => stop.name === current.name) || result.data[1] || result.data[0]);
    });
    return () => { mounted = false; };
  }, []);

  // Google Maps ETA state
  const [googleEta, setGoogleEta] = useState(null);
  const [etaLoading, setEtaLoading] = useState(false);

  // Modal Steps: 'form' | 'companion_modal' | 'summary' | 'boarding'
  const [step, setStep] = useState('form');
  const [isAlone, setIsAlone] = useState(true);
  const [companionCount, setCompanionCount] = useState(0);
  const [savingTrip, setSavingTrip] = useState(false);

  // Realtime Live Bus Tracking & Seat Occupancy State
  const [routeBusTrip, setRouteBusTrip] = useState(null);
  const [liveBusCoords, setLiveBusCoords] = useState(null);
  const [lastUpdatedSecondsAgo, setLastUpdatedSecondsAgo] = useState(0);
  const [isSignalLost, setIsSignalLost] = useState(false);

  const [occupancy, setOccupancy] = useState(null);

  const qrCanvasRef = useRef(null);
  const [tripHistory, setTripHistory] = useState([]);
  const [feedbackTrip, setFeedbackTrip] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const localActiveJourneyKey = currentUser?.id ? `qcbus_local_test_journey_${currentUser.id}` : null;
  const [hiddenTripIds, setHiddenTripIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`qcbus_hidden_trips_${currentUser?.id || 'guest'}`) || '[]'); }
    catch { return []; }
  });
  const visibleTripHistory = tripHistory.filter(item => !hiddenTripIds.includes(item.dbId || item.id));
  const busCapacity = Number(routeBusTrip?.bus?.capacity ?? occupancy?.bus_capacity) || null;
  const currentOnboard = occupancy?.current_onboard == null ? null : Number(occupancy.current_onboard);
  const availableSeats = occupancy?.available_seats == null
    ? (busCapacity != null && currentOnboard != null ? Math.max(0, busCapacity - currentOnboard) : null)
    : Number(occupancy.available_seats);
  const persistHiddenTrips = (ids) => {
    const next = [...new Set(ids)];
    setHiddenTripIds(next);
    localStorage.setItem(`qcbus_hidden_trips_${currentUser?.id || 'guest'}`, JSON.stringify(next));
  };
  useEffect(() => {
    try { setHiddenTripIds(JSON.parse(localStorage.getItem(`qcbus_hidden_trips_${currentUser?.id || 'guest'}`) || '[]')); }
    catch { setHiddenTripIds([]); }
  }, [currentUser?.id]);
  const reachedStopNotice = useRef(false);

  useEffect(() => {
    if (!activeTrip || !liveBusCoords || reachedStopNotice.current) return;
    const stop = activeTrip.toStop;
    if (stop?.lat && stop?.lng && calculateDistanceKm(liveBusCoords.lat, liveBusCoords.lng, stop.lat, stop.lng) <= 0.15) {
      reachedStopNotice.current = true;
      onShowToast?.(`Your bus has reached ${stop.name}.`, 'stop-reached');
    }
  }, [activeTrip, liveBusCoords, onShowToast]);
  useEffect(() => {
    if (!activeTrip) reachedStopNotice.current = false;
  }, [activeTrip]);

  // Fetch Google Maps ETA based on starting/boarding stop and destination stop
  useEffect(() => {
    let isMounted = true;
    async function calculateETA() {
      if (startStop && endStop && startStop.id !== endStop.id) {
        setEtaLoading(true);
        const res = await fetchGoogleMapsETA(startStop, endStop);
        if (isMounted) {
          setGoogleEta(res);
          setEtaLoading(false);
        }
      } else {
        if (isMounted) {
          setGoogleEta(null);
          setEtaLoading(false);
        }
      }
    }
    calculateETA();
    return () => { isMounted = false; };
  }, [startStop, endStop]);

  // Fetch initial journeys from Supabase DB and restore active trip
  const recallUserPastActions = async () => {
    let databaseActiveJourneyFound = false;
    if (currentUser && currentUser.id) {
      try {
        const res = await fetchUserJourneys(currentUser.id);
        if (res.success && Array.isArray(res.data)) {
          const dbTrips = res.data.map(tItem => ({
            id: tItem.id.slice(0, 8).toUpperCase(),
            dbId: tItem.id,
            date: tItem.created_at ? new Date(tItem.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
            fromStop: tItem.origin_name,
            toStop: tItem.destination_name,
            routeName: 'QC Bus Route 4',
            busPlate: tItem.trips?.buses?.plate_number || '',
            companions: 0,
            status: tItem.status === 'boarded' ? t.inProgressStatus : (tItem.status === 'completed' ? t.completedStatus : (tItem.status === 'cancelled' ? 'Cancelled' : t.plannedStatus))
          }));
          setTripHistory(dbTrips);

          // Restore active planned/boarded journey from DB if available
          const activeItem = res.data.find(tItem => tItem.status === 'planned' || tItem.status === 'boarded');
          databaseActiveJourneyFound = Boolean(activeItem);
          if (activeItem && !activeTrip) {
            if (localActiveJourneyKey) localStorage.removeItem(localActiveJourneyKey);
            const restoredFrom = selectedRoute.stops.find(s => s.name === activeItem.origin_name) || { name: activeItem.origin_name, id: 'stop-1' };
            const restoredTo = selectedRoute.stops.find(s => s.name === activeItem.destination_name) || { name: activeItem.destination_name, id: 'stop-2' };
            const travelMins = 20;
            const category = activeItem.passenger_category || currentUser?.category || 'Regular';
            const qrData = createPassengerQrPayload({
              tripId: activeItem.qr_token,
              count: activeItem.passenger_count || 1,
              category,
              boardingStop: activeItem.origin_name,
              destinationStop: activeItem.destination_name,
              busPlate: activeItem.trips?.buses?.plate_number || ''
            });

            setActiveTrip({
              id: activeItem.id.slice(0, 8).toUpperCase(),
              dbId: activeItem.id,
              fromStop: restoredFrom,
              toStop: restoredTo,
              route: selectedRoute,
              bus: { plateNumber: routeBusTrip?.bus?.plate_number || '' },
              companions: 0,
              totalPassengers: 1,
              status: activeItem.status === 'boarded' ? 'In Progress' : 'Planned',
              isQrScanned: false,
              qrData,
              dailyTripId: activeItem.qr_token || '',
              category,
              startTime: activeItem.created_at ? new Date(activeItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              estMinutes: travelMins,
              distanceKm: '2.5',
              busEta: `~${travelMins} mins`
            });
            setStep('summary');
          }
        }
      } catch (err) {
        console.warn('Supabase user journeys fetch error:', err);
      }
    }

    if (!databaseActiveJourneyFound && !activeTrip && localActiveJourneyKey) {
      try {
        const savedTestJourney = JSON.parse(localStorage.getItem(localActiveJourneyKey) || 'null');
        if (savedTestJourney?.localTest && savedTestJourney.qrData) {
          setActiveTrip(savedTestJourney);
          setStep('summary');
        }
      } catch (err) {
        console.warn('Could not restore local test journey:', err);
      }
    }
  };

  useEffect(() => {
    recallUserPastActions();
  }, [currentUser?.id, language]);

  useEffect(() => {
    let mounted = true;
    const refreshActiveTrip = async () => {
      const result = await fetchActiveTripForRoute(selectedRoute.code);
      if (!mounted) return;
      setRouteBusTrip(result.success ? result.data : null);
      setOccupancy(result.data?.occupancy || null);
    };
    refreshActiveTrip();
    const refreshTimer = setInterval(refreshActiveTrip, 10000);
    return () => { mounted = false; clearInterval(refreshTimer); };
  }, [selectedRoute.code]);

  // Subscribe to the active trip and its bus, resolved from the selected route.
  useEffect(() => {
    if (activeTab !== 'tracking' || !routeBusTrip?.id || !routeBusTrip?.bus_id) return undefined;
    let mounted = true;
    const applyBusLocation = (location) => {
      const updatedAt = Date.parse(location.updated_at);
      const secondsAgo = Number.isFinite(updatedAt)
        ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))
        : 0;
      setLiveBusCoords({
        lat: location.latitude, lng: location.longitude,
        speed: location.speed, updated_at: location.updated_at
      });
      setLastUpdatedSecondsAgo(secondsAgo);
      setIsSignalLost(secondsAgo > 60);
    };

    setLiveBusCoords(null);
    fetchCurrentBusLocation(routeBusTrip.bus_id).then((result) => {
      if (mounted && result.success && result.data) applyBusLocation(result.data);
    });
    fetchTripOccupancy(routeBusTrip.id).then((result) => {
      if (mounted && result.success && result.data) setOccupancy(result.data);
    });
    const unsubscribeLocation = subscribeToBusLocation(routeBusTrip.bus_id, (location) => {
      applyBusLocation(location);
    });
    const unsubscribeOccupancy = subscribeToTripOccupancy(routeBusTrip.id, setOccupancy);
    return () => {
      mounted = false;
      unsubscribeLocation();
      unsubscribeOccupancy();
    };
  }, [activeTab, routeBusTrip?.id, routeBusTrip?.bus_id]);

  useEffect(() => {
    if (activeTab !== 'tracking' || !liveBusCoords?.updated_at) return undefined;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - new Date(liveBusCoords.updated_at).getTime()) / 1000);
      setLastUpdatedSecondsAgo(seconds);
      setIsSignalLost(seconds > 60);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeTab, liveBusCoords?.updated_at]);

  const handleRouteChange = (routeId) => {
    const selected = QC_ROUTES.find(r => r.id === routeId) || QC_ROUTES[0];
    const route = selected.code === 'R4' ? { ...selected, stops: configuredRoute4Stops } : selected;
    setSelectedRoute(route);
    setStartStop(route.stops[0]);
    setEndStop(route.stops[1] || route.stops[0]);
  };

  const handleDetectNearestStop = () => {
    if (navigator.geolocation) {
      if (onShowToast) onShowToast('Detecting location...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const nearest = findNearestStop(lat, lng, selectedRoute.stops);
          if (nearest && nearest.stop) {
            setStartStop(nearest.stop);
            if (onShowToast) onShowToast(`Nearest stop found: ${nearest.stop.name} (${nearest.formattedDistance})`);
          } else {
            if (onShowToast) onShowToast('Could not determine nearest stop.');
          }
        },
        (err) => {
          if (onShowToast) onShowToast('Location access denied or unavailable.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const handleConfirmRouteSelection = () => {
    if (activeTrip) {
      onShowToast('Active Trip Ongoing! You cannot book another trip until finished.');
      return;
    }
    if (startStop.id === endStop.id) {
      onShowToast(t.sameStopWarning);
      return;
    }

    // Location is used for live tracking, but must not block route planning.
    setStep('companion_modal');
  };

  const getFirstLetters = (str) => {
    if (!str) return 'STOP';
    return str
      .trim()
      .split(/[\s-]+/)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase())
      .filter(Boolean)
      .join('');
  };

  const handleCompanionConfirm = async () => {
    if (activeTrip) {
      onShowToast?.('You already have an active journey in progress.');
      return;
    }
    if (savingTrip) return;
    setSavingTrip(true);
    try {
      const bus = { plateNumber: routeBusTrip?.bus?.plate_number || 'QC-BUS' };
      const totalPassengerCount = isAlone ? 1 : 1 + companionCount;
      const travelMins = googleEta?.durationMins || 15;
      const category = currentUser?.category || 'Regular';

      // Generate unique trip ID per passenger per day strictly formatted as MMDDYY-xxxxx
      const dailyTripId = generateDailyTripId();

      // Standard scannable JSON QR payload
      const qrPayloadString = createPassengerQrPayload({
        tripId: dailyTripId,
        count: totalPassengerCount,
        category,
        boardingStop: startStop.name,
        destinationStop: endStop.name,
        busPlate: bus.plateNumber
      });

      // Save journey to Supabase passenger_journeys table
      const res = await savePassengerJourney({
        origin_name: startStop.name,
        origin_lat: startStop.lat || null,
        origin_lng: startStop.lng || null,
        destination_name: endStop.name,
        destination_lat: endStop.lat || null,
        destination_lng: endStop.lng || null,
        qr_token: dailyTripId,
        passenger_name: currentUser?.name || currentUser?.email || 'Passenger',
        registration_source: 'app'
      });

      if (!res.success) {
        if (onShowToast) {
          onShowToast(`Failed to plan trip: ${res.error}`);
        }
        return;
      }

      const newTrip = {
        id: dailyTripId,
        dbId: res.localTest ? null : res.data?.id,
        fromStop: startStop,
        toStop: endStop,
        route: selectedRoute,
        bus: bus,
        companions: isAlone ? 0 : companionCount,
        totalPassengers: totalPassengerCount,
        category,
        status: 'In Progress',
        isQrScanned: false,
        qrData: qrPayloadString,
        dailyTripId,
        startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        estMinutes: travelMins,
        distanceKm: googleEta?.distanceKm || '2.5',
        busEta: `~${travelMins} mins`,
        localTest: Boolean(res.localTest),
      };

      if (localActiveJourneyKey) {
        if (res.localTest) localStorage.setItem(localActiveJourneyKey, JSON.stringify(newTrip));
        else localStorage.removeItem(localActiveJourneyKey);
      }

      setActiveTrip(newTrip);
      setStep('summary');

      // Immediately reload trips from Supabase DB to reflect action in history list
      await recallUserPastActions();

      if (onShowToast) onShowToast(
        res.localTest
          ? `Local test pass #${dailyTripId} created. It is saved on this device; no database journey was created.`
          : `Pass #${dailyTripId} issued successfully!`,
        'passenger-selection'
      );
    } catch (error) {
      onShowToast?.(`Failed to create trip: ${error.message}`);
    } finally {
      setSavingTrip(false);
    }
  };

  // Draw QR canvas when summary or boarding
  useEffect(() => {
    if ((step === 'summary' || step === 'boarding') && activeTrip && qrCanvasRef.current) {
      drawQRCodeCanvas(
        qrCanvasRef.current,
        activeTrip.qrData,
        activeTrip.fromStop.name || activeTrip.fromStop,
        activeTrip.toStop.name || activeTrip.toStop,
        activeTrip.bus?.plateNumber || routeBusTrip?.bus?.plate_number || 'QC-BUS',
        activeTrip.companions,
        activeTrip.estMinutes,
        activeTrip.busEta,
        activeTrip.category || currentUser?.category || 'Regular',
        activeTrip.id
      );
    }
  }, [step, activeTrip, activeTab, routeBusTrip]);

  const handleSaveQR = () => {
    if (qrCanvasRef.current) {
      downloadQRImage(qrCanvasRef.current, `QCBus_Pass_${activeTrip?.id || 'Boarding'}.png`);
      onShowToast('QR Boarding Pass saved to your device!');
    }
  };

  const handleCompleteJourney = async () => {
    if (!activeTrip) return;
    if (activeTrip.dbId) {
      const res = await updateJourneyStatus(activeTrip.dbId, 'completed');
      if (!res.success) {
        if (onShowToast) onShowToast(`Error completing trip: ${res.error}`);
        return;
      }
    }
    if (activeTrip.localTest && localActiveJourneyKey) localStorage.removeItem(localActiveJourneyKey);
    const completedHistoryItem = {
      id: activeTrip.id,
      dbId: activeTrip.dbId,
      date: new Date().toLocaleDateString(),
      fromStop: activeTrip.fromStop.name || activeTrip.fromStop,
      toStop: activeTrip.toStop.name || activeTrip.toStop,
      routeName: activeTrip.route?.name || 'QC Bus Route 4',
      busPlate: activeTrip.bus?.plateNumber || routeBusTrip?.bus?.plate_number || '',
      companions: activeTrip.companions || 0,
      status: t.completedStatus
    };
    setTripHistory((rows) => {
      const id = completedHistoryItem.dbId || completedHistoryItem.id;
      const alreadyListed = rows.some((row) => (row.dbId || row.id) === id);
      return alreadyListed
        ? rows.map((row) => (row.dbId || row.id) === id ? { ...row, ...completedHistoryItem } : row)
        : [completedHistoryItem, ...rows];
    });
    if (!activeTrip.localTest) setFeedbackTrip(activeTrip);
    setActiveTrip(null);
    setStep('form');
    await recallUserPastActions();
    if (onShowToast) onShowToast('Trip completed safely!');
  };

  const handleCancelJourney = async () => {
    if (!activeTrip) return;
    if (activeTrip.dbId) {
      const res = await updateJourneyStatus(activeTrip.dbId, 'cancelled');
      if (!res.success) {
        if (onShowToast) onShowToast(`Error cancelling trip: ${res.error}`);
        return;
      }
    }
    if (activeTrip.localTest && localActiveJourneyKey) localStorage.removeItem(localActiveJourneyKey);
    setActiveTrip(null);
    setStep('form');
    await recallUserPastActions();
    if (onShowToast) onShowToast('Trip cancelled.');
  };

  return (
    <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Interactive Tabs Header */}
      <div className="tabs-header">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
        >
          <Home size={18} /> {t.homeTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          <BarChart3 size={18} /> {t.dashboardTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trips')}
          className={`tab-btn ${activeTab === 'trips' ? 'active' : ''}`}
        >
          <Bus size={18} /> {t.tripsTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('tracking')}
          className={`tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
        >
          <Navigation size={18} /> {t.trackingTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        >
          <User size={18} /> {t.profileTab}
        </button>
      </div>

      {/* TAB 1: HOME & TRIP PLANNER */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {feedbackTrip && <div className="glass-card" role="dialog" aria-modal="true" style={{ marginBottom: '1rem' }}>
        <h2>How was your bus trip?</h2>
        <label className="form-label" htmlFor="trip-rating">Rating</label>
        <select id="trip-rating" className="form-select" value={feedbackRating} onChange={e => setFeedbackRating(Number(e.target.value))}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} / 5</option>)}</select>
        <label className="form-label" htmlFor="trip-feedback">Comments (optional)</label>
        <textarea id="trip-feedback" className="form-select" rows="3" maxLength={1000} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
        <button type="button" className="btn-primary" onClick={async () => { const { submitJourneyFeedback } = await import('../services/supabaseClient'); const result = await submitJourneyFeedback(feedbackTrip.dbId, feedbackRating, feedbackText); if (!result.success) { onShowToast?.(result.error); return; } setFeedbackTrip(null); setFeedbackText(''); onShowToast?.('Thanks for your feedback!'); }}>Send feedback</button>
        <button type="button" className="btn-secondary" style={{ marginLeft: '.5rem' }} onClick={() => setFeedbackTrip(null)}>Skip</button>
      </div>}

      {activeTrip && (
            <div className="glass-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="badge badge-success">
                  <span className="pulse-dot" style={{ backgroundColor: '#fff' }}></span> {t.activeJourney} ({activeTrip.id})
                </span>
                {activeTrip.localTest && <span className="badge" style={{ background: '#fff7ed', color: '#9a3412' }}>LOCAL TEST · NOT SYNCED</span>}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Started at {activeTrip.startTime}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.boardingStop}:</span>
                  <div style={{ fontWeight: 700 }}>{activeTrip.fromStop.name || activeTrip.fromStop}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.destinationStop}:</span>
                  <div style={{ fontWeight: 700, color: 'var(--secondary)' }}>{activeTrip.toStop.name || activeTrip.toStop}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.etaTitle}:</span>
                  <div style={{ fontWeight: 700, color: 'var(--warning)' }}>~{activeTrip.estMinutes} mins ({activeTrip.distanceKm} km)</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Bus plate:</span>
                  <div style={{ fontWeight: 700 }}>{routeBusTrip?.bus?.plate_number || 'No active bus assigned'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Passengers onboard:</span>
                  <div style={{ fontWeight: 700 }}>{occupancy?.current_onboard ?? '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '8px' }}>
                  <canvas ref={qrCanvasRef} style={{ width: '240px', height: '275px', display: 'block' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem' }}>{t.digitalPassTitle}</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
                    Passengers on this pass: <strong>{activeTrip.totalPassengers || (Number(activeTrip.companions || 0) + 1)}</strong>
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    {t.showToConductor}
                  </p>
                  <button type="button" onClick={handleSaveQR} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                    <Download size={14} /> {t.saveQRBtn}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={handleCancelJourney} className="btn-danger" style={{ fontSize: '0.85rem' }}>
                  Cancel Trip
                </button>
                <button type="button" onClick={handleCompleteJourney} className="btn-primary" style={{ fontSize: '0.85rem' }}>
                  Complete Journey
                </button>
              </div>
            </div>
          )}

          {/* MAIN TRIP BOOKING WIZARD */}
          {activeTrip ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '2rem 1.5rem', border: '1px solid var(--secondary)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(6, 182, 212, 0.15)', display: 'grid', placeItems: 'center', margin: '0 auto 1rem', color: '#06b6d4' }}>
                <Bus size={26} />
              </div>
              <h2 style={{ fontSize: '1.35rem', marginBottom: '.5rem', color: 'var(--text-main)' }}>
                Active Journey in Progress ({activeTrip.id})
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', maxWidth: '540px', margin: '0 auto 1.25rem', lineHeight: '1.5' }}>
                You currently have an active boarding pass from <strong>{activeTrip.fromStop?.name || activeTrip.fromStop}</strong> to <strong>{activeTrip.toStop?.name || activeTrip.toStop}</strong>. To create a new boarding, please complete or cancel your ongoing journey above.
              </p>
              <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('tracking')}
                  className="btn-primary"
                  style={{ padding: '.6rem 1.2rem', fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}
                >
                  <Navigation size={16} /> View Live Bus Map & Seats
                </button>
                <button
                  type="button"
                  onClick={handleCompleteJourney}
                  className="btn-secondary"
                  style={{ padding: '.6rem 1.2rem', fontSize: '.9rem' }}
                >
                  Complete Journey
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card">
              {step === 'form' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t.selectRoute}</label>
                    <select
                      className="form-select"
                      value="route-4"
                      disabled={true}
                      style={{ backgroundColor: 'var(--bg-subtle)', cursor: 'default' }}
                    >
                      <option value="route-4">
                        Route 4: QC Hall to General Luis (14.5 km)
                      </option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">{t.boardingStop}</label>
                      <select
                        className="form-select"
                        value={startStop.id}
                        disabled={!!activeTrip}
                        onChange={(e) => {
                          if (e.target.value === 'detect') {
                            handleDetectNearestStop();
                          } else {
                            const s = ROUTE4_STOPS.find(st => st.id === e.target.value);
                            if (s) setStartStop(s);
                          }
                        }}
                      >
                        <option value="detect">📍 Detect Nearest Stop (GPS)</option>
                        {ROUTE4_STOPS.map((stop, idx) => (
                          <option key={stop.id} value={stop.id}>
                            Stop {stop.stopNumber || idx + 1}: {stop.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">{t.destinationStop}</label>
                      <select
                        className="form-select"
                        value={endStop.id}
                        disabled={!!activeTrip}
                        onChange={(e) => {
                          const s = ROUTE4_STOPS.find(st => st.id === e.target.value);
                          if (s) setEndStop(s);
                        }}
                      >
                        {ROUTE4_STOPS.map((stop, idx) => (
                          <option key={stop.id} value={stop.id}>
                            Stop {stop.stopNumber || idx + 1}: {stop.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Clean Estimated Time of Arrival (ETA) Display Banner */}
                  {googleEta && startStop.id !== endStop.id && (
                    <div style={{
                      backgroundColor: 'var(--primary-light)',
                      border: '1px solid var(--primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <Clock size={24} color="var(--primary)" />
                      <div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          {t.etaTitle}
                        </span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                          ~ {googleEta.durationMins} mins ({googleEta.distanceKm} km)
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleConfirmRouteSelection}
                    disabled={!!activeTrip}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      fontSize: '1rem',
                      marginTop: '0.5rem',
                      opacity: activeTrip ? 0.6 : 1,
                      cursor: activeTrip ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {activeTrip ? 'Active Trip Ongoing' : <>{t.continueBtn} <ArrowRight size={18} /></>}
                  </button>
                </div>
              )}

            {step === 'companion_modal' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Are you traveling alone or with companions?</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '400px', margin: '1rem auto' }}>
                  <button
                    type="button"
                    onClick={() => { setIsAlone(true); setCompanionCount(0); }}
                    className={`btn ${isAlone ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t.soloPassenger}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsAlone(false); if (companionCount === 0) setCompanionCount(1); }}
                    className={`btn ${!isAlone ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t.withCompanions}
                  </button>
                </div>

                {!isAlone && <div className="form-group" style={{ maxWidth: '300px', margin: '0 auto 1.5rem auto' }}>
                  <label className="form-label">Companions</label>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
                    <button type="button" aria-label="Remove one companion" className="btn-secondary" disabled={companionCount <= 1} onClick={() => setCompanionCount(count => Math.max(1, count - 1))}>−</button>
                    <output aria-live="polite" style={{ minWidth: '2rem', fontWeight: 800, fontSize: '1.2rem' }}>{companionCount}</output>
                    <button type="button" aria-label="Add one companion" className="btn-secondary" onClick={() => setCompanionCount(count => Math.min(9, count + 1))}>+</button>
                  </div>
                </div>}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button type="button" onClick={() => setStep('form')} className="btn-secondary">Back</button>
                  <button type="button" onClick={handleCompanionConfirm} disabled={savingTrip} className="btn-primary">{savingTrip ? 'Saving trip…' : <>{t.confirmAndSummary} →</>}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )}

      {/* TAB: PASSENGER DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL COMMUTES</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', display: 'grid', placeItems: 'center', color: '#8b5cf6' }}>
                  <Bus size={18} />
                </div>
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                {visibleTripHistory.length} Trips
              </div>
            </div>
          </div>

          {/* Weekly Ridership Trend Chart */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={20} color="#8b5cf6" /> Weekly Ridership Frequency & Commute Trend
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
                  Trip distribution across days of the week along the Route 4 QC Bus network
                </p>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                Peak Day: Wednesday (6 Trips)
              </span>
            </div>

            {/* Interactive Bar Chart Visualization */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '180px',
              padding: '1.5rem 0.5rem 0.5rem 0.5rem',
              borderBottom: '2px solid var(--border-color)',
              gap: '0.75rem'
            }}>
              {[
                { day: 'Mon', count: 4, height: 65, color: '#8b5cf6' },
                { day: 'Tue', count: 3, height: 50, color: '#8b5cf6' },
                { day: 'Wed', count: 6, height: 100, color: '#10b981', peak: true },
                { day: 'Thu', count: 3, height: 50, color: '#8b5cf6' },
                { day: 'Fri', count: 5, height: 82, color: '#8b5cf6' },
                { day: 'Sat', count: 2, height: 35, color: '#06b6d4' },
                { day: 'Sun', count: 1, height: 20, color: '#06b6d4' }
              ].map((bar) => (
                <div key={bar.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: bar.peak ? '#10b981' : 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    {bar.count}
                  </span>
                  <div
                    title={`${bar.day}: ${bar.count} trips`}
                    style={{
                      width: '100%',
                      maxWidth: '48px',
                      height: `${bar.height}%`,
                      backgroundColor: bar.color,
                      borderRadius: '6px 6px 0 0',
                      transition: 'all 0.3s ease',
                      boxShadow: bar.peak ? '0 0 14px rgba(16, 185, 129, 0.45)' : 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: bar.peak ? 800 : 600, color: bar.peak ? 'var(--text-primary)' : 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {bar.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Commute Pattern & Peak Hour Analysis (2-column layout) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Left: Peak Hours & Travel Insights */}
            <div className="glass-card">
              <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={19} color="#06b6d4" /> Commute Pattern & Peak Hours
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <strong style={{ fontSize: '0.92rem', color: '#f59e0b' }}>🌅 Morning Peak Window</strong>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>7:00 AM – 8:45 AM</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    High outbound volume towards Mindanao Ave, QCU Main Campus, and Quirino Hwy.
                  </p>
                </div>

                <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <strong style={{ fontSize: '0.92rem', color: '#8b5cf6' }}>🌇 Evening Peak Window</strong>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>5:15 PM – 7:30 PM</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Inbound rush towards Quezon City Hall & Vertis North interchange hubs.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>AVG. TRIP DURATION</span>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>~34 Mins</strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>AVG. STOP WAIT</span>
                    <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>6–8 Mins</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Top Visited Stops on Route 4 */}
            <div className="glass-card">
              <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={19} color="#10b981" /> Top Visited Stops along Route 4
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {[
                  {
                    rank: 1,
                    stopNumber: 1,
                    name: 'Quezon City Hall – NHA Interchange',
                    percent: 46,
                    tag: 'Primary Boarding Hub',
                    color: '#8b5cf6'
                  },
                  {
                    rank: 2,
                    stopNumber: 11,
                    name: 'Quirino Highway – SM City Novaliches',
                    percent: 32,
                    tag: 'Top Commercial Destination',
                    color: '#06b6d4'
                  },
                  {
                    rank: 3,
                    stopNumber: 15,
                    name: 'General Luis Avenue corner SB Road',
                    percent: 22,
                    tag: 'North Terminal Anchor',
                    color: '#10b981'
                  }
                ].map((item) => (
                  <div key={item.stopNumber} style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.4rem', borderRadius: '4px', background: item.color, color: '#fff' }}>
                          STOP {item.stopNumber}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.name}</strong>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: item.color }}>{item.percent}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden', marginTop: '0.4rem' }}>
                      <div style={{ width: `${item.percent}%`, height: '100%', backgroundColor: item.color, borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRIP HISTORY */}
      {activeTab === 'trips' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: '0 0 .25rem 0' }}>{t.tripsTab}</h2>
              <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                Showing your local recorded journeys. Deleting items clears display from your app without affecting database records.
              </span>
            </div>
            {visibleTripHistory.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: '#ef4444', borderColor: 'rgba(239,68,68,.3)' }}
                onClick={() => {
                  persistHiddenTrips([...hiddenTripIds, ...visibleTripHistory.map(item => item.dbId || item.id)]);
                  onShowToast?.('All trips cleared from your display.');
                }}
              >
                <Trash2 size={14} /> Delete All
              </button>
            )}
          </div>

          {visibleTripHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <Bus size={32} style={{ margin: '0 auto .5rem', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No past journeys saved yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {visibleTripHistory.map((item, idx) => (
                <div
                  key={item.dbId || item.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '.75rem',
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '1rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                      <strong style={{ fontSize: '.95rem' }}>{item.fromStop} → {item.toStop}</strong>
                      <span className="badge badge-secondary" style={{ fontSize: '.7rem' }}>
                        Pass #{item.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Status: <strong style={{ color: item.status === 'Completed' ? '#10b981' : '#06b6d4' }}>{item.status}</strong> | Date: {item.date}{item.busPlate ? ` | Bus: ${item.busPlate}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '.8rem', padding: '.4rem .75rem', display: 'flex', alignItems: 'center', gap: '.35rem', color: '#f87171' }}
                    onClick={() => {
                      persistHiddenTrips([...hiddenTripIds, item.dbId || item.id]);
                      onShowToast?.('Trip removed from display.');
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE MAP & REALTIME SEATS */}
      {activeTab === 'tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <InteractiveMap
            liveBusCoords={liveBusCoords}
            liveBusPlate={routeBusTrip?.bus?.plate_number}
            isSignalLost={isSignalLost}
            lastUpdatedSecondsAgo={lastUpdatedSecondsAgo}
            onShowToast={onShowToast}
            onSelectStartStop={(stop) => {
              setStartStop(stop);
              setActiveTab('home');
              if (onShowToast) onShowToast(`Boarding stop set to ${stop.name}. Let's plan your trip!`);
            }}
          />

          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.85rem' }}>Real-time Bus Occupancy & Seat Availability</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1.1rem', borderRadius: '8px', border: '1px solid #06b6d4' }}>
                <span style={{ fontSize: '0.78rem', color: '#06b6d4', fontWeight: 700, display: 'block', marginBottom: '.25rem' }}>AVAILABLE SEATS</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#06b6d4' }}>
                  {availableSeats == null ? '—' : `${availableSeats} / ${busCapacity}`}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Calculated from the active trip and bus capacity.</span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1.1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '.25rem' }}>CURRENT ONBOARD</span>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>
                  {currentOnboard == null ? '—' : `${currentOnboard} Passengers`}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {busCapacity == null ? 'Waiting for active trip occupancy.' : `Bus capacity: ${busCapacity}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROFILE & SETTINGS SECTION */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* USER DETAILS CARD */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1.25rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={22} /> {t.accountDetailsHeader}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Name */}
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, marginBottom: '0.2rem' }}>
                  {t.fullNameLabel}
                </span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {currentUser?.name || 'Commuter Passenger'}
                </strong>
              </div>

              {/* Account Used */}
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, marginBottom: '0.2rem' }}>
                  {t.accountUsedLabel}
                </span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)', wordBreak: 'break-all' }}>
                  {currentUser?.email || 'commuter@qc.gov.ph'}
                </div>
              </div>

            </div>

            {/* Change Category Selector */}
            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem', flexWrap: 'wrap', gap: '.4rem' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {t.categoryLabel}
                </label>
                <span
                  className="badge"
                  style={{
                    backgroundColor: isPriorityCategory(currentUser?.category) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                    color: isPriorityCategory(currentUser?.category) ? '#fbbf24' : '#38bdf8',
                    border: `1px solid ${isPriorityCategory(currentUser?.category) ? '#f59e0b' : '#06b6d4'}`,
                    fontWeight: 700,
                    fontSize: '.75rem'
                  }}
                >
                  {currentUser?.category || 'Regular'} · {isPriorityCategory(currentUser?.category) ? 'Priority Seat Eligible (/20)' : 'Standard Seating (/30)'}
                </span>
              </div>
              <select
                className="form-select"
                value={currentUser?.category || 'Regular'}
                onChange={(e) => {
                  if (onUpdateCategory) {
                    onUpdateCategory(e.target.value);
                  }
                }}
              >
                <option value="Regular">Regular Passenger (Standard Seating /30)</option>
                <option value="Student">Student (Standard Seating /30)</option>
                <option value="Senior Citizen">Senior Citizen (Priority Seat Access /20)</option>
                <option value="PWD">PWD - Person with Disability (Priority Seat Access /20)</option>
                <option value="Pregnant">Pregnant (Priority Seat Access /20)</option>
              </select>
              <p style={{ color: 'var(--text-muted)', fontSize: '.78rem', margin: '.5rem 0 0' }}>
                Changing your category immediately updates your digital pass entitlement and priority seat eligibility across the bus network.
              </p>
            </div>
          </div>

          {/* USER APP PREFERENCES CARD (Theme, Text Size, Language) */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
              <Sliders size={20} /> {t.preferencesHeader}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 1. Light / Dark Mode Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {theme === 'dark' ? <Moon size={22} color="var(--primary)" /> : <Sun size={22} color="var(--warning)" />}
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>{t.themeLabel}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {theme === 'dark' ? t.darkMode : t.lightMode}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} Switch to {theme === 'dark' ? t.lightMode : t.darkMode}
                </button>
              </div>

              {/* 2. Text Size Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Type size={22} color="var(--primary)" />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>{t.textSizeLabel}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Current: {textSize === 'small' ? t.smallText : (textSize === 'large' ? t.largeText : t.normalText)}
                    </span>
                  </div>
                </div>

                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '0.45rem 1rem' }}
                  value={textSize}
                  onChange={(e) => onChangeTextSize && onChangeTextSize(e.target.value)}
                >
                  <option value="small">{t.smallText}</option>
                  <option value="normal">{t.normalText}</option>
                  <option value="large">{t.largeText}</option>
                </select>
              </div>

              {/* 3. Language Selector (English / Filipino) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Globe size={22} color="var(--secondary)" />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>{t.languageLabel}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Current: {language === 'en' ? t.english : t.filipino}
                    </span>
                  </div>
                </div>

                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '0.45rem 1rem' }}
                  value={language}
                  onChange={(e) => onChangeLanguage && onChangeLanguage(e.target.value)}
                >
                  <option value="en">{t.english}</option>
                  <option value="fil">{t.filipino}</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" onClick={onLogout} className="btn-danger" style={{ width: '100%', padding: '0.8rem', justifyContent: 'center' }}>
                <LogOut size={16} /> {t.logoutBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
