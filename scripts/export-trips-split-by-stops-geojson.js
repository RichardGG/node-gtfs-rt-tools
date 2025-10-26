import dotenv from "dotenv";
import postgres from "postgres";
import fs from "fs";

dotenv.config();
const sql = postgres({});

const processTrip = async (tripId, shapeId, additionalProperties) => {
  // Instead of splitting by segment, we'll keep the shapes in-tact but split lines by individual stops on trip

  // TODO Route trips have different shapes. Busese generally have two shapes, one per direction.
  // But train lines and some bus lines have multiple shapes per route (eg express vs local)
  // Determine most common shape? Or longest? buses generally have two directions
  // This is something to maybe solve, but lets just process the first trip per route for now

  // TODO might need to merge stops? (figure out later)

  // TODO define colours for points based on delay info (just per stop data, coloured in JS)

  console.log("Processing trip ", tripId, " with shape ", shapeId);

  // Line points along shape
  const linePoints = await sql`
    SELECT
      ST_LineLocatePoint(shapes_geom.geom,ST_PointN(shapes_geom.geom, generate_series(1, ST_NumPoints(shapes_geom.geom)))) as frac,
      ST_AsGeoJSON(ST_PointN(shapes_geom.geom, generate_series(1, ST_NumPoints(shapes_geom.geom)))) as geom
    FROM shapes_geom WHERE shapes_geom.shape_id = ${shapeId}
  `;

  console.log(`Fetched ${linePoints.length} line points for shape ${shapeId}`);

  // Stop points along shape
  const stopPoints = await sql`
    SELECT
      stop_times.entity->>'stop_id' as stop_id,
      ST_LineLocatePoint(shapes_geom.geom, stops_geom.geom) AS frac,
      ST_AsGeoJSON(ST_LineInterpolatePoint(shapes_geom.geom, ST_LineLocatePoint(shapes_geom.geom, stops_geom.geom))) AS geom
    FROM stop_times
    INNER JOIN stops_geom ON stops_geom.stop_id = stop_times.entity->>'stop_id'
    INNER JOIN shapes_geom ON shapes_geom.shape_id = ${shapeId}
    WHERE stop_times.entity->>'trip_id' = ${tripId}
    ORDER BY stop_times.entity->>'stop_sequence';
  `;

  console.log(`Fetched ${stopPoints.length} stop points for trip ${tripId}`);

  // Combine line points and stops by fraction along shape
  const combinedPoints = [...linePoints, ...stopPoints];
  combinedPoints.sort((a, b) => a.frac - b.frac);
  // TODO remove duplicates (ie line points that are very close to stop points)

  // Note details about each point (to assist with styling later)
  const pointData = [];
  const coordinates = [];
  combinedPoints.forEach((pt, index) => {
    pointData.push({
      frac: pt.frac,
      geom: JSON.parse(pt.geom).coordinates,
      stop_id: pt.stop_id || null,
    });
    coordinates.push(JSON.parse(pt.geom).coordinates);
  });

  console.log(`Constructed GeoJSON geometry for trip ${tripId}`);

  const feature = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: coordinates,
    },
    properties: {
      trip_id: tripId,
      shape_id: shapeId,
      point_data: pointData,
      ...additionalProperties,
    },
  };

  return feature;
};

const uniqueShapes = [];

const processBatch = async (limit, offset = 0) => {
  const fetchResult = await sql`
    SELECT trips.trip_id, string_agg(stop_times.stop_id, ', ' ORDER BY stop_times.stop_id) as stop_seq, (jsonb_agg(trips.entity))[1] as entity FROM trips
    INNER JOIN stop_times ON trips.trip_id = stop_times.trip_id
    GROUP BY trips.trip_id
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  // TODO this gets slow with large offsets, new logging table to identify the fetches instead
  // 25k remaining, 10 in about 10s. Estimate 7 hours for all at this rate... Probably around 18h total

  console.log(`Processing ${fetchResult.length} trips`);

  if (!fetchResult || fetchResult.length === 0) {
    return false;
  }

  const features = [];
  for (const row of fetchResult) {
    // Only trips with unique (shape + stop sequence)
    const key = `${row.entity.shape_id}-${row.stop_seq}`;
    if (uniqueShapes.includes(key)) {
      console.log(
        `Skipping trip ${row.entity.trip_id} with duplicate shape/stop sequence`
      );
      continue;
    }
    uniqueShapes.push(key);
    features.push(
      await processTrip(row.entity.trip_id, row.entity.shape_id, {
        route_id: row.entity.route_id,
        service_id: row.entity.service_id,
        direction_id: row.entity.direction_id,
        trip_headsign: row.entity.trip_headsign,
        key: key,
      })
    );
  }
  return features;
};

const processAll = async () => {
  let offset = 0;
  let done = false;
  const allFeatures = [];
  while (!done) {
    const results = await processBatch(10, offset);
    if (!results) {
      done = true;
      break;
    }
    offset += 10;
    console.log(`Processed ${results.length} trips`);
    allFeatures.push(...results);
  }
  fs.writeFileSync(
    "temp_geojson/trips-split-by-stop.geojson",
    JSON.stringify(allFeatures)
  );
};

await processAll();
process.exit(0);
