import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, CheckCircle2, ChevronRight, Clock3, PackageOpen, RefreshCw, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useToast } from '../../context/ToastContext';
import { DISHES } from '../../utils/mockData';
import { formatInvoiceAmount } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';

const COMPLETED_STATUSES = new Set(['delivered', 'completed', 'served']);

const CustomerOrdersScreen = () => {
  const navigate = useNavigate();
  const { activeOrder, customerOrders } = useOrder();
  const { cartItems, addToCart } = useCart();
  const { showToast } = useToast();

  const activeIsComplete =
    !activeOrder || COMPLETED_STATUSES.has(activeOrder.status) || activeOrder.stageIndex >= 4;
  const currentOrder = activeIsComplete ? null : activeOrder;
  const pastOrders = customerOrders.filter(
    (order) => order.orderId !== currentOrder?.orderId
  );

  const handleReorder = (order) => {
    if (cartItems.length > 0) {
      showToast('Your cart already has items. Review it before adding a past order.', 'info');
      navigate('/cart');
      return;
    }

    (order.items || []).forEach((item) => {
      const dishId = item.dishId || item.id;
      const dish =
        item.originalDish ||
        DISHES.find((candidate) => candidate.id === dishId) || {
          id: dishId,
          name: item.name,
          price: item.price || item.unitPrice || 0,
          image: item.image,
          foodType: item.isVeg ? 'VEGETARIAN' : 'NON_VEGETARIAN',
        };

      addToCart(
        dish,
        item.selectedCustomizations || [],
        item.itemNote || item.specialInstructions || '',
        item.quantity || 1,
        {
          unitPrice: item.unitPrice,
          selectedOptions: item.selectedOptions,
          makeVegan: item.makeVegan,
          jainPreparation: item.jainPreparation,
          allergyAlert: item.allergyAlert,
        }
      );
    });

    showToast(`${order.items?.length || 0} past-order items added to your cart`, 'success');
    navigate('/cart');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9]">
      <TopAppBar variant="brand" />
      <main className="max-w-[640px] mx-auto px-4 pt-20 pb-32">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F47712]">Your activity</p>
        <h1 className="text-3xl font-black text-[#211917] mt-1">Orders</h1>
        <p className="text-sm text-[#6E5F58] mt-1">Track what is cooking and quickly repeat past favourites.</p>

        {currentOrder && (
          <section className="mt-6 rounded-[24px] bg-gradient-to-br from-[#A30F3B] to-[#7E0D2F] text-white p-5 shadow-lg overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/5" />
            <div className="flex items-center justify-between gap-3 relative">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-white/70">Active order</p>
                <h2 className="text-xl font-black mt-1">#{currentOrder.orderId}</h2>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/12 flex items-center justify-center">
                <Bike className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 relative">
              <div className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] uppercase text-white/65 font-bold">Status</p>
                <p className="text-sm font-black mt-0.5 capitalize">
                  {String(currentOrder.status || 'received').replaceAll('_', ' ')}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] uppercase text-white/65 font-bold">Arrival</p>
                <p className="text-sm font-black mt-0.5">
                  {currentOrder.fulfillment?.etaMinutes || 30}-{(currentOrder.fulfillment?.etaMinutes || 30) + 8} min
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/order-tracking')}
              className="mt-4 w-full h-12 rounded-xl bg-white text-[#A30F3B] font-black flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              Track live order
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>
        )}

        <section className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-[#211917]">Past orders</h2>
            {pastOrders.length > 0 && (
              <span className="text-xs font-bold text-[#75665F]">{pastOrders.length} saved</span>
            )}
          </div>

          {pastOrders.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#DCCFC5] bg-white px-6 py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF0E3] text-[#F47712] flex items-center justify-center mx-auto">
                <PackageOpen className="w-7 h-7" />
              </div>
              <h3 className="font-black text-lg mt-4">No past orders yet</h3>
              <p className="text-sm text-[#6E5F58] mt-1">Your delivered orders will appear here for easy reordering.</p>
              <button
                onClick={() => navigate('/menu')}
                className="mt-5 h-11 px-5 rounded-xl bg-[#A30F3B] text-white font-black text-sm"
              >
                Explore menu
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pastOrders.map((order) => {
                const orderDate = new Date(order.completedAt || order.createdAt || Date.now());
                const itemNames = (order.items || []).map((item) => `${item.quantity || 1}× ${item.name}`);
                return (
                  <article key={order.orderId} className="rounded-[22px] bg-white border border-[#EADFD6] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <p className="text-sm font-black text-[#211917]">Order #{order.orderId}</p>
                        </div>
                        <p className="text-[11px] text-[#75665F] mt-1 flex items-center gap-1">
                          <Clock3 className="w-3.5 h-3.5" />
                          {orderDate.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <p className="font-black text-[#A30F3B]">
                        {formatInvoiceAmount(order.totals?.totalPayable || order.totals?.grandTotal || 0)}
                      </p>
                    </div>
                    <p className="text-xs text-[#5E514B] leading-relaxed mt-3 line-clamp-2">
                      {itemNames.join(' • ')}
                    </p>
                    <div className="mt-4 pt-3 border-t border-[#EFE6DF] flex items-center justify-between gap-3">
                      <div className="text-[11px] text-[#75665F] flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {order.fulfillment?.type === 'PICKUP' ? 'Self pickup' : `Delivered to ${order.fulfillment?.label || 'Home'}`}
                      </div>
                      <button
                        onClick={() => handleReorder(order)}
                        className="h-10 px-4 rounded-xl bg-[#FBECEF] text-[#A30F3B] font-black text-xs flex items-center gap-1.5 active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reorder
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <BottomNavBar />
    </div>
  );
};

export default CustomerOrdersScreen;
