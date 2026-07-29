import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { orderService } from '../../services/orderService';
import { formatInvoiceAmount } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../components/common/Icon';
import BillingSummary from '../../components/common/BillingSummary';
import { AlertCircle } from 'lucide-react';

const BillScreen = () => {
  const navigate = useNavigate();
  const { activeOrder } = useOrder();
  const { fulfillment: savedFulfillment } = useCustomerSession();
  const fulfillment = activeOrder?.fulfillment || savedFulfillment;
  const { showToast } = useToast();

  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isNotifyingStaff, setIsNotifyingStaff] = useState(false);

  const handlePayAtCounter = async () => {
    setIsNotifyingStaff(true);
    try {
      await orderService.requestAssistance(fulfillment.type, fulfillment.type === 'DELIVERY' ? 'Cash on Delivery' : 'Cash at Pickup');
      showToast(fulfillment.type === 'DELIVERY' ? 'Cash on delivery selected.' : 'Cash payment at pickup selected.', 'success');
      setIsCashModalOpen(false);
    } catch (err) {
      showToast('Error notifying staff', 'error');
    } finally {
      setIsNotifyingStaff(false);
    }
  };

  if (!activeOrder) {
    return (
      <>
        <TopAppBar variant="brand" />
        <main className="flex-1 pt-20 px-4">
          <EmptyState
            icon={() => <Icon name="receipt_long" className="text-4xl" />}
            title="No active bill found"
            description="Place an order from our menu to generate your bill."
            actionLabel="Go to Menu"
            onAction={() => navigate('/menu')}
          />
        </main>
        <BottomNavBar />
      </>
    );
  }

  const totals = activeOrder.totals || {
    subtotal: activeOrder.subtotal || 0,
    discountAmount: activeOrder.discount || 0,
    packagingCharge: activeOrder.packagingCharge || 0,
    gst: activeOrder.gst || activeOrder.tax || 0,
    cgst: activeOrder.cgst || (activeOrder.gst || activeOrder.tax || 0) / 2,
    sgst: activeOrder.sgst || (activeOrder.gst || activeOrder.tax || 0) / 2,
    tipAmount: activeOrder.tip || 0,
    totalPayable: activeOrder.totalPayable || activeOrder.grandTotal || 0,
  };

  return (
    <>
      <TopAppBar variant="brand" />

      <main className="flex-1 pt-20 pb-24 max-w-[1280px] mx-auto w-full px-4 md:px-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-1">Bill Summary</h2>
            <p className="text-xs text-on-surface-variant">Review your selection before proceeding to secure payment.</p>
          </div>
          {/* Service Recovery Trigger */}
          <button
            onClick={() => navigate('/report-issue')}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Billing issue or discrepancy?</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="md:col-span-7 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/30">
                <p className="text-xs text-on-surface-variant uppercase mb-1">Order Number</p>
                <p className="text-lg font-bold text-on-surface">#{activeOrder.orderId}</p>
              </div>
              <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/30">
                <p className="text-xs text-on-surface-variant uppercase mb-1">Order Type</p>
                <p className="text-lg font-bold text-on-surface">{fulfillment.type === 'DELIVERY' ? 'Delivery' : 'Pickup'}</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
              <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low">
                <h3 className="text-xs font-bold text-on-surface uppercase">Items Ordered</h3>
              </div>
              {activeOrder.items?.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 flex items-center justify-between hover:bg-surface-container-high/30 transition-colors ${
                    idx > 0 ? 'border-t border-outline-variant/10' : ''
                  }`}
                >
                  <div className="flex gap-4 items-center min-w-0">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-dim flex-shrink-0">
                      {item.image ? (
                        <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant/60">
                          <Icon name="restaurant" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-on-surface truncate">{item.name}</h4>
                      <p className="text-xs text-on-surface-variant">{item.quantity}x</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-on-surface flex-shrink-0">
                    {formatInvoiceAmount((item.unitPrice || item.price) * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="md:sticky md:top-24 space-y-4">
              <BillingSummary totals={totals} showTipSelector={false} />

              <div className="space-y-3 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm">
                <button
                  onClick={() => navigate('/payment')}
                  className="w-full h-14 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
                >
                  <Icon name="payments" />
                  Proceed to Payment
                </button>
                <button
                  onClick={() => setIsCashModalOpen(true)}
                  className="w-full h-14 bg-transparent border-2 border-primary text-primary rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 active:scale-95 transition-all"
                >
                  <Icon name="storefront" />
                  {fulfillment.type === 'DELIVERY' ? 'Cash on Delivery' : 'Pay at Pickup'}
                </button>
              </div>

              <div className="pt-2 flex items-center gap-3 text-on-surface-variant/60">
                <Icon name="verified_user" />
                <p className="text-xs">Secure encrypted payment processing</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNavBar />

      <Modal isOpen={isCashModalOpen} onClose={() => setIsCashModalOpen(false)} title={fulfillment.type === 'DELIVERY' ? 'Cash on Delivery' : 'Pay at Pickup'}>
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-secondary-container/30 text-secondary rounded-full flex items-center justify-center mx-auto">
            <Icon name="storefront" className="text-3xl" />
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Would you like to select {fulfillment.type === 'DELIVERY' ? 'cash payment when your order arrives' : 'cash payment at the pickup counter'} for{' '}
            <span className="font-bold text-on-surface">{formatInvoiceAmount(totals.totalPayable || totals.grandTotal)}</span>?
          </p>
          <div className="space-y-2 pt-2">
            <button
              onClick={handlePayAtCounter}
              disabled={isNotifyingStaff}
              className="w-full h-12 bg-primary text-on-primary rounded-xl font-semibold disabled:opacity-60"
            >
              {isNotifyingStaff ? 'Saving...' : 'Confirm Cash Payment'}
            </button>
            <button
              onClick={() => setIsCashModalOpen(false)}
              className="w-full h-12 border border-outline-variant text-on-surface rounded-xl font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BillScreen;
