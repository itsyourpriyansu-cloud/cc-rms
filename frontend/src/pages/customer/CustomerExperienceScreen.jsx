import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Coins,
  Crown,
  Gift,
  Heart,
  IndianRupee,
  Leaf,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserPlus,
  Users,
  UtensilsCrossed,
  WalletCards,
} from 'lucide-react';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import DeliveryTrackingMap from '../../components/customer/DeliveryTrackingMap';
import ReferralCard from '../../components/customer/ReferralCard';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useOrder } from '../../context/OrderContext';
import { useToast } from '../../context/ToastContext';
import { DISHES } from '../../utils/mockData';
import { formatMenuPrice } from '../../utils/formatters';

const EXPERIENCE_TABS = [
  { id: 'for-you', label: 'For you', icon: Sparkles },
  { id: 'taste', label: 'Taste', icon: Heart },
  { id: 'benefits', label: 'Benefits', icon: Crown },
  { id: 'family', label: 'Family', icon: Users },
];

const TASTE_DISH_IDS = [
  'meals-aritaku-veg',
  'meals-aritaku-nonveg',
  'biryani-chicken-special',
  'mcnv-home-style-chicken',
  'mcveg-paneer-butter-masala',
  'mcveg-dal-tadka',
  'rice-curd',
  'dessert-gulab-jamun',
];

const DROP_DISHES = [
  {
    id: 'meals-aritaku-nonveg',
    eyebrow: 'Weekend regional table',
    title: 'Aritaku Non-Veg Bojanam',
    detail: 'Served Saturday and Sunday with rotating regional curries.',
  },
  {
    id: 'rice-mudda-pappu-avakaya',
    eyebrow: 'Subscriber early access',
    title: 'Mudda Pappu Avakaya Rice',
    detail: 'A home-style lunch drop with ghee and seasonal pachadi.',
  },
  {
    id: 'dessert-carrot-halwa',
    eyebrow: 'Chef’s weekly special',
    title: 'Slow-cooked Carrot Halwa',
    detail: 'Small-batch dessert available with family and Meal Pass orders.',
  },
];

const VEGETARIAN_DAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 0, label: 'Sun' },
];

const relationshipOptions = ['Parent', 'Partner', 'Child', 'Friend', 'Colleague'];

const dishById = (id) => DISHES.find((dish) => dish.id === id);

const ChoicePills = ({ label, options, value, onChange }) => (
  <fieldset>
    <legend className="text-xs font-black text-[#211917] mb-2">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const optionValue = typeof option === 'string' ? option : option.value;
        const optionLabel = typeof option === 'string' ? option : option.label;
        const selected = value === optionValue;
        return (
          <button
            type="button"
            key={optionValue}
            onClick={() => onChange(optionValue)}
            aria-pressed={selected}
            className={`h-9 rounded-xl border px-3 text-[11px] font-black transition-colors ${
              selected
                ? 'border-[#A30F3B] bg-[#FBECEF] text-[#A30F3B]'
                : 'border-[#EADFD6] bg-white text-[#705F58]'
            }`}
          >
            {optionLabel}
          </button>
        );
      })}
    </div>
  </fieldset>
);

const FavouriteDishCard = ({ dish, selected, onToggle, onOpen }) => (
  <article className={`rounded-2xl border overflow-hidden bg-white ${selected ? 'border-[#A30F3B]/45' : 'border-[#EADFD6]'}`}>
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="h-24 bg-[#F8F0E5] overflow-hidden">
        <img src={dish.image} alt={dish.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-3 pb-2">
        <p className="text-xs font-black line-clamp-2 min-h-8">{dish.name}</p>
        <p className="text-[11px] text-[#A30F3B] font-black mt-1">{formatMenuPrice(dish.price)}</p>
      </div>
    </button>
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`mx-3 mb-3 h-9 w-[calc(100%-24px)] rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 ${
        selected ? 'bg-[#FBECEF] text-[#A30F3B]' : 'bg-[#FFF8F1] text-[#705F58]'
      }`}
    >
      <Heart className={`w-3.5 h-3.5 ${selected ? 'fill-current' : ''}`} />
      {selected ? 'Saved favourite' : 'Add favourite'}
    </button>
  </article>
);

const CustomerExperienceScreen = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const {
    auth,
    profile,
    fulfillment,
    favouriteDishIds,
    toggleFavouriteDish,
    updateProfile,
    mealPlan,
  } = useCustomerSession();
  const { activeOrder, customerOrders } = useOrder();

  const requestedTab = searchParams.get('tab');
  const initialTab = EXPERIENCE_TABS.some((tab) => tab.id === requestedTab) ? requestedTab : 'for-you';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tasteForm, setTasteForm] = useState({
    dietaryPreference: profile?.dietaryPreference || 'NO_PREFERENCE',
    spicePreference: profile?.spicePreference || 'MEDIUM',
    allergies: profile?.allergies?.join(', ') || '',
    vegetarianDays: profile?.vegetarianDays || [],
    usualOrderTime: profile?.usualOrderTime || '20:00',
    typicalBudget: profile?.typicalBudget || '350',
    portionPreference: profile?.portionPreference || 'REGULAR',
    favouritePairing: profile?.favouritePairing || 'Raita',
    mealReminders: profile?.mealReminders ?? true,
    dropAlerts: profile?.dropAlerts ?? true,
  });
  const [memberForm, setMemberForm] = useState({
    name: '',
    relationship: 'Parent',
    diet: 'NO_PREFERENCE',
  });
  const [showMemberForm, setShowMemberForm] = useState(false);

  const curatedTasteDishes = TASTE_DISH_IDS.map(dishById).filter(Boolean);
  const savedFavouriteDishes = favouriteDishIds.map(dishById).filter(Boolean);
  const recommendation = savedFavouriteDishes[0] || curatedTasteDishes[0];
  const familyMembers = profile?.familyMembers || [];
  const completedOrders = customerOrders?.filter((order) =>
    ['delivered', 'completed'].includes(String(order.status || '').toLowerCase())
  ).length || 0;
  const loyaltyPoints = Math.min(
    1600,
    (profile?.loyaltyPoints || 260) + completedOrders * 80 + (mealPlan && mealPlan.status !== 'CANCELLED' ? 140 : 0),
  );
  const tier = loyaltyPoints >= 1200 ? 'Mangamma Insider' : loyaltyPoints >= 500 ? 'Family' : 'Regular';
  const nextTierAt = tier === 'Regular' ? 500 : tier === 'Family' ? 1200 : 1600;
  const progress = Math.min(100, Math.round((loyaltyPoints / nextTierAt) * 100));
  const tasteSignals = [
    tasteForm.dietaryPreference !== 'NO_PREFERENCE',
    Boolean(tasteForm.spicePreference),
    Boolean(tasteForm.typicalBudget),
    Boolean(tasteForm.usualOrderTime),
    Boolean(tasteForm.portionPreference),
    tasteForm.vegetarianDays.length > 0,
    favouriteDishIds.length > 0,
    Boolean(tasteForm.allergies),
  ];
  const tasteCompleteness = Math.round(
    (tasteSignals.filter(Boolean).length / tasteSignals.length) * 100,
  );

  const setTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams(tabId === 'for-you' ? {} : { tab: tabId }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleVegetarianDay = (dayId) => {
    setTasteForm((current) => ({
      ...current,
      vegetarianDays: current.vegetarianDays.includes(dayId)
        ? current.vegetarianDays.filter((id) => id !== dayId)
        : [...current.vegetarianDays, dayId],
    }));
  };

  const saveTasteGraph = async () => {
    try {
      await updateProfile({
        ...tasteForm,
        typicalBudget: Number(tasteForm.typicalBudget) || 350,
        allergies: tasteForm.allergies
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        tasteGraphUpdatedAt: new Date().toISOString(),
      });
      showToast('Your Taste Graph is updated across menu and Meal Pass', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to save your Taste Graph', 'error');
    }
  };

  const handleFavourite = (dish) => {
    const willBeFavourite = !favouriteDishIds.includes(dish.id);
    toggleFavouriteDish(dish.id);
    showToast(
      willBeFavourite ? `${dish.name} added to your Taste Graph` : `${dish.name} removed from favourites`,
      willBeFavourite ? 'success' : 'info',
    );
  };

  const addFamilyMember = () => {
    if (!memberForm.name.trim()) {
      showToast('Enter the recipient’s name', 'warning');
      return;
    }
    updateProfile({
      familyMembers: [
        ...familyMembers,
        {
          id: `family-${Date.now()}`,
          ...memberForm,
          name: memberForm.name.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setMemberForm({ name: '', relationship: 'Parent', diet: 'NO_PREFERENCE' });
    setShowMemberForm(false);
    showToast('Family recipient saved to this phone profile', 'success');
  };

  const removeFamilyMember = (memberId) => {
    updateProfile({ familyMembers: familyMembers.filter((member) => member.id !== memberId) });
    showToast('Recipient removed', 'info');
  };

  return (
    <>
      <TopAppBar variant="brand" />
      <main className="max-w-[640px] mx-auto w-full pt-[74px] pb-32">
        <header className="px-4">
          <section className="rounded-[26px] bg-gradient-to-br from-[#8D1230] via-[#A30F3B] to-[#D76316] text-white p-5 shadow-lg overflow-hidden relative">
            <span className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-white/8" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-black text-white/65">My Mangamma</p>
                <h1 className="text-2xl font-black mt-1">Made around your life, {profile?.firstName}.</h1>
                <p className="text-xs text-white/75 mt-2 max-w-[410px]">
                  Your favourites, routine, delivery reliability and family preferences stay connected to +91 {auth?.phone}.
                </p>
              </div>
              <span className="w-12 h-12 rounded-2xl bg-white/12 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </span>
            </div>
            <div className="relative grid grid-cols-3 gap-2 mt-5">
              {[
                { value: `${tasteCompleteness}%`, label: 'Taste profile' },
                { value: tier, label: 'Status' },
                { value: favouriteDishIds.length, label: 'Favourites' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-white/10 border border-white/10 p-2.5">
                  <p className="text-xs font-black truncate">{item.value}</p>
                  <p className="text-[9px] text-white/60 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </section>
        </header>

        <nav aria-label="My Mangamma sections" className="sticky top-[58px] z-30 mt-4 px-4 py-2 bg-[#FFFDF9]/95 backdrop-blur-md">
          <div className="grid grid-cols-4 rounded-2xl border border-[#EADFD6] bg-white p-1 shadow-sm">
            {EXPERIENCE_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const selected = tab.id === activeTab;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`min-h-12 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-black ${
                    selected ? 'bg-[#FBECEF] text-[#A30F3B]' : 'text-[#75665F]'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {activeTab === 'for-you' && (
          <div className="px-4 pt-3 space-y-5">
            <section>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#F47712]">Your usual {Number(tasteForm.usualOrderTime.split(':')[0]) < 17 ? 'lunch' : 'dinner'}</p>
                  <h2 className="text-xl font-black mt-1">One tap back to a favourite</h2>
                </div>
                <button onClick={() => setTab('taste')} className="text-[11px] font-black text-[#A30F3B]">Tune</button>
              </div>
              {recommendation && (
                <button
                  type="button"
                  onClick={() => navigate(`/menu/${recommendation.id}`)}
                  className="w-full rounded-[22px] overflow-hidden border border-[#EADFD6] bg-white shadow-sm text-left"
                >
                  <div className="h-40 relative">
                    <img src={recommendation.image} alt={recommendation.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <span className="absolute left-3 bottom-3 px-2.5 py-1 rounded-full bg-white/92 text-[10px] font-black text-[#A30F3B]">
                      {tasteForm.spicePreference.toLowerCase()} spice match
                    </span>
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-1">
                      <h3 className="font-black">{recommendation.name}</h3>
                      <p className="text-[11px] text-[#75665F] mt-1">
                        Under ₹{tasteForm.typicalBudget} • ready in {recommendation.preparationTimeMinutes} min
                      </p>
                    </div>
                    <span className="h-10 px-3 rounded-xl bg-[#A30F3B] text-white text-xs font-black flex items-center">
                      Reorder
                    </span>
                  </div>
                </button>
              )}
            </section>

            <section className="rounded-[22px] border border-[#EADFD6] bg-white overflow-hidden shadow-sm">
              <div className="p-4 flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-black text-emerald-700">Mangamma Reliability Promise</p>
                  <h2 className="font-black mt-1">Honest ETA, explained delays</h2>
                  <p className="text-[11px] text-[#75665F] mt-1">
                    {activeOrder
                      ? 'Your active order is covered. If its guaranteed window is missed, credit is added automatically.'
                      : `Your ${fulfillment.distanceKm} km route is ready. The checkout ETA will become your guaranteed window.`}
                  </p>
                </div>
                {activeOrder && <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">Covered</span>}
              </div>
              {fulfillment.type === 'DELIVERY' && (
                <DeliveryTrackingMap
                  destination={fulfillment.location}
                  progress={activeOrder ? 0.48 : 0}
                  riderAssigned={Boolean(activeOrder)}
                />
              )}
              <button
                type="button"
                onClick={() => navigate(activeOrder ? '/order-tracking' : '/delivery-details')}
                className="w-full h-12 border-t border-[#EADFD6] text-xs font-black text-[#A30F3B] flex items-center justify-center gap-1"
              >
                {activeOrder ? 'Open live tracking' : 'Adjust delivery pin'} <ChevronRight className="w-4 h-4" />
              </button>
            </section>

            <section>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#F47712]">Kitchen-only drops</p>
                  <h2 className="text-xl font-black mt-1">Food others cannot copy</h2>
                </div>
                <span className="text-[10px] text-[#75665F]">No fake countdowns</span>
              </div>
              <div className="space-y-3">
                {DROP_DISHES.map((drop) => {
                  const dish = dishById(drop.id);
                  if (!dish) return null;
                  return (
                    <button
                      type="button"
                      key={drop.id}
                      onClick={() => navigate(`/menu/${drop.id}`)}
                      className="w-full rounded-2xl border border-[#EADFD6] bg-white p-3 flex items-center gap-3 text-left shadow-sm"
                    >
                      <img src={dish.image} alt="" className="w-20 h-20 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase tracking-wider font-black text-[#F47712] block">{drop.eyebrow}</span>
                        <span className="text-sm font-black block mt-1">{drop.title}</span>
                        <span className="text-[10px] leading-relaxed text-[#75665F] block mt-1">{drop.detail}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#A30F3B]" />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('/meal-pass')} className="rounded-2xl bg-[#A30F3B] text-white p-4 text-left min-h-36">
                <CalendarDays className="w-6 h-6" />
                <p className="font-black mt-4">Smart Meal Pass</p>
                <p className="text-[10px] text-white/70 mt-1">Plan, customize, skip and track weekly meals.</p>
              </button>
              <button onClick={() => setTab('family')} className="rounded-2xl bg-[#FFF0E3] border border-[#F4D3B5] text-[#6E0D25] p-4 text-left min-h-36">
                <Gift className="w-6 h-6" />
                <p className="font-black mt-4">Send a meal</p>
                <p className="text-[10px] text-[#75665F] mt-1">Order for parents, family or colleagues.</p>
              </button>
            </section>
          </div>
        )}

        {activeTab === 'taste' && (
          <div className="px-4 pt-3 space-y-5">
            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-[#F47712]">Personal Taste Graph</p>
                  <h2 className="text-xl font-black mt-1">{tasteCompleteness}% personalized</h2>
                </div>
                <Target className="w-7 h-7 text-[#A30F3B]" />
              </div>
              <div className="h-2 rounded-full bg-[#F1E7E0] mt-4 overflow-hidden">
                <span className="block h-full bg-gradient-to-r from-[#F47712] to-[#A30F3B]" style={{ width: `${tasteCompleteness}%` }} />
              </div>
              <p className="text-[11px] text-[#75665F] mt-2">
                Used for recommendations, allergy reminders, Meal Pass rotation and one-tap reorders.
              </p>
            </section>

            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4 space-y-5 shadow-sm">
              <ChoicePills
                label="Food preference"
                value={tasteForm.dietaryPreference}
                onChange={(value) => setTasteForm((current) => ({ ...current, dietaryPreference: value }))}
                options={[
                  { value: 'NO_PREFERENCE', label: 'Everything' },
                  { value: 'VEGETARIAN', label: 'Vegetarian' },
                  { value: 'NON_VEGETARIAN', label: 'Non-vegetarian' },
                  { value: 'VEGAN', label: 'Vegan' },
                  { value: 'JAIN', label: 'Jain' },
                ]}
              />
              <ChoicePills
                label="Usual spice"
                value={tasteForm.spicePreference}
                onChange={(value) => setTasteForm((current) => ({ ...current, spicePreference: value }))}
                options={[
                  { value: 'MILD', label: 'Mild' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'HOT', label: 'Hot' },
                ]}
              />
              <fieldset>
                <legend className="text-xs font-black mb-2">Vegetarian days</legend>
                <div className="grid grid-cols-7 gap-1.5">
                  {VEGETARIAN_DAYS.map((day) => {
                    const selected = tasteForm.vegetarianDays.includes(day.id);
                    return (
                      <button
                        type="button"
                        key={day.id}
                        onClick={() => toggleVegetarianDay(day.id)}
                        aria-pressed={selected}
                        className={`h-10 rounded-xl text-[10px] font-black ${
                          selected ? 'bg-emerald-600 text-white' : 'bg-[#FFF8F1] border border-[#EADFD6] text-[#705F58]'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-black">
                  Usual order time
                  <input
                    type="time"
                    value={tasteForm.usualOrderTime}
                    onChange={(event) => setTasteForm((current) => ({ ...current, usualOrderTime: event.target.value }))}
                    className="w-full h-11 mt-1 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-xs"
                  />
                </label>
                <label className="text-xs font-black">
                  Typical budget
                  <span className="relative block">
                    <IndianRupee className="absolute left-3 top-4 w-3.5 h-3.5 text-[#75665F]" />
                    <input
                      inputMode="numeric"
                      value={tasteForm.typicalBudget}
                      onChange={(event) => setTasteForm((current) => ({
                        ...current,
                        typicalBudget: event.target.value.replace(/\D/g, '').slice(0, 4),
                      }))}
                      className="w-full h-11 mt-1 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] pl-8 pr-3 text-xs"
                    />
                  </span>
                </label>
              </div>

              <ChoicePills
                label="Portion requirement"
                value={tasteForm.portionPreference}
                onChange={(value) => setTasteForm((current) => ({ ...current, portionPreference: value }))}
                options={[
                  { value: 'LIGHT', label: 'Light' },
                  { value: 'REGULAR', label: 'Regular' },
                  { value: 'LARGE', label: 'Large' },
                  { value: 'FAMILY', label: 'Family' },
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-black">
                  Usual combination
                  <select
                    value={tasteForm.favouritePairing}
                    onChange={(event) => setTasteForm((current) => ({ ...current, favouritePairing: event.target.value }))}
                    className="w-full h-11 mt-1 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-xs"
                  >
                    <option>Raita</option>
                    <option>Buttermilk</option>
                    <option>Chapathi</option>
                    <option>Curd rice</option>
                    <option>Fresh salad</option>
                  </select>
                </label>
                <label className="text-xs font-black">
                  Allergies / avoid
                  <input
                    value={tasteForm.allergies}
                    onChange={(event) => setTasteForm((current) => ({ ...current, allergies: event.target.value }))}
                    placeholder="Peanut, dairy"
                    className="w-full h-11 mt-1 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-xs"
                  />
                </label>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'mealReminders', label: 'Reminder near my usual meal time', detail: 'One optional reminder, never repeated spam.' },
                  { key: 'dropAlerts', label: 'Exclusive menu drop alerts', detail: 'Only for genuinely new or seasonal dishes.' },
                ].map((setting) => (
                  <label key={setting.key} className="flex items-center gap-3 rounded-xl bg-[#FFF8F1] border border-[#EADFD6] p-3 cursor-pointer">
                    <Bell className="w-4 h-4 text-[#A30F3B]" />
                    <span className="flex-1">
                      <span className="text-xs font-black block">{setting.label}</span>
                      <span className="text-[10px] text-[#75665F] block mt-0.5">{setting.detail}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={tasteForm[setting.key]}
                      onChange={(event) => setTasteForm((current) => ({ ...current, [setting.key]: event.target.checked }))}
                      className="accent-[#A30F3B]"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider font-black text-[#F47712]">Favourite dishes</p>
                <h2 className="text-xl font-black mt-1">Teach us what you love</h2>
                <p className="text-[11px] text-[#75665F] mt-1">These choices immediately improve your menu recommendations.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {curatedTasteDishes.map((dish) => (
                  <FavouriteDishCard
                    key={dish.id}
                    dish={dish}
                    selected={favouriteDishIds.includes(dish.id)}
                    onToggle={() => handleFavourite(dish)}
                    onOpen={() => navigate(`/menu/${dish.id}`)}
                  />
                ))}
              </div>
            </section>

            <button onClick={saveTasteGraph} className="w-full h-14 rounded-2xl bg-[#A30F3B] text-white font-black flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Save Taste Graph
            </button>
            <p className="text-center text-[10px] text-[#95847C]">
              Sensitive allergy notes remain editable and can be removed from your phone profile anytime.
            </p>
          </div>
        )}

        {activeTab === 'benefits' && (
          <div className="px-4 pt-3 space-y-5">
            <section className="rounded-[26px] bg-[#211917] text-white p-5 shadow-lg overflow-hidden relative">
              <Crown className="absolute -right-5 -bottom-6 w-32 h-32 text-white/5" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-[#F8A04B]">Mangamma Status</p>
                  <h2 className="text-2xl font-black mt-1">{tier}</h2>
                  <p className="text-xs text-white/65 mt-1">{loyaltyPoints} transparent progress points</p>
                </div>
                <span className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Star className="w-6 h-6 text-[#F8A04B] fill-current" />
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-white/10 mt-5 overflow-hidden">
                <span className="block h-full rounded-full bg-[#F8A04B]" style={{ width: `${progress}%` }} />
              </div>
              <div className="relative flex justify-between text-[10px] text-white/60 mt-2">
                <span>{completedOrders} completed orders</span>
                <span>{tier === 'Mangamma Insider' ? 'Top status active' : `${nextTierAt - loyaltyPoints} points to next level`}</span>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#EADFD6] bg-white p-4">
                <Coins className="w-5 h-5 text-[#A30F3B]" />
                <p className="text-2xl font-black mt-3">₹{profile?.loyaltyCredits || 0}</p>
                <p className="text-[10px] text-[#75665F] mt-1">Available Mangamma credits</p>
              </div>
              <div className="rounded-2xl border border-[#EADFD6] bg-white p-4">
                <WalletCards className="w-5 h-5 text-[#A30F3B]" />
                <p className="text-2xl font-black mt-3">{mealPlan && mealPlan.status !== 'CANCELLED' ? 'Active' : 'Ready'}</p>
                <p className="text-[10px] text-[#75665F] mt-1">Meal Pass benefit status</p>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4">
              <h2 className="font-black">Your current benefits</h2>
              <div className="mt-3 space-y-3">
                {[
                  ['Priority kitchen slot', tier !== 'Regular'],
                  ['Complimentary side on every 5th order', true],
                  ['Early access to regional drops', true],
                  ['Expanded free-delivery radius', tier === 'Mangamma Insider'],
                ].map(([label, unlocked]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center ${unlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                      {unlocked ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                    </span>
                    <span className={`text-xs font-bold flex-1 ${unlocked ? 'text-[#211917]' : 'text-[#95847C]'}`}>{label}</span>
                    <span className="text-[9px] font-black uppercase text-[#95847C]">{unlocked ? 'Active' : 'Next level'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-900">Reliability credit is automatic</p>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    If we miss the guaranteed delivery window shown at checkout, ₹75 is credited after delivery review—no coupon claim flow.
                  </p>
                  <p className="text-[10px] text-emerald-700 mt-2">
                    Production requires server-verified order timestamps and published eligibility terms.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-[#F47712]">Positive progress</p>
                  <h2 className="font-black mt-1">2 of 3 family meals completed</h2>
                </div>
                <span className="w-11 h-11 rounded-xl bg-[#FFF0E3] text-[#A30F3B] flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5" />
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {[true, true, false].map((done, index) => (
                  <span key={index} className={`h-2 rounded-full ${done ? 'bg-[#A30F3B]' : 'bg-[#EADFD6]'}`} />
                ))}
              </div>
              <p className="text-[10px] text-[#75665F] mt-2">A complimentary dessert unlocks after the third genuine family meal. No expiry countdown.</p>
            </section>

            <ReferralCard firstName={profile?.firstName} phone={auth?.phone} onNotify={showToast} />
          </div>
        )}

        {activeTab === 'family' && (
          <div className="px-4 pt-3 space-y-5">
            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-black text-[#F47712]">Shared family profile</p>
                  <h2 className="text-xl font-black mt-1">Saved recipients</h2>
                  <p className="text-[11px] text-[#75665F] mt-1">Keep each person’s diet separate before gifting or repeating an order.</p>
                </div>
                <button onClick={() => setShowMemberForm((value) => !value)} className="w-10 h-10 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center" aria-label="Add family recipient">
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>

              {showMemberForm && (
                <div className="mt-4 rounded-2xl bg-[#FFF8F1] border border-[#EADFD6] p-3 space-y-3">
                  <input
                    value={memberForm.name}
                    onChange={(event) => setMemberForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Recipient name"
                    aria-label="Recipient name"
                    className="w-full h-11 rounded-xl border border-[#EADFD6] bg-white px-3 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={memberForm.relationship}
                      onChange={(event) => setMemberForm((current) => ({ ...current, relationship: event.target.value }))}
                      aria-label="Relationship"
                      className="h-11 rounded-xl border border-[#EADFD6] bg-white px-3 text-xs"
                    >
                      {relationshipOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <select
                      value={memberForm.diet}
                      onChange={(event) => setMemberForm((current) => ({ ...current, diet: event.target.value }))}
                      aria-label="Recipient diet"
                      className="h-11 rounded-xl border border-[#EADFD6] bg-white px-3 text-xs"
                    >
                      <option value="NO_PREFERENCE">Any diet</option>
                      <option value="VEGETARIAN">Vegetarian</option>
                      <option value="NON_VEGETARIAN">Non-vegetarian</option>
                      <option value="JAIN">Jain</option>
                    </select>
                  </div>
                  <button onClick={addFamilyMember} className="w-full h-11 rounded-xl bg-[#A30F3B] text-white text-xs font-black">
                    Save recipient
                  </button>
                </div>
              )}

              <div className="mt-4 space-y-2">
                {familyMembers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#D9C8BC] p-4 text-center">
                    <Users className="w-6 h-6 text-[#95847C] mx-auto" />
                    <p className="text-xs font-black mt-2">No recipients saved yet</p>
                    <p className="text-[10px] text-[#75665F] mt-1">Add a parent, partner, child or colleague.</p>
                  </div>
                ) : (
                  familyMembers.map((member) => (
                    <div key={member.id} className="rounded-xl border border-[#EADFD6] bg-[#FFFDF9] p-3 flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center font-black">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-xs font-black block">{member.name}</span>
                        <span className="text-[10px] text-[#75665F] block">{member.relationship} • {member.diet.replaceAll('_', ' ').toLowerCase()}</span>
                      </span>
                      <button onClick={() => removeFamilyMember(member.id)} aria-label={`Remove ${member.name}`} className="w-9 h-9 rounded-xl text-rose-700 flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (!familyMembers.length) {
                    setShowMemberForm(true);
                    showToast('Save a recipient before sending a meal', 'info');
                    return;
                  }
                  navigate('/menu', { state: { orderMode: 'GIFT', recipientId: familyMembers[0].id } });
                }}
                className="rounded-2xl bg-[#A30F3B] text-white p-4 text-left min-h-40"
              >
                <Gift className="w-6 h-6" />
                <p className="font-black mt-5">Gift a meal</p>
                <p className="text-[10px] text-white/70 mt-1">Choose food using the recipient’s diet and add a message.</p>
              </button>
              <button
                onClick={() => navigate('/menu', { state: { orderMode: 'GROUP' } })}
                className="rounded-2xl bg-[#FFF0E3] border border-[#F4D3B5] text-[#6E0D25] p-4 text-left min-h-40"
              >
                <Users className="w-6 h-6" />
                <p className="font-black mt-5">Start group cart</p>
                <p className="text-[10px] text-[#75665F] mt-1">Share one cart link; payment splitting needs backend checkout support.</p>
              </button>
            </section>

            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4">
              <div className="flex items-start gap-3">
                <PackageCheck className="w-5 h-5 text-[#A30F3B] mt-0.5" />
                <div>
                  <h2 className="font-black">Parent-friendly repeat ordering</h2>
                  <p className="text-[11px] text-[#75665F] mt-1">
                    Save a recipient once, remember their diet, and repeat a suitable meal without rebuilding the cart.
                  </p>
                  <button onClick={() => navigate('/orders')} className="text-xs font-black text-[#A30F3B] mt-3 inline-flex items-center gap-1">
                    Choose a past order <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-[#EADFD6] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Leaf className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-black">Shared Meal Pass wallet</h2>
                  <p className="text-[10px] text-[#75665F] mt-0.5">Assign future meal credits to saved recipients.</p>
                </div>
                <button onClick={() => navigate('/meal-pass')} className="text-[11px] font-black text-[#A30F3B]">Manage</button>
              </div>
            </section>
          </div>
        )}
      </main>
      <BottomNavBar />
    </>
  );
};

export default CustomerExperienceScreen;
