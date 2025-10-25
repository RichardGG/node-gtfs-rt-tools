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

const processBatch = async (offset = 0) => {
  const fetchResult = await sql`
    SELECT * FROM trips
    ORDER BY id
    LIMIT 10
    OFFSET ${offset}
  `;

  console.log(`Processing ${fetchResult.length} trips`);

  const features = [];
  for (const row of fetchResult) {
    features.push(
      await processTrip(row.entity.trip_id, row.entity.shape_id, {
        route_id: row.entity.route_id,
        service_id: row.entity.service_id,
        direction_id: row.entity.direction_id,
        trip_headsign: row.entity.trip_headsign,
      })
    );
  }
  return features;
};

const processAll = async () => {
  let count = 1;
  let offset = 0;
  const allFeatures = [];
  while (count > 0 && offset < 100) {
    const results = await processBatch(offset);
    count = results.length;
    offset += count;
    console.log(`Processed ${count} trips`);
    allFeatures.push(...results);
  }
  fs.writeFileSync(
    "temp_geojson/trips-split-by-stop.geojson",
    JSON.stringify(allFeatures, null, 2)
  );
};

await processAll();
process.exit(0);
