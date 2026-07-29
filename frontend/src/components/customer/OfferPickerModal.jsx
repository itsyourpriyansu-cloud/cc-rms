import React from 'react';
import { BadgePercent, Check, ChevronRight, Gift, Tag, X } from 'lucide-react';
import { formatInvoiceAmount } from '../../utils/formatters';

const OFFERS = [
  {
    code: 'MANGAMMA10',
    title: '10% off your order',
    description: 'Best value on orders above ₹299.',
    minimumOrder: 299,
    discountPercent: 10,
    icon: BadgePercent,
  },
  {
    code: 'BIRYANI10',
    title: '10% off biryanis',
    description: 'Valid when your cart contains a biryani.',
    minimumOrder: 250,
    discountPercent: 10,
    requiresBiryani: true,
    icon: Tag,
  },
  {
    code: 'WELCOME20',
    title: '20% welcome saving',
    description: 'For first orders above ₹499.',
    minimumOrder: 499,
    discountPercent: 20,
    firstOrderOnly: true,
    icon: Gift,
  },
];

const OfferPickerModal = ({
  isOpen,
  onClose,
  onApply,
  subtotal,
  cartItems,
  appliedPromo,
  isFirstOrder,
}) => {
  if (!isOpen) return null;

  const hasBiryani = cartItems.some((item) =>
    `${item.category || ''} ${item.name || ''}`.toLowerCase().includes('biryani')
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close offers" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offers-title"
        className="relative w-full max-w-md max-h-[86vh] overflow-y-auto bg-[#FFFDF9] rounded-t-[28px] sm:rounded-[28px] px-4 pt-4 pb-7 shadow-2xl"
      >
        <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mb-4 sm:hidden" />
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-black tracking-[0.14em] uppercase text-[#F47712]">Save before payment</p>
            <h2 id="offers-title" className="text-2xl font-black text-[#211917] mt-1">Offers for this order</h2>
            <p className="text-sm text-[#6E5F58] mt-1">Only eligible savings can be applied.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close offer selection"
            className="w-10 h-10 rounded-full bg-white border border-[#EADFD6] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {OFFERS.map((offer) => {
            const minimumMet = subtotal >= offer.minimumOrder;
            const categoryMet = !offer.requiresBiryani || hasBiryani;
            const accountMet = !offer.firstOrderOnly || isFirstOrder;
            const eligible = minimumMet && categoryMet && accountMet;
            const isApplied = appliedPromo?.code === offer.code;
            const estimatedSaving = subtotal * (offer.discountPercent / 100);
            const Icon = offer.icon;

            let reason = '';
            if (!minimumMet) {
              reason = `Add ${formatInvoiceAmount(offer.minimumOrder - subtotal)} more to unlock`;
            } else if (!categoryMet) {
              reason = 'Add a biryani to unlock';
            } else if (!accountMet) {
              reason = 'Available only on your first order';
            }

            return (
              <article
                key={offer.code}
                className={`rounded-2xl border p-4 ${
                  isApplied
                    ? 'border-emerald-400 bg-emerald-50'
                    : eligible
                    ? 'border-[#E7C8D2] bg-white'
                    : 'border-[#EADFD6] bg-stone-50 opacity-75'
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-black text-[#211917]">{offer.title}</h3>
                        <p className="text-xs text-[#6E5F58] mt-0.5">{offer.description}</p>
                      </div>
                      <span className="text-[10px] font-black text-[#A30F3B] bg-[#FBECEF] px-2 py-1 rounded-lg">
                        {offer.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3">
                      <p className={`text-xs font-bold ${eligible ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {eligible ? `Save about ${formatInvoiceAmount(estimatedSaving)}` : reason}
                      </p>
                      <button
                        disabled={!eligible || isApplied}
                        onClick={() => onApply(offer.code)}
                        className={`h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1 ${
                          isApplied
                            ? 'bg-emerald-600 text-white'
                            : eligible
                            ? 'bg-[#A30F3B] text-white active:scale-95'
                            : 'bg-stone-200 text-stone-500'
                        }`}
                      >
                        {isApplied ? <Check className="w-4 h-4" /> : null}
                        {isApplied ? 'Applied' : 'Apply'}
                        {eligible && !isApplied ? <ChevronRight className="w-4 h-4" /> : null}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-[11px] leading-relaxed text-[#75665F] mt-5 px-1">
          One offer per order. Discounts apply to eligible food value; taxes and other charges are calculated separately.
        </p>
      </section>
    </div>
  );
};

export default OfferPickerModal;
