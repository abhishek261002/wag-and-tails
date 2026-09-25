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
  /** The road path still ahead of the partner. When absent, a dashed straight line is drawn instead. */
  route?: { lat: number; lng: number }[] | null;
  /** Seconds until the partner arrives; shown as "Arriving in N min". */
  etaSeconds?: number | null;
  /**
   * Navigation mode: the camera stays on the partner and turns with their heading, tilted like a driving
   * app. Off, the map frames the partner and the destination together.
   */
  follow?: boolean;
  /** Called when the user drags the map (so a driving screen can switch follow off and offer "Re-centre"). */
  onUserPan?: () => void;
}
