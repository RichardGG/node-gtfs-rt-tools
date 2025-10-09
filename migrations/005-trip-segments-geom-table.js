export async function up(sql) {
  await sql`
          CREATE TABLE trip_segments_geom (
              id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
              fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
              route_id TEXT,
              from_stop_id TEXT,
              to_stop_id TEXT,
              geom GEOMETRY(LineString, 4326)
          );
      `;

  await sql`ALTER TABLE trips ADD COLUMN last_processed_at TIMESTAMPTZ`;
}

export async function down(sql) {
  await sql`ALTER TABLE trips DROP COLUMN last_processed_at;`;
  await sql`DROP TABLE trip_segments_geom`;
}
