import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bike,
  ChevronRight,
  Clock3,
  CalendarDays,
  Navigation,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import RestaurantTrustProfileModal from '../../components/trust/RestaurantTrustProfileModal';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useOrder } from '../../context/OrderContext';
import { DISHES, RESTAURANT_INFO } from '../../utils/mockData';
import { formatMenuPrice } from '../../utils/formatters';

const POPULAR_DISH_IDS = [
  'biryani-chicken-special',
  'mcveg-paneer-butter-masala',
  'meals-aritaku-veg',
];

const PopularDishCard = ({ dish, onPress }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const isVeg = dish.foodType === 'VEGETARIAN' || dish.foodType === 'VEGAN';

  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onPress}
      className="w-full flex items-center gap-3 rounded-2xl bg-white border border-[#EADFD6] p-3 text-left shadow-sm"
    >
      <div className="w-[82px] h-[82px] rounded-xl overflow-hidden bg-[#F8F0E5] shrink-0 flex items-center justify-center">
        {!imageFailed && dish.image ? (
          <img
            src={dish.image}
            alt={dish.name}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <UtensilsCrossed className="w-7 h-7 text-[#95847C]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-[14px] leading-snug text-[#211917] line-clamp-2">{dish.name}</h3>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#705F58]">
          <span className={`w-3 h-3 border flex items-center justify-center ${isVeg ? 'border-emerald-600' : 'border-[#A30F3B]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-[#A30F3B]'}`} />
          </span>
          <span>{isVeg ? 'Veg' : 'Non-veg'}</span>
          <span>•</span>
          <span>{dish.preparationTimeMinutes || 20} min</span>
        </div>
        <p className="font-black text-[#A30F3B] mt-2">{formatMenuPrice(dish.price)}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-[#95847C] shrink-0" />
    </motion.button>
  );
};

const WelcomeScreen = () => {
  const navigate = useNavigate();
  const { profile, fulfillment, hasFulfillmentDetails, mealPlan } = useCustomerSession();
  const { kitchenLoad, activeOrder } = useOrder();
  const [trustOpen, setTrustOpen] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);

  const popularDishes = POPULAR_DISH_IDS
    .map((id) => DISHES.find((dish) => dish.id === id))
    .filter(Boolean);

  const eta = fulfillment.type === 'DELIVERY'
    ? `${fulfillment.etaMinutes}-${fulfillment.etaMinutes + 8} min`
    : `${kitchenLoad?.averagePreparationMinutes || 20}-${(kitchenLoad?.averagePreparationMinutes || 20) + 5} min`;

  return (
    <>
      <TopAppBar
        variant="brand"
        onOpenTrustProfile={() => setTrustOpen(true)}
        onOpenPreferences={() => navigate('/account')}
      />

      <main className="max-w-[640px] mx-auto w-full pt-[58px] pb-32">
        <section className="relative h-[235px] overflow-hidden bg-[#201714]">
          {!heroFailed ? (
            <img
              src={RESTAURANT_INFO.heroImage}
              alt={`${RESTAURANT_INFO.name} kitchen`}
              fetchPriority="high"
              onError={() => setHeroFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UtensilsCrossed className="w-12 h-12 text-white/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-8 text-white">
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold text-[#FFD7B5] mb-1"
            >
              Freshly prepared • Delivery-first kitchen
            </motion.p>
            <h1 className="text-[28px] leading-tight font-black">Good food is on the way, {profile?.firstName}.</h1>
          </div>
        </section>

        <section className="-mt-4 relative z-10 mx-4 rounded-[22px] bg-white border border-[#EADFD6] shadow-[0_12px_32px_rgba(63,34,23,0.10)] overflow-hidden">
          <button
            type="button"
            onClick={() => navigate('/delivery-details')}
            className="w-full p-4 flex items-center gap-3 text-left"
          >
            <span className="w-11 h-11 rounded-full bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center shrink-0">
              {fulfillment.type === 'DELIVERY' ? <Bike className="w-5 h-5" /> : <PackageCheck className="w-5 h-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#E97818] block">
                {fulfillment.type === 'DELIVERY' ? `Deliver to ${fulfillment.label}` : 'Self pickup'}
              </span>
              <span className="text-sm font-bold text-[#211917] truncate block mt-0.5">
                {fulfillment.type === 'DELIVERY'
                  ? fulfillment.addressLine || 'Add your delivery address'
                  : 'Mangamma Ruchulu Cloud Kitchen'}
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-[#95847C]" />
          </button>

          <div className="border-t border-[#EADFD6] px-4 py-3 bg-[#FFF8F1] flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#705F58]">
              <Clock3 className="w-3.5 h-3.5 text-[#A30F3B]" />
              Estimated {fulfillment.type === 'DELIVERY' ? 'arrival' : 'ready time'}
            </span>
            <span className="text-xs font-black text-[#211917]">{eta}</span>
          </div>
        </section>

        {!hasFulfillmentDetails && fulfillment.type === 'DELIVERY' ? (
          <section className="mx-4 mt-5 rounded-2xl border border-[#E97818]/30 bg-[#FFF0DE] p-4">
            <div className="flex items-start gap-3">
              <Navigation className="w-5 h-5 text-[#A30F3B] mt-0.5 shrink-0" />
              <div>
                <h2 className="font-bold text-sm text-[#6E0D25]">Set your delivery pin first</h2>
                <p className="text-xs text-[#705F58] mt-1">We use it to confirm serviceability and show an honest ETA.</p>
                <button
                  onClick={() => navigate('/delivery-details')}
                  className="mt-3 text-xs font-black text-[#A30F3B] inline-flex items-center gap-1"
                >
                  Add delivery details <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        ) : (
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={() => navigate('/menu')}
            className="mx-4 mt-5 w-[calc(100%-32px)] h-14 rounded-2xl bg-[#E97818] text-white font-black shadow-[0_10px_24px_rgba(233,120,24,0.25)] flex items-center justify-center gap-2"
          >
            Explore menu
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        )}

        {activeOrder && (
          <button
            onClick={() => navigate('/order-tracking')}
            className="mx-4 mt-3 w-[calc(100%-32px)] rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-left"
          >
            <span className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="text-xs font-black text-emerald-900 block">Track active order #{activeOrder.orderId}</span>
              <span className="text-[11px] text-emerald-800">See live preparation and delivery progress</span>
            </span>
            <ChevronRight className="w-4 h-4 text-emerald-700" />
          </button>
        )}

        <button
          onClick={() => navigate('/meal-pass')}
          className="mx-4 mt-4 w-[calc(100%-32px)] rounded-[22px] bg-gradient-to-br from-[#FBECEF] to-[#FFF0E3] border border-[#E7C8D2] p-4 text-left shadow-sm overflow-hidden relative"
        >
          <span className="absolute -right-7 -top-8 w-24 h-24 rounded-full bg-[#A30F3B]/5" />
          <span className="relative flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-[#A30F3B] text-white flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider font-black text-[#F47712] block">
                {mealPlan && mealPlan.status !== 'CANCELLED' ? 'Your Meal Pass' : 'New • Mangamma Meal Pass'}
              </span>
              <span className="font-black text-[#211917] block mt-0.5">
                {mealPlan && mealPlan.status !== 'CANCELLED'
                  ? `${mealPlan.mealCount} meal routine • ${mealPlan.status.toLowerCase()}`
                  : 'Plan your week. Skip or pause anytime.'}
              </span>
              <span className="text-[11px] text-[#6E5F58] block mt-1">
                {mealPlan && mealPlan.status !== 'CANCELLED'
                  ? `${mealPlan.upcomingMeals?.filter((meal) => meal.status === 'SCHEDULED').length || 0} meals scheduled`
                  : 'From ₹199 per meal with flexible delivery days'}
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-[#A30F3B]" />
          </span>
        </button>

        <section className="px-4 mt-7">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#E97818] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Popular nearby
              </p>
              <h2 className="text-xl font-black text-[#211917] mt-1">Loved by regulars</h2>
            </div>
            <button onClick={() => navigate('/menu')} className="text-xs font-black text-[#A30F3B]">View all</button>
          </div>
          <div className="space-y-3">
            {popularDishes.map((dish) => (
              <PopularDishCard
                key={dish.id}
                dish={dish}
                onPress={() => navigate(`/menu/${dish.id}`)}
              />
            ))}
          </div>
        </section>

        <section className="mx-4 mt-7 rounded-2xl border border-[#EADFD6] bg-[#FFF8F1] p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#A30F3B] shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#211917]">Verified kitchen information</p>
            <button onClick={() => setTrustOpen(true)} className="text-[11px] font-bold text-[#A30F3B] mt-0.5">
              View FSSAI, food safety and our story
            </button>
          </div>
        </section>
      </main>

      <BottomNavBar />
      <RestaurantTrustProfileModal isOpen={trustOpen} onClose={() => setTrustOpen(false)} />
    </>
  );
};

export default WelcomeScreen;
