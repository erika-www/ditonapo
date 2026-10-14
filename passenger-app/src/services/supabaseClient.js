/**
 * Supabase Client & Database Integration Service for Passenger App
 * Manages Supabase Auth, Profiles, Journeys, and Realtime subscriptions.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in this app’s .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

function getPassengerAuthRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_PASSENGER_APP_URL?.trim();
  const redirectUrl = configuredUrl || window.location.origin;

  try {
    const parsedUrl = new URL(redirectUrl);
    if (import.meta.env.PROD && parsedUrl.protocol !== 'https:') {
      throw new Error('VITE_PASSENGER_APP_URL must use HTTPS in production.');
    }
    return parsedUrl.origin;
  } catch (error) {
    console.error('[Auth] Invalid passenger app redirect URL:', error.message);
    return window.location.origin;
  }
}

export async function fetchConfiguredRoute4Stops() {
  try {
    const { data: route, error: routeError } = await supabase.from('routes')
      .select('id').eq('code', 'R4').maybeSingle();
    if (routeError) throw routeError;
    if (!route) {
      return {
        success: true,
        data: ROUTE4_STOPS.map((s, idx) => ({
          id: `stop-${idx + 1}`,
          stopNumber: idx + 1,
          sequenceNumber: idx + 1,
          name: s.name,
          lat: Number(s.lat),
          lng: Number(s.lng)
        }))
      };
    }
    const { data, error } = await supabase.from('stops')
      .select('id,sequence_number,name,latitude,longitude')
      .eq('route_id', route.id).order('sequence_number');
    if (error) throw error;

    const rows = data || [];
    const seen = new Set();
    const canonical = [];

    for (const r of rows) {
      const clean = String(r.name || '').trim().toLowerCase();
      if (!seen.has(clean) && canonical.length < 15) {
        seen.add(clean);
        canonical.push(r);
      }
    }

    const source = canonical.length >= 10 ? canonical : ROUTE4_STOPS;
    return {
      success: true,
      data: source.slice(0, 15).map((stop, idx) => ({
        id: `stop-${idx + 1}`,
        stopNumber: idx + 1,
        sequenceNumber: idx + 1,
        name: stop.name,
        lat: Number(stop.latitude || stop.lat),
        lng: Number(stop.longitude || stop.lng)
      }))
    };
  } catch (err) {
    return {
      success: true,
      data: ROUTE4_STOPS.map((s, idx) => ({
        id: `stop-${idx + 1}`,
        stopNumber: idx + 1,
        sequenceNumber: idx + 1,
        name: s.name,
        lat: Number(s.lat),
        lng: Number(s.lng)
      }))
    };
  }
}

// ========================================================
// AUTHENTICATION FUNCTIONS
// ========================================================

/**
 * Sign up a new passenger account.
 * Database trigger automatically creates profile with role 'passenger'.
 */
export async function signUpPassenger(email, password, fullName, phone) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null
        }
      }
    });

    if (error) throw error;
    return { success: true, user: data.user };
  } catch (err) {
    console.warn('SignUp warning:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Log in passenger account.
 */
export async function loginPassenger(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true, user: data.user };
  } catch (err) {
    console.warn('Login warning:', err.message);
    return { success: false, error: err.message };
  }
}

export async function signUpWithEmail(email, password, name, category) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          passenger_category: category || 'Regular',
        }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.session) {
      const loginRes = await supabase.auth.signInWithPassword({ email, password });
      if (!loginRes.error && loginRes.data?.user) {
        return { success: true, user: loginRes.data.user, session: loginRes.data.session };
      }
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function loginWithEmail(email, password) {
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error && (error.message?.includes('Invalid login credentials') || error.message?.includes('User not found') || error.message?.includes('credentials'))) {
    const signup = await signUpWithEmail(email, password, email.split('@')[0], 'Regular');
    if (signup.success && signup.user) {
      return signup;
    }
  }

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

/**
 * Google OAuth Login
 */
export async function loginWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getPassengerAuthRedirectUrl() }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    console.warn('Google OAuth warning:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Facebook OAuth Login
 */
export async function loginWithFacebook() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: getPassengerAuthRedirectUrl() }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    console.warn('Facebook OAuth warning:', err.message);
    return { success: false, error: err.message };
  }
}

export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ========================================================
// PASSENGER JOURNEY FUNCTIONS
// ========================================================

export async function savePassengerJourney(journeyData) {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      if (import.meta.env.DEV) {
        return {
          success: true,
          data: { id: null, ...journeyData, status: 'planned', created_at: new Date().toISOString(), localTest: true },
          localTest: true
        };
      }
      return { success: false, error: userErr?.message || 'Sign in before creating a journey.' };
    }

    const payload = {
      passenger_id: userId,
      qr_token: journeyData.qr_token || null,
      passenger_name: journeyData.passenger_name || null,
      registration_source: 'app',
      trip_id: journeyData.trip_id || null,
      origin_name: journeyData.origin_name,
      origin_lat: journeyData.origin_lat || null,
      origin_lng: journeyData.origin_lng || null,
      destination_name: journeyData.destination_name,
      destination_lat: journeyData.destination_lat || null,
      destination_lng: journeyData.destination_lng || null,
      status: 'planned'
    };

    let { data, error } = await supabase
      .from('passenger_journeys')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Insert journey error:', error);
      if (import.meta.env.DEV) {
        return {
          success: true,
          data: {
            id: null,
            ...journeyData,
            status: 'planned',
            created_at: new Date().toISOString(),
            localTest: true
          },
          localTest: true
        };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Save journey error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function submitJourneyFeedback(journeyId, rating, text) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in to submit feedback.');
    const { error } = await supabase.from('passenger_journeys').update({
      feedback_rating: rating, feedback_text: text.trim() || null
    }).eq('id', journeyId).eq('passenger_id', user.id);
    if (error) {
      if (/feedback_(rating|text)|schema cache|could not find/i.test(error.message)) {
        throw new Error('Feedback storage is not installed in the database yet. Apply migration 20261011000001_passenger_feedback_qr.sql, then reload the Supabase API schema cache.');
      }
      throw error;
    }
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function updateJourneyStatus(journeyId, status) {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      return { success: false, error: 'User must be logged in to update journey.' };
    }

    const { data, error } = await supabase
      .from('passenger_journeys')
      .update({
        status,
        ...(status === 'completed' ? { alighted_at: new Date().toISOString() } : {})
      })
      .eq('id', journeyId)
      .eq('passenger_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Update journey error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Update journey error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchUserJourneys(passengerId) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const activeUserId = userData?.user?.id;

    if (userError || !activeUserId) {
      return { success: false, error: userError?.message || 'No authenticated user identity provided.' };
    }
    if (passengerId && passengerId !== activeUserId) {
      return { success: false, error: 'Requested passenger does not match the authenticated user.' };
    }

    // Do not embed trips/buses here: some deployments have trip_id without a
    // declared PostgREST foreign-key relationship, which makes the whole
    // history query fail (including completed journeys).
    const { data, error } = await supabase
      .from('passenger_journeys')
      .select('*')
      .eq('passenger_id', activeUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Fetch journeys error:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Fetch journeys warning:', err.message);
    return { success: false, error: err.message };
  }
}

// ========================================================
// LIVE TRACKING & REALTIME OCCUPANCY
// ========================================================

export async function fetchCurrentBusLocation(busId) {
  try {
    const { data, error } = await supabase
      .from('bus_current_location')
      .select('*')
      .eq('bus_id', busId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchTripOccupancy(tripId) {
  try {
    const { data, error } = await supabase
      .from('trip_occupancy')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchActiveTripForRoute(routeCode) {
  try {
    const { data: route, error: routeError } = await supabase.from('routes')
      .select('id,code,name').eq('code', routeCode).maybeSingle();
    if (routeError) throw routeError;
    if (!route) return { success: true, data: null };

    const { data: trip, error: tripError } = await supabase.from('trips')
      .select('id,bus_id,route_id,status,started_at')
      .eq('route_id', route.id).eq('status', 'ongoing')
      .order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (tripError) throw tripError;
    if (!trip) return { success: true, data: null };

    const [{ data: bus, error: busError }, occupancyResult] = await Promise.all([
      supabase.from('buses').select('id,plate_number,capacity').eq('id', trip.bus_id).maybeSingle(),
      fetchTripOccupancy(trip.id)
    ]);
    if (busError) throw busError;
    if (!occupancyResult.success) throw new Error(occupancyResult.error);
    return { success: true, data: { ...trip, bus: bus || null, occupancy: occupancyResult.data } };
  } catch (err) { return { success: false, error: err.message }; }
}

export function subscribeToBusLocation(busId, onUpdate) {
  const channel = supabase
    .channel(`bus_location_${busId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bus_current_location',
        filter: `bus_id=eq.${busId}`
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToTripOccupancy(tripId, onUpdate) {
  const channel = supabase
    .channel(`trip_occupancy_${tripId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'boarding_events',
        filter: `trip_id=eq.${tripId}`
      },
      async () => {
        const occ = await fetchTripOccupancy(tripId);
        if (occ.success && occ.data) {
          onUpdate(occ.data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
