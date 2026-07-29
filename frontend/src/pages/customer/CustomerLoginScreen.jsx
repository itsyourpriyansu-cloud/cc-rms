import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, UtensilsCrossed } from 'lucide-react';
import PhoneNumberField from '../../components/common/PhoneNumberField';
import PrimaryButton from '../../components/common/PrimaryButton';
import { useCustomerSession } from '../../context/CustomerSessionContext';
import { CUSTOMER_DEMO_OTP } from '../../services/customerAuthService';
import { parseIndianMobile } from '../../utils/whatsapp';
import { validateFirstName } from '../../utils/guestFieldValidation';
import { restaurantConfig } from '../../config/restaurantConfig';

const CustomerLoginScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestOtp, verifyOtp } = useCustomerSession();
  const [step, setStep] = useState('PHONE');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequest, setOtpRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (event) => {
    event.preventDefault();
    const parsed = parseIndianMobile(phone);
    if (!parsed.isValid) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await requestOtp(parsed.digits10);
      setOtpRequest(response.data);
      setStep('OTP');
    } catch (requestError) {
      setError(requestError.message || 'Unable to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    const nameError = validateFirstName(firstName);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await verifyOtp({
        phone: otpRequest.phone,
        otp,
        requestId: otpRequest.requestId,
        firstName,
      });
      const requestedRoute = location.state?.from;
      navigate(requestedRoute && requestedRoute !== '/' ? requestedRoute : '/delivery-details', {
        replace: true,
      });
    } catch (verificationError) {
      setError(verificationError.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFFDF9] flex flex-col">
      <div className="h-2 bg-gradient-to-r from-[#8D1230] via-[#E97818] to-[#8D1230]" />
      <div className="w-full max-w-md mx-auto flex-1 px-5 py-8 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 rounded-full bg-[#A30F3B] text-white flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E97818]">
              Delivery kitchen
            </p>
            <h1 className="text-xl font-black text-[#A30F3B]">{restaurantConfig.name}</h1>
          </div>
        </div>

        <section className="mb-7">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBECEF] text-[#A30F3B] text-[11px] font-bold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Phone-only secure access
          </span>
          <h2 className="text-[30px] leading-[1.12] font-black tracking-tight text-[#211917]">
            Your favourites,
            <br />
            address and orders.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#705F58]">
            Sign in with your mobile number to get a faster, personalized ordering experience.
          </p>
        </section>

        <form
          onSubmit={step === 'PHONE' ? handleSendOtp : handleVerifyOtp}
          className="bg-white rounded-[24px] border border-[#EADFD6] shadow-[0_16px_45px_rgba(57,34,24,0.10)] p-5 space-y-4"
        >
          {step === 'PHONE' ? (
            <>
              <div>
                <h3 className="font-bold text-[#211917]">Continue with your phone</h3>
                <p className="text-xs text-[#705F58] mt-1">We will send a one-time password.</p>
              </div>
              <PhoneNumberField
                id="customer-phone"
                value={phone}
                onChange={(value) => {
                  setPhone(value);
                  setError('');
                }}
                error={error}
                label="Mobile number"
              />
              <PrimaryButton type="submit" isLoading={loading} icon={ArrowRight}>
                Send OTP
              </PrimaryButton>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#211917]">Verify +91 {otpRequest.phone}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('PHONE');
                      setOtp('');
                      setError('');
                    }}
                    className="text-xs font-bold text-[#A30F3B] mt-0.5"
                  >
                    Change number
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="customer-name" className="font-bold text-[#211917] text-xs block mb-1">
                  Your first name
                </label>
                <input
                  id="customer-name"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    setError('');
                  }}
                  autoComplete="given-name"
                  placeholder="How should we greet you?"
                  className="w-full h-12 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-3 text-sm outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
                />
              </div>

              <div>
                <label htmlFor="customer-otp" className="font-bold text-[#211917] text-xs block mb-1">
                  6-digit OTP
                </label>
                <input
                  id="customer-otp"
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="w-full h-14 rounded-xl border border-[#EADFD6] bg-[#FFFDF9] px-4 text-center text-xl tracking-[0.5em] font-bold outline-none focus:ring-2 focus:ring-[#A30F3B]/25"
                />
              </div>

              <div className="rounded-xl bg-[#FFF0DE] border border-[#E97818]/25 p-3 text-xs text-[#6E0D25]">
                <strong>Frontend demo:</strong> use OTP <strong>{CUSTOMER_DEMO_OTP}</strong>. Connect this adapter to a real SMS provider before production.
              </div>

              {error && <p className="text-xs font-semibold text-red-700">{error}</p>}

              <PrimaryButton type="submit" isLoading={loading} icon={LockKeyhole}>
                Verify and continue
              </PrimaryButton>
            </>
          )}
        </form>

        <p className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-[#8A7971]">
          By continuing, you agree to receive authentication messages and to our privacy and service terms.
        </p>
      </div>
    </main>
  );
};

export default CustomerLoginScreen;
