import React from 'react';
import { stockImages } from '../../data/imageManifest';
import { ArrowRight, Sparkles } from 'lucide-react';

/**
 * Compact customer food-discovery hero with refined typography & breathing room.
 */
const MenuDiscoveryHero = ({ firstName = 'there', fulfillmentLabel = 'Delivery', onSeeFavourites }) => {
  const heroDishes = [
    { url: stockImages.traditionalBananaLeafMeal.url, alt: 'Banana leaf meal' },
    { url: stockImages.biryani.url, alt: 'Chicken biryani' },
    { url: stockImages.paneerButterMasala.url, alt: 'Paneer butter masala' },
  ];

  return (
    <section className="px-4 mt-3 mb-7">
      <div className="relative overflow-hidden rounded-[22px] bg-[#FFF7EE] border border-[#EADFD6] p-5 sm:p-6 shadow-xs flex items-center justify-between gap-4 min-h-[165px] sm:min-h-[180px]">
        {/* Left: Text and fulfillment identity */}
        <div className="flex-1 min-w-0 z-10 flex flex-col justify-between py-1">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FBECEF] text-[#A30F3B] text-[11.5px] font-bold tracking-wide border border-[#A30F3B]/15 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A30F3B]" />
              {fulfillmentLabel}
            </div>

            <h1 className="text-[21px] sm:text-[23px] font-bold text-[#211917] leading-tight tracking-tight">
              What would you like, {firstName}?
            </h1>

            <p className="text-[13px] text-[#6F5F58] leading-relaxed mt-2 mb-1 max-w-[250px] sm:max-w-[290px]">
              Traditional favourites, biryanis and curries prepared fresh for your order.
            </p>
          </div>

          {onSeeFavourites && (
            <button
              type="button"
              onClick={onSeeFavourites}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#A30F3B] hover:text-[#7E0D2F] mt-4 group cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F47712]" aria-hidden="true" />
              <span>See favourites</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Right: Food image collage */}
        <div className="relative w-[120px] sm:w-[145px] h-[125px] sm:h-[140px] shrink-0 pointer-events-none select-none" aria-hidden="true">
          {/* Back image */}
          <div className="absolute top-0 right-0 w-[74px] sm:w-[88px] h-[74px] sm:h-[88px] rounded-2xl overflow-hidden shadow-md border-2 border-white transform rotate-6">
            <img src={heroDishes[1].url} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Front image */}
          <div className="absolute bottom-0 left-0 w-[84px] sm:w-[98px] h-[84px] sm:h-[98px] rounded-2xl overflow-hidden shadow-lg border-2 border-white transform -rotate-3">
            <img src={heroDishes[0].url} alt="" className="w-full h-full object-cover" />
          </div>

          {/* Overlay small accent dish badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50px] sm:w-[58px] h-[50px] sm:h-[58px] rounded-full overflow-hidden shadow-xl border-2 border-white">
            <img src={heroDishes[2].url} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MenuDiscoveryHero;
