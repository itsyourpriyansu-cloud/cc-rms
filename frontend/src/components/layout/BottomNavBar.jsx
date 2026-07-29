import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, ShoppingBag, ReceiptText, UserRound } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';

const navTheme = {
  surface: '#FFFFFF',
  surfaceWarm: '#FFFDF9',

  maroon: '#A30F3B',
  maroonDark: '#7E0D2F',
  maroonSoft: '#FBECEF',

  textPrimary: '#211917',
  textSecondary: '#75665F',
  textMuted: '#9A8C85',

  border: '#EADFD6',
  shadow: 'rgba(57, 34, 24, 0.14)',
};

const NAV_ITEMS = [
  { label: 'Menu', path: '/menu', icon: BookOpen },
  { label: 'Cart', path: '/cart', icon: ShoppingBag },
  { label: 'Orders', path: '/order-tracking', icon: ReceiptText },
  { label: 'Account', path: '/account', icon: UserRound },
];

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totals } = useCart();
  const { activeOrder } = useOrder();

  return (
    <nav
      aria-label="Customer navigation"
      className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-20px)] sm:w-[calc(100%-32px)] max-w-[520px] rounded-[24px] p-[8px_10px] flex items-center select-none pointer-events-auto transition-all duration-200"
      style={{
        bottom: 'calc(12px + env(safe-area-inset-bottom))',
        minHeight: '70px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid rgba(225, 212, 201, 0.95)',
        boxShadow: '0 14px 38px rgba(57, 34, 24, 0.16), 0 3px 10px rgba(57, 34, 24, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="grid grid-cols-4 items-center gap-1.5 w-full h-full">
        {NAV_ITEMS.map((item) => {
          const IconComponent = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path === '/menu' && location.pathname.startsWith('/menu/')) ||
            (item.path === '/order-tracking' && location.pathname === '/order-confirmation');

          const cartBadge = item.path === '/cart' ? (totals?.itemCount || 0) : 0;
          const hasActiveOrder = item.path === '/order-tracking' && !!activeOrder;

          let ariaLabel = item.label;
          if (item.path === '/cart' && cartBadge > 0) {
            ariaLabel = `Cart, ${cartBadge} ${cartBadge === 1 ? 'item' : 'items'}`;
          } else if (item.path === '/order-tracking' && hasActiveOrder) {
            ariaLabel = 'Orders, active order in progress';
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={ariaLabel}
              className={`relative min-h-[54px] w-full rounded-[18px] flex flex-col items-center justify-center gap-[4px] py-1 transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[#A30F3B] focus-visible:outline-offset-2 ${
                isActive
                  ? 'bg-[#FBECEF] text-[#A30F3B] border border-[#A30F3B]/20 shadow-xs'
                  : 'bg-transparent text-[#6B5C55] border border-transparent hover:text-[#211917] hover:bg-[#F9F6F3]/60'
              }`}
            >
              <span className="relative flex items-center justify-center">
                <IconComponent
                  size={22}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className="transition-colors duration-150"
                  aria-hidden="true"
                />
                {cartBadge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-[5px] rounded-full flex items-center justify-center text-[10.5px] font-bold text-white leading-none shadow-sm pointer-events-none"
                    style={{ backgroundColor: navTheme.maroon }}
                  >
                    {cartBadge > 9 ? '9+' : cartBadge}
                  </span>
                )}
                {hasActiveOrder && cartBadge === 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white animate-pulse pointer-events-none"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                className={`text-[11.5px] sm:text-[12px] leading-none tracking-tight whitespace-nowrap ${
                  isActive ? 'text-[#A30F3B] font-bold' : 'text-[#6B5C55] font-semibold'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavBar;
