import { OfficeLocation } from "../models/OfficeLocation.js";
import { calculateHaversineDistance } from "../utils/geo.js";

const DEFAULT_OFFICE_LOCATIONS = [
  {
    name: "Head Office - Noida",
    latitude: 28.5355,
    longitude: 77.391,
    radiusMeters: 250,
  },
  {
    name: "Regional Office - Lucknow",
    latitude: 26.8467,
    longitude: 80.9462,
    radiusMeters: 250,
  },
];

const normalizeOfficeLocation = (location) => ({
  _id: String(location._id),
  name: location.name,
  latitude: Number(location.latitude),
  longitude: Number(location.longitude),
  radiusMeters: Number(location.radiusMeters),
  createdAt: location.createdAt,
  updatedAt: location.updatedAt,
});

export const fetchOfficeLocations = async () => {
  const locations = await OfficeLocation.find().sort({ name: 1 }).lean();
  return locations.map(normalizeOfficeLocation);
};

export const initializeOfficeLocations = async () => {
  const totalLocations = await OfficeLocation.countDocuments();
  if (totalLocations > 0) return;

  await OfficeLocation.insertMany(DEFAULT_OFFICE_LOCATIONS);
  console.log("[Office Locations] Sample office locations initialized successfully");
};

export const createOfficeLocation = async (payload, userId = null) => {
  const created = await OfficeLocation.create({
    name: payload.name,
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    radiusMeters: Number(payload.radiusMeters),
    createdBy: userId,
    updatedBy: userId,
  });

  return normalizeOfficeLocation(created.toObject());
};

export const updateOfficeLocation = async (locationId, payload, userId = null) => {
  const updated = await OfficeLocation.findByIdAndUpdate(
    locationId,
    {
      $set: {
        name: payload.name,
        latitude: Number(payload.latitude),
        longitude: Number(payload.longitude),
        radiusMeters: Number(payload.radiusMeters),
        updatedBy: userId,
      },
    },
    { new: true, runValidators: true }
  ).lean();

  return updated ? normalizeOfficeLocation(updated) : null;
};

export const deleteOfficeLocation = async (locationId) => {
  const deleted = await OfficeLocation.findByIdAndDelete(locationId).lean();
  return deleted ? normalizeOfficeLocation(deleted) : null;
};

export const validateGeoFence = async ({ latitude, longitude }) => {
  const locations = await fetchOfficeLocations();

  if (!locations.length) {
    return {
      matched: false,
      message: "No office locations are configured yet. Please contact an administrator.",
      matchedLocation: null,
      nearestLocation: null,
      evaluatedLocations: [],
    };
  }

  const evaluatedLocations = locations
    .map((location) => {
      const distanceMeters = calculateHaversineDistance(
        { latitude, longitude },
        { latitude: location.latitude, longitude: location.longitude }
      );

      return {
        ...location,
        distanceMeters,
        withinRadius: distanceMeters <= location.radiusMeters,
      };
    })
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  const matchedLocation = evaluatedLocations.find((location) => location.withinRadius) || null;
  const nearestLocation = evaluatedLocations[0] || null;

  return {
    matched: Boolean(matchedLocation),
    message: matchedLocation
      ? `Inside ${matchedLocation.name}`
      : `Outside all office zones. Nearest office is ${nearestLocation?.name || "unavailable"}.`,
    matchedLocation,
    nearestLocation,
    evaluatedLocations,
  };
};
