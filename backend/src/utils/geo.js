const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value) => (Number(value) * Math.PI) / 180;

export const calculateHaversineDistance = (from, to) => {
  const startLatitude = Number(from?.latitude);
  const startLongitude = Number(from?.longitude);
  const endLatitude = Number(to?.latitude);
  const endLongitude = Number(to?.longitude);

  const latitudeDelta = toRadians(endLatitude - startLatitude);
  const longitudeDelta = toRadians(endLongitude - startLongitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(startLatitude)) *
      Math.cos(toRadians(endLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Number((EARTH_RADIUS_METERS * arc).toFixed(2));
};
