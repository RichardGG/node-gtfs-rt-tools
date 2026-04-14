import dotenv from "dotenv";
import postgres from "postgres";
import fs from "fs";

dotenv.config();
const sql = postgres({});

const processBatch = async () => {
  const fetchResult = await sql`
        SELECT
            trips.entity->>'route_id' as route_id,
            SUBSTRING(stop_times.entity->>'arrival_time', 1, STRPOS(stop_times.entity->>'arrival_time', ':') - 1) as hour,
            day_of_week,
            (SUM(averages.avg_delay) / SUM(averages.count))::NUMERIC(10,2) as avg_delay,
            MAX(max_delay) as max_delay
        FROM "trips"
        INNER JOIN (
            SELECT
                stop_id,
                stop_sequence,
                trip_id,
                EXTRACT(DOW FROM estimated_arrival) as day_of_week,

                COUNT(*) as count,
                avg(GREATEST(arrival_delay_seconds, 0))::NUMERIC(10,2) as avg_delay,
                max(arrival_delay_seconds) as max_delay
            FROM agg_trip_stop_delays
            GROUP BY stop_id, stop_sequence, trip_id, EXTRACT(DOW FROM estimated_arrival)
        ) as averages
        ON averages.trip_id = trips.trip_id
        INNER JOIN stop_times ON stop_times.trip_id = averages.trip_id AND stop_times.stop_sequence = averages.stop_sequence AND stop_times.stop_id = averages.stop_id
        GROUP BY trips.entity->>'route_id', SUBSTRING(stop_times.entity->>'arrival_time', 1, STRPOS(stop_times.entity->>'arrival_time', ':') - 1), averages.day_of_week
    `;
  fs.writeFileSync("temp_json/weekly-delays.json", "[");
  for (let i = 0; i < fetchResult.length; i++) {
    fs.appendFileSync(
      "temp_json/weekly-delays.json",
      JSON.stringify(fetchResult[i]) + (i < fetchResult.length - 1 ? "," : "")
    );
  }
  fs.appendFileSync("temp_json/weekly-delays.json", "]");

  // ✅ Overall average delays grouped by route, hour, weekday
  // TODO [Do we want to group by direction too?]
  // TODO export monthly/weekly averages (see trends over time)
  // TODO consider Average max delay per day (determine which days have extreme delays?)
  // TODO show the delays in a timetable or scrollable timeline
  // TODO group stops from different trips together (distance?)

  return 1;
};

await processBatch();
process.exit(0);
