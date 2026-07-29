import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { formatInvoiceAmount } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import DeliveryTrackingMap from '../../components/customer/DeliveryTrackingMap';
import { DISHES } from '../../utils/mockData';

const PASS_OPTIONS = [
  { id: 'PASS_3', meals: 3, pricePerMeal: 239, title: '3 Meal Starter', subtitle: 'Try the routine' },
  { id: 'PASS_5', meals: 5, pricePerMeal: 219, title: '5 Meal Week', subtitle: 'Best for weekdays', recommended: true },
  { id: 'PASS_10', meals: 10, pricePerMeal: 209, title: '10 Meal Saver', subtitle: 'Two flexible weeks' },
  { id: 'PASS_20', meals: 20, pricePerMeal: 199, title: '20 Meal Regular', subtitle: 'Maximum savings' },
];

const MEAL_STYLES = [
  { id: 'HOME_STYLE', label: 'Home-style', detail: 'Balanced rice, dal, curry and sides', emoji: '🏠' },
  { id: 'HIGH_PROTEIN', label: 'Protein focused', detail: 'Higher-protein mains and portions', emoji: '💪' },
  { id: 'REGIONAL', label: 'Regional rotation', detail: 'Different Telugu favourites each meal', emoji: '🌶️' },
  { id: 'LIGHT', label: 'Light meals', detail: 'Lighter portions for workdays', emoji: '🥗' },
];

const DAYS = [
  { id: 1, short: 'Mon', label: 'Monday' },
  { id: 2, short: 'Tue', label: 'Tuesday' },
  { id: 3, short: 'Wed', label: 'Wednesday' },
  { id: 4, short: 'Thu', label: 'Thursday' },
  { id: 5, short: 'Fri', label: 'Friday' },
  { id: 6, short: 'Sat', label: 'Saturday' },
  { id: 0, short: 'Sun', label: 'Sunday' },
];

const TIME_WINDOWS = [
  { id: '12:30', label: 'Lunch • 12:30–1:00 PM' },
  { id: '19:30', label: 'Dinner • 7:30–8:00 PM' },
  { id: '20:30', label: 'Dinner • 8:30–9:00 PM' },
];

const STEP_LABELS = ['Plan', 'Food', 'Schedule', 'Review'];

const ROTATION_DISH_IDS = [
  'meals-aritaku-veg',
  'mcveg-paneer-butter-masala',
  'mcveg-dal-tadka',
  'rice-curd',
  'mcnv-home-style-chicken',
  'biryani-chicken-special',
];

const NUTRITION_BY_STYLE = {
  HOME_STYLE: { calories: '520–680 kcal', protein: '18–28 g', label: 'Balanced everyday range' },
  HIGH_PROTEIN: { calories: '560–720 kcal', protein: '32–44 g', label: 'Higher-protein target' },
  REGIONAL: { calories: '580–760 kcal', protein: '20–34 g', label: 'Regional rotation range' },
  LIGHT: { calories: '380–520 kcal', protein: '16–26 g', label: 'Lighter portion range' },
};

const toLocalIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildUpcomingMeals = ({ mealCount, selectedDays, timeWindow, mealStyle, rotationDishes }) => {
  const meals = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  while (meals.length < mealCount) {
    if (selectedDays.includes(cursor.getDay())) {
      const date = toLocalIsoDate(cursor);
      const rotationDish = rotationDishes[meals.length % rotationDishes.length];
      meals.push({
        id: `meal-${date}-${meals.length + 1}`,
        sequence: meals.length + 1,
        date,
        timeWindow,
        mealStyle,
        dishId: rotationDish?.id || null,
        dishName: rotationDish?.name || null,
        status: 'SCHEDULED',
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return meals;
};

const formatMealDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const formatMealTime = (time) => {
  const hour = Number(time.split(':')[0]);
  const minute = time.split(':')[1];
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const offsetIsoDate = (date, days) => {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);
  return toLocalIsoDate(nextDate);
};

const MealPassManager = ({ mealPlan, fulfillment }) => {
  const navigate = useNavigate();
  const { updateMealPlan, updateScheduledMeal } = useCustomerSession();
  const { showToast } = useToast();
  const [reschedulingMealId, setReschedulingMealId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('19:30');
  const [rescheduleDishId, setRescheduleDishId] = useState('');
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const orderedMeals = [...(mealPlan.upcomingMeals || [])].sort((mealA, mealB) =>
    `${mealA.date}T${mealA.timeWindow}`.localeCompare(`${mealB.date}T${mealB.timeWindow}`),
  );
  const scheduledMeals = orderedMeals.filter((meal) => meal.status === 'SCHEDULED');
  const skippedMeals = (mealPlan.upcomingMeals || []).filter((meal) => meal.status === 'SKIPPED').length;
  const deliveredMeals = (mealPlan.upcomingMeals || []).filter((meal) => meal.status === 'DELIVERED').length;
  const nextMeal = scheduledMeals[0];
  const visibleMeals = showAllMeals ? orderedMeals : orderedMeals.slice(0, 4);
  const availableDishes = (mealPlan.selectedDishIds || [])
    .map((dishId) => DISHES.find((dish) => dish.id === dishId))
    .filter(Boolean);
  const completion = Math.round(
    (deliveredMeals / Math.max(mealPlan.mealCount, 1)) * 100
  );

  const togglePause = () => {
    const isPaused = mealPlan.status === 'PAUSED';
    updateMealPlan({
      status: isPaused ? 'ACTIVE' : 'PAUSED',
      pausedAt: isPaused ? null : new Date().toISOString(),
    });
    showToast(isPaused ? 'Meal Pass resumed' : 'Meal Pass paused—no meals will be prepared', 'success');
  };

  const skipMeal = (meal) => {
    const lastMealDate = orderedMeals.at(-1)?.date || meal.date;
    const replacementDate = new Date(`${lastMealDate}T00:00:00`);
    const selectedDeliveryDays = mealPlan.selectedDays?.length
      ? mealPlan.selectedDays
      : [replacementDate.getDay()];

    do {
      replacementDate.setDate(replacementDate.getDate() + 1);
    } while (!selectedDeliveryDays.includes(replacementDate.getDay()));

    const skippedAt = new Date().toISOString();
    updateMealPlan({
      upcomingMeals: [
        ...(mealPlan.upcomingMeals || []).map((scheduledMeal) =>
          scheduledMeal.id === meal.id
            ? { ...scheduledMeal, status: 'SKIPPED', skippedAt, updatedAt: skippedAt }
            : scheduledMeal
        ),
        {
          ...meal,
          id: `${meal.id}-replacement-${Date.now()}`,
          date: toLocalIsoDate(replacementDate),
          status: 'SCHEDULED',
          isReplacement: true,
          replacesMealId: meal.id,
          createdAt: skippedAt,
        },
      ],
    });
    setReschedulingMealId(null);
    showToast(`${formatMealDate(meal.date)} skipped—your meal credit moved to the cycle end`, 'success');
  };

  const openReschedule = (meal) => {
    setReschedulingMealId(meal.id);
    setRescheduleDate(meal.date);
    setRescheduleTime(meal.timeWindow);
    setRescheduleDishId(meal.dishId || availableDishes[0]?.id || '');
  };

  const saveReschedule = () => {
    if (!reschedulingMealId || !rescheduleDate) return;
    const selectedDish = availableDishes.find((dish) => dish.id === rescheduleDishId);
    updateScheduledMeal(reschedulingMealId, {
      date: rescheduleDate,
      timeWindow: rescheduleTime,
      dishId: selectedDish?.id || null,
      dishName: selectedDish?.name || null,
      rescheduledAt: new Date().toISOString(),
    });
    setReschedulingMealId(null);
    showToast('Upcoming meal rescheduled', 'success');
  };

  const cancelPass = () => {
    updateMealPlan({
      status: 'CANCELLED',
      cancelledAt: new Date().toISOString(),
      renewalMode: 'MANUAL',
    });
    setConfirmCancel(false);
    showToast('Meal Pass cancelled. No future renewal will be attempted.', 'info');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <TopAppBar variant="brand" />
      <main className="max-w-[640px] mx-auto px-4 pt-20 pb-32 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[#F47712]">Mangamma Meal Pass</p>
            <h1 className="text-3xl font-black text-[#211917] mt-1">Your meal routine</h1>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-[10px] font-black ${
            mealPlan.status === 'ACTIVE'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {mealPlan.status === 'ACTIVE' ? 'Active' : 'Paused'}
          </span>
        </div>

        <section className="rounded-[26px] bg-gradient-to-br from-[#A30F3B] to-[#6E0D25] text-white p-5 shadow-lg overflow-hidden relative">
          <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-white/5" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold text-white/65">{mealPlan.planTitle}</p>
              <h2 className="text-2xl font-black mt-1">
                {scheduledMeals.length} meals remaining
              </h2>
              <p className="text-xs text-white/70 mt-1">
                {formatInvoiceAmount(mealPlan.pricePerMeal)} per meal • {mealPlan.renewalMode === 'AUTOPAY' ? 'Auto-renewal selected' : 'Manual renewal'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/12 flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
          </div>
          <div className="relative mt-5 h-2 rounded-full bg-white/15 overflow-hidden">
            <span className="block h-full rounded-full bg-[#F8A04B]" style={{ width: `${completion}%` }} />
          </div>
          <div className="relative flex justify-between text-[10px] text-white/65 mt-2">
            <span>{deliveredMeals} delivered</span>
            <span>{skippedMeals} skipped</span>
            <span>{mealPlan.mealCount} included</span>
          </div>
        </section>

        {mealPlan.status === 'PAUSED' && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-black">Your pass is paused</p>
            <p className="text-xs mt-1">Scheduled meals remain saved, but the kitchen will not prepare them until you resume.</p>
          </section>
        )}

        {nextMeal && (
          <section className="rounded-[22px] bg-white border border-[#EADFD6] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-black text-[#F47712]">Next meal</p>
                <h2 className="text-xl font-black mt-1">{formatMealDate(nextMeal.date)}</h2>
                <p className="text-sm text-[#6E5F58] mt-1">{formatMealTime(nextMeal.timeWindow)} • {nextMeal.dishName || mealPlan.mealStyleLabel}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center">
                <CalendarDays className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-[#EFE6DF] flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#A30F3B] mt-0.5" />
              <p className="text-xs text-[#6E5F58]">{fulfillment.addressLine || mealPlan.deliveryAddress}</p>
            </div>
          </section>
        )}

        {fulfillment.type === 'DELIVERY' && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-2 px-1">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-black text-[#F47712]">Upcoming meal route</p>
                <h2 className="font-black mt-1">Kitchen to {fulfillment.label}</h2>
              </div>
              <span className="text-[10px] text-[#75665F]">{fulfillment.distanceKm} km</span>
            </div>
            <DeliveryTrackingMap
              destination={fulfillment.location}
              progress={0}
              riderAssigned={false}
            />
          </section>
        )}

        <section className="rounded-[22px] bg-white border border-[#EADFD6] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-black text-emerald-700">Nutrition summary</p>
              <h2 className="text-sm font-black mt-0.5">{mealPlan.nutrition?.label || 'Estimated meal range'}</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl bg-[#FFF8F1] p-3">
              <p className="text-[9px] uppercase font-bold text-[#75665F]">Energy</p>
              <p className="text-sm font-black mt-1">{mealPlan.nutrition?.calories || '520–720 kcal'}</p>
            </div>
            <div className="rounded-xl bg-[#FFF8F1] p-3">
              <p className="text-[9px] uppercase font-bold text-[#75665F]">Protein</p>
              <p className="text-sm font-black mt-1">{mealPlan.nutrition?.protein || '18–34 g'}</p>
            </div>
          </div>
          <p className="text-[9px] leading-relaxed text-[#95847C] mt-2">Approximate ranges vary by selected dish and customization; not medical nutrition advice.</p>
        </section>

        <section className="rounded-[22px] bg-white border border-[#EADFD6] p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-black">Upcoming meals</h2>
              <p className="text-[11px] text-[#75665F]">Skip or reschedule before the kitchen cutoff.</p>
            </div>
            <span className="text-[10px] font-bold text-[#A30F3B] bg-[#FBECEF] px-2 py-1 rounded-lg">2-hour cutoff</span>
          </div>

          <div className="divide-y divide-[#EFE6DF]">
            {visibleMeals.map((meal) => (
              <div key={meal.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center ${
                    meal.status === 'SKIPPED'
                      ? 'bg-stone-100 text-stone-400'
                      : 'bg-[#FFF0E3] text-[#A30F3B]'
                  }`}>
                    <span className="text-[9px] font-black uppercase">{formatMealDate(meal.date).split(',')[0]}</span>
                    <span className="text-sm font-black">{new Date(`${meal.date}T00:00:00`).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black ${meal.status === 'SKIPPED' ? 'text-stone-400 line-through' : 'text-[#211917]'}`}>
                      {meal.isReplacement ? 'Replacement' : `Meal ${meal.sequence}`} • {formatMealTime(meal.timeWindow)}
                    </p>
                    <p className="text-[11px] text-[#75665F] mt-0.5">
                      {meal.status === 'SKIPPED'
                        ? 'Skipped—credit moved to the cycle end'
                        : meal.dishName || mealPlan.mealStyleLabel}
                    </p>
                  </div>
                  {meal.status === 'SCHEDULED' && mealPlan.status !== 'PAUSED' && (
                    <button
                      onClick={() => openReschedule(meal)}
                      className="text-[11px] font-black text-[#A30F3B] px-2 py-1.5"
                    >
                      Manage
                    </button>
                  )}
                </div>

                {reschedulingMealId === meal.id && (
                  <div className="mt-3 rounded-xl bg-[#FFF8F1] border border-[#EADFD6] p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold text-[#6E5F58]">
                        New delivery date
                        <input
                          type="date"
                          value={rescheduleDate}
                          min={toLocalIsoDate(new Date())}
                          onChange={(event) => setRescheduleDate(event.target.value)}
                          className="w-full h-10 mt-1 rounded-lg border border-[#EADFD6] bg-white px-2 text-xs"
                        />
                      </label>
                      <label className="text-[10px] font-bold text-[#6E5F58]">
                        Delivery window
                        <select
                          value={rescheduleTime}
                          onChange={(event) => setRescheduleTime(event.target.value)}
                          className="w-full h-10 mt-1 rounded-lg border border-[#EADFD6] bg-white px-2 text-xs"
                        >
                          {TIME_WINDOWS.map((window) => (
                            <option key={window.id} value={window.id}>{window.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {availableDishes.length > 0 && (
                      <label className="block text-[10px] font-bold text-[#6E5F58]">
                        Change dish
                        <select
                          value={rescheduleDishId}
                          onChange={(event) => setRescheduleDishId(event.target.value)}
                          className="w-full h-10 mt-1 rounded-lg border border-[#EADFD6] bg-white px-2 text-xs"
                        >
                          {availableDishes.map((dish) => (
                            <option key={dish.id} value={dish.id}>{dish.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '+1 day', days: 1 },
                        { label: '+2 days', days: 2 },
                        { label: '+1 week', days: 7 },
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setRescheduleDate(offsetIsoDate(meal.date, option.days))}
                          className="h-8 rounded-lg bg-white border border-[#EADFD6] text-[10px] font-black text-[#A30F3B]"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setReschedulingMealId(null)} className="h-9 rounded-lg bg-white border border-[#EADFD6] text-xs font-bold">Close</button>
                      <button onClick={() => skipMeal(meal)} className="h-9 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold">Skip meal</button>
                      <button onClick={saveReschedule} className="h-9 rounded-lg bg-[#A30F3B] text-white text-xs font-bold">Save</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {(mealPlan.upcomingMeals || []).length > 4 && (
            <button
              onClick={() => setShowAllMeals((value) => !value)}
              className="w-full mt-3 pt-3 border-t border-[#EFE6DF] text-xs font-black text-[#A30F3B] flex items-center justify-center gap-1"
            >
              {showAllMeals ? 'Show fewer meals' : `View all ${orderedMeals.length} entries`}
              {showAllMeals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={togglePause}
            className="h-12 rounded-xl border border-[#EADFD6] bg-white text-sm font-black flex items-center justify-center gap-2"
          >
            {mealPlan.status === 'PAUSED' ? <Play className="w-4 h-4 text-emerald-700" /> : <Pause className="w-4 h-4 text-[#A30F3B]" />}
            {mealPlan.status === 'PAUSED' ? 'Resume pass' : 'Pause pass'}
          </button>
          <button
            onClick={() => navigate('/delivery-details')}
            className="h-12 rounded-xl border border-[#EADFD6] bg-white text-sm font-black flex items-center justify-center gap-2"
          >
            <MapPin className="w-4 h-4 text-[#A30F3B]" />
            Change address
          </button>
        </section>

        <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-emerald-900">You stay in control</p>
            <p className="text-[11px] text-emerald-800 mt-1">
              Pause or cancel future renewals anytime. Scheduled meals can be changed up to two hours before delivery.
            </p>
          </div>
        </section>

        {!confirmCancel ? (
          <button onClick={() => setConfirmCancel(true)} className="w-full h-11 text-xs font-bold text-rose-700">
            Cancel Meal Pass
          </button>
        ) : (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-black text-rose-900">Cancel future Meal Pass service?</p>
            <p className="text-xs text-rose-800 mt-1">Future renewal will stop. This does not delete your order history.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={() => setConfirmCancel(false)} className="h-10 rounded-xl bg-white border border-rose-200 text-xs font-black text-rose-800">Keep my pass</button>
              <button onClick={cancelPass} className="h-10 rounded-xl bg-rose-700 text-white text-xs font-black">Confirm cancellation</button>
            </div>
          </section>
        )}
      </main>
      <BottomNavBar />
    </div>
  );
};

const MealPassScreen = () => {
  const navigate = useNavigate();
  const {
    profile,
    fulfillment,
    hasFulfillmentDetails,
    mealPlan,
    saveMealPlan,
  } = useCustomerSession();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState('PASS_5');
  const [mealStyle, setMealStyle] = useState('HOME_STYLE');
  const [diet, setDiet] = useState(profile?.dietaryPreference || 'NO_PREFERENCE');
  const [spice, setSpice] = useState(profile?.spicePreference || 'MEDIUM');
  const [selectedDishIds, setSelectedDishIds] = useState([
    'meals-aritaku-veg',
    'mcveg-paneer-butter-masala',
    'mcveg-dal-tadka',
  ]);
  const [selectedDays, setSelectedDays] = useState([1, 3, 5]);
  const [timeWindow, setTimeWindow] = useState('19:30');
  const [renewalMode, setRenewalMode] = useState('AUTOPAY');
  const [isActivating, setIsActivating] = useState(false);

  const selectedPlan = PASS_OPTIONS.find((plan) => plan.id === selectedPlanId) || PASS_OPTIONS[1];
  const selectedStyle = MEAL_STYLES.find((style) => style.id === mealStyle) || MEAL_STYLES[0];
  const nutrition = NUTRITION_BY_STYLE[mealStyle] || NUTRITION_BY_STYLE.HOME_STYLE;
  const rotationDishes = ROTATION_DISH_IDS
    .map((dishId) => DISHES.find((dish) => dish.id === dishId))
    .filter(Boolean);
  const visibleRotationDishes = ['VEGETARIAN', 'VEGAN', 'JAIN'].includes(diet)
    ? rotationDishes.filter((dish) => dish.foodType === 'VEGETARIAN')
    : rotationDishes;
  const selectedRotationDishes = rotationDishes.filter((dish) => selectedDishIds.includes(dish.id));
  const totalPrice = selectedPlan.meals * selectedPlan.pricePerMeal;
  const regularPrice = selectedPlan.meals * 270;
  const savings = regularPrice - totalPrice;

  const canContinue = useMemo(() => {
    if (step === 2) return selectedDishIds.length >= 3;
    if (step === 3) return selectedDays.length > 0 && hasFulfillmentDetails;
    return true;
  }, [hasFulfillmentDetails, selectedDays.length, selectedDishIds.length, step]);

  const toggleDay = (dayId) => {
    setSelectedDays((current) =>
      current.includes(dayId)
        ? current.filter((id) => id !== dayId)
        : [...current, dayId]
    );
  };

  const toggleRotationDish = (dishId) => {
    setSelectedDishIds((current) =>
      current.includes(dishId)
        ? current.filter((id) => id !== dishId)
        : [...current, dishId]
    );
  };

  const changeDiet = (nextDiet) => {
    setDiet(nextDiet);
    if (['VEGETARIAN', 'VEGAN', 'JAIN'].includes(nextDiet)) {
      const vegetarianIds = rotationDishes
        .filter((dish) => dish.foodType === 'VEGETARIAN')
        .map((dish) => dish.id);
      setSelectedDishIds((current) => {
        const suitableIds = current.filter((id) => vegetarianIds.includes(id));
        return suitableIds.length >= 3 ? suitableIds : vegetarianIds.slice(0, 3);
      });
    }
  };

  const continueStep = () => {
    if (step === 3 && !hasFulfillmentDetails) {
      showToast('Add a serviceable delivery address before activating Meal Pass', 'warning');
      navigate('/delivery-details');
      return;
    }
    if (step === 3 && selectedDays.length === 0) {
      showToast('Choose at least one delivery day', 'warning');
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const activatePass = async () => {
    setIsActivating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const upcomingMeals = buildUpcomingMeals({
      mealCount: selectedPlan.meals,
      selectedDays,
      timeWindow,
      mealStyle,
      rotationDishes: selectedRotationDishes,
    });
    saveMealPlan({
      id: `MP-${Date.now().toString().slice(-7)}`,
      status: 'ACTIVE',
      planId: selectedPlan.id,
      planTitle: selectedPlan.title,
      mealCount: selectedPlan.meals,
      pricePerMeal: selectedPlan.pricePerMeal,
      totalPrice,
      estimatedSavings: savings,
      mealStyle,
      mealStyleLabel: selectedStyle.label,
      selectedDishIds,
      nutrition,
      diet,
      spice,
      selectedDays,
      timeWindow,
      renewalMode,
      paymentStatus: renewalMode === 'AUTOPAY' ? 'DEMO_MANDATE_READY' : 'PAY_PER_CYCLE',
      deliveryAddress: fulfillment.addressLine,
      deliveryLocation: fulfillment.location,
      upcomingMeals,
      createdAt: new Date().toISOString(),
    });
    setIsActivating(false);
    showToast('Meal Pass activated and your schedule is ready', 'success');
  };

  if (mealPlan && mealPlan.status !== 'CANCELLED') {
    return <MealPassManager mealPlan={mealPlan} fulfillment={fulfillment} />;
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <TopAppBar variant="brand" />
      <main className="max-w-[640px] mx-auto px-4 pt-20 pb-36">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="w-10 h-10 rounded-full bg-white border border-[#EADFD6] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] font-black text-[#F47712]">Mangamma Meal Pass</p>
            <h1 className="text-2xl font-black text-[#211917]">Build your meal routine</h1>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-6">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            const complete = stepNumber < step;
            const active = stepNumber === step;
            return (
              <div key={label}>
                <div className={`h-1.5 rounded-full ${stepNumber <= step ? 'bg-[#A30F3B]' : 'bg-[#EADFD6]'}`} />
                <p className={`text-[10px] mt-1.5 font-bold ${active ? 'text-[#A30F3B]' : complete ? 'text-emerald-700' : 'text-[#95847C]'}`}>
                  {complete ? '✓ ' : ''}{label}
                </p>
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <section className="mt-7">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#F47712]">Step 1 of 4</p>
            <h2 className="text-2xl font-black mt-1">How many meals fit your life?</h2>
            <p className="text-sm text-[#6E5F58] mt-1">Every plan can be paused, skipped or rescheduled.</p>
            <div className="space-y-3 mt-5">
              {PASS_OPTIONS.map((plan) => {
                const selected = plan.id === selectedPlanId;
                const planTotal = plan.meals * plan.pricePerMeal;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full rounded-2xl border-2 p-4 text-left flex items-center gap-3 ${
                      selected ? 'border-[#A30F3B] bg-[#FBECEF]/50' : 'border-[#EADFD6] bg-white'
                    }`}
                    aria-pressed={selected}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                      selected ? 'bg-[#A30F3B] text-white' : 'bg-[#FFF0E3] text-[#A30F3B]'
                    }`}>
                      {plan.meals}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black">{plan.title}</p>
                        {plan.recommended && <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Recommended</span>}
                      </div>
                      <p className="text-xs text-[#75665F] mt-0.5">{plan.subtitle}</p>
                      <p className="text-xs font-bold text-[#A30F3B] mt-1">{formatInvoiceAmount(plan.pricePerMeal)}/meal • {formatInvoiceAmount(planTotal)} total</p>
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-[#A30F3B]' : 'border-stone-300'}`}>
                      {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#A30F3B]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="mt-7">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#F47712]">Step 2 of 4</p>
            <h2 className="text-2xl font-black mt-1">Make every meal feel like yours</h2>
            <p className="text-sm text-[#6E5F58] mt-1">We will rotate suitable dishes instead of repeating one fixed menu.</p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {MEAL_STYLES.map((style) => {
                const selected = style.id === mealStyle;
                return (
                  <button
                    key={style.id}
                    onClick={() => setMealStyle(style.id)}
                    className={`rounded-2xl border-2 p-4 text-left min-h-[136px] ${
                      selected ? 'border-[#A30F3B] bg-[#FBECEF]/40' : 'border-[#EADFD6] bg-white'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="text-2xl">{style.emoji}</span>
                    <p className="font-black mt-2">{style.label}</p>
                    <p className="text-[11px] leading-relaxed text-[#75665F] mt-1">{style.detail}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <label className="text-xs font-black">
                Diet
                <select value={diet} onChange={(event) => changeDiet(event.target.value)} className="w-full h-12 mt-1 rounded-xl border border-[#EADFD6] bg-white px-3 text-xs">
                  <option value="NO_PREFERENCE">No preference</option>
                  <option value="VEGETARIAN">Vegetarian</option>
                  <option value="NON_VEGETARIAN">Non-vegetarian</option>
                  <option value="VEGAN">Vegan</option>
                  <option value="JAIN">Jain</option>
                </select>
              </label>
              <label className="text-xs font-black">
                Spice
                <select value={spice} onChange={(event) => setSpice(event.target.value)} className="w-full h-12 mt-1 rounded-xl border border-[#EADFD6] bg-white px-3 text-xs">
                  <option value="MILD">Mild</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HOT">Hot</option>
                </select>
              </label>
            </div>

            <div className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black">Choose your dish rotation</p>
                  <p className="text-[10px] text-[#75665F] mt-0.5">Select at least 3. You can change individual meals later.</p>
                </div>
                <span className={`text-[10px] font-black ${selectedDishIds.length >= 3 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {selectedDishIds.length} selected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {visibleRotationDishes.map((dish) => {
                  const selected = selectedDishIds.includes(dish.id);
                  return (
                    <button
                      type="button"
                      key={dish.id}
                      onClick={() => toggleRotationDish(dish.id)}
                      aria-pressed={selected}
                      className={`rounded-xl border-2 overflow-hidden text-left ${
                        selected ? 'border-[#A30F3B] bg-[#FBECEF]/40' : 'border-[#EADFD6] bg-white'
                      }`}
                    >
                      <img src={dish.image} alt="" className="w-full h-20 object-cover" />
                      <span className="p-2.5 flex items-start gap-2">
                        <span className="text-[10px] font-black leading-snug flex-1">{dish.name}</span>
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          selected ? 'bg-[#A30F3B] border-[#A30F3B] text-white' : 'border-[#C8B8AF]'
                        }`}>
                          {selected && <Check className="w-3 h-3" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="mt-7">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#F47712]">Step 3 of 4</p>
            <h2 className="text-2xl font-black mt-1">Choose your delivery rhythm</h2>
            <p className="text-sm text-[#6E5F58] mt-1">Selected days repeat until all meals in this cycle are scheduled.</p>
            <div className="grid grid-cols-7 gap-1.5 mt-5">
              {DAYS.map((day) => {
                const selected = selectedDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    aria-label={`${selected ? 'Remove' : 'Add'} ${day.label}`}
                    aria-pressed={selected}
                    className={`h-12 rounded-xl text-[10px] font-black ${
                      selected ? 'bg-[#A30F3B] text-white' : 'bg-white border border-[#EADFD6] text-[#75665F]'
                    }`}
                  >
                    {day.short}
                  </button>
                );
              })}
            </div>

            <label className="block text-xs font-black mt-5">
              Preferred delivery window
              <select value={timeWindow} onChange={(event) => setTimeWindow(event.target.value)} className="w-full h-12 mt-1 rounded-xl border border-[#EADFD6] bg-white px-3 text-sm">
                {TIME_WINDOWS.map((window) => <option key={window.id} value={window.id}>{window.label}</option>)}
              </select>
            </label>

            <button
              onClick={() => navigate('/delivery-details')}
              className={`w-full mt-4 rounded-2xl border p-4 flex items-center gap-3 text-left ${
                hasFulfillmentDetails ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <MapPin className={`w-5 h-5 ${hasFulfillmentDetails ? 'text-emerald-700' : 'text-amber-700'}`} />
              <span className="flex-1">
                <span className="text-xs font-black block">{hasFulfillmentDetails ? 'Delivery address ready' : 'Delivery address required'}</span>
                <span className="text-[11px] text-[#75665F] block mt-0.5">{fulfillment.addressLine || 'Add your map pin and complete address'}</span>
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </section>
        )}

        {step === 4 && (
          <section className="mt-7">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#F47712]">Step 4 of 4</p>
            <h2 className="text-2xl font-black mt-1">Review your Meal Pass</h2>
            <p className="text-sm text-[#6E5F58] mt-1">Nothing is charged by this frontend demo.</p>

            <div className="rounded-[24px] bg-white border border-[#EADFD6] p-5 mt-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{selectedPlan.title}</p>
                  <p className="text-xs text-[#75665F] mt-1">{selectedStyle.label} • {diet.replaceAll('_', ' ').toLowerCase()} • {spice.toLowerCase()} spice</p>
                  <p className="text-[10px] text-[#A30F3B] font-bold mt-1">{selectedRotationDishes.length} chosen dishes in rotation</p>
                </div>
                <span className="w-11 h-11 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-[#EFE6DF] space-y-2 text-sm">
                <div className="flex justify-between text-[#6E5F58]"><span>{selectedPlan.meals} meals × {formatInvoiceAmount(selectedPlan.pricePerMeal)}</span><span>{formatInvoiceAmount(totalPrice)}</span></div>
                <div className="flex justify-between text-emerald-700 font-bold"><span>Estimated menu saving</span><span>{formatInvoiceAmount(savings)}</span></div>
                <div className="flex justify-between font-black pt-2 border-t border-[#EFE6DF]"><span>Cycle total</span><span className="text-[#A30F3B]">{formatInvoiceAmount(totalPrice)}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-2xl border border-[#EADFD6] bg-white p-3">
                <p className="text-[9px] uppercase font-black text-[#75665F]">Energy range</p>
                <p className="text-sm font-black mt-1">{nutrition.calories}</p>
              </div>
              <div className="rounded-2xl border border-[#EADFD6] bg-white p-3">
                <p className="text-[9px] uppercase font-black text-[#75665F]">Protein range</p>
                <p className="text-sm font-black mt-1">{nutrition.protein}</p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <button
                onClick={() => setRenewalMode('AUTOPAY')}
                aria-pressed={renewalMode === 'AUTOPAY'}
                className={`w-full rounded-2xl border-2 p-4 text-left flex gap-3 ${
                  renewalMode === 'AUTOPAY' ? 'border-[#A30F3B] bg-[#FBECEF]/40' : 'border-[#EADFD6] bg-white'
                }`}
              >
                <RefreshCw className="w-5 h-5 text-[#A30F3B] mt-0.5" />
                <span className="flex-1">
                  <span className="text-sm font-black block">UPI AutoPay renewal</span>
                  <span className="text-[11px] text-[#75665F] block mt-1">Renew each cycle after a pre-debit notice. Pause or cancel anytime.</span>
                </span>
                {renewalMode === 'AUTOPAY' && <CheckCircle2 className="w-5 h-5 text-[#A30F3B]" />}
              </button>
              <button
                onClick={() => setRenewalMode('MANUAL')}
                aria-pressed={renewalMode === 'MANUAL'}
                className={`w-full rounded-2xl border-2 p-4 text-left flex gap-3 ${
                  renewalMode === 'MANUAL' ? 'border-[#A30F3B] bg-[#FBECEF]/40' : 'border-[#EADFD6] bg-white'
                }`}
              >
                <CreditCard className="w-5 h-5 text-[#A30F3B] mt-0.5" />
                <span className="flex-1">
                  <span className="text-sm font-black block">Pay each cycle manually</span>
                  <span className="text-[11px] text-[#75665F] block mt-1">We will remind you before the next cycle. No automatic renewal.</span>
                </span>
                {renewalMode === 'MANUAL' && <CheckCircle2 className="w-5 h-5 text-[#A30F3B]" />}
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed text-amber-900">
                AutoPay is a UI adapter only in this build. Production activation requires an NPCI-supported payment gateway, mandate authorization and server-side webhook verification.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-[#EADFD6] p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[640px] mx-auto flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep((current) => current - 1)} className="w-12 h-14 rounded-xl border border-[#EADFD6] flex items-center justify-center" aria-label="Previous step">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={continueStep}
              disabled={!canContinue}
              className="flex-1 h-14 rounded-xl bg-[#A30F3B] text-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={activatePass}
              disabled={isActivating}
              className="flex-1 h-14 rounded-xl bg-[#A30F3B] text-white font-black flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isActivating ? 'Preparing your schedule...' : 'Activate demo Meal Pass'}
              {!isActivating && <Check className="w-4 h-4" />}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default MealPassScreen;
