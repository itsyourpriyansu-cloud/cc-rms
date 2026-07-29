import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, CheckCircle2, Clock3, MapPin, Navigation, ShoppingBag } from 'lucide-react';
import DeliveryLocationPicker from '../../components/customer/DeliveryLocationPicker';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { useToast } from '../../context/ToastContext';

const FulfillmentSetupScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { profile, fulfillment, updateFulfillment } = useCustomerSession();
  const [form, setForm] = useState(fulfillment);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);

  const isServiceable = useMemo(() => form.distanceKm <= 12, [form.distanceKm]);

  const updateForm = (updates) => {
    const next = { ...form, ...updates };
    if (updates.location) {
      const latDelta = updates.location.lat - 17.385044;
      const lngDelta = updates.location.lng - 78.486671;
      next.distanceKm = Number((Math.sqrt(latDelta ** 2 + lngDelta ** 2) * 105).toFixed(1));
      next.etaMinutes = Math.max(25, Math.round(20 + next.distanceKm * 4));
    }
    setForm(next);
    setError('');
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Location access is not supported on this device');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateForm({
          location: {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          },
        });
        setLocating(false);
      },
      () => {
        setError('Location access was unavailable. Tap the map to place your delivery pin.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (form.type === 'DELIVERY') {
      if (!form.addressLine.trim()) {
        setError('Enter a complete delivery address');
        return;
      }
      if (!/^\d{6}$/.test(form.pincode)) {
        setError('Enter a valid 6-digit PIN code');
        return;
      }
      if (!isServiceable) {
        setError('This pin is outside our current 12 km delivery area');
        return;
      }
    }
    if (form.slot === 'SCHEDULED' && !form.scheduledFor) {
      setError(`Choose a ${form.type === 'DELIVERY' ? 'delivery' : 'pickup'} time`);
      return;
    }

    updateFulfillment(form);
    showToast(`${form.type === 'DELIVERY' ? 'Delivery' : 'Pickup'} details saved`, 'success');
    navigate('/');
  };

  return (
    <main className="min-h-screen bg-[#FFFDF9] pb-8">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EADFD6]">
        <div className="max-w-[640px] mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#E97818] uppercase tracking-wider">Welcome, {profile?.firstName}</p>
            <h1 className="text-lg font-black text-[#211917]">How should we serve you?</h1>
          </div>
          <Navigation className="w-5 h-5 text-[#A30F3B]" />
        </div>
      </header>

      <form onSubmit={handleSave} className="max-w-[640px] mx-auto px-4 pt-5 space-y-5">
        <section className="grid grid-cols-2 gap-3">
          {[
            { id: 'DELIVERY', label: 'Delivery', detail: 'Track to your door', icon: Bike },
            { id: 'PICKUP', label: 'Self pickup', detail: 'Collect from kitchen', icon: ShoppingBag },
          ].map((option) => {
            const selected = form.type === option.id;
            const OptionIcon = option.icon;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => updateForm({ type: option.id })}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${
                  selected
                    ? 'border-[#A30F3B] bg-[#FBECEF] shadow-sm'
                    : 'border-[#EADFD6] bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected ? 'bg-[#A30F3B] text-white' : 'bg-[#FFF7EE] text-[#705F58]'}`}>
                    <OptionIcon className="w-5 h-5" />
                  </span>
                  {selected && <CheckCircle2 className="w-5 h-5 text-[#A30F3B]" />}
                </div>
                <p className="font-bold text-sm text-[#211917]">{option.label}</p>
                <p className="text-[11px] text-[#705F58] mt-0.5">{option.detail}</p>
              </button>
            );
          })}
        </section>

        {form.type === 'DELIVERY' ? (
          <>
            <DeliveryLocationPicker
              value={form.location}
              onChange={(location) => updateForm({ location })}
              onUseCurrentLocation={useCurrentLocation}
              locating={locating}
            />

            <section className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${isServiceable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div>
                <p className={`text-xs font-bold ${isServiceable ? 'text-emerald-800' : 'text-red-800'}`}>
                  {isServiceable ? 'This location is serviceable' : 'Outside current delivery area'}
                </p>
                <p className="text-[11px] text-[#705F58] mt-0.5">
                  Approx. {form.distanceKm} km from kitchen
                </p>
              </div>
              <span className="font-black text-[#211917]">{form.etaMinutes} min</span>
            </section>

            <section className="bg-white rounded-2xl border border-[#EADFD6] p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#211917] block mb-1">Save address as</label>
                <div className="flex gap-2">
                  {['Home', 'Work', 'Other'].map((label) => (
                    <button
                      type="button"
                      key={label}
                      onClick={() => updateForm({ label })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border ${form.label === label ? 'bg-[#FBECEF] border-[#A30F3B]/30 text-[#A30F3B]' : 'bg-white border-[#EADFD6] text-[#705F58]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="address-line" className="text-xs font-bold text-[#211917] block mb-1">Complete address</label>
                <textarea
                  id="address-line"
                  rows={3}
                  value={form.addressLine}
                  onChange={(event) => updateForm({ addressLine: event.target.value })}
                  placeholder="House/flat, building, street and area"
                  className="w-full rounded-xl border border-[#EADFD6] bg-[#FFFDF9] p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pincode" className="text-xs font-bold text-[#211917] block mb-1">PIN code</label>
                  <input
                    id="pincode"
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={(event) => updateForm({ pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="500001"
                    className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="text-xs font-bold text-[#211917] block mb-1">City</label>
                  <input
                    id="city"
                    value={form.city}
                    onChange={(event) => updateForm({ city: event.target.value })}
                    className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="landmark" className="text-xs font-bold text-[#211917] block mb-1">Landmark (optional)</label>
                <input
                  id="landmark"
                  value={form.landmark}
                  onChange={(event) => updateForm({ landmark: event.target.value })}
                  placeholder="Near metro, gate or well-known place"
                  className="w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
                />
              </div>
            </section>
          </>
        ) : (
          <section className="bg-white rounded-2xl border border-[#EADFD6] p-5">
            <div className="w-11 h-11 rounded-xl bg-[#FBECEF] text-[#A30F3B] flex items-center justify-center mb-3">
              <MapPin className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-[#211917]">Mangamma Ruchulu Cloud Kitchen</h2>
            <p className="text-xs text-[#705F58] mt-1">Central Hyderabad, Telangana</p>
            <p className="mt-3 inline-flex px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold">
              Pickup counter open today
            </p>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-[#EADFD6] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 className="w-4 h-4 text-[#A30F3B]" />
            <h2 className="text-sm font-bold text-[#211917]">
              {form.type === 'DELIVERY' ? 'Delivery time' : 'Pickup time'}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['ASAP', 'SCHEDULED'].map((slot) => (
              <button
                type="button"
                key={slot}
                onClick={() => updateForm({ slot })}
                className={`h-11 rounded-xl border text-xs font-bold ${form.slot === slot ? 'bg-[#FBECEF] border-[#A30F3B]/30 text-[#A30F3B]' : 'bg-[#FFFDF9] border-[#EADFD6] text-[#705F58]'}`}
              >
                {slot === 'ASAP' ? 'As soon as possible' : 'Schedule'}
              </button>
            ))}
          </div>
          {form.slot === 'SCHEDULED' && (
            <input
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(event) => updateForm({ scheduledFor: event.target.value })}
              className="mt-3 w-full h-11 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
            />
          )}
        </section>

        {error && <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

        <PrimaryButton type="submit" icon={Navigation} size="lg">
          Save and explore menu
        </PrimaryButton>
      </form>
    </main>
  );
};

export default FulfillmentSetupScreen;
