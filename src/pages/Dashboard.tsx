import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { MapPin, User, MessageSquare, Package, Users, Search } from 'lucide-react';

// Traveller pages
import MyTrips from '@/pages/traveller/MyTrips';
import NewTrip from '@/pages/traveller/NewTrip';
import TripDetail from '@/pages/traveller/TripDetail';
import BrowseActivities from '@/pages/traveller/BrowseActivities';

// Provider pages
import MyListings from '@/pages/provider/MyListings';
import NewListing from '@/pages/provider/NewListing';
import EditListing from '@/pages/provider/EditListing';
import Community from '@/pages/provider/Community';

// Shared pages
import Profile from '@/pages/Profile';
import Messages from '@/pages/Messages';
import ActivityDetail from '@/pages/ActivityDetail';

const travellerNav = [
  { title: 'My Trips', url: '/dashboard', icon: MapPin },
  { title: 'Browse Activities', url: '/dashboard/browse', icon: Search },
  { title: 'My Profile', url: '/dashboard/profile', icon: User },
  { title: 'Messages', url: '/dashboard/messages', icon: MessageSquare },
];

const providerNav = [
  { title: 'My Listings', url: '/dashboard', icon: Package },
  { title: 'Community', url: '/dashboard/community', icon: Users },
  { title: 'My Profile', url: '/dashboard/profile', icon: User },
  { title: 'Messages', url: '/dashboard/messages', icon: MessageSquare },
];

export default function Dashboard() {
  const { role, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  const isTraveller = role === 'traveller';
  const navItems = isTraveller ? travellerNav : providerNav;
  const actionButton = isTraveller
    ? { label: 'New Trip', url: '/dashboard/new-trip' }
    : { label: 'New Listing', url: '/dashboard/new-listing' };

  return (
    <DashboardLayout navItems={navItems} actionButton={actionButton}>
      <Routes>
        <Route path="/" element={isTraveller ? <MyTrips /> : <MyListings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/activity/:id" element={<ActivityDetail />} />
        {isTraveller && (
          <>
            <Route path="/new-trip" element={<NewTrip />} />
            <Route path="/trip/:id" element={<TripDetail />} />
            <Route path="/browse" element={<BrowseActivities />} />
          </>
        )}
        {!isTraveller && (
          <>
            <Route path="/new-listing" element={<NewListing />} />
            <Route path="/edit-listing/:id" element={<EditListing />} />
            <Route path="/community" element={<Community />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
