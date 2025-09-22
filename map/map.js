var map = L.map('map').setView([-28, 153.38], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    opacity: 0.3,
}).addTo(map);

const randomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

const addCustomStops = async () => {

    const response = await fetch('/temp_json/stops.json');

    const stops = await response.json();

    for (const stop of stops) {
        const lat = stop.entity.stop_lat;
        const lon = stop.entity.stop_lon;
        L.circleMarker([lat, lon], {stroke: false, fillOpacity: 1, color: randomColor()}).addTo(map)
            .bindPopup(`Stop ID: ${stop.entity.stop_id}<br>Stop Name: ${stop.entity.stop_name}`);
    }
}

const addGeoJson = async () => {
    const response = await fetch('/temp_geojson/translink-qld.geojson');
    const geojson = await response.json();
    return L.geoJSON(geojson, {
        pointToLayer: function (feature, latlng) {
            // console.log('feature', feature.properties?.routes?.[0]?.route_color);
            return L.circleMarker(latlng, {
                radius: 4,
                // TODO fix color (only fill showing)
                stroke: true,
                fillOpacity: 1,
                opacity: 1,
                // color: '#f00', // feature.properties?.routes?.[0]?.route_color || '#f00',// '#000', // randomColor(),
                weight: 2,
                fillColor: '#fff',
            });
        },
        style: function (feature) {
            return {
                color: feature.properties?.route_color || feature.properties?.routes?.[0]?.route_color,
                weight: 2,
                opacity: 1,
            };
        },
        onEachFeature: function (feature, layer) {
            if (feature.properties && feature.properties.route_id) {
                layer.bindPopup(`Route ID: ${feature.properties.route_id}<br>Route Name: ${feature.properties.route_short_name} - ${feature.properties.route_long_name}`);
            }
            if (feature.properties && feature.properties.stop_id) {
                layer.bindPopup(`Stop ID: ${feature.properties.stop_id}<br>Stop Name: ${feature.properties.stop_name}`);
            }
        }
    }).addTo(map);
}

// addCustomStops();
addGeoJson();

function updateColors(day) {
    console.log('updating colors');
    map.eachLayer(function (marker) {
    //   const stopId = marker.feature.properties.stop_id;
    //   const color = stopColorsByDay[day][stopId] || "gray";
        if (marker.setStyle) {
            marker.setStyle({ color: randomColor() });
        }
    });

    // While testing, update colors every 5 seconds
    window.setTimeout(() => {
        updateColors(day);
    }, 5000);
}
// updateColors('Monday');

map.on('zoom', function() {
    console.log('zoom level:', map.getZoom() < 13);

    map.eachLayer(function (marker) {
        if (marker instanceof L.CircleMarker === false) {
            return;
        }
        // Hide markers if zoom level is less than 13
        if (marker.setStyle) {
            if (map.getZoom() < 13) {
                marker.setStyle({ stroke: false, fill: false, });
            } else {
                marker.setStyle({ stroke: true, fill: true, });
            }
        }
    });
});