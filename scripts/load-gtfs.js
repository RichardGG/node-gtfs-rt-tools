// This script is intended to download GTFS data from the web and load it into the database if version not already present
import fetch from "node-fetch";
import crypto from "crypto";
import AdmZip from "adm-zip";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();
const sql = postgres({});

function calculateHash(buffer, algorithm = "sha256") {
  const hash = crypto.createHash(algorithm);
  hash.update(Buffer.from(buffer)); // Convert ArrayBuffer to Buffer for crypto module
  return hash.digest("hex"); // Get the hash in hexadecimal format
}

// TODO check for changes in historic GTFS data https://mobilitydatabase.org/feeds/gtfs/mdb-668
// 20250906,20251105
const fetchGTFS = async () => {
  const res = await fetch(
    "https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip"
  );
  if (!res.ok) {
    const error = new Error(`${res.url}: ${res.status} ${res.statusText}`);
    error.response = res;
    throw error;
  }
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
};

async function run() {
  const fileContent = await fetchGTFS();
  if (!fileContent) {
    return false; // Fetch failed
  }

  const calculatedHash = calculateHash(fileContent);
  console.log(`Calculated hash: ${calculatedHash}`);

  const zip = new AdmZip(fileContent);
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    const entryHash = calculateHash(entry.getData());
    console.log(`Entry: ${entry.entryName}, Hash: ${entryHash}`);

    const fetchResult = await sql`
      SELECT COUNT(id) FROM gtfs_fetches
      WHERE type = ${entry.entryName} AND hash = ${entryHash}
    `;

    if (fetchResult[0].count === "0") {
      console.log(
        `New GTFS file detected: ${entry.entryName} with hash ${entryHash}. Loading into database...`
      );
      await sql`
        INSERT INTO gtfs_fetches (type, hash, content, fetched_at)
        VALUES (${entry.entryName}, ${entryHash}, ${entry.toString()},now())
      `;
    } else {
      console.log(
        `GTFS file ${entry.entryName} with hash ${entryHash} already exists in database. Skipping load.`
      );
    }
  }
}

// TODO review GTFS tables and implement some sort of versioning

await run();
process.exit(0);
