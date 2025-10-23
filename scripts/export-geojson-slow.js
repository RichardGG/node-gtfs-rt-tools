/**
 * Summarised schema relationships:
 * Route has many Trips
 *  * Trip has many StopTimes
 *    * StopTime belongs to Stop
 *      * Stop has one StopsGeom
 *  * Trip has many TripSegmentsGeom
 *    * TripSegmentGeom connects two Stops (from_stop_id, to_stop_id) and has a geometry (geom)
 */

// We also want to consider adding the delay information to the GeoJSON properties
// so that we can visualise delays on the map
// eg max-delay per stop/route/day

// Ideally we have a reusable function to convert a geometry to GeoJSON format, we can create different outputs for each dataset

/**
 * Action plan:
 * 1. Fetch all routes
 * 2. For each route, fetch all trips
 * 3. For each trip, fetch all stop times (ordered by stop_sequence)
 * 4. For each pair of consecutive stop times, fetch the trip segment geom
 * 5. Construct GeoJSON features for each trip segment, including properties from route, trip, stops, delays
 * 6. Write the GeoJSON to a file
 */

import dotenv from "dotenv";
import postgres from "postgres";
import fs from "fs";

dotenv.config();
const sql = postgres({});

const processBatch = async () => {
  // TODO this still isn't efficient, see EXPLAIN, consider composite indexes
  // Get all route segments with their geometries in a single query, using indexed columns
  const results = await sql`
    WITH route_segments AS (
      SELECT DISTINCT 
        r.entity as route,
        t.entity as trip,
        st1.entity as from_stop_time,
        st2.entity as to_stop_time,
        tsg.geom,
        tsg.from_stop_id,
        tsg.to_stop_id
      FROM routes r
      JOIN trips t ON t.route_id = r.route_id
      JOIN stop_times st1 ON st1.trip_id = t.trip_id
      JOIN stop_times st2 ON st2.trip_id = t.trip_id AND st2.stop_sequence = st1.stop_sequence + 1
      JOIN trip_segments_geom tsg 
        ON tsg.route_id = r.route_id
        AND tsg.from_stop_id = st1.stop_id
        AND tsg.to_stop_id = st2.stop_id
      LIMIT 50
    )
    SELECT 
      rs.*,
      ST_AsGeoJSON(rs.geom) as geojson
    FROM route_segments rs
  `;

  const features = results.map((row) => ({
    type: "Feature",
    geometry: JSON.parse(row.geojson),
    properties: {
      route_id: row.route.route_id,
      trip_id: row.trip.trip_id,
      from_stop_id: row.from_stop_id,
      to_stop_id: row.to_stop_id,
      route_short_name: row.route.route_short_name,
      route_long_name: row.route.route_long_name,
      departure_time: row.from_stop_time.departure_time,
      arrival_time: row.to_stop_time.arrival_time,
    },
  }));

  fs.writeFileSync(
    "temp_json/segments2.json",
    JSON.stringify(features, null, 2)
  );
  return features;
};

await processBatch();
process.exit(0);
