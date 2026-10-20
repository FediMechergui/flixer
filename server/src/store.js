// JSON persistence under server/data. Writes are atomic (tmp + rename).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {readJsonFile,writeJsonFile} from './json-files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), `stream-library-${process.env.APP_PRODUCT || 'flixer'}`) : path.resolve(__dirname, '../data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

export function readJson(name, fallback) {
  const file = path.join(DATA_DIR, name);
  try {
    return readJsonFile(file);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`[store] ${name}: ${e.message}`);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

export function writeJson(name, data) {
  const file = path.join(DATA_DIR, name);
  const tmp = `${file}.${process.pid}.tmp`;
  try{writeJsonFile(tmp,data);fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}
}

export const DEFAULT_SOURCES = {
  sources: [
    {
      type: 'channel',
      id: 'UCLiTe0aOHShx7hXGyqZ9UIw',
      title: 'Nat Geo Abu Dhabi',
      url: 'https://www.youtube.com/@natgeoabudhabime',
      addedAt: '2026-10-12T00:00:00.000Z',
    },
  ],
};

export const DEFAULT_OVERRIDES = {
  // Episodes shorter than this are treated as promos/clips and never listed as episodes.
  minEpisodeSeconds: 420,
  // Map alternative spellings to a canonical show title (normalized comparison).
  aliases: {},
  // Per-show overrides keyed by show id (see catalog.json) or by exact show title.
  shows: {},
};
