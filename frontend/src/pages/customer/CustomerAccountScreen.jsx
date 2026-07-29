import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, CalendarDays, ChevronRight, Heart, LogOut, MapPin, ShieldCheck, Sparkles, SlidersHorizontal, UserRound } from 'lucide-react';
import BottomNavBar from '../../components/layout/BottomNavBar';
import TopAppBar from '../../components/layout/TopAppBar';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';

const CustomerAccountScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { auth, profile, fulfillment, mealPlan, updateProfile, signOut } = useCustomerSession();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: profile?.firstName || '',
    dietaryPreference: profile?.dietaryPreference || 'NO_PREFERENCE',
    spicePreference: profile?.spicePreference || 'MEDIUM',
    allergies: profile?.allergies?.join(', ') || '',
    marketingConsent: Boolean(profile?.marketingConsent),
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        ...form,
        allergies: form.allergies
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      showToast('Your preferences were securely updated', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to update your preferences', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/customer/login', { replace: true });
    }
  };

  return (
    <>
      <TopAppBar variant="brand" />
      <main className="max-w-[640px] mx-auto w-full px-4 pt-20 pb-32 space-y-5">
        <section className="rounded-[24px] bg-gradient-to-br from-[#8D1230] to-[#6E0D25] text-white p-5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-xl font-black">
              {(profile?.firstName || 'G').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-black">{profile?.firstName || 'Guest'}</p>
              <p className="text-xs text-white/75">+91 {auth?.phone}</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" /> Phone verified
              </span>
            </div>
          </div>
        </section>

        <button
          onClick={() => navigate('/delivery-details')}
          className="w-full bg-white rounded-2xl border border-[#EADFD6] p-4 flex items-center gap-3 text-left shadow-sm"
        >
          <span className="w-10 h-10 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center shrink-0">
            {fulfillment.type === 'DELIVERY' ? <Bike className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-bold text-[#211917] block">
              {fulfillment.type === 'DELIVERY' ? `${fulfillment.label} delivery` : 'Self pickup'}
            </span>
            <span className="text-[11px] text-[#705F58] truncate block">
              {fulfillment.type === 'DELIVERY' ? fulfillment.addressLine || 'Add delivery address' : 'Central Hyderabad pickup counter'}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-[#95847C]" />
        </button>

        <button
          onClick={() => navigate('/meal-pass')}
          className="w-full bg-white rounded-2xl border border-[#EADFD6] p-4 flex items-center gap-3 text-left shadow-sm"
        >
          <span className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#A30F3B] flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-bold text-[#211917] block">Mangamma Meal Pass</span>
            <span className="text-[11px] text-[#705F58] truncate block">
              {mealPlan && mealPlan.status !== 'CANCELLED'
                ? `${mealPlan.planTitle} • ${mealPlan.status.toLowerCase()}`
                : 'Create a flexible recurring meal routine'}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-[#95847C]" />
        </button>

        <button
          onClick={() => navigate('/for-you')}
          className="w-full bg-[#211917] text-white rounded-2xl border border-[#211917] p-4 flex items-center gap-3 text-left shadow-sm"
        >
          <span className="w-10 h-10 rounded-xl bg-[#F47712] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-xs font-bold block">My Mangamma profile</span>
            <span className="text-[11px] text-white/65 truncate block">Taste Graph, loyalty, family and referral controls</span>
          </span>
          <ChevronRight className="w-4 h-4 text-[#F8A04B]" />
        </button>

        <section className="bg-white rounded-2xl border border-[#EADFD6] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#A30F3B]" />
            <div>
              <h1 className="text-sm font-bold text-[#211917]">Personalize your menu</h1>
              <p className="text-[11px] text-[#705F58]">Saved only for this verified phone profile.</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#211917] block mb-1">First name</label>
            <input
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#211917] block mb-1">Diet</label>
              <select
                value={form.dietaryPreference}
                onChange={(event) => setForm((current) => ({ ...current, dietaryPreference: event.target.value }))}
                className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-xs outline-none"
              >
                <option value="NO_PREFERENCE">No preference</option>
                <option value="VEGETARIAN">Vegetarian</option>
                <option value="NON_VEGETARIAN">Non-vegetarian</option>
                <option value="VEGAN">Vegan</option>
                <option value="JAIN">Jain</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#211917] block mb-1">Spice</label>
              <select
                value={form.spicePreference}
                onChange={(event) => setForm((current) => ({ ...current, spicePreference: event.target.value }))}
                className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-xs outline-none"
              >
                <option value="MILD">Mild</option>
                <option value="MEDIUM">Medium</option>
                <option value="HOT">Hot</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#211917] block mb-1">Allergies</label>
            <input
              value={form.allergies}
              onChange={(event) => setForm((current) => ({ ...current, allergies: event.target.value }))}
              placeholder="e.g. peanut, dairy"
              className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-[#FFF8F1] border border-[#EADFD6] p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.marketingConsent}
              onChange={(event) => setForm((current) => ({ ...current, marketingConsent: event.target.checked }))}
              className="mt-0.5"
            />
            <span>
              <span className="text-xs font-bold text-[#211917] flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-[#A30F3B]" /> Offers and reorder reminders
              </span>
              <span className="text-[11px] text-[#705F58] block mt-0.5">Optional. You can turn this off at any time.</span>
            </span>
          </label>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-12 rounded-xl bg-[#E97818] text-white text-sm font-bold disabled:opacity-60"
          >
            {isSaving ? 'Saving securely…' : 'Save preferences'}
          </button>
        </section>

        <button
          onClick={handleSignOut}
          className="w-full h-12 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-bold flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>

        <div className="flex items-center justify-center gap-2 text-[10px] text-[#95847C]">
          <UserRound className="w-3 h-3" />
          Your account is identified only by your verified phone number.
        </div>
      </main>
      <BottomNavBar />
    </>
  );
};

export default CustomerAccountScreen;
