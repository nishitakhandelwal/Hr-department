import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = path.resolve(__dirname, "..", "..");
export const uploadsDir = path.join(serverRoot, "uploads");
