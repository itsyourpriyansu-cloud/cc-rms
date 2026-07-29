import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Banknote,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
  Tag,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import { formatInvoiceAmount } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import EmptyState from '../../components/common/EmptyState';

const PAYMENT_METHODS = [
  {
    id: 'upi',
    name: 'UPI',
    subtitle: 'Fastest • Pay with any UPI app',
    icon: Smartphone,
    recommended: true,
  },
  {
    id: 'card',
    name: 'Credit or debit card',
    subtitle: 'Visa, Mastercard and RuPay',
    icon: CreditCard,
  },
  {
    id: 'cash',
    name: 'Cash on delivery',
    subtitle: 'Pay when the order reaches you',
    icon: Banknote,
    deliveryOnly: true,
  },
];

const UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM'];

const PaymentScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeOrder, placeOrder, markAsPaid } = useOrder();
  const { clearCart } = useCart();
  const { fulfillment: savedFulfillment } = useCustomerSession();
  const { showToast } = useToast();

  const orderDraft = location.state?.orderDraft || activeOrder;
  const isCheckout = Boolean(location.state?.checkout && location.state?.orderDraft);
  const fulfillment = orderDraft?.fulfillment || savedFulfillment;
  const grandTotal =
    orderDraft?.totals?.totalPayable ||
    orderDraft?.totals?.grandTotal ||
    orderDraft?.grandTotal ||
    0;

  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState('GPay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(false);

  const handleProcessPayment = async () => {
    if (!orderDraft) return;
    setIsProcessing(true);
    try {
      const response = await paymentService.processPayment({
        orderId: orderDraft.orderId,
        amount: grandTotal,
        method: selectedMethod,
        provider: selectedMethod === 'upi' ? selectedUpiApp : undefined,
        fulfillmentType: fulfillment.type,
      });

      if (!response.data.success) return;

      const transaction = {
        ...response.data,
        paymentStatus: selectedMethod === 'cash' ? 'PAY_ON_DELIVERY' : 'PAID',
      };

      if (isCheckout) {
        placeOrder({
          ...orderDraft,
          isPaid: selectedMethod !== 'cash',
          transaction,
        });
        clearCart();
        showToast(
          selectedMethod === 'cash' ? 'Order placed • Pay on delivery' : 'Payment successful • Order placed',
          'success'
        );
        navigate('/order-confirmation', { replace: true });
      } else {
        markAsPaid(transaction);
        showToast('Payment completed successfully', 'success');
        navigate('/success', { replace: true });
      }
    } catch {
      showToast('Payment failed. No amount was charged. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!orderDraft) {
    return (
      <>
        <TopAppBar variant="brand" />
        <main className="flex-1 pt-20 px-4">
          <EmptyState
            icon={CreditCard}
            title="No checkout awaiting payment"
            description="Add food to your cart and continue to payment."
            actionLabel="Browse menu"
            onAction={() => navigate('/menu')}
          />
        </main>
      </>
    );
  }

  const discount = orderDraft.totals?.discountAmount || 0;
  const isCashAvailable = fulfillment.type === 'DELIVERY';

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#211917]">
      <TopAppBar variant="brand" />

      <main className="max-w-[560px] mx-auto px-4 pt-20 pb-40">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-7 px-2.5 rounded-full bg-[#FBECEF] text-[#A30F3B] text-[11px] font-black flex items-center">
            Secure checkout
          </span>
          <span className="text-xs text-[#75665F]">Order #{orderDraft.orderId}</span>
        </div>
        <h1 className="text-[28px] leading-tight font-black">Choose payment</h1>
        <p className="text-sm text-[#6E5F58] mt-1">
          Your order reaches the kitchen only after this step.
        </p>

        {orderDraft.appliedPromo && (
          <section className="mt-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-emerald-700 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-black text-emerald-900">{orderDraft.appliedPromo.code} applied</p>
              <p className="text-xs text-emerald-700">
                You saved {formatInvoiceAmount(discount)} on this order
              </p>
            </div>
            <Check className="w-5 h-5 text-emerald-700" />
          </section>
        )}

        <section className="mt-5 rounded-2xl bg-white border border-[#EADFD6] overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setShowPriceDetails((value) => !value)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <p className="text-xs font-bold text-[#75665F] uppercase tracking-wider">Amount to pay</p>
              <p className="text-3xl font-black text-[#A30F3B] mt-0.5">{formatInvoiceAmount(grandTotal)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#A30F3B]">
              Details
              {showPriceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {showPriceDetails && (
            <div className="border-t border-[#EFE6DF] px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between text-[#6E5F58]">
                <span>Food subtotal</span>
                <span>{formatInvoiceAmount(orderDraft.totals?.subtotal || 0)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Offer saving</span>
                  <span>-{formatInvoiceAmount(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#6E5F58]">
                <span>GST</span>
                <span>{formatInvoiceAmount(orderDraft.totals?.gst || 0)}</span>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black">Payment methods</h2>
            <span className="text-[11px] text-[#6E5F58] flex items-center gap-1">
              <LockKeyhole className="w-3.5 h-3.5" />
              Encrypted
            </span>
          </div>

          <div className="space-y-3">
            {PAYMENT_METHODS.filter((method) => !method.deliveryOnly || isCashAvailable).map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              return (
                <article
                  key={method.id}
                  className={`rounded-2xl bg-white border-2 overflow-hidden transition-colors ${
                    isSelected ? 'border-[#A30F3B]' : 'border-[#EADFD6]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedMethod(method.id)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                    aria-pressed={isSelected}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-[#FBECEF] text-[#A30F3B]' : 'bg-[#F7F3F0] text-[#6E5F58]'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black">{method.name}</p>
                        {method.recommended && (
                          <span className="text-[9px] uppercase tracking-wide font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#75665F] mt-0.5">{method.subtitle}</p>
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-[#A30F3B]' : 'border-stone-300'
                    }`}>
                      {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-[#A30F3B]" />}
                    </span>
                  </button>

                  {isSelected && method.id === 'upi' && (
                    <div className="px-4 pb-4">
                      <p className="text-xs font-bold text-[#6E5F58] mb-2">Pay using</p>
                      <div className="grid grid-cols-4 gap-2">
                        {UPI_APPS.map((app) => (
                          <button
                            key={app}
                            type="button"
                            onClick={() => setSelectedUpiApp(app)}
                            className={`h-12 rounded-xl text-[11px] font-black flex flex-col items-center justify-center gap-0.5 ${
                              selectedUpiApp === app
                                ? 'bg-[#FBECEF] text-[#A30F3B] ring-1 ring-[#A30F3B]'
                                : 'bg-[#F7F3F0] text-[#5E514B]'
                            }`}
                          >
                            <QrCode className="w-4 h-4" />
                            {app}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <div className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-[#6E5F58]">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          Online payment is simulated in this frontend. Production must use a PCI-compliant payment gateway and server-side payment verification.
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-[#EADFD6] p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <div className="max-w-[560px] mx-auto">
          <button
            onClick={handleProcessPayment}
            disabled={isProcessing}
            className="w-full h-14 rounded-2xl bg-[#A30F3B] text-white font-black flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-60"
          >
            {isProcessing
              ? 'Securing your order...'
              : selectedMethod === 'cash'
              ? 'Place order • Pay on delivery'
              : `Pay ${formatInvoiceAmount(grandTotal)}`}
          </button>
          <p className="text-center text-[10px] text-[#75665F] mt-2">
            {selectedMethod === 'cash'
              ? 'Please keep the exact amount ready if possible.'
              : `You will continue in ${selectedMethod === 'upi' ? selectedUpiApp : 'your bank'} to authorize payment.`}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PaymentScreen;
