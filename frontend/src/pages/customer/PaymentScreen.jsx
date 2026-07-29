import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import { formatInvoiceAmount } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../components/common/Icon';

const PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI / QR Code', subtitle: 'GPay, PhonePe, Paytm', icon: 'account_balance_wallet' },
  { id: 'credit', name: 'Credit Card', subtitle: 'Visa, Mastercard, Amex', icon: 'credit_card' },
  { id: 'debit', name: 'Debit Card', subtitle: 'Instant Bank Settlement', icon: 'payments' },
  { id: 'cash', name: 'Cash', subtitle: 'Pay on delivery or at pickup', icon: 'storefront' },
];

const PaymentScreen = () => {
  const navigate = useNavigate();
  const { activeOrder, markAsPaid } = useOrder();
  const { fulfillment: savedFulfillment } = useCustomerSession();
  const fulfillment = activeOrder?.fulfillment || savedFulfillment;
  const { showToast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [isProcessing, setIsProcessing] = useState(false);

  const grandTotal = activeOrder?.totals?.totalPayable || activeOrder?.totals?.grandTotal || activeOrder?.grandTotal || 0;

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    try {
      const paymentPayload = {
        orderId: activeOrder?.orderId,
        amount: grandTotal,
        method: selectedMethod,
        fulfillmentType: fulfillment.type,
      };
      const res = await paymentService.processPayment(paymentPayload);
      if (res.data.success) {
        markAsPaid(res.data);
        showToast('Payment processed successfully!', 'success');
        navigate('/success');
      }
    } catch (err) {
      showToast('Payment failed. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!activeOrder) {
    return (
      <>
        <TopAppBar variant="brand" />
        <main className="flex-1 pt-20 px-4">
          <EmptyState
            icon={() => <Icon name="credit_card" className="text-4xl" />}
            title="No bill pending payment"
            description="Please place an order to proceed with payment."
            actionLabel="Go to Menu"
            onAction={() => navigate('/menu')}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <TopAppBar variant="brand" />

      <main className="flex-1 pt-20 pb-32 max-w-md mx-auto w-full px-4">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-on-surface mb-1">Select Payment Method</h2>
          <p className="text-sm text-on-surface-variant">Choose how you would like to pay for this {fulfillment.type === 'DELIVERY' ? 'delivery' : 'pickup'} order.</p>
        </div>

        {/* Order Total Card */}
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] mb-8 flex justify-between items-center border border-outline-variant/20">
          <div>
            <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Total Payable</p>
            <p className="text-3xl font-extrabold text-primary mt-1">{formatInvoiceAmount(grandTotal)}</p>
          </div>
          <div className="w-12 h-12 bg-primary-container/10 flex items-center justify-center rounded-full">
            <Icon name="receipt_long" className="text-primary" />
          </div>
        </div>

        {/* Payment Options */}
        <div className="space-y-4">
          {PAYMENT_METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`w-full p-4 rounded-xl shadow-sm border-2 transition-all text-left flex items-center justify-between active:scale-[0.98] ${
                  isSelected ? 'border-primary bg-surface-container-lowest' : 'border-transparent bg-surface-container-lowest hover:bg-surface-bright'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-container flex items-center justify-center rounded-lg">
                    <Icon name={method.icon} className="text-on-surface" />
                  </div>
                  <div>
                    <p className="font-semibold text-on-surface">{method.name}</p>
                    <p className="text-[10px] text-on-surface-variant font-medium">{method.subtitle}</p>
                  </div>
                </div>
                <Icon
                  name={isSelected ? 'check_circle' : 'radio_button_unchecked'}
                  filled={isSelected}
                  className={isSelected ? 'text-primary' : 'text-outline-variant'}
                />
              </button>
            );
          })}
        </div>

        {/* Secure Badge */}
        <div className="mt-8 flex flex-col items-center justify-center gap-1 opacity-60">
          <div className="flex items-center gap-1.5">
            <Icon name="lock" style={{ fontSize: 16 }} />
            <p className="text-xs">Secure Encrypted Payment</p>
          </div>
        </div>
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-0 w-full bg-surface-container-lowest p-4 shadow-[0px_-4px_20px_rgba(0,0,0,0.06)] z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleProcessPayment}
            disabled={isProcessing}
            className="w-full bg-primary text-on-primary h-14 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-60"
          >
            <span>{isProcessing ? 'Processing...' : 'Complete Payment'}</span>
            {!isProcessing && <Icon name="arrow_forward" />}
          </button>
        </div>
      </div>
    </>
  );
};

export default PaymentScreen;
