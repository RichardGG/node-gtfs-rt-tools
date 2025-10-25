# node-gtfs-rt-tools
Tools to read/store/analyse gtfs realtime data

Currently only supports saving GTFS-RT data to a postgres DB

```
npm install
npm run migrate
npm run fetch
```

## Scripts
* Aggregate
    * scripts/process-trip-stop-delays.js (Loop through trip updates, set DB agg_trip_stop_delays)
* GTFS Import
    * scripts/import-shapes-geom.js (Import GTFS stop data to DB as geom)
    * scripts/import-stops-geom.js (Import GTFS stop data to DB as geom)
    * scripts/import-csv.js (Manually import raw GTFS data to DB)
* Export
    * scripts/export-stop-delays.js (Average and Max stop delays per trip)
    * scripts/export-trips-split-by-stops-geojson.js (GeoJSON shapes with extra points for stops, used for styling)
* Abandoned approach
    * ~~scripts/export-stops-json.js~~ Testing (Exporting gtfs stops as regular json)
    * ~~scripts/process-shapes-segments.js~~ Abandoned approach (split shapes into segments between stops)
    * ~~scripts/export-geojson.js~~ Abandoned approach
    * ~~scripts/export-geojson-slow.js~~ 