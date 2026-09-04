export interface LatLng {
  lat: number;
  lng: number;
}

export interface Address {
  id: string;
  userId: string;
  label: string; // "Home", "Office", etc.
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export interface WalkSession {
  id: string;
  bookingId: string;
  partnerId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  routePolyline: string | null;
  photos: string[];
}

export interface LiveLocation {
  userId: string;
  role: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  timestamp: string;
}

export interface ServiceArea {
  id: string;
  name: string;
  city: string;
  polygon: LatLng[];
  isActive: boolean;
}

export interface Neighborhood {
  id: string;
  serviceAreaId: string;
  name: string;
  isActive: boolean;
}
