import mongoose from "mongoose";
import { env } from "./env.js";

const connectWithUri = async (uri, label) => {
  await mongoose.connect(uri, {
    autoIndex: env.nodeEnv !== "production",
    serverSelectionTimeoutMS: 10000,
  });
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected (${label})`);
  return true;
};

export const connectDB = async () => {
  mongoose.set("strictQuery", true);

  try {
    return await connectWithUri(env.mongoUri, "primary");
  } catch (primaryError) {
    // eslint-disable-next-line no-console
    console.error("Primary MongoDB connection failed:", primaryError?.message || primaryError);

    if (env.nodeEnv !== "production" && env.mongoFallbackUri && env.mongoFallbackUri !== env.mongoUri) {
      try {
        // eslint-disable-next-line no-console
        console.warn(`Trying MongoDB fallback URI: ${env.mongoFallbackUri}`);
        return await connectWithUri(env.mongoFallbackUri, "fallback");
      } catch (fallbackError) {
        // eslint-disable-next-line no-console
        console.error("Fallback MongoDB connection failed:", fallbackError?.message || fallbackError);
      }
    }

    if (env.nodeEnv !== "production" && env.allowStartWithoutDb) {
      // eslint-disable-next-line no-console
      console.warn("Starting backend without database (development mode).");
      // eslint-disable-next-line no-console
      console.warn("Set ALLOW_START_WITHOUT_DB=false to enforce DB startup in development.");
      return false;
    }

    throw primaryError;
  }
};
