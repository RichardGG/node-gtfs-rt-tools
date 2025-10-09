import dotenv from "dotenv";
import postgres from "postgres";
import { parse } from "csv-parse";
import fs from "fs";

dotenv.config();
const args = process.argv.slice(2);
const sql = postgres({});

const importShapes = async () => {
  const fetchResult = await sql`
    INSERT INTO fetches (type, header)
    VALUES ('import_stops', ${"imported from CSV"})
    RETURNING id
  `;
  const fetchId = fetchResult[0].id;
  const parser = parse({ delimiter: ",", columns: true });

  parser.on("readable", async () => {
    let record;

    // Read stops from file
    while ((record = parser.read())) {
      await sql`
        INSERT INTO stops_geom (fetch_id, stop_id, stop_name, geom)
        VALUES (
          ${fetchId},
          ${record.stop_id},
          ${record.stop_name},
          ST_SetSRID(
            ST_MakePoint(
              ${parseFloat(record.shape_pt_lon)},
              ${parseFloat(record.shape_pt_lat)}
            ),
            4326
          )
        )
        ON CONFLICT (stop_id)
        DO UPDATE SET stop_name = EXCLUDED.stop_name,
                      geom = EXCLUDED.geom
        `;
    }
  });

  parser.on("error", (err) => {
    console.error(err.message);
  });

  // Import the CSV file
  await fs.createReadStream(`temp_gtfs/stops.txt`).pipe(parser);
  return new Promise((resolve) => {
    parser.on("end", resolve);
  });
};

await importShapes();
process.exit(0);
