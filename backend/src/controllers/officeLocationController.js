import {
  createOfficeLocation,
  deleteOfficeLocation,
  fetchOfficeLocations,
  updateOfficeLocation,
} from "../services/officeLocationService.js";

export const getLocations = async (_req, res) => {
  const data = await fetchOfficeLocations();
  return res.json({
    success: true,
    message: "Office locations fetched successfully.",
    data,
  });
};

export const createLocation = async (req, res) => {
  const data = await createOfficeLocation(req.body, req.user?._id || null);
  return res.status(201).json({
    success: true,
    message: "Office location created successfully.",
    data,
  });
};

export const updateLocation = async (req, res) => {
  const data = await updateOfficeLocation(req.params.id, req.body, req.user?._id || null);
  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Office location not found.",
      data: null,
    });
  }

  return res.json({
    success: true,
    message: "Office location updated successfully.",
    data,
  });
};

export const deleteLocation = async (req, res) => {
  const data = await deleteOfficeLocation(req.params.id);
  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Office location not found.",
      data: null,
    });
  }

  return res.json({
    success: true,
    message: "Office location deleted successfully.",
    data,
  });
};
