export interface LiveMapMarker {
  lat: number;
  lng: number;
  heading?: number;
  label: string;
}

export interface LiveMapViewProps {
  // The moving party — whoever's GPS is being broadcast (almost always
  // the partner; see PartnersService.updateLocation).
  partner: LiveMapMarker | null;
  // The fixed point the partner is heading to/from — the booking address
  // for the customer's view, or the customer's own device position when
  // the partner-side screen wants to show it. Not live-tracked itself.
  destination: LiveMapMarker | null;
  height?: number;
}
