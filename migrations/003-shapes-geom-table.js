export async function up(sql) {
  await sql`
        CREATE TABLE shapes_geom (
            fetch_id integer REFERENCES fetches(id) ON DELETE CASCADE,
            shape_id TEXT PRIMARY KEY,
            geom GEOMETRY(LineString, 4326)
        );
    `;
}

export async function down(sql) {
  await sql`DROP TABLE shapes_geom`;
}
