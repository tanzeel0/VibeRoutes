export interface GeoResult {
  name: string;
  lat: number;
  lng: number;
}

const CITY_COORDS: Record<string, GeoResult> = {
  delhi: { name: "Delhi", lat: 28.6139, lng: 77.2090 },
  mumbai: { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  bangalore: { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
  bengaluru: { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
  darjeeling: { name: "Darjeeling", lat: 27.041, lng: 88.2663 },
  goa: { name: "Goa", lat: 15.2993, lng: 74.124 },
  jaipur: { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  varanasi: { name: "Varanasi", lat: 25.3176, lng: 82.9739 },
  kolkata: { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  chennai: { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  hyderabad: { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  pune: { name: "Pune", lat: 18.5204, lng: 73.8567 },
  shimla: { name: "Shimla", lat: 31.1048, lng: 77.1734 },
  rishikesh: { name: "Rishikesh", lat: 30.0869, lng: 78.2676 },
  Pondicherry: { name: "Pondicherry", lat: 11.9416, lng: 79.8083 },
  udaipur: { name: "Udaipur", lat: 24.5854, lng: 73.7125 },
  jodhpur: { name: "Jodhpur", lat: 26.2389, lng: 73.0243 },
  amritsar: { name: "Amritsar", lat: 31.634, lng: 74.8723 },
  ladakh: { name: "Ladakh", lat: 34.1526, lng: 77.5771 },
  leh: { name: "Leh", lat: 34.1526, lng: 77.5771 },
  spiti: { name: "Spiti Valley", lat: 32.2257, lng: 77.9996 },
  mcleodganj: { name: "McLeodganj", lat: 32.219, lng: 76.3234 },
  kasol: { name: "Kasol", lat: 32.0113, lng: 77.3138 },
  hampi: { name: "Hampi", lat: 15.335, lng: 76.46 },
  munnar: { name: "Munnar", lat: 10.0889, lng: 77.0595 },
  alleppey: { name: "Alleppey", lat: 9.4981, lng: 76.3388 },
  coorg: { name: "Coorg", lat: 12.3375, lng: 75.8069 },
  ooty: { name: "Ooty", lat: 11.4102, lng: 76.695 },
  mahabaleshwar: { name: "Mahabaleshwar", lat: 17.9236, lng: 73.6563 },
  lonavala: { name: "Lonavala", lat: 18.7547, lng: 73.4068 },
  nainital: { name: "Nainital", lat: 29.3919, lng: 79.4469 },
  manali: { name: "Manali", lat: 32.2396, lng: 77.1887 },
  dharamshala: { name: "Dharamshala", lat: 32.219, lng: 76.3234 },
  mussoorie: { name: "Mussoorie", lat: 30.4598, lng: 78.0644 },
  corbett: { name: "Jim Corbett", lat: 29.5304, lng: 78.7747 },
  sangla: { name: "Sangla Valley", lat: 31.4819, lng: 78.2579 },
};

export async function geocodeCity(name: string): Promise<GeoResult> {
  const normalized = name.toLowerCase().trim();
  if (CITY_COORDS[normalized]) {
    return CITY_COORDS[normalized];
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ", India")}&limit=1`,
      { headers: { "User-Agent": "VibeCheckRoutes/1.0" } }
    );
    if (!res.ok) return { name, lat: 28.6139, lng: 77.209 };
    const data = await res.json();
    if (data.length > 0) {
      return {
        name,
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch {
    // fallback
  }

  return { name, lat: 28.6139, lng: 77.209 };
}
