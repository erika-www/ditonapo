/**
 * Geolocation & Spatial Distance Utilities (Haversine Formula)
 * Calculates distance between GPS coordinates in kilometers & meters,
 * finds nearest QC Bus stop to user location, and estimates walking time.
 */

/**
 * Calculates Haversine distance between two (lat, lng) points in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance into readable meters or kilometers
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Estimates walking time in minutes based on 4.8 km/h average speed
 */
export function estimateWalkingTimeMins(distanceKm) {
  const walkingSpeedKmH = 4.8;
  const hours = distanceKm / walkingSpeedKmH;
  const minutes = Math.ceil(hours * 60);
  return minutes < 1 ? 1 : minutes;
}

/**
 * Finds the single nearest bus stop from a list of stops given a user's GPS coordinates
 */
export function findNearestStop(userLat, userLng, stopsList = []) {
  if (!userLat || !userLng || !stopsList.length) return null;

  let nearest = null;
  let minDistance = Infinity;

  stopsList.forEach((stop) => {
    const dist = calculateDistanceKm(userLat, userLng, stop.lat || stop.latitude, stop.lng || stop.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = {
        stop,
        distanceKm: dist,
        formattedDistance: formatDistance(dist),
        walkingMins: estimateWalkingTimeMins(dist),
      };
    }
  });

  return nearest;
}
