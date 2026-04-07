import { getRuntimeConfig, getDefaultRuntimeConfig, updateRuntimeConfig } from "../services/configService.js";

export const getConfig = async (_req, res) => {
  const config = await getRuntimeConfig();
  return res.json({
    success: true,
    message: "Runtime config fetched",
    data: config,
  });
};

export const updateConfig = async (req, res) => {
  const config = await updateRuntimeConfig(req.body || {});
  return res.json({
    success: true,
    message: "Runtime config updated",
    data: config,
  });
};

export const getConfigDefaults = async (_req, res) => {
  return res.json({
    success: true,
    message: "Runtime config defaults fetched",
    data: getDefaultRuntimeConfig(),
  });
};

