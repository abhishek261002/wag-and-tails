export interface DashboardKpis {
  revenueThisMonth: number;
  totalBookings: number;
  storeGmv: number;
  cancellationRate: number;
  avgBookingValue: number;
  channelSplit: Record<string, number>;
  attentionQueue: AttentionItem[];
  topPackages: PackageStat[];
  bestSellers: ProductStat[];
}

export interface AttentionItem {
  type: string;
  label: string;
  count: number;
  action: string;
}

export interface PackageStat {
  packageId: string;
  name: string;
  bookings: number;
  revenue: number;
}

export interface ProductStat {
  productId: string;
  name: string;
  sold: number;
  revenue: number;
}

export interface StaffDashboardKpis {
  todaysBookings: number;
  unassignedBookings: number;
  needsPartnerBookings: number;
  storeOrdersPlaced: number;
  assignedBookings: number;
  pendingBookings: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  reviewerName: string;
  revieweeId: string;
  revieweeType: 'partner' | 'customer';
  rating: number;
  comment: string | null;
  createdAt: string;
}
