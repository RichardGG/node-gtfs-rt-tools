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
    VALUES ('import_shapes', ${"imported from CSV"})
    RETURNING id
  `;
  const fetchId = fetchResult[0].id;
  const parser = parse({ delimiter: ",", columns: true });

  parser.on("readable", async () => {
    let record;
    const shapes = new Map();

    // Read shapes from file
    while ((record = parser.read())) {
      const shape_id = record.shape_id;
      if (!shapes.has(shape_id)) shapes.set(shape_id, []);
      shapes.get(shape_id).push({
        seq: parseInt(record.shape_pt_sequence, 10),
        lat: parseFloat(record.shape_pt_lat),
        lon: parseFloat(record.shape_pt_lon),
      });
    }

    // Insert each shape into PostGIS
    for (const [shape_id, points] of shapes.entries()) {
      points.sort((a, b) => a.seq - b.seq);

      if (points.length < 2) {
        console.warn(
          `Shape ${shape_id} has less than 2 points, skipping geometry creation.`
        );
        continue;
      }

      const coords = points.map((p) => `${p.lon} ${p.lat}`).join(", ");
      const linestring = `LINESTRING(${coords})`;

      await sql`
          INSERT INTO shapes_geom (fetch_id, shape_id, geom)
          VALUES (${fetchId}, ${shape_id}, ST_SetSRID(ST_GeomFromText(${linestring}), 4326))
          ON CONFLICT (shape_id)
          DO UPDATE SET geom = EXCLUDED.geom
        `;
    }
  });

  parser.on("error", (err) => {
    console.error(err.message);
  });

  // Import the CSV file
  await fs.createReadStream(`temp_gtfs/shapes.txt`).pipe(parser);
  return new Promise((resolve) => {
    parser.on("end", resolve);
  });
};

await importShapes();
process.exit(0);
