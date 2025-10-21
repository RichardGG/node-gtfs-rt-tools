// TODO this file will be used to generate GeoJSON from the segment
// routes, trips, stops, stops_geom, trip_segments_geom tables

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

// TODO more efficient queries with fewer round-trips to the database?

import dotenv from "dotenv";
import postgres from "postgres";
import fs from "fs";

dotenv.config();
const sql = postgres({});

const processBatch = async () => {
  const routes = await sql`
    SELECT * FROM routes
    LIMIT 50
  `;
  const features = [];

  for (const route of routes) {
    const trips = await sql`
      SELECT * FROM trips
      WHERE entity->>'route_id' = ${route.entity.route_id}
      LIMIT 1
    `;
    console.log(
      `Processing ${trips.length} trips for route ${route.entity.route_id}`
    );

    const count = 0;

    for (const trip of trips) {
      const stopTimes = await sql`
        SELECT * FROM stop_times
        WHERE entity->>'trip_id' = ${trip.entity.trip_id}
        ORDER BY (entity->>'stop_sequence')::int
      `;

      console.log(
        `  Processing ${stopTimes.length} stop times for trip ${trip.entity.trip_id}`
      );
      for (let i = 0; i < stopTimes.length - 1; i++) {
        const fromStopId = stopTimes[i].entity.stop_id;
        const toStopId = stopTimes[i + 1].entity.stop_id;

        const segmentResult = await sql`
          SELECT geom FROM trip_segments_geom
          WHERE route_id = ${route.entity.route_id}
          AND from_stop_id = ${fromStopId}
          AND to_stop_id = ${toStopId}
          LIMIT 1
        `;
        if (segmentResult.length === 0) continue;

        console.log("  Found segment from", fromStopId, "to", toStopId);

        const geom = segmentResult[0].geom;
        const geojsonGeom = await sql`
          SELECT ST_AsGeoJSON(${geom}) as geojson
        `;

        const feature = {
          type: "Feature",
          geometry: JSON.parse(geojsonGeom[0].geojson),
          properties: {
            route_id: route.entity.route_id,
            trip_id: trip.entity.trip_id,
            from_stop_id: fromStopId,
            to_stop_id: toStopId,
          },
        };
        features.push(feature);
        console.log("pushed feature for segment", fromStopId, "to", toStopId);
      }
    }
  }

  fs.writeFileSync(
    "temp_json/segments.json",
    JSON.stringify(features, null, 2)
  );
  return features;
};

await processBatch();
process.exit(0);
