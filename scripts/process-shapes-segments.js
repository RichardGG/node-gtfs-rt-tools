import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config();
const sql = postgres({});

const markAsProcessed = async (id) => {
  await sql`
        UPDATE trips
        SET last_processed_at = now()
        WHERE id = ${id}
    `;
};

const processSegment = async (routeId, stopId1, stopId2, shapeId) => {
  const segment = await sql`
      WITH stop_fracs AS (
      SELECT s.stop_id,
            st.shape_id,
            ST_LineLocatePoint(st.geom, s.geom) AS frac
      FROM stops_geom s
      JOIN shapes_geom st
        ON st.shape_id = ${shapeId}
      WHERE s.stop_id IN (${stopId1},${stopId2})
    )
    SELECT ST_LineSubstring(st.geom,
                            LEAST(a.frac, b.frac),
                            GREATEST(a.frac, b.frac)) AS seg
    FROM shapes_geom st
    JOIN stop_fracs a ON st.shape_id = a.shape_id AND a.stop_id = ${stopId1}
    JOIN stop_fracs b ON st.shape_id = b.shape_id AND b.stop_id = ${stopId2};
  `;

  await sql`
      INSERT INTO trip_segments_geom (fetch_id, route_id, from_stop_id, to_stop_id, geom)
      VALUES (1, ${routeId}, ${stopId1}, ${stopId2}, ${segment[0].seg})
  `;
};

const processTrip = async (tripId) => {
  const fetchResult = await sql`
        SELECT stop_times.entity as stop_times_entity, trips.entity as trips_entity FROM stop_times
        INNER JOIN trips ON trips.entity->>'trip_id' = stop_times.entity->>'trip_id'
        WHERE stop_times.entity->>'trip_id' = ${tripId}
        ORDER BY stop_times.entity->>'stop_sequence'
        LIMIT 5000
    `;

  console.log(`Processing ${fetchResult.length} stop times for trip ${tripId}`);

  // TODO might need to merge stops? (figure out later)
  // TODO I suppose we can assume that the same stops segment will have the same shape? (for now)

  let lastStop = null;
  for (const row of fetchResult) {
    if (!lastStop) {
      lastStop = row;
      continue;
    }

    await processSegment(
      row.trips_entity.route_id,
      lastStop.stop_times_entity.stop_id,
      row.stop_times_entity.stop_id,
      row.trips_entity.shape_id
    );

    lastStop = row;
  }
  return fetchResult;
};

const processBatch = async () => {
  const fetchResult = await sql`
        SELECT * FROM trips
        WHERE last_processed_at IS NULL
        ORDER BY id
        LIMIT 10
    `;

  console.log(`Processing ${fetchResult.length} trips`);
  for (const row of fetchResult) {
    await processTrip(row.entity.trip_id);
    await markAsProcessed(row.id);
  }
  return fetchResult;
};

let count = 1;
while (count > 0) {
  const results = await processBatch();
  count = results.length;
  console.log(`Processed ${count} trips`);
}
process.exit(0);
