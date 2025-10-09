export async function up(sql) {
  await sql`
        CREATE TABLE stops_geom (
            fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
            stop_id TEXT PRIMARY KEY,
            stop_name TEXT,
            geom GEOMETRY(Point, 4326)
        );
    `;
}

export async function down(sql) {
  await sql`DROP TABLE stops_geom`;
}
