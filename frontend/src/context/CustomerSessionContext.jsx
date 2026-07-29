import React, { createContext, useContext, useMemo, useState } from 'react';
import { customerAuthService } from '../services/customerAuthService';
import {
  clearStoredCustomerAuth,
  getStoredCustomerAuth,
  getStoredCustomerFavourites,
  getStoredCustomerFulfillment,
  getStoredCustomerMealPlan,
  getStoredCustomerProfile,
  setStoredCustomerAuth,
  setStoredCustomerFavourites,
  setStoredCustomerFulfillment,
  setStoredCustomerMealPlan,
  setStoredCustomerProfile,
} from '../utils/storage';

export const KITCHEN_LOCATION = {
  lat: 17.385044,
  lng: 78.486671,
  label: 'Mangamma Ruchulu Cloud Kitchen',
  address: 'Central Hyderabad, Telangana',
};

export const DEFAULT_DELIVERY_LOCATION = {
  lat: 17.4014,
  lng: 78.4851,
};

const CustomerSessionContext = createContext(null);

const distanceInKm = (from, to) => {
  const radius = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDistance = toRadians(to.lat - from.lat);
  const lngDistance = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDistance / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildFulfillment = (value = {}) => {
  const location = value.location || DEFAULT_DELIVERY_LOCATION;
  const distanceKm = Number(distanceInKm(KITCHEN_LOCATION, location).toFixed(1));

  return {
    type: value.type || 'DELIVERY',
    slot: value.slot || 'ASAP',
    scheduledFor: value.scheduledFor || '',
    label: value.label || 'Home',
    addressLine: value.addressLine || '',
    landmark: value.landmark || '',
    city: value.city || 'Hyderabad',
    pincode: value.pincode || '',
    location,
    distanceKm,
    etaMinutes: Math.max(25, Math.round(20 + distanceKm * 4)),
    instructions: value.instructions || '',
    updatedAt: value.updatedAt || null,
  };
};

export const CustomerSessionProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => getStoredCustomerAuth());
  const [profile, setProfile] = useState(() =>
    auth?.phone ? getStoredCustomerProfile(auth.phone) : null
  );
  const [fulfillment, setFulfillment] = useState(() =>
    auth?.phone ? buildFulfillment(getStoredCustomerFulfillment(auth.phone) || {}) : buildFulfillment()
  );
  const [favouriteDishIds, setFavouriteDishIds] = useState(() =>
    auth?.phone ? getStoredCustomerFavourites(auth.phone) : []
  );
  const [mealPlan, setMealPlan] = useState(() =>
    auth?.phone ? getStoredCustomerMealPlan(auth.phone) : null
  );

  const requestOtp = (phone) => customerAuthService.requestOtp(phone);

  const verifyOtp = async ({ phone, otp, requestId, firstName }) => {
    const response = await customerAuthService.verifyOtp({ phone, otp, requestId });
    const nextAuth = response.data.session;
    const savedProfile = getStoredCustomerProfile(phone);
    const nextProfile = savedProfile || {
      firstName: String(firstName || 'Guest').trim(),
      phone,
      dietaryPreference: 'NO_PREFERENCE',
      spicePreference: 'MEDIUM',
      allergies: [],
      vegetarianDays: [],
      usualOrderTime: '20:00',
      typicalBudget: 350,
      portionPreference: 'REGULAR',
      favouritePairing: 'Raita',
      mealReminders: true,
      dropAlerts: true,
      familyMembers: [],
      loyaltyPoints: 260,
      loyaltyCredits: 0,
      marketingConsent: false,
      createdAt: new Date().toISOString(),
    };
    const savedFulfillment = buildFulfillment(getStoredCustomerFulfillment(phone) || {});

    setStoredCustomerAuth(nextAuth);
    setStoredCustomerProfile(phone, nextProfile);
    setAuth(nextAuth);
    setProfile(nextProfile);
    setFulfillment(savedFulfillment);
    setFavouriteDishIds(getStoredCustomerFavourites(phone));
    setMealPlan(getStoredCustomerMealPlan(phone));
    return nextAuth;
  };

  const updateProfile = (updates) => {
    if (!auth?.phone) return;
    const nextProfile = {
      ...profile,
      ...updates,
      phone: auth.phone,
      updatedAt: new Date().toISOString(),
    };
    setProfile(nextProfile);
    setStoredCustomerProfile(auth.phone, nextProfile);
  };

  const updateFulfillment = (updates) => {
    if (!auth?.phone) return null;
    const nextFulfillment = buildFulfillment({
      ...fulfillment,
      ...updates,
      location: updates.location || fulfillment.location,
      updatedAt: new Date().toISOString(),
    });
    setFulfillment(nextFulfillment);
    setStoredCustomerFulfillment(auth.phone, nextFulfillment);
    return nextFulfillment;
  };

  const toggleFavouriteDish = (dishId) => {
    if (!auth?.phone) return false;
    let isFavourite = false;
    setFavouriteDishIds((currentIds) => {
      isFavourite = !currentIds.includes(dishId);
      const nextIds = isFavourite
        ? [dishId, ...currentIds]
        : currentIds.filter((id) => id !== dishId);
      setStoredCustomerFavourites(auth.phone, nextIds);
      return nextIds;
    });
    return isFavourite;
  };

  const saveMealPlan = (nextPlan) => {
    if (!auth?.phone) return null;
    const persistedPlan = {
      ...nextPlan,
      phone: auth.phone,
      updatedAt: new Date().toISOString(),
    };
    setMealPlan(persistedPlan);
    setStoredCustomerMealPlan(auth.phone, persistedPlan);
    return persistedPlan;
  };

  const updateMealPlan = (updates) => {
    if (!mealPlan) return null;
    return saveMealPlan({
      ...mealPlan,
      ...updates,
    });
  };

  const updateScheduledMeal = (mealId, updates) => {
    if (!mealPlan) return null;
    return updateMealPlan({
      upcomingMeals: (mealPlan.upcomingMeals || []).map((meal) =>
        meal.id === mealId ? { ...meal, ...updates, updatedAt: new Date().toISOString() } : meal
      ),
    });
  };

  const signOut = () => {
    clearStoredCustomerAuth();
    setAuth(null);
    setProfile(null);
    setFulfillment(buildFulfillment());
    setFavouriteDishIds([]);
    setMealPlan(null);
  };

  const hasFulfillmentDetails = useMemo(() => {
    if (fulfillment.type === 'PICKUP') return true;
    return Boolean(
      fulfillment.addressLine.trim() &&
        /^\d{6}$/.test(fulfillment.pincode) &&
        fulfillment.location?.lat &&
        fulfillment.location?.lng
    );
  }, [fulfillment]);

  const fulfillmentSummary =
    fulfillment.type === 'PICKUP'
      ? `Pickup ${fulfillment.slot === 'ASAP' ? 'as soon as possible' : fulfillment.scheduledFor}`
      : fulfillment.addressLine || 'Add delivery address';

  return (
    <CustomerSessionContext.Provider
      value={{
        auth,
        profile,
        fulfillment,
        favouriteDishIds,
        mealPlan,
        isAuthenticated: Boolean(auth?.phone),
        hasFulfillmentDetails,
        fulfillmentSummary,
        requestOtp,
        verifyOtp,
        updateProfile,
        updateFulfillment,
        toggleFavouriteDish,
        saveMealPlan,
        updateMealPlan,
        updateScheduledMeal,
        signOut,
      }}
    >
      {children}
    </CustomerSessionContext.Provider>
  );
};

export const useCustomerSession = () => {
  const context = useContext(CustomerSessionContext);
  if (!context) {
    throw new Error('useCustomerSession must be used within CustomerSessionProvider');
  }
  return context;
};
