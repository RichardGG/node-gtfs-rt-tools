var map = L.map("map").setView([-28, 153.38], 13);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  opacity: 0.1,
}).addTo(map);

const randomColor = () => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

const addCustomStops = async () => {
  const response = await fetch("/temp_json/stops.json");

  const stops = await response.json();

  for (const stop of stops) {
    const lat = stop.entity.stop_lat;
    const lon = stop.entity.stop_lon;
    L.circleMarker([lat, lon], {
      stroke: false,
      fillOpacity: 1,
      color: randomColor(),
    })
      .addTo(map)
      .bindPopup(
        `Stop ID: ${stop.entity.stop_id}<br>Stop Name: ${stop.entity.stop_name}`
      );
  }
};

const addGeoJson = async () => {
  const response = await fetch("/temp_geojson/translink-qld.geojson");
  const geojson = await response.json();
  return L.geoJSON(geojson, {
    pointToLayer: function (feature, latlng) {
      return L.circleMarker(latlng, {
        radius: 3,
        fillOpacity: 1,
        fillColor: "#fff",
      });
    },
    style: function (feature) {
      return {
        color: feature.properties?.route_color || "#fff", //feature.properties?.routes?.[0]?.route_color,
        weight: feature.properties?.stop_id ? 2 : 2,
        opacity: 1,
      };
    },
    onEachFeature: function (feature, layer) {
      if (feature.properties && feature.properties.route_id) {
        layer.bindPopup(
          `Route ID: ${feature.properties.route_id}<br>Route Name: ${feature.properties.route_short_name} - ${feature.properties.route_long_name}`
        );
      }
      if (feature.properties && feature.properties.stop_id) {
        layer.bindPopup(
          `Stop ID: ${feature.properties.stop_id}<br>Stop Name: ${feature.properties.stop_name}`
        );
      }
    },
  }).addTo(map);
};

const colorStops = async () => {
  const response = await fetch("/temp_json/delays.json");
  const delays = await response.json();
  map.eachLayer(function (marker) {
    if (marker instanceof L.CircleMarker === false) {
      return;
    }
    const stopId = marker.feature?.properties?.stop_id;
    if (!stopId) {
      return;
    }
    // Find the delay entry for this stop
    const delayEntry = delays.find((d) => d.stop_id === stopId);
    if (delayEntry) {
      // Color based on average arrival delay
      const maxDelay = parseFloat(delayEntry.max_delay) || 0;
      const max = 30; // 30 minutes
      let color = "#00ff00";
      if (maxDelay > 0) {
        const ratio = Math.min(maxDelay / max, 1);
        const red = Math.floor(255 * ratio);
        const green = Math.floor(255 * (1 - ratio));
        color = `rgb(${red},${green},0)`;
      }
      marker.setStyle({ color });
      marker.bindPopup(
        `Stop ID: ${stopId}<br>Avg Arrival Delay: ${maxDelay} mins<br>Route ID: ${delayEntry.route_id}`
      );
    }
  });
};

const addSegments = async () => {
  const response = await fetch("/temp_json/segments.json");
  const geojson = await response.json();
  return L.geoJSON(geojson, {
    style: function (feature) {
      return {
        color: randomColor(),
        weight: 4,
        opacity: 0.5,
      };
    },
    onEachFeature: function (feature, layer) {
      if (feature.properties && feature.properties.route_id) {
        layer.bindPopup(
          `Route ID: ${feature.properties.route_id}<br>Trip ID: ${feature.properties.trip_id}<br>From Stop ID: ${feature.properties.from_stop_id}<br>To Stop ID: ${feature.properties.to_stop_id}`
        );
      }
    },
  }).addTo(map);
};

addSegments();

// addCustomStops();
// await addGeoJson();
colorStops();

function updateColors(day) {
  console.log("updating colors");
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

map.on("zoom", function () {
  map.eachLayer(function (marker) {
    if (marker instanceof L.CircleMarker === false) {
      return;
    }
    // Hide markers if zoom level is less than
    if (marker.setStyle) {
      if (map.getZoom() < 14) {
        marker.setStyle({ stroke: false, fill: false });
      } else {
        marker.setStyle({ stroke: true, fill: true });
      }
    }
  });
});
