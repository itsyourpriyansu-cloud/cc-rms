import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, Sparkles, Users } from 'lucide-react';
import { menuService } from '../../services/menuService';
import TopAppBar from '../../components/layout/TopAppBar';
import BottomNavBar from '../../components/layout/BottomNavBar';
import SearchBar from '../../components/menu/SearchBar';
import FoodCard from '../../components/menu/FoodCard';
import CompactDishRow from '../../components/menu/CompactDishRow';
import StickyCartBar from '../../components/menu/StickyCartBar';
import CustomizationModal from '../../components/menu/CustomizationModal';
import RestaurantTrustProfileModal from '../../components/trust/RestaurantTrustProfileModal';
import CustomerPreferencesModal from '../../components/preferences/CustomerPreferencesModal';
import MenuDiscoveryHero from '../../components/menu/MenuDiscoveryHero';
import CompactKitchenStatus from '../../components/menu/CompactKitchenStatus';
import VisualCategoryRail from '../../components/menu/VisualCategoryRail';
import DietaryFilterRail, { QUICK_FILTERS } from '../../components/menu/DietaryFilterRail';
import RecommendedDishRail from '../../components/menu/RecommendedDishRail';
import MenuSectionHeader from '../../components/menu/MenuSectionHeader';
import { MenuSkeletonList, CategorySkeletonRow } from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import Icon from '../../components/common/Icon';
import { DISHES, FAVOURITE_DISH_IDS } from '../../utils/mockData';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';

const MenuScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [customizingDish, setCustomizingDish] = useState(null);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);

  const [isTrustOpen, setIsTrustOpen] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);

  const favouritesRef = useRef(null);

  const { addToCart, totals } = useCart();
  const { kitchenLoad, addAssistanceRequest } = useOrder();
  const { profile, fulfillment, favouriteDishIds } = useCustomerSession();
  const { showToast } = useToast();

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await menuService.getCategories();
        setCategories(res.data || []);
      } catch (err) {
        console.error('Error loading categories', err);
      }
    };
    loadCategories();
  }, []);

  const fetchMenuData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await menuService.getMenu(selectedCategory, searchQuery);
      setDishes(res.data || []);
    } catch (err) {
      setError('Failed to load menu dishes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMenuData();
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (location.state?.focus === 'favourites' && favouritesRef.current) {
      setTimeout(() => favouritesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [location.state]);

  const toggleFilter = (id) => {
    setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const resetFilters = () => setActiveFilters([]);

  const visibleDishes = dishes.filter((d) =>
    activeFilters.every((fid) => QUICK_FILTERS.find((f) => f.id === fid)?.test(d))
  );

  const personalizedDishIds =
    favouriteDishIds.length > 0 ? favouriteDishIds : FAVOURITE_DISH_IDS;
  const favouriteDishes = personalizedDishIds
    .map((id) => DISHES.find((dish) => dish.id === id))
    .filter(Boolean);

  const handleOpenCustomize = (dish) => {
    if (dish.availabilityStatus === 'SOLD_OUT') {
      showToast(`${dish.name} is currently sold out`, 'warning');
      return;
    }
    if (dish.orderableInApp === false) {
      showToast(`${dish.name} is priced at MRP — please contact support`, 'info');
      return;
    }
    setCustomizingDish(dish);
    setIsCustomizationOpen(true);
  };

  const handleAddToCartFromModal = (payload) => {
    const { dish, quantity, formattedModifiers, allergyAlert, specialInstruction, selectedOptions, makeVegan, jainPreparation } = payload;
    addToCart(dish, formattedModifiers, specialInstruction, quantity, { selectedOptions, makeVegan, jainPreparation, allergyAlert });
    showToast(`Added customized ${dish.name} (x${quantity}) to cart`, 'success');
  };

  const showCuratedRecommendations = selectedCategory === 'all' && !searchQuery && activeFilters.length === 0;

  const scrollToFavourites = () => {
    if (favouritesRef.current) {
      favouritesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory) || { id: 'all', name: 'Full Menu' };

  // Bottom padding dynamic clearance so floating nav & cart never obscure content
  const contentPaddingBottom = totals.itemCount > 0
    ? 'calc(200px + env(safe-area-inset-bottom))'
    : 'calc(120px + env(safe-area-inset-bottom))';

  return (
    <>
      <TopAppBar
        variant="brand"
        onOpenTrustProfile={() => setIsTrustOpen(true)}
        onOpenPreferences={() => setIsPrefsOpen(true)}
      />

      <main
        className="customer-page flex-1 max-w-[640px] mx-auto w-full"
        style={{
          paddingTop: 'calc(60px + env(safe-area-inset-top) + 8px)',
          paddingBottom: contentPaddingBottom,
        }}
      >
        {/* 1. Welcome / Discovery Hero */}
        <MenuDiscoveryHero
          firstName={profile?.firstName}
          fulfillmentLabel={fulfillment.type === 'DELIVERY' ? `Delivery to ${fulfillment.label}` : 'Self pickup'}
          onSeeFavourites={scrollToFavourites}
        />

        {location.state?.orderMode && (
          <section className="mx-4 mb-4 rounded-2xl border border-[#E7C8D2] bg-[#FBECEF] p-3 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#A30F3B] text-white flex items-center justify-center">
              {location.state.orderMode === 'GIFT' ? <Heart className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </span>
            <span className="flex-1">
              <span className="text-xs font-black block">
                {location.state.orderMode === 'GIFT' ? 'Gift meal mode' : 'Group cart mode'}
              </span>
              <span className="text-[10px] text-[#705F58] block mt-0.5">
                {location.state.orderMode === 'GIFT'
                  ? 'Choose a suitable dish using the recipient preference you just selected.'
                  : 'Build the shared cart first; invite and split-payment adapters connect at checkout.'}
              </span>
            </span>
          </section>
        )}

        <button
          type="button"
          onClick={() => navigate('/for-you?tab=taste')}
          className="mx-4 mb-4 w-[calc(100%-32px)] rounded-2xl border border-[#EADFD6] bg-white p-3 flex items-center gap-3 text-left shadow-sm"
        >
          <span className="w-10 h-10 rounded-xl bg-[#FFF0E3] text-[#A30F3B] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[10px] uppercase tracking-wider font-black text-[#F47712] block">Taste Graph active</span>
            <span className="text-xs font-black block mt-0.5">
              {(profile?.spicePreference || 'MEDIUM').toLowerCase()} spice • under ₹{profile?.typicalBudget || 350}
            </span>
          </span>
          <span className="text-[10px] font-black text-[#A30F3B]">Tune</span>
        </button>

        {/* 2. Compact Kitchen Status */}
        <CompactKitchenStatus kitchenLoad={kitchenLoad} />

        {/* 3. Search */}
        <section className="px-4 mb-7">
          <SearchBar value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} />
        </section>

        {/* 4. Visual Category Shortcuts Rail */}
        {categories.length === 0 && isLoading ? (
          <CategorySkeletonRow />
        ) : (
          <VisualCategoryRail
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        )}

        {/* 5. Dietary Quick Filters */}
        <DietaryFilterRail
          activeFilters={activeFilters}
          onToggleFilter={toggleFilter}
          onResetFilters={resetFilters}
        />

        {/* 6. Personalized recommendations */}
        {showCuratedRecommendations && favouriteDishes.length > 0 && (
          <RecommendedDishRail
            recommendedDishes={favouriteDishes}
            onCustomize={handleOpenCustomize}
            onViewAll={() => {
              const el = document.getElementById('full-menu-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            favouritesRef={favouritesRef}
          />
        )}

        {/* 7. Selected Category Heading */}
        <div id="full-menu-section">
          <MenuSectionHeader
            selectedCategoryObj={selectedCategoryObj}
            dishCount={visibleDishes.length}
            onOpenTrustProfile={() => setIsTrustOpen(true)}
          />
        </div>

        {/* 8. Full Dish List with Card Variety */}
        {isLoading ? (
          <div className="px-4">
            <MenuSkeletonList count={5} />
          </div>
        ) : error ? (
          <div className="px-4">
            <ErrorState message={error} onRetry={fetchMenuData} />
          </div>
        ) : visibleDishes.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={() => <Icon name="tune" className="text-4xl" />}
              title="No dishes found"
              description={`No dishes match "${searchQuery || selectedCategoryObj.name}". Try clearing search or filters.`}
              actionLabel="Clear Filters"
              onAction={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setActiveFilters([]);
              }}
            />
          </div>
        ) : (
          <section className="px-4 flex flex-col gap-3.5">
            {visibleDishes.map((dish) => {
              // Compact row variant for simple breads or drinks to provide visual variety
              const isSimpleItem = dish.category === 'rotis_breads' || dish.category === 'drinks';
              if (isSimpleItem && !searchQuery) {
                return <CompactDishRow key={dish.id} dish={dish} onCustomize={handleOpenCustomize} />;
              }

              return <FoodCard key={dish.id} dish={dish} onCustomize={handleOpenCustomize} />;
            })}
          </section>
        )}
      </main>

      {/* Modals & Floating Bars */}
      {customizingDish && (
        <CustomizationModal
          isOpen={isCustomizationOpen}
          onClose={() => {
            setIsCustomizationOpen(false);
            setCustomizingDish(null);
          }}
          dish={customizingDish}
          onAddToCart={handleAddToCartFromModal}
        />
      )}

      <RestaurantTrustProfileModal
        isOpen={isTrustOpen}
        onClose={() => setIsTrustOpen(false)}
        onRequestAssistance={(type) => addAssistanceRequest(fulfillment.type, type)}
      />
      <CustomerPreferencesModal isOpen={isPrefsOpen} onClose={() => setIsPrefsOpen(false)} />

      {!isCustomizationOpen && <StickyCartBar />}
      {!isCustomizationOpen && <BottomNavBar />}
    </>
  );
};

export default MenuScreen;
