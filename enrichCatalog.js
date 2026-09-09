import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TMDB_API_KEY = 'b9bfbf5ca6f25f3f03f7a41b71dddf9d';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3/search';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const REQUEST_DELAY_MS = 250;
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(SCRIPT_DIRECTORY, 'src/data/recommendationsData.js');
const RETRY_ONLY_TITLES = new Set([
  "Kiki's Delivery Service",
]);
const ALTERNATE_TITLES = {
  "Kiki's Delivery Service": ['Kiki', 'Majo no Takkyuubin'],
  'My Neighbor Totoro': ['Tonari no Totoro', 'My Neighbour Totoro'],
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findOnTmdb(item) {
  const endpoints = item.type === 'movie' || RETRY_ONLY_TITLES.has(item.title)
    ? ['movie', 'tv']
    : ['tv'];
  const titlesToTry = [item.title, ...(ALTERNATE_TITLES[item.title] || [])];

  for (const endpoint of endpoints) {
    for (const title of titlesToTry) {
      const query = new URLSearchParams({ api_key: TMDB_API_KEY, query: title });
      const response = await fetch(`${TMDB_BASE_URL}/${endpoint}?${query}`);

      if (!response.ok) {
        throw new Error(`TMDB responded with ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.results?.[0]) return data.results[0];
      if (title !== titlesToTry.at(-1) || endpoint !== endpoints.at(-1)) await sleep(REQUEST_DELAY_MS);
    }
  }

  return null;
}

function enrichItem(item, result) {
  const releaseDate = result.release_date || result.first_air_date;
  const enrichedItem = { ...item };

  if (result.poster_path) {
    enrichedItem.thumbnail = `${TMDB_IMAGE_BASE_URL}${result.poster_path}`;
    enrichedItem.image = `${TMDB_IMAGE_BASE_URL}${result.poster_path}`;
  }
  if (releaseDate) enrichedItem.year = releaseDate.slice(0, 4);
  if (result.overview) {
    enrichedItem.description = result.overview;
    enrichedItem.synopsis = result.overview;
  }

  return enrichedItem;
}

async function main() {
  const catalogModule = await import(pathToFileURL(CATALOG_PATH).href);
  const updatedCatalog = [];
  const unmatchedTitles = [];

  for (const item of catalogModule.mediaCatalog) {
    if (item.type === 'music') {
      updatedCatalog.push(item);
      continue;
    }
    if (!['movie', 'series', 'anime'].includes(item.type) || !RETRY_ONLY_TITLES.has(item.title)) {
      updatedCatalog.push(item);
      continue;
    }

    try {
      const result = await findOnTmdb(item);
      if (!result) {
        unmatchedTitles.push(`${item.type}: ${item.title}`);
        updatedCatalog.push(item);
      } else {
        updatedCatalog.push(enrichItem(item, result));
      }
    } catch (error) {
      console.error(`Failed to enrich ${item.type}: ${item.title} (${error.message})`);
      unmatchedTitles.push(`${item.type}: ${item.title}`);
      updatedCatalog.push(item);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  const source = await fs.readFile(CATALOG_PATH, 'utf8');
  const catalogExport = `export const mediaCatalog = ${JSON.stringify(updatedCatalog, null, 2)};`;
  const exportPattern = /export const mediaCatalog = (?:\[\.\.\.legacyMediaCatalog, \.\.\.generatedCatalog\]|\[[\s\S]*?\n\]);/;

  if (!exportPattern.test(source)) {
    throw new Error('Could not locate the mediaCatalog export; no file was written.');
  }

  const updatedSource = source.replace(exportPattern, catalogExport);
  await fs.writeFile(CATALOG_PATH, updatedSource, 'utf8');

  console.log(`Enriched ${RETRY_ONLY_TITLES.size - unmatchedTitles.length} previously unmatched catalog item(s).`);
  if (unmatchedTitles.length) {
    console.log('\nTitles not matched on TMDB:');
    unmatchedTitles.forEach((title) => console.log(`- ${title}`));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});