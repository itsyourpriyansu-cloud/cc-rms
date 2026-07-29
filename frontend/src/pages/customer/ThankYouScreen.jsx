import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, ReceiptText, Star, UtensilsCrossed } from 'lucide-react';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import { formatInvoiceAmount, deriveInvoiceNumber } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import ReferralCard from '../../components/customer/ReferralCard';

const ThankYouScreen = () => {
  const navigate = useNavigate();
  const { activeOrder, clearOrder } = useOrder();
  const { fulfillment: savedFulfillment, profile, auth } = useCustomerSession();
  const { showToast } = useToast();

  const fulfillment = activeOrder?.fulfillment || savedFulfillment;
  const [isDownloading, setIsDownloading] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const totalPaid =
    activeOrder?.totals?.totalPayable ||
    activeOrder?.totals?.grandTotal ||
    activeOrder?.grandTotal ||
    0;
  const invoiceNumber = deriveInvoiceNumber(activeOrder);
  const paymentMethod =
    activeOrder?.transaction?.paymentMethod === 'cash'
      ? 'Cash on delivery'
      : activeOrder?.transaction?.paymentProvider ||
        activeOrder?.transaction?.paymentMethod?.toUpperCase() ||
        'Online payment';

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const response = await paymentService.downloadReceipt(
        activeOrder?.orderId || invoiceNumber,
        activeOrder?.transaction
      );
      const blob = new Blob([response.data.receiptText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.data.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Receipt downloaded', 'success');
    } catch {
      showToast('Could not download the receipt', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRating = (value) => {
    setRating(value);
    setFeedbackSent(true);
    showToast('Thanks—your rating helps us improve', 'success');
  };

  const handleOrderAgain = () => {
    clearOrder();
    navigate('/orders');
  };

  if (!activeOrder) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <TopAppBar variant="brand" />
        <main className="max-w-md mx-auto px-4 pt-28 text-center">
          <h1 className="text-2xl font-black">This order is already complete</h1>
          <button
            onClick={() => navigate('/orders')}
            className="mt-5 h-12 px-5 rounded-xl bg-[#A30F3B] text-white font-black"
          >
            View your orders
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#211917]">
      <TopAppBar variant="brand" />
      <main className="max-w-[560px] mx-auto px-4 pt-20 pb-10 space-y-4">
        <section className="rounded-[28px] bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-6 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70 mt-4">
            Order delivered
          </p>
          <h1 className="text-2xl font-black mt-1">Enjoy your meal, {profile?.firstName}!</h1>
          <p className="text-sm text-white/75 mt-2">
            {fulfillment.type === 'DELIVERY'
              ? `Delivered to ${fulfillment.label || 'your address'}`
              : 'Your pickup is complete'}
          </p>
        </section>

        <section className="rounded-[22px] bg-white border border-[#EADFD6] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#75665F]">Invoice {invoiceNumber}</p>
              <p className="font-black text-lg">{formatInvoiceAmount(totalPaid)}</p>
              <p className="text-[11px] text-emerald-700 font-bold">{paymentMethod} • Payment confirmed</p>
            </div>
            <button
              onClick={handleDownloadReceipt}
              disabled={isDownloading}
              aria-label="Download receipt"
              className="w-11 h-11 rounded-xl border border-[#EADFD6] text-[#A30F3B] flex items-center justify-center disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </section>

        <section className="rounded-[22px] bg-white border border-[#EADFD6] p-5 text-center shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#F47712]">Quick feedback</p>
          <h2 className="text-lg font-black mt-1">
            {feedbackSent ? 'Thank you for rating us' : 'How was your order?'}
          </h2>
          <p className="text-xs text-[#6E5F58] mt-1">One tap is enough. You can report a specific issue from Orders.</p>
          <div className="flex items-center justify-center gap-2 mt-4" role="group" aria-label="Rate this order">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => handleRating(value)}
                aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  value <= rating
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-[#F7F3F0] text-stone-400'
                }`}
              >
                <Star className={`w-5 h-5 ${value <= rating ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
        </section>

        <ReferralCard
          firstName={profile?.firstName}
          phone={auth?.phone}
          onNotify={showToast}
        />

        <button
          onClick={handleOrderAgain}
          className="w-full h-14 rounded-2xl border-2 border-[#A30F3B] text-[#A30F3B] font-black flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <UtensilsCrossed className="w-4 h-4" />
          Finish and view order history
        </button>
      </main>
    </div>
  );
};

export default ThankYouScreen;
