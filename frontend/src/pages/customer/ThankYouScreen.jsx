import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { paymentService } from '../../services/paymentService';
import { formatInvoiceAmount, deriveInvoiceNumber } from '../../utils/formatters';
import TopAppBar from '../../components/layout/TopAppBar';
import CustomerPreferencesModal from '../../components/preferences/CustomerPreferencesModal';
import DiagnosticFeedbackModal from '../../components/retention/DiagnosticFeedbackModal';
import SignatureDishStoryModal from '../../components/retention/SignatureDishStoryModal';
import ContentRemovalModal from '../../components/retention/ContentRemovalModal';
import MilestoneCouponCard from '../../components/retention/MilestoneCouponCard';
import { CheckCircle2, MessageSquare, Camera, ShieldCheck, Download, UtensilsCrossed } from 'lucide-react';

const ThankYouScreen = () => {
  const navigate = useNavigate();
  const { activeOrder, clearOrder, customerMemory, saveCustomerMemory, forgetCustomerMemory } = useOrder();
  const { fulfillment: savedFulfillment } = useCustomerSession();
  const fulfillment = activeOrder?.fulfillment || savedFulfillment;
  const { showToast } = useToast();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);

  const [isDiagnosticFeedbackOpen, setIsDiagnosticFeedbackOpen] = useState(false);
  const [isSignatureDishOpen, setIsSignatureDishOpen] = useState(false);
  const [isRemovalModalOpen, setIsRemovalModalOpen] = useState(false);

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const res = await paymentService.downloadReceipt(activeOrder?.orderId || 'INV-5983', activeOrder?.transaction);
      const blob = new Blob([res.data.receiptText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', res.data.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Receipt downloaded to your device!', 'success');
    } catch (err) {
      showToast('Could not download receipt', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleVisitAgain = () => {
    clearOrder();
    navigate('/');
  };

  const totalPaid = activeOrder?.totals?.totalPayable || activeOrder?.totals?.grandTotal || activeOrder?.grandTotal || 262.5;
  const invoiceNumber = deriveInvoiceNumber(activeOrder);

  return (
    <div className="w-full min-h-screen bg-[#FFFDF9] text-[#211917] flex flex-col antialiased">
      {/* 1. Compact Customer Header */}
      <TopAppBar variant="brand" />

      <main
        className="w-full max-w-[640px] mx-auto flex-1 flex flex-col px-4 pt-18 pb-6 space-y-4"
        style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
      >
        {/* 2. Compact Payment-Success Confirmation Card */}
        <section
          aria-label="Payment Confirmation"
          className="w-full p-4 bg-white rounded-2xl border border-[#EADFD6] shadow-sm flex items-center gap-3.5 text-left"
        >
          <div className="w-11 h-11 rounded-full bg-[#E8F8F1] flex items-center justify-center text-[#138A5B] shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold text-[#211917] leading-tight">Payment Successful</h1>
            <p className="text-[23px] font-bold text-[#A30F3B] leading-tight mt-0.5">
              {formatInvoiceAmount(totalPaid)} paid
            </p>
            <p className="text-[12px] text-[#6E5F58] mt-0.5">
              {fulfillment.type === 'DELIVERY' ? 'Delivery' : 'Pickup'} order · Invoice {invoiceNumber}
            </p>
          </div>
        </section>

        {/* 3–5. Coupon Request Progress Card */}
        <MilestoneCouponCard
          activeOrder={activeOrder}
          onOpenPrivacyControls={() => setIsRemovalModalOpen(true)}
        />

        {/* 6. Connected Guest Experience Section */}
        <section aria-label="Connected Guest Experience" className="w-full space-y-3 pt-2 text-left">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="font-bold text-xs text-[#A30F3B] uppercase tracking-wider">
              Connected Guest Experience
            </h2>
            <span className="text-[11px] font-semibold text-[#6E5F58] bg-[#F0E7E0] px-2 py-0.5 rounded-md">
              Optional
            </span>
          </div>

          <div className="space-y-2.5">
            {/* Feedback Card */}
            <div className="p-3.5 bg-white rounded-2xl border border-[#EADFD6] shadow-sm flex items-center justify-between gap-3 min-h-[78px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-[#211917] truncate">Share Useful Feedback</h3>
                  <p className="text-[12px] text-[#6E5F58] leading-tight mt-0.5">
                    Help us improve food, service, speed, cleanliness & value.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDiagnosticFeedbackOpen(true)}
                className="px-3.5 py-1.5 bg-white border border-[#A30F3B] text-[#A30F3B] hover:bg-[#FBECEF] font-bold text-xs rounded-xl shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                Feedback
              </button>
            </div>

            {/* Dish Story Card */}
            <div className="p-3.5 bg-white rounded-2xl border border-[#EADFD6] shadow-sm flex items-center justify-between gap-3 min-h-[78px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#F47712] flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs text-[#211917] truncate">Share a Dish Moment</h3>
                  <p className="text-[12px] text-[#6E5F58] leading-tight mt-0.5">
                    Watch a dish story or share authentic content.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSignatureDishOpen(true)}
                className="px-3.5 py-1.5 bg-white border border-[#F47712] text-[#F47712] hover:bg-[#FFF0E3] font-bold text-xs rounded-xl shadow-2xs transition-colors shrink-0 cursor-pointer"
              >
                Dish Story
              </button>
            </div>

            {/* 7. Privacy & Communication Controls */}
            <div
              onClick={() => setIsRemovalModalOpen(true)}
              className="p-3.5 bg-[#FFF8F1] rounded-xl border border-[#EADFD6] flex items-center justify-between gap-2.5 text-xs min-h-[48px] cursor-pointer hover:bg-[#FFF0E3]/50 transition-colors"
            >
              <div className="flex items-start gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-[#A30F3B] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-bold text-[#211917] text-xs block">Privacy & Communication</span>
                  <span className="text-[#6E5F58] text-[11px] leading-tight block">
                    Review coupon consent, WhatsApp preferences and content permissions.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRemovalModalOpen(true);
                }}
                className="text-[#A30F3B] font-bold text-xs hover:underline shrink-0 px-2 py-1"
              >
                Manage
              </button>
            </div>
          </div>
        </section>

        {/* 8. Receipt Actions */}
        <div className="w-full pt-2">
          <button
            onClick={handleDownloadReceipt}
            disabled={isDownloading}
            className="w-full h-12 bg-white border border-[#EADFD6] text-[#211917] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#FFF8F1] text-xs disabled:opacity-60 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-[#A30F3B]" />
            {isDownloading ? 'Downloading...' : 'Download Receipt'}
          </button>
        </div>

        {/* 9. Visit Again */}
        <div className="w-full flex justify-center pb-2">
          <button
            onClick={handleVisitAgain}
            className="h-11 px-6 text-[#A30F3B] font-bold flex items-center justify-center gap-2 hover:underline text-xs min-h-[44px] cursor-pointer"
          >
            <UtensilsCrossed className="w-4 h-4" />
            Order Again
          </button>
        </div>
      </main>

      {/* Connected Systems Retention Modals */}
      <DiagnosticFeedbackModal
        isOpen={isDiagnosticFeedbackOpen}
        onClose={() => setIsDiagnosticFeedbackOpen(false)}
        order={activeOrder}
      />

      <SignatureDishStoryModal
        isOpen={isSignatureDishOpen}
        onClose={() => setIsSignatureDishOpen(false)}
        dish={{ id: 'biryani-chicken-dum', name: 'Chicken Dum Biryani' }}
      />

      <ContentRemovalModal
        isOpen={isRemovalModalOpen}
        onClose={() => setIsRemovalModalOpen(false)}
      />

      <CustomerPreferencesModal
        isOpen={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
        customerMemory={customerMemory}
        onSaveMemory={saveCustomerMemory}
        onForgetMemory={forgetCustomerMemory}
      />
    </div>
  );
};

export default ThankYouScreen;
