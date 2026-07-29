import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { ISSUE_CATEGORIES } from '../../utils/issueCategories';
import Icon from '../../components/common/Icon';

const ReportIssueScreen = () => {
  const navigate = useNavigate();
  const { activeOrder, submitIssue } = useOrder();
  const { fulfillment: savedFulfillment } = useCustomerSession();
  const fulfillment = activeOrder?.fulfillment || savedFulfillment;
  const { showToast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [affectedItemId, setAffectedItemId] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeItems = activeOrder?.items || [
    { id: 'item-1048-01', name: 'Chicken Dum Biryani' },
    { id: 'item-1048-02', name: 'Sweet Lassi' },
    { id: 'item-1048-03', name: 'Aritaku Bojanam (Veg)' }
  ];

  const handleSubmit = () => {
    if (!selectedCategory) {
      showToast('Please select an issue category', 'error');
      return;
    }

    setIsSubmitting(true);
    const affectedItem = activeItems.find((it) => (it.id || it.dishId) === affectedItemId);

    const createdIssue = submitIssue({
      orderId: activeOrder?.orderId || 'ORD-1048',
      tableNumber: fulfillment.type,
      category: selectedCategory.id,
      categoryLabel: selectedCategory.label,
      affectedItemId: affectedItemId || null,
      affectedItemName: affectedItem?.name || 'General Order',
      description: details
    });

    showToast(`Issue ${createdIssue.issueId} reported to restaurant manager!`, 'success');
    navigate('/report-status');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface shadow-sm h-14 flex items-center px-4 justify-between border-b border-outline-variant/20">
        <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform" aria-label="Go back">
          <Icon name="arrow_back" className="text-primary" />
        </button>
        <h1 className="text-lg font-bold text-primary italic">Service Recovery</h1>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/20">
          Order #{activeOrder?.orderId || 'ORD-1048'}
        </div>
      </header>

      <main className="mt-14 pb-32 pt-6 px-4 flex-1 max-w-xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Something isn’t right?</h2>
          <p className="text-xs text-on-surface-variant mt-1">
            Report an issue with your active order. Staff will take immediate ownership and update your screen with resolution actions.
          </p>
        </div>

        {/* Order Information Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-sm space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Active Order Reference</span>
              <p className="text-xl font-black text-primary">#{activeOrder?.orderId || 'ORD-1048'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Order Type</span>
              <p className="text-xl font-bold text-on-surface">{fulfillment.type === 'DELIVERY' ? 'Delivery' : 'Pickup'}</p>
            </div>
          </div>

          {/* Select Affected Item */}
          <div className="pt-2 border-t border-outline-variant/10">
            <label className="text-xs font-bold text-on-surface block mb-1.5">
              Select Affected Item (Optional)
            </label>
            <select
              value={affectedItemId}
              onChange={(e) => setAffectedItemId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface outline-none focus:border-primary"
            >
              <option value="">-- Entire Order / Not Item Specific --</option>
              {activeItems.map((it) => (
                <option key={it.id || it.dishId} value={it.id || it.dishId}>
                  {it.name} (x{it.quantity || 1})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Issue Categories */}
        <section>
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
            Select Category
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ISSUE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                    isActive
                      ? 'border-primary bg-primary/10 text-on-surface ring-2 ring-primary/20'
                      : 'border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                    <Icon name={cat.icon} className="text-sm" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">{cat.label}</span>
                    <span className="text-[11px] text-on-surface-variant leading-tight block mt-0.5">{cat.explanation}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Input Details */}
        <section className="space-y-2">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
            Additional Details (Optional)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl p-3.5 focus:outline-none focus:border-primary text-xs placeholder:text-on-surface-variant/50"
            placeholder="Describe what went wrong or how you prefer it to be corrected..."
            rows={3}
          />
        </section>
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-md p-4 border-t border-outline-variant/20 flex justify-center z-50">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedCategory}
          className="w-full max-w-xl h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          <span>{isSubmitting ? 'Submitting...' : 'Submit Issue to Staff'}</span>
          <Icon name="send" className="text-base" />
        </button>
      </div>
    </>
  );
};

export default ReportIssueScreen;
