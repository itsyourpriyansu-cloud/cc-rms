import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CookingPot,
  Headphones,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import EmptyState from '../../components/common/EmptyState';
import DeliveryTrackingMap from '../../components/customer/DeliveryTrackingMap';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';

const DELIVERY_STAGES = [
  { status: 'received', label: 'Order confirmed', detail: 'The kitchen received your order.', icon: CheckCircle2 },
  { status: 'preparing', label: 'Freshly preparing', detail: 'Your dishes are cooking now.', icon: CookingPot },
  { status: 'ready', label: 'Packed and quality checked', detail: 'Your order is ready for rider pickup.', icon: PackageCheck },
  { status: 'out_for_delivery', label: 'On the way', detail: 'Your rider is heading to you.', icon: Bike },
  { status: 'delivered', label: 'Delivered', detail: 'Your order has reached you.', icon: Check },
];

const PICKUP_STAGES = [
  DELIVERY_STAGES[0],
  DELIVERY_STAGES[1],
  { status: 'ready', label: 'Ready for pickup', detail: 'Collect your order from the pickup counter.', icon: ShoppingBag },
  { status: 'delivered', label: 'Collected', detail: 'Your pickup is complete.', icon: Check },
];

const STAGE_PROGRESS = [0, 0, 0.05, 0.56, 1];

const OrderTrackingScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activeOrder, updateOrderStatus } = useOrder();
  const { fulfillment: savedFulfillment, profile } = useCustomerSession();
  const fulfillment = activeOrder?.fulfillment || savedFulfillment;
  const isDelivery = fulfillment.type === 'DELIVERY';
  const stages = isDelivery ? DELIVERY_STAGES : PICKUP_STAGES;
  const stageIndex = Math.min(activeOrder?.stageIndex || 0, stages.length - 1);
  const currentStage = stages[stageIndex];
  const riderAssigned = isDelivery && stageIndex >= 2;
  const riderProgress = isDelivery ? STAGE_PROGRESS[stageIndex] : 0;

  const etaText = useMemo(() => {
    if (!activeOrder) return '';
    if (stageIndex === stages.length - 1) return isDelivery ? 'Delivered' : 'Collected';
    if (isDelivery && stageIndex >= 3) return '12-18 min';
    return `${fulfillment.etaMinutes || 35}-${(fulfillment.etaMinutes || 35) + 8} min`;
  }, [activeOrder, fulfillment.etaMinutes, isDelivery, stageIndex, stages.length]);

  const advanceDemoStage = () => {
    const nextIndex = Math.min(stageIndex + 1, stages.length - 1);
    updateOrderStatus(stages[nextIndex].status, nextIndex);
    showToast(`Order moved to: ${stages[nextIndex].label}`, 'info');
  };

  if (!activeOrder) {
    return (
      <>
        <TopAppBar variant="brand" />
        <main className="flex-1 pt-20 px-4">
          <EmptyState
            icon={() => <Navigation className="w-10 h-10" />}
            title="No active order to track"
            description="Place an order and its kitchen and delivery progress will appear here."
            actionLabel="Explore Menu"
            onAction={() => navigate('/menu')}
          />
        </main>
        <BottomNavBar />
      </>
    );
  }

  return (
    <>
      <TopAppBar variant="brand" onOpenPreferences={() => navigate('/account')} />

      <main className="max-w-[640px] mx-auto w-full px-4 pt-20 pb-32 space-y-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E97818]">
              Order #{activeOrder.orderId}
            </p>
            <h1 className="text-2xl font-black text-[#211917] mt-1">
              {isDelivery ? 'Track your delivery' : 'Pickup progress'}
            </h1>
          </div>
          {stageIndex < stages.length - 1 && (
            <button
              type="button"
              onClick={advanceDemoStage}
              className="px-3 py-2 rounded-xl bg-[#FBECEF] border border-[#A30F3B]/20 text-[#A30F3B] text-[10px] font-black"
            >
              Advance demo
            </button>
          )}
        </header>

        <section className="rounded-[22px] bg-gradient-to-br from-[#8D1230] to-[#6E0D25] p-5 text-white shadow-lg overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="flex items-start justify-between gap-4 relative">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live order status
              </span>
              <h2 className="text-xl font-black mt-3">{currentStage.label}</h2>
              <p className="text-xs text-white/75 mt-1">{currentStage.detail}</p>
            </div>
            <span className="w-12 h-12 rounded-2xl bg-white/12 flex items-center justify-center shrink-0">
              <currentStage.icon className="w-6 h-6" />
            </span>
          </div>
          <div className="mt-5 pt-4 border-t border-white/15 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                {isDelivery ? 'Estimated arrival' : 'Estimated ready'}
              </p>
              <p className="text-2xl font-black mt-0.5">{etaText}</p>
            </div>
            <Clock3 className="w-5 h-5 text-[#FFD7B5]" />
          </div>
        </section>

        {isDelivery ? (
          <DeliveryTrackingMap
            destination={fulfillment.location}
            progress={riderProgress}
            riderAssigned={riderAssigned}
          />
        ) : (
          <section className="rounded-[22px] bg-white border border-[#EADFD6] p-5 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-[#211917]">Pickup at Mangamma Ruchulu</h2>
            <p className="text-xs text-[#705F58] mt-1">Central Hyderabad, Telangana</p>
            <button className="mt-4 h-10 px-4 rounded-xl bg-[#FFF0DE] text-[#A30F3B] text-xs font-bold inline-flex items-center gap-2">
              <Navigation className="w-4 h-4" /> Open directions
            </button>
          </section>
        )}

        {riderAssigned && (
          <section className="rounded-2xl bg-white border border-[#EADFD6] p-4 flex items-center gap-3 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#FFF0DE] text-[#A30F3B] flex items-center justify-center font-black">
              RK
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-[#211917]">Ravi Kumar</p>
              <p className="text-[11px] text-[#705F58]">Delivery partner • TS09 AB 2481</p>
            </div>
            <button
              type="button"
              onClick={() => showToast('Calling is disabled in the frontend demo', 'info')}
              className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center"
              aria-label="Call delivery partner"
            >
              <Phone className="w-4 h-4" />
            </button>
          </section>
        )}

        <section className="rounded-[22px] bg-white border border-[#EADFD6] p-5 shadow-sm">
          <h2 className="font-black text-sm text-[#211917] mb-4">Order journey</h2>
          <div>
            {stages.map((stage, index) => {
              const complete = index <= stageIndex;
              const StageIcon = stage.icon;
              return (
                <div key={stage.status} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < stages.length - 1 && (
                    <span className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${index < stageIndex ? 'bg-[#A30F3B]' : 'bg-[#EADFD6]'}`} />
                  )}
                  <span className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 ${complete ? 'bg-[#A30F3B] border-[#A30F3B] text-white' : 'bg-white border-[#EADFD6] text-[#95847C]'}`}>
                    <StageIcon className="w-4 h-4" />
                  </span>
                  <div className="pt-0.5">
                    <p className={`text-xs font-black ${complete ? 'text-[#211917]' : 'text-[#95847C]'}`}>{stage.label}</p>
                    <p className="text-[11px] text-[#705F58] mt-0.5">{stage.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-[#EADFD6] p-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-[#A30F3B] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black text-[#211917]">
                {isDelivery ? `Deliver to ${fulfillment.label}` : 'Pickup customer'}
              </p>
              <p className="text-[11px] text-[#705F58] mt-1">
                {isDelivery ? fulfillment.addressLine : `${profile?.firstName} • +91 ${profile?.phone}`}
              </p>
              {isDelivery && fulfillment.landmark && (
                <p className="text-[11px] text-[#705F58]">Landmark: {fulfillment.landmark}</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => showToast('Support chat is ready for backend integration', 'info')}
            className="h-12 rounded-xl border border-[#EADFD6] bg-white text-xs font-bold text-[#211917] flex items-center justify-center gap-2"
          >
            <Headphones className="w-4 h-4 text-[#A30F3B]" /> Get help
          </button>
          <button
            type="button"
            onClick={() => navigate('/report-issue')}
            className="h-12 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-800 flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4" /> Report issue
          </button>
        </section>

        <button
          type="button"
          onClick={() =>
            stageIndex === stages.length - 1
              ? navigate(activeOrder.isPaid ? '/success' : '/payment')
              : navigate('/bill')
          }
          className={`w-full h-12 rounded-xl text-white text-sm font-black flex items-center justify-center gap-2 ${
            stageIndex === stages.length - 1 ? 'bg-[#A30F3B]' : 'bg-[#E97818]'
          }`}
        >
          {stageIndex === stages.length - 1
            ? activeOrder.isPaid
              ? 'Finish order and unlock rewards'
              : 'Pay and finish order'
            : activeOrder.isPaid
            ? 'View paid bill'
            : 'View bill and payment'}
          <ChevronRight className="w-4 h-4" />
        </button>

        <p className="text-center text-[10px] text-[#95847C]">
          Rider positions are simulated in this frontend build. Production connects this map to authenticated rider GPS events.
        </p>
      </main>

      <BottomNavBar />
    </>
  );
};

export default OrderTrackingScreen;
