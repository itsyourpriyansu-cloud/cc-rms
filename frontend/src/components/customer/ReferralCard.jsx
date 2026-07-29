import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Gift, Share2, Users } from 'lucide-react';

const ReferralCard = ({ firstName, phone, onNotify }) => {
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const referralCode = useMemo(() => {
    const namePart = String(firstName || 'FOOD').replace(/[^a-z]/gi, '').slice(0, 5).toUpperCase();
    return `${namePart || 'FOOD'}${String(phone || '1000').slice(-4)}`;
  }, [firstName, phone]);

  const inviteText = `Try Mangamma Ruchulu with my code ${referralCode}. Get ₹100 off your first order above ₹399.`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteText);
      setCopied(true);
      onNotify?.('Referral code copied', 'success');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      onNotify?.(`Referral code: ${referralCode}`, 'info');
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mangamma Ruchulu invite',
          text: inviteText,
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    copyInvite();
  };

  return (
    <section className="rounded-[24px] overflow-hidden border border-[#E7C8D2] bg-white shadow-sm">
      <div className="bg-gradient-to-br from-[#A30F3B] to-[#7E0D2F] text-white p-5 relative overflow-hidden">
        <div className="absolute -right-10 -top-12 w-36 h-36 rounded-full bg-white/6" />
        <div className="relative flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/12 flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">Share good food</p>
            <h2 className="text-xl font-black mt-1">Give ₹100, get ₹100</h2>
            <p className="text-xs leading-relaxed text-white/75 mt-1">
              Your friend saves on their first order. Your reward unlocks after their order is delivered.
            </p>
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl bg-white/10 border border-white/15 p-2 flex items-center gap-2">
          <div className="flex-1 px-2">
            <p className="text-[9px] uppercase font-bold text-white/60">Your referral code</p>
            <p className="font-black tracking-[0.12em] mt-0.5">{referralCode}</p>
          </div>
          <button
            onClick={copyInvite}
            className="h-10 px-3 rounded-xl bg-white text-[#A30F3B] font-black text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <button
          onClick={shareInvite}
          className="relative mt-3 w-full h-12 rounded-xl bg-[#F47712] text-white font-black flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Share2 className="w-4 h-4" />
          Share invite
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#F47712] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-[#211917]">0 successful referrals</p>
            <p className="text-[11px] text-[#75665F]">Rewards will appear here after qualifying deliveries.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRules((value) => !value)}
          className="w-full mt-3 pt-3 border-t border-[#EFE6DF] flex items-center justify-between text-xs font-black text-[#A30F3B]"
        >
          How referral rewards work
          {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showRules && (
          <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-[#6E5F58] list-disc pl-4">
            <li>Your friend gets ₹100 off their first order of ₹399 or more.</li>
            <li>You receive ₹100 credit after that order is successfully delivered.</li>
            <li>Credits expire after 30 days, cannot be withdrawn as cash, and one reward is allowed per new phone account.</li>
          </ul>
        )}
        <p className="text-[10px] leading-relaxed text-[#95847C] mt-3">
          Demo program rules. Production requires a server-side reward ledger, fraud checks and published referral terms.
        </p>
      </div>
    </section>
  );
};

export default ReferralCard;
