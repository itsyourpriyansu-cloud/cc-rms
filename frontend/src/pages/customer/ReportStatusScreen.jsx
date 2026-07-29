import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../context/OrderContext';
import { useToast } from '../../context/ToastContext';
import { REPORT_STAGES } from '../../utils/issueCategories';
import BottomNavBar from '../../components/layout/BottomNavBar';
import Icon from '../../components/common/Icon';

const ReportStatusScreen = () => {
  const navigate = useNavigate();
  const { activeOrder, issuesList, confirmIssueResolution } = useOrder();
  const { showToast } = useToast();

  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Pick active or most recent issue
  const currentIssue = issuesList?.find(
    (iss) => iss.orderId === activeOrder?.orderId
  ) || issuesList?.[0];

  if (!currentIssue) {
    return (
      <>
        <header className="sticky top-0 z-40 bg-surface shadow-sm flex items-center justify-between px-4 h-16 border-b border-outline-variant/20">
          <button onClick={() => navigate('/order-tracking')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant/50">
            <Icon name="arrow_back" className="text-on-surface" />
          </button>
          <h1 className="text-lg font-bold text-primary italic">Service Recovery</h1>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
            {activeOrder ? `Order #${activeOrder.orderId}` : 'Support'}
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-3">
          <Icon name="fact_check" className="text-4xl text-on-surface-variant" />
          <p className="text-on-surface font-semibold text-base">No active issues recorded</p>
          <p className="text-xs text-on-surface-variant max-w-xs">If something isn't right with your food, billing, or service, you can report it to staff anytime.</p>
          <button
            onClick={() => navigate('/report-issue')}
            className="mt-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-xs shadow"
          >
            Report an Issue
          </button>
        </main>
        <BottomNavBar />
      </>
    );
  }

  const handleResolutionChoice = (isResolved) => {
    if (isResolved) {
      setShowFeedbackModal(true);
    } else {
      confirmIssueResolution(currentIssue.issueId, false);
      showToast('Issue marked as not resolved. Support has been asked to follow up.', 'warning');
    }
  };

  const handleSubmitFeedback = () => {
    confirmIssueResolution(currentIssue.issueId, true, {
      rating: feedbackRating,
      comment: feedbackComment
    });
    showToast('Thank you for confirming resolution!', 'success');
    setShowFeedbackModal(false);
  };

  const currentStageIdx = currentIssue.status === 'RESOLVED' || currentIssue.status === 'CLOSED'
    ? 4
    : currentIssue.status === 'WAITING_FOR_CUSTOMER'
    ? 3
    : currentIssue.status === 'ACTION_IN_PROGRESS'
    ? 2
    : currentIssue.status === 'OWNER_ASSIGNED'
    ? 1
    : 0;

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface shadow-sm flex items-center justify-between px-4 h-16 border-b border-outline-variant/20">
        <button onClick={() => navigate('/order-tracking')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant/50">
          <Icon name="arrow_back" className="text-on-surface" />
        </button>
        <h1 className="text-lg font-bold text-primary italic">Issue Status & Recovery</h1>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
          Order #{activeOrder?.orderId || currentIssue.orderId}
        </div>
      </header>

      <main className="flex-1 px-4 pt-6 pb-28 max-w-xl mx-auto w-full space-y-6">
        <section className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">Ticket #{currentIssue.issueId}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Category: <strong>{currentIssue.categoryLabel}</strong></p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            currentIssue.status === 'RESOLVED' || currentIssue.status === 'CLOSED'
              ? 'bg-emerald-500/10 text-emerald-700'
              : 'bg-rose-500/10 text-rose-700'
          }`}>
            {currentIssue.statusLabel || currentIssue.status}
          </span>
        </section>

        {/* Assigned Staff Owner Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Assigned Staff Owner</span>
            <span className="text-[11px] text-on-surface-variant">{currentIssue.acceptedAt ? `Accepted at ${currentIssue.acceptedAt}` : 'Recent'}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center border border-primary/20">
              <Icon name="support_agent" className="text-xl" />
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">{currentIssue.assignedOwner || 'Staff reviewing request'}</p>
              <p className="text-xs text-on-surface-variant">{currentIssue.assignedRole || 'Floor Staff'}</p>
            </div>
          </div>

          {/* Selected Recovery Action */}
          {currentIssue.recoveryAction && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-on-surface space-y-1">
              <span className="font-bold text-primary block">Active Resolution Action:</span>
              <p className="leading-relaxed">{currentIssue.recoveryAction}</p>
            </div>
          )}
        </section>

        {/* Status Workflow Progress */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 space-y-4">
          <h3 className="font-bold text-sm text-on-surface">Resolution Timeline</h3>
          <div className="space-y-4 relative pl-2">
            {REPORT_STAGES.map((stage, idx) => {
              const isCompleted = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;

              return (
                <div key={stage.id} className="flex gap-3 items-start relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-primary text-on-primary ring-2 ring-primary/30'
                      : 'bg-surface-container text-on-surface-variant/50'
                  }`}>
                    {isCompleted ? <Icon name="check" className="text-sm" /> : idx + 1}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>{stage.title}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {isCompleted ? 'Completed' : isCurrent ? 'Active stage' : 'Pending step'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Customer Resolution Confirmation Box */}
        {currentIssue.status !== 'RESOLVED' && currentIssue.status !== 'CLOSED' && (
          <section className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-3 text-amber-950 dark:text-amber-200">
            <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">Has this issue been resolved?</h4>
            <p className="leading-relaxed">
              Support cannot close this complaint without your confirmation. Please confirm whether the resolution is satisfactory.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => handleResolutionChoice(true)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Icon name="check_circle" className="text-base" />
                Yes, resolved
              </button>
              <button
                onClick={() => handleResolutionChoice(false)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Icon name="cancel" className="text-base" />
                Not yet / Reopen
              </button>
            </div>
          </section>
        )}

        {/* Timeline Audit Logs */}
        {currentIssue.timeline?.length > 0 && (
          <section className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/20 space-y-2 text-xs">
            <h4 className="font-bold text-on-surface">Issue Audit History</h4>
            <div className="space-y-1.5 text-[11px] text-on-surface-variant">
              {currentIssue.timeline.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-outline-variant/10 last:border-0">
                  <span>• {item.text}</span>
                  <span className="font-mono text-on-surface-variant/70 shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Resolution Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl p-6 max-w-md w-full space-y-4 text-on-surface shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="font-bold text-lg">How well was this issue handled?</h3>
              <p className="text-xs text-on-surface-variant">Your feedback helps management review staff recovery performance.</p>
            </div>

            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setFeedbackRating(star)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-transform active:scale-95 ${
                    star <= feedbackRating ? 'bg-amber-500/20 text-amber-500 font-bold' : 'bg-surface-container text-on-surface-variant/40'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Optional notes on how staff resolved this issue..."
              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-xs outline-none focus:border-primary"
            />

            <button
              onClick={handleSubmitFeedback}
              className="w-full py-3 bg-primary text-on-primary font-bold text-xs rounded-xl shadow"
            >
              Submit Feedback & Complete Resolution
            </button>
          </div>
        </div>
      )}

      <BottomNavBar />
    </>
  );
};

export default ReportStatusScreen;
