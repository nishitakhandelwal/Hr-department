import fs from 'fs';
import path from 'path';

const logoPath = path.resolve(process.cwd(), '../frontend/public/company-logo.png');

if (!fs.existsSync(logoPath)) {
  throw new Error(`Company logo not found at ${logoPath}. Please ensure frontend/public/company-logo.png exists.`);
}

const logoBuffer = fs.readFileSync(logoPath);
export const LOGO_BASE64 = logoBuffer.toString('base64');
export const LOGO_URL = `data:image/png;base64,${LOGO_BASE64}`;

console.log('[logo] Company logo loaded:', logoPath, logoBuffer.length, 'bytes');
