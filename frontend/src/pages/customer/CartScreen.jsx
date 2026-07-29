import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { orderService } from '../../services/orderService';
import { cartService } from '../../services/cartService';
import { formatInvoiceAmount, formatMenuPrice } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../components/common/Icon';
import BillingSummary from '../../components/common/BillingSummary';
import CustomizationModal from '../../components/menu/CustomizationModal';
import HonestExpectationBanner from '../../components/order/HonestExpectationBanner';
import { AlertTriangle, Bike, ChevronRight, Edit3, MapPin, Trash2, Plus, Minus } from 'lucide-react';

const CartScreen = () => {
  const navigate = useNavigate();
  const { profile, fulfillment, hasFulfillmentDetails } = useCustomerSession();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    updateCartItemCustomization,
    clearCart,
    tipPercentage,
    setTipPercentage,
    customTipAmount,
    setCustomTipAmount,
    selectedTipOption,
    setSelectedTipOption,
    appliedPromo,
    setAppliedPromo,
    specialOrderNotes,
    setSpecialOrderNotes,
    totals,
  } = useCart();
  const { placeOrder, kitchenLoad } = useOrder();
  const { showToast } = useToast();

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleApplyPromo = async (e) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;
    setIsApplyingPromo(true);
    try {
      const res = await cartService.applyPromoCode(promoCodeInput);
      if (res.data.success) {
        setAppliedPromo(res.data.promo);
        showToast(`Promo "${res.data.promo.code}" applied successfully!`, 'success');
        setPromoCodeInput('');
      } else {
        showToast(res.data.message || 'Invalid promo code', 'error');
      }
    } catch (err) {
      showToast('Error applying promo code', 'error');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    if (!hasFulfillmentDetails) {
      showToast('Add your delivery or pickup details before placing the order', 'warning');
      navigate('/delivery-details');
      return;
    }
    setIsPlacingOrder(true);
    try {
      const payload = {
        customer: {
          firstName: profile?.firstName,
          phone: profile?.phone,
        },
        fulfillment,
        items: cartItems,
        totals,
        specialNotes: specialOrderNotes,
      };
      const res = await orderService.createOrder(payload);
      placeOrder(res.data);
      clearCart();
      showToast('Order placed successfully with the kitchen!', 'success');
      navigate('/order-confirmation');
    } catch (err) {
      showToast('Failed to place order. Please try again.', 'error');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (newPayload) => {
    if (!editingItem) return;
    updateCartItemCustomization(editingItem.cartItemId, newPayload);
    showToast(`Updated customization for ${editingItem.name}`, 'success');
    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  if (cartItems.length === 0) {
    return (
      <>
        <TopAppBar variant="brand" />
        <main className="flex-1 pt-20 px-4">
          <EmptyState
            icon={() => <Icon name="shopping_bag" className="text-4xl" />}
            title="Your cart is empty"
            description="Explore our regional menu of biryanis, curries and tandoor grills, and add items to your cart to begin your order."
            actionLabel="Browse Full Menu"
            onAction={() => navigate('/menu')}
          />
        </main>
        <BottomNavBar />
      </>
    );
  }

  return (
    <>
      <TopAppBar variant="brand" />

      <main className="flex-1 pt-20 pb-56 md:pb-16 max-w-[1280px] mx-auto w-full px-4 md:px-10">
        <header className="mb-4">
          <h2 className="text-2xl md:text-4xl font-bold text-ink">Your Selection</h2>
          <p className="text-sm text-muted mt-1">
            {fulfillment.type === 'DELIVERY' ? 'Delivery order' : 'Self pickup'} &bull; Review everything before sending it to the kitchen.
          </p>
        </header>

        <button
          type="button"
          onClick={() => navigate('/delivery-details')}
          className="w-full mb-5 bg-white rounded-2xl border border-border p-4 flex items-center gap-3 text-left shadow-sm"
        >
          <span className="w-10 h-10 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center shrink-0">
            {fulfillment.type === 'DELIVERY' ? <Bike className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E97818] block">
              {fulfillment.type === 'DELIVERY' ? `Deliver to ${fulfillment.label}` : 'Self pickup'}
            </span>
            <span className="text-xs font-bold text-ink truncate block mt-0.5">
              {fulfillment.type === 'DELIVERY'
                ? fulfillment.addressLine || 'Add delivery address'
                : 'Mangamma Ruchulu Cloud Kitchen'}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted" />
        </button>

        <section className="mb-6">
          <HonestExpectationBanner
            kitchenLoad={kitchenLoad}
            estimatedRange={`${kitchenLoad?.averagePreparationMinutes || 20}–${(kitchenLoad?.averagePreparationMinutes || 20) + 5} mins`}
          />
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left: Items */}
          <div className="md:col-span-7 flex flex-col gap-4">
            {cartItems.map((item) => {
              const singleUnitPrice = item.unitPrice !== undefined ? item.unitPrice : item.price;
              const itemTotalPrice = singleUnitPrice * item.quantity;
              const hasModifiers = (item.selectedCustomizations && item.selectedCustomizations.length > 0) || item.makeVegan || item.jainPreparation;

              return (
                <div key={item.cartItemId || item.id} className="bg-surface-container-lowest rounded-2xl p-4 border border-border shadow-card flex flex-col gap-3">
                  <div className="flex gap-4 items-start">
                    <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-border" />

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-ink text-base">{item.name}</h3>
                          <span className="text-xs text-maroon-800 font-semibold">{formatMenuPrice(singleUnitPrice)} each</span>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.cartItemId || item.id)}
                          className="text-muted hover:text-danger transition-colors p-1.5 rounded-lg hover:bg-danger/10"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {hasModifiers && (
                        <div className="mt-2 text-xs space-y-1 bg-cream p-2.5 rounded-xl border border-border">
                          {item.makeVegan && <div className="text-success font-semibold flex items-center gap-1"><span>🌱 Vegan Preparation</span></div>}
                          {item.jainPreparation && <div className="text-success font-semibold flex items-center gap-1"><span>🌿 Jain Preparation</span></div>}
                          {item.selectedCustomizations?.map((mod, idx) => (
                            <div key={idx} className="text-text font-medium flex justify-between">
                              <span>• {mod.label || mod.name}</span>
                              {mod.priceDelta && mod.priceDelta > 0 ? <span className="text-maroon-800">+{formatMenuPrice(mod.priceDelta)}</span> : null}
                            </div>
                          ))}
                        </div>
                      )}

                      {item.allergyAlert && (
                        <div className="mt-2 bg-danger/10 border-l-4 border-danger p-2.5 rounded-r-xl text-xs text-ink space-y-0.5">
                          <div className="font-bold uppercase tracking-wider flex items-center gap-1 text-danger">
                            <AlertTriangle className="w-4 h-4" />
                            <span>ALLERGY ALERT</span>
                          </div>
                          <p className="font-semibold">{item.allergyAlert}</p>
                        </div>
                      )}

                      {item.itemNote && <div className="mt-1 text-xs text-muted italic"><span>Special instruction: "{item.itemNote}"</span></div>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      {item.originalDish?.customizationAvailable !== false && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="px-3 py-1.5 bg-saffron-100 hover:bg-saffron-100/70 text-maroon-900 text-xs font-bold rounded-lg border border-saffron-600/30 flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Customization</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center bg-surface-container rounded-xl p-1">
                        <button
                          onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container-lowest shadow-sm text-text hover:bg-surface-container-low active:scale-90"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold w-6 text-center text-xs text-ink">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-container-lowest shadow-sm text-text hover:bg-surface-container-low active:scale-90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-bold text-maroon-800 text-base">{formatInvoiceAmount(itemTotalPrice)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div>
              <label className="text-xs font-semibold text-text mb-2 block">Special Order Notes</label>
              <textarea
                rows={2}
                value={specialOrderNotes}
                onChange={(e) => setSpecialOrderNotes(e.target.value)}
                placeholder="e.g. Call on arrival, leave at security, less plastic, etc."
                className="w-full bg-surface-container-lowest border border-border rounded-xl p-3 focus:ring-2 focus:ring-maroon-700/40 text-xs placeholder:text-muted shadow-sm resize-none outline-none"
              />
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-4 border border-border shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="sell" className="text-saffron-600" />
                  <span className="text-xs font-bold text-ink">Promo Code or Voucher</span>
                </div>
                <span className="text-[10px] text-muted font-medium">Try: MANGAMMA10</span>
              </div>
              {appliedPromo ? (
                <div className="flex items-center justify-between p-3 bg-success/10 border border-success/30 rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-success">{appliedPromo.code}</span>
                    <p className="text-[10px] text-success">{appliedPromo.description}</p>
                  </div>
                  <button onClick={() => setAppliedPromo(null)} className="text-[11px] font-bold text-danger underline">Remove</button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="flex gap-2">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Enter promo code"
                    className="flex-1 px-3 py-2 bg-surface-container border border-border rounded-xl text-xs uppercase font-bold outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isApplyingPromo || !promoCodeInput.trim()}
                    className="px-4 py-2 bg-saffron-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-saffron-500"
                  >
                    Apply
                  </button>
                </form>
              )}
            </div>

            <div className="md:hidden">
              <BillingSummary
                totals={totals}
                showTipSelector={true}
                tipPercentage={tipPercentage}
                setTipPercentage={setTipPercentage}
                customTipAmount={customTipAmount}
                setCustomTipAmount={setCustomTipAmount}
                selectedTipOption={selectedTipOption}
                setSelectedTipOption={setSelectedTipOption}
              />
            </div>

            <div className="hidden md:flex gap-4 mt-2">
              <button
                onClick={() => navigate('/menu')}
                className="flex-grow h-14 border border-border text-text rounded-xl font-semibold hover:bg-surface-container transition-colors active:scale-95 text-sm"
              >
                Continue Ordering
              </button>
              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder}
                className="flex-[2] h-14 bg-saffron-600 text-white rounded-xl font-bold hover:bg-saffron-500 transition-opacity active:scale-95 shadow-md disabled:opacity-60 text-sm"
              >
                {isPlacingOrder ? 'Placing Order...' : `Place Order • ${formatInvoiceAmount(totals.totalPayable || totals.grandTotal)}`}
              </button>
            </div>
          </div>

          {/* Right: Desktop Summary */}
          <div className="hidden md:block md:col-span-5">
            <div className="sticky top-24">
              <BillingSummary
                totals={totals}
                showTipSelector={true}
                tipPercentage={tipPercentage}
                setTipPercentage={setTipPercentage}
                customTipAmount={customTipAmount}
                setCustomTipAmount={setCustomTipAmount}
                selectedTipOption={selectedTipOption}
                setSelectedTipOption={setSelectedTipOption}
              />
            </div>
          </div>
        </div>
      </main>

      {editingItem && (
        <CustomizationModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingItem(null);
          }}
          dish={editingItem.originalDish || editingItem}
          initialSelections={{
            selectedOptions: editingItem.selectedOptions || {},
            makeVegan: editingItem.makeVegan,
            jainPreparation: editingItem.jainPreparation,
            allergyAlert: editingItem.allergyAlert,
            specialInstruction: editingItem.itemNote,
            quantity: editingItem.quantity,
          }}
          onAddToCart={handleSaveEdit}
        />
      )}

      {/* Mobile sticky footer — "N items · ₹total / Review Order" */}
      <div
        className="md:hidden fixed left-0 w-full bg-surface-container-lowest p-4 flex flex-col gap-2 z-40 border-t border-border shadow-xl"
        style={{ bottom: 'calc(90px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[11px] text-muted">
              {totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'} · {formatInvoiceAmount(totals.totalPayable || totals.grandTotal)}
            </span>
          </div>
          <button onClick={() => setShowMobileDetails((s) => !s)} className="text-maroon-800 text-xs font-semibold flex items-center gap-0.5">
            Details
            <Icon name={showMobileDetails ? 'expand_more' : 'expand_less'} />
          </button>
        </div>
        {showMobileDetails && (
          <div className="flex flex-col gap-1.5 pb-2 border-b border-border text-xs text-muted">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatInvoiceAmount(totals.subtotal)}</span></div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-success"><span>Discount</span><span>-{formatInvoiceAmount(totals.discountAmount)}</span></div>
            )}
            <div className="flex justify-between"><span>GST @ 5%</span><span>{formatInvoiceAmount(totals.gst)}</span></div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => navigate('/menu')} className="flex-1 h-12 border border-border text-text rounded-xl font-semibold active:scale-95 text-xs">
            Continue
          </button>
          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="flex-[2] h-12 bg-saffron-600 text-white rounded-xl font-bold active:scale-95 shadow-md text-xs disabled:opacity-60"
          >
            {isPlacingOrder ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      </div>

      <BottomNavBar />
    </>
  );
};

export default CartScreen;
