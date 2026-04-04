export const listEntities = (Model, populate = "") => async (req, res) => {
  const query = Model.find().sort({ createdAt: -1 });
  if (populate) query.populate(populate);
  const data = await query;
  res.json({ success: true, message: "Fetched successfully", data });
};

export const createEntity = (Model) => async (req, res) => {
  const created = await Model.create(req.body);
  res.status(201).json({ success: true, message: "Created successfully", data: created });
};

export const updateEntity = (Model) => async (req, res) => {
  const updated = await Model.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!updated) {
    const error = new Error("Resource not found");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Updated successfully", data: updated });
};

export const deleteEntity = (Model) => async (req, res) => {
  const deleted = await Model.findByIdAndDelete(req.params.id);
  if (!deleted) {
    const error = new Error("Resource not found");
    error.statusCode = 404;
    throw error;
  }
  res.json({ success: true, message: "Deleted successfully", data: deleted });
};
