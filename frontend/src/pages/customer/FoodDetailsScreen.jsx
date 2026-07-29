import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { menuService } from '../../services/menuService';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';
import { formatMenuPrice } from '../../utils/formatters';
import ResponsiveImage from '../../components/common/ResponsiveImage';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ErrorState from '../../components/common/ErrorState';
import CustomizationModal from '../../components/menu/CustomizationModal';
import RestaurantTrustProfileModal from '../../components/trust/RestaurantTrustProfileModal';
import SignatureDishStoryModal from '../../components/retention/SignatureDishStoryModal';
import biryaniVideo from '../../assets/no_have_no_images.mp4';
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  Plus,
  BookOpen,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  Heart,
  Clock,
  Flame,
  CheckCircle2,
  Utensils,
  Leaf,
  PackageCheck
} from 'lucide-react';

const dishDetailsTheme = {
  background: '#FFFDF9',
  surface: '#FFFFFF',
  surfaceWarm: '#FFF8F1',

  maroon: '#A30F3B',
  maroonDark: '#7E0D2F',
  maroonSoft: '#FBECEF',

  orange: '#F47712',
  orangeDark: '#DB5F05',
  orangeSoft: '#FFF0E3',

  amber: '#B96B08',
  amberSoft: '#FFF5E3',

  green: '#238653',
  greenSoft: '#EAF7EF',

  red: '#C93650',
  redSoft: '#FDECEF',

  textPrimary: '#211917',
  textSecondary: '#6E5F58',
  textMuted: '#93847D',

  border: '#EADFD6',
  divider: '#EFE6DF',
};

/**
 * Returns exact items/components included in the serving for customer UX clarity.
 */
const getDishInclusions = (dish) => {
  if (!dish) return [];
  const cat = dish.category || '';
  const name = (dish.name || '').toLowerCase();

  if (cat === 'biryanis' || name.includes('biryani')) {
    return [
      { name: 'Basmati Dum Rice', detail: 'Fragrant dum-cooked rice', icon: '🍚' },
      { name: name.includes('veg') ? 'Paneer & Vegetables' : name.includes('egg') ? 'Spiced Boiled Eggs' : 'Spiced Chicken Pieces', detail: 'Signature marinade & rich gravy', icon: '🍗' },
      { name: 'Mirchi Ka Salan', detail: 'Authentic house peanut-sesame gravy', icon: '🥣' },
      { name: 'Onion Raita', detail: 'Cooling spiced yoghurt & fresh onion', icon: '🥛' },
      { name: 'Herbal Garnish', detail: 'Fresh mint, coriander & lemon wedge', icon: '🍋' },
    ];
  }

  if (cat === 'meals' || name.includes('bojanam') || name.includes('meal')) {
    return [
      { name: 'Steamed Rice', detail: 'Unlimited traditional aromatic rice', icon: '🍚' },
      { name: 'Dal, Sambar & Rasam', detail: 'Home-style lentil & tangy soups', icon: '🍲' },
      { name: 'Special Curries & Vepudu', detail: name.includes('non-veg') ? 'Mutton curry & Chicken fry' : 'Seasonal regional vegetable curries', icon: '🥘' },
      { name: 'Condiments', detail: 'Homemade pickle, podi & pure ghee', icon: '🌶️' },
      { name: 'Dessert & Curd', detail: 'Traditional sweet & fresh thick curd', icon: '🍨' },
    ];
  }

  if (cat.includes('starters')) {
    return [
      { name: 'Full Starter Portion', detail: 'Prepared fresh to order with house spices', icon: '🔥' },
      { name: 'Mint Chutney', detail: 'Signature spiced coriander-mint dip', icon: '🥣' },
      { name: 'Fresh Salad Garnish', detail: 'Sliced ring onions & lemon wedge', icon: '🧅' },
    ];
  }

  if (cat.includes('soups')) {
    return [
      { name: 'Hot Soup Bowl', detail: 'Freshly brewed aromatic soup', icon: '🥣' },
      { name: 'Crispy Noodles', detail: 'Crunchy fried noodle topping', icon: '🥢' },
    ];
  }

  if (cat.includes('curries') || cat.includes('main_course')) {
    return [
      { name: 'Curry / Gravy Portion', detail: 'Slow-cooked rich gravy portion', icon: '🥘' },
      { name: 'Herb Garnish', detail: 'Fresh cilantro, ginger juliennes & ghee', icon: '🌿' },
    ];
  }

  if (cat.includes('rotis') || cat.includes('breads')) {
    return [
      { name: 'Clay-Oven Indian Bread', detail: 'Baked fresh in tandoor oven', icon: '🫓' },
      { name: 'Desi Ghee Glaze', detail: 'Brushed with pure ghee/butter', icon: '🧈' },
    ];
  }

  if (cat === 'desserts') {
    return [
      { name: 'Dessert Portion', detail: dish.portionLabel || 'Freshly prepared dessert', icon: '🍨' },
      { name: 'Nut Garnish', detail: 'Pistachio & cardamom dusting', icon: '🌰' },
    ];
  }

  if (cat === 'drinks') {
    return [
      { name: 'Chilled Drink Portion', detail: 'Served ice-cold with fresh mint/lime', icon: '🍹' },
    ];
  }

  return [
    { name: 'Full Dish Portion', detail: 'Prepared fresh with signature spices', icon: '🍽️' },
    { name: 'House Dips & Salad', detail: 'Complimentary condiments', icon: '🥗' },
  ];
};

const FoodDetailsScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { fulfillment, favouriteDishIds, toggleFavouriteDish } = useCustomerSession();
  const { kitchenLoad, addAssistanceRequest } = useOrder();
  const { showToast } = useToast();

  const [dish, setDish] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isTrustOpen, setIsTrustOpen] = useState(false);
  const [isAllergyExpanded, setIsAllergyExpanded] = useState(false);
  const isFavourite = favouriteDishIds.includes(id);

  useEffect(() => {
    const loadDish = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await menuService.getDishById(id);
        setDish(res.data);
      } catch (err) {
        setError('Dish details could not be found.');
      } finally {
        setIsLoading(false);
      }
    };
    loadDish();
  }, [id]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !dish) return <ErrorState message={error} onRetry={() => navigate('/menu')} />;

  const isAvailable = dish.availabilityStatus === 'AVAILABLE' || dish.availabilityStatus === 'LIMITED_AVAILABILITY';
  const isOrderable = dish.orderableInApp !== false;
  const prepTimeMin = dish.preparationTimeMinutes || 15;
  const isDelayedDish = prepTimeMin >= 30 || kitchenLoad?.status === 'BUSY' || kitchenLoad?.status === 'VERY_BUSY';

  const handleAddToCartFromModal = (payload) => {
    const { dish: d, quantity, formattedModifiers, allergyAlert, specialInstruction, selectedOptions, makeVegan, jainPreparation } = payload;
    addToCart(d, formattedModifiers, specialInstruction, quantity, { selectedOptions, makeVegan, jainPreparation, allergyAlert });
    showToast(`Added ${d.name} (x${quantity}) to cart`, 'success');
    navigate('/menu');
  };

  const handleDirectAddToCart = () => {
    addToCart(dish);
    showToast(`Added "${dish.name}" to cart`, 'success');
    navigate('/menu');
  };

  const handleAddPairing = (pairing) => {
    const pairingDish = {
      id: pairing.itemId || `pairing-${Date.now()}`,
      name: pairing.name,
      price: pairing.price,
      image: pairing.image || dish.image,
      customizationAvailable: false,
    };
    addToCart(pairingDish);
    showToast(`Added pairing "${pairing.name}" to cart`, 'success');
  };

  const handleToggleFavourite = () => {
    const nextIsFavourite = toggleFavouriteDish(dish.id);
    showToast(
      nextIsFavourite ? `${dish.name} saved to favourites` : `${dish.name} removed from favourites`,
      nextIsFavourite ? 'success' : 'info'
    );
  };

  const isChickenDumBiryani = dish && (
    dish.id === 'biryani-chicken-dum' ||
    (dish.name && dish.name.toLowerCase().includes('chicken dum biryani'))
  );

  return (
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col font-sans selection:bg-[#FFF0E3] selection:text-[#A30F3B]">
      <main className="flex-1 pb-36 max-w-2xl mx-auto w-full relative">
        {/* 1. Hero Food Photography / Video Section */}
        <section className="relative w-full h-[40vh] sm:h-[46vh] min-h-[260px] max-h-[420px] bg-stone-900 overflow-hidden">
          {isChickenDumBiryani ? (
            <div className="relative w-full h-full">
              <video
                src={biryaniVideo}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />
            </div>
          ) : (
            <ResponsiveImage
              src={dish.image}
              alt={dish.name}
              aspectRatio={undefined}
              rounded="rounded-none"
              fetchPriority="high"
              className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
              overlay={
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              }
            />
          )}

          {/* Glassmorphic Action Header */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-md hover:bg-white active:scale-95 transition-all shadow-md border border-white/40 text-[#211917]"
            >
              <ArrowLeft className="w-5 h-5 text-[#211917]" />
            </button>
            <button
              onClick={handleToggleFavourite}
              aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={isFavourite}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-md hover:bg-white active:scale-95 transition-all shadow-md border border-white/40 text-[#211917]"
            >
              <Heart className={`w-5 h-5 transition-colors ${isFavourite ? 'fill-[#C93650] text-[#C93650]' : 'text-[#211917]'}`} />
            </button>
          </div>
        </section>

        {/* 2. Main Content Card with Smooth Overlap */}
        <article className="-mt-6 rounded-t-3xl relative z-10 bg-[#FFFFFF] px-5 pt-6 pb-6 shadow-sm border-t border-[#EADFD6] space-y-6">
          {/* Header Title, Portion Badge & Price Block */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFF8F1] border border-[#FBECEF] text-[#A30F3B] text-[11px] font-bold tracking-wide uppercase">
                {dish.portionLabel || 'Regular'}
              </span>

              {/* Availability Tag */}
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isAvailable ? 'text-[#238653]' : 'text-[#C93650]'}`}>
                <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-[#238653] animate-pulse' : 'bg-[#C93650]'}`} />
                {dish.availabilityStatus === 'AVAILABLE'
                  ? 'Available Now'
                  : dish.availabilityStatus === 'LIMITED_AVAILABILITY'
                  ? 'Limited Portions Left'
                  : 'Sold Out Today'}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl sm:text-3xl font-black text-[#211917] tracking-tight leading-tight flex-1">
                {dish.name}
              </h1>
              <div className="text-2xl sm:text-3xl font-black text-[#A30F3B] whitespace-nowrap pt-0.5">
                {dish.priceDisplay || formatMenuPrice(dish.price)}
              </div>
            </div>
          </div>

          {/* Fast Decision Attribute Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            {/* Dietary Badge */}
            {dish.foodType === 'VEGETARIAN' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF7EF] border border-[#238653]/30 text-[#238653] text-xs font-bold">
                <span className="w-2.5 h-2.5 border-2 border-[#238653] p-0.5 flex items-center justify-center rounded-sm">
                  <span className="w-1.5 h-1.5 bg-[#238653] rounded-full" />
                </span>
                Vegetarian
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDECEF] border border-[#C93650]/30 text-[#C93650] text-xs font-bold">
                <span className="w-2.5 h-2.5 border-2 border-[#C93650] p-0.5 flex items-center justify-center rounded-sm">
                  <span className="w-1.5 h-1.5 bg-[#C93650] rounded-full" />
                </span>
                Non-Vegetarian
              </span>
            )}

            {/* Spice Level */}
            {dish.spiceLevel && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFF0E3] border border-[#F47712]/30 text-[#DB5F05] text-xs font-bold">
                <Flame className="w-3.5 h-3.5 text-[#F47712]" />
                {dish.spiceLevel === 'MEDIUM' ? 'Medium Spice' : dish.spiceLevel === 'SPICY' ? 'Spicy' : 'Mild'}
              </span>
            )}

            {/* Prep Time Estimate */}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFF5E3] border border-[#B96B08]/30 text-[#B96B08] text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-[#B96B08]" />
              {prepTimeMin}–{prepTimeMin + 5} min prep
            </span>

            {/* Portion / Serves */}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#FFF8F1] border border-[#EADFD6] text-[#6E5F58] text-xs font-medium">
              <Utensils className="w-3.5 h-3.5 text-[#93847D]" />
              Serves {dish.serves || '1 person'}
            </span>
          </div>

          {/* Mangamma Favourite Highlight Card */}
          {dish.bestseller && (
            <div className="p-3.5 rounded-2xl bg-[#FFF8F1] border border-[#FBECEF] flex items-start gap-3 shadow-xs">
              <div className="p-2 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#A30F3B] uppercase tracking-wider block">
                  Mangamma Favourite
                </span>
                <p className="text-xs text-[#6E5F58] font-medium leading-relaxed mt-0.5">
                  {dish.bestsellerReason || 'Our most-loved biryani upgrade'}
                </p>
              </div>
            </div>
          )}

          {/* What's Included With This Order Section */}
          {(() => {
            const inclusions = getDishInclusions(dish);
            if (!inclusions || inclusions.length === 0) return null;
            return (
              <div className="rounded-2xl border border-[#EADFD6] bg-[#FFF8F1] p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#A30F3B] text-white">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#211917] text-xs uppercase tracking-wider">
                        What's Included With This Order
                      </h3>
                      <p className="text-[11px] text-[#93847D] mt-0.5">
                        Everything served in your portion
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#EAF7EF] text-[#238653] border border-[#238653]/30">
                    Complete Meal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {inclusions.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FFFFFF] border border-[#EFE6DF] shadow-2xs hover:border-[#F47712]/30 transition-colors"
                    >
                      <span className="text-lg leading-none mt-0.5 flex-shrink-0">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-[#211917] block truncate">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-[#6E5F58] leading-tight block">
                          {item.detail}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Kitchen Volume / Long Preparation Alert */}
          {isDelayedDish && (
            <div className="p-4 rounded-2xl bg-[#FFF5E3] border border-[#B96B08]/30 text-[#211917] space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#B96B08]">
                <AlertTriangle className="w-4 h-4 text-[#B96B08]" />
                <span>Longer preparation time</span>
              </div>
              <p className="text-xs leading-relaxed text-[#6E5F58]">
                This item currently takes approximately <strong>{prepTimeMin}–{prepTimeMin + 5} minutes</strong> due to kitchen volume. Other items in your order may be ready earlier.
              </p>
            </div>
          )}

          {/* Appetizing Dish Description */}
          <div className="py-1">
            <p className="text-[#342722] text-sm leading-relaxed font-normal">
              {dish.shortDescription || dish.description}
            </p>
          </div>

          {/* Special Dietary Options Pills */}
          {(dish.jainAvailable || dish.veganAvailable) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {dish.jainAvailable && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EAF7EF] border border-[#238653]/25 text-[#238653] text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Jain option available on request
                </span>
              )}
              {dish.veganAvailable && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EAF7EF] border border-[#238653]/25 text-[#238653] text-xs font-medium">
                  <Leaf className="w-3.5 h-3.5" />
                  Vegan customizable
                </span>
              )}
            </div>
          )}

          <div className="border-t border-[#EFE6DF] pt-4 space-y-3">
            {/* Progressive Disclosure 1: Allergens & Safety Policy Accordion */}
            <div className="rounded-2xl border border-[#EADFD6] bg-[#FFFFFF] overflow-hidden transition-all shadow-xs">
              <button
                type="button"
                onClick={() => setIsAllergyExpanded((v) => !v)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-[#FFF8F1] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#FBECEF] text-[#A30F3B]">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#211917] text-xs uppercase tracking-wider">
                      Allergens & Kitchen Safety Policy
                    </h3>
                    <p className="text-xs text-[#93847D] mt-0.5">
                      {dish.glutenStatus || 'Gluten-Free Recipe'} • {dish.allergens?.length > 0 ? dish.allergens.join(', ') : 'No Allergens Listed'}
                    </p>
                  </div>
                </div>
                {isAllergyExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#A30F3B] transform rotate-180 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#93847D]" />
                )}
              </button>

              {isAllergyExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-[#EFE6DF] bg-[#FFF8F1]/50 space-y-3 text-xs">
                  <div className="flex flex-col gap-1 text-[#6E5F58] pt-2">
                    <p><strong>Gluten Status:</strong> {dish.glutenStatus || 'Gluten-Free Recipe'}</p>
                    <p><strong>Allergens Present:</strong> {dish.allergens?.length > 0 ? dish.allergens.join(', ') : 'None listed'}</p>
                  </div>
                  <div className="p-3 bg-[#FFFFFF] rounded-xl text-[#6E5F58] border border-[#EADFD6] leading-relaxed">
                    Allergy requests are reviewed by the kitchen before the order is accepted. Cross-contact may still be possible in a shared commercial kitchen.
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setIsTrustOpen(true)}
                      className="text-xs font-bold text-[#A30F3B] hover:underline"
                    >
                      Read Kitchen Policy
                    </button>
                    <button
                      type="button"
                      onClick={() => addAssistanceRequest(fulfillment.type, 'Allergy assistance')}
                      className="text-xs font-bold text-[#A30F3B] hover:underline"
                    >
                      Speak to staff about an allergy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Progressive Disclosure 2: Story of this Dish Button Row */}
            <button
              type="button"
              onClick={() => setShowStoryModal(true)}
              className="w-full p-4 rounded-2xl border border-[#EADFD6] bg-[#FFF8F1] hover:bg-[#FBECEF]/60 text-[#211917] font-bold text-xs flex items-center justify-between transition-colors shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#FBECEF] text-[#A30F3B]">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[#211917]">Story of this dish</span>
                  <span className="text-[11px] font-normal text-[#93847D]">Discover the traditional heritage & secret spices</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#A30F3B]" />
            </button>
          </div>

          {/* Recommended Pairings Section */}
          {dish.recommendedPairings && dish.recommendedPairings.length > 0 && (
            <div className="pt-2 border-t border-[#EFE6DF]">
              <h3 className="font-bold text-[#93847D] text-xs uppercase tracking-wider mb-3">
                Pairs well with
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dish.recommendedPairings.map((pairing) => (
                  <div
                    key={pairing.itemId || pairing.name}
                    className="flex items-center justify-between p-3 rounded-2xl border border-[#EADFD6] bg-[#FFFFFF] shadow-xs hover:border-[#F47712]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {pairing.image && (
                        <img src={pairing.image} alt={pairing.name} className="w-12 h-12 object-cover rounded-xl border border-[#EFE6DF]" />
                      )}
                      <div>
                        <h4 className="font-bold text-xs text-[#211917]">{pairing.name}</h4>
                        <span className="text-xs text-[#A30F3B] font-bold">{formatMenuPrice(pairing.price)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddPairing(pairing)}
                      className="px-3 py-1.5 rounded-xl bg-[#FFF0E3] hover:bg-[#F47712] text-[#F47712] hover:text-white font-bold text-xs flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isOrderable && (
            <div className="p-3 rounded-xl bg-[#FFF5E3] border border-[#B96B08]/30 text-xs text-[#B96B08]">
              This item is priced at MRP and isn't orderable through the app — please contact support.
            </div>
          )}
        </article>
      </main>

      {/* Modals */}
      {showStoryModal && <SignatureDishStoryModal isOpen={showStoryModal} onClose={() => setShowStoryModal(false)} dish={dish} />}

      <RestaurantTrustProfileModal
        isOpen={isTrustOpen}
        onClose={() => setIsTrustOpen(false)}
        onRequestAssistance={(type) => addAssistanceRequest(fulfillment.type, type)}
      />

      {/* Sticky Call-To-Action Footer */}
      {!isCustomizationOpen && (
        <footer
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#EFE6DF] px-4 pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-[#93847D] uppercase font-bold tracking-wider block">
                Total Price
              </span>
              <div className="text-xl sm:text-2xl font-black text-[#211917]">
                {dish.priceDisplay || formatMenuPrice(dish.price)}
              </div>
            </div>

            {!isOrderable ? (
              <button disabled className="flex-1 py-3.5 px-6 bg-[#EADFD6] text-[#93847D] font-bold rounded-xl text-sm cursor-not-allowed">
                Ask Your Server
              </button>
            ) : dish.customizationAvailable ? (
              <button
                onClick={() => setIsCustomizationOpen(true)}
                disabled={!isAvailable}
                className="flex-1 py-3.5 px-6 bg-[#F47712] hover:bg-[#DB5F05] active:scale-[0.98] disabled:bg-[#EADFD6] disabled:text-[#93847D] text-white font-bold rounded-xl transition-all shadow-md shadow-[#F47712]/20 flex items-center justify-center gap-2 text-sm"
              >
                <span>Customize & Add</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleDirectAddToCart}
                disabled={!isAvailable}
                className="flex-1 py-3.5 px-6 bg-[#F47712] hover:bg-[#DB5F05] active:scale-[0.98] disabled:bg-[#EADFD6] disabled:text-[#93847D] text-white font-bold rounded-xl transition-all shadow-md shadow-[#F47712]/20 flex items-center justify-center gap-2 text-sm"
              >
                <span>Add to Order</span>
              </button>
            )}
          </div>
        </footer>
      )}

      {isCustomizationOpen && (
        <CustomizationModal isOpen={isCustomizationOpen} onClose={() => setIsCustomizationOpen(false)} dish={dish} onAddToCart={handleAddToCartFromModal} />
      )}
    </div>
  );
};

export default FoodDetailsScreen;
