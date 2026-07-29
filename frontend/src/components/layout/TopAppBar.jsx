import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RESTAURANT_INFO } from '../../utils/mockData';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import Icon from '../common/Icon';
import { Bike, MapPin, ShieldCheck, UtensilsCrossed } from 'lucide-react';

/**
 * Top app bar with Trust Profile and secondary actions.
 * Brand variant features brand identity, trust, order mode, and phone-profile access.
 */
const TopAppBar = ({
  variant = 'brand',
  title,
  onBack,
  rightIcon,
  onRightAction,
  transparent = false,
  onOpenTrustProfile,
  logoSrc,
}) => {
  const navigate = useNavigate();
  const { profile, fulfillment } = useCustomerSession();
  const [logoFailed, setLogoFailed] = useState(false);

  if (variant === 'back') {
    return (
      <header
        className={`fixed top-0 left-0 w-full z-40 h-16 flex items-center justify-between px-4 ${
          transparent ? 'bg-transparent' : 'bg-surface/80 backdrop-blur-md border-b border-[#EADFD6]'
        }`}
      >
        <button
          onClick={onBack || (() => navigate(-1))}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/90 hover:bg-white active:scale-95 transition-all shadow-sm cursor-pointer"
          aria-label="Go back"
        >
          <Icon name="arrow_back" className="text-on-surface" />
        </button>
        <span className="font-bold text-lg tracking-tight text-primary truncate max-w-[45%]">
          {title || RESTAURANT_INFO.name}
        </span>
        <div className="flex items-center gap-2">
          {onOpenTrustProfile && (
            <button
              onClick={onOpenTrustProfile}
              className="px-2.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-primary flex items-center gap-1 transition-colors cursor-pointer"
              title="About Our Kitchen"
            >
              <Icon name="info" className="text-sm" />
              <span className="hidden sm:inline">About Kitchen</span>
            </button>
          )}
          {rightIcon ? (
            <button
              onClick={onRightAction}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/90 hover:bg-white active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <Icon name={rightIcon} className="text-on-surface" />
            </button>
          ) : (
            <span className="w-2" />
          )}
        </div>
      </header>
    );
  }

  /* ── Brand variant (welcome screen header) ── */
  return (
    <header
      className="fixed top-0 left-0 w-full z-40 bg-white/95 backdrop-blur-md border-b border-[#EADFD6]"
      style={{ height: 'calc(58px + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-[640px] mx-auto w-full h-full flex items-center justify-between px-4 gap-2">
        {/* Brand identity — valid logo or clean Lucide restaurant fallback */}
        <div
          className="flex items-center gap-2 cursor-pointer min-w-0 flex-1"
          onClick={() => navigate('/')}
          role="link"
          aria-label="Go to welcome screen"
        >
          {logoSrc && !logoFailed ? (
            <img
              src={logoSrc}
              alt=""
              aria-hidden="true"
              onError={() => setLogoFailed(true)}
              className="shrink-0 rounded-full object-contain"
              style={{ width: '32px', height: '32px' }}
            />
          ) : (
            <div
              className="shrink-0 w-8 h-8 rounded-full bg-[#A30F3B] text-white flex items-center justify-center shadow-xs"
              aria-hidden="true"
            >
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          )}
          <span className="text-[17px] leading-tight font-bold text-[#A30F3B] tracking-tight truncate min-w-0">
            {RESTAURANT_INFO.name}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Shield / trust button — 44×44px circular warm-neutral surface */}
          {onOpenTrustProfile && (
            <button
              onClick={onOpenTrustProfile}
              className="hidden min-[430px]:flex w-[44px] h-[44px] rounded-full bg-[#FFF7EE] hover:bg-[#FFF0E3] active:scale-95 border border-[#EADFD6] text-[#A30F3B] items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A30F3B] focus-visible:ring-offset-2 cursor-pointer"
              aria-label="Open restaurant trust and safety information"
            >
              <ShieldCheck className="w-5 h-5 text-[#A30F3B]" aria-hidden="true" />
            </button>
          )}

          {/* Delivery or pickup mode */}
          <button
            type="button"
            onClick={() => navigate('/delivery-details')}
            className="h-[44px] px-3 rounded-full bg-[#FBECEF] text-[#A30F3B] text-[12px] font-bold border border-[#A30F3B]/20 shrink-0 flex items-center justify-center gap-1.5"
            aria-label={`Order method: ${fulfillment.type === 'DELIVERY' ? 'Delivery' : 'Pickup'}`}
          >
            {fulfillment.type === 'DELIVERY' ? <Bike className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
            <span className="hidden min-[390px]:inline">
              {fulfillment.type === 'DELIVERY' ? 'Delivery' : 'Pickup'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/account')}
            className="w-[44px] h-[44px] rounded-full bg-[#A30F3B] text-white flex items-center justify-center font-black text-sm border border-[#7E0D2F] shadow-sm"
            aria-label="Open customer account"
          >
            {(profile?.firstName || 'G').charAt(0).toUpperCase()}
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopAppBar;
