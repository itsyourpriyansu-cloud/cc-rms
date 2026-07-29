export const restaurantConfig = {
  // Brand identity — the single source of truth for restaurant name/branding.
  // Every module should read from here instead of hardcoding restaurant strings.
  id: 'MANGAMMA-RUCHULU',
  tenantId: import.meta.env.VITE_TENANT_ID || 'ten_mangamma01',
  outletId: import.meta.env.VITE_OUTLET_ID || 'out_hyderabad01',
  name: 'Mangamma Ruchulu',
  nativeName: 'మంగమ్మ రుచులు',
  parentCompany: 'Lakshya Foodways',
  parentCompanyLabel: 'A Unit of Lakshya Foodways',
  establishedYear: 2014,

  tagline: 'A Journey of Tradition. A Legacy of Flavour.',

  shortDescription:
    'Since 2014, Lakshya Foodways has served guests with a passion for quality, tradition and heartfelt hospitality. Mangamma Ruchulu brings timeless regional recipes and memorable dining experiences to every table.',

  aboutStory:
    'Since 2014, Lakshya Foodways has been serving guests with a passion for quality, tradition, and heartfelt hospitality. As part of this legacy, Mangamma Ruchulu was created to bring timeless recipes and memorable dining experiences to every table. From our first meal to thousands of happy guests today, our journey has been driven by one simple promise — to serve food that brings people together and creates lasting memories.',

  contact: {
    phone: '8886911773',
    email: 'contact@mangammaruchulu.com',
    website: 'www.mangammaruchulu.com',
    socialHandle: '/mangammaruchulu',
  },

  branding: {
    primaryColor: '#8D1230',
    actionColor: '#E97818',
    backgroundColor: '#FFFDF9',
  },

  countryCode: 'IN',
  countryName: 'India',

  currencyCode: 'INR',
  currencySymbol: '₹',
  currencyLocale: 'en-IN',

  menuPriceDecimals: 0,
  invoicePriceDecimals: 2,

  timezone: 'Asia/Kolkata',
  dateFormat: 'DD MMM YYYY',
  timeFormat: '12-hour',

  taxStructure: {
    taxName: 'GST',
    totalRate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5,
    pricesIncludeTax: false,
  },

  billingPolicy: {
    serviceChargeEnabled: false,
    voluntaryTipEnabled: true,
    defaultTipPercentage: 0,
    tipOptions: [0, 5, 10],
    packagingChargeEnabled: true,
  },

  invoiceRules: {
    documentTitle: 'Tax Invoice',
    invoicePrefix: 'INV',
    gstin: '36ABCDE1234F1Z5',
    fssaiNumber: '12345678901234',
  },

  payrollDisplay: {
    defaultSalaryPeriod: 'month',
    currencyCode: 'INR',
  },

  // WhatsApp coupon-request prototype destination — the restaurant's business
  // number, kept in one place so no component hardcodes it directly.
  whatsapp: {
    countryCode: '91',
    businessNumber: '918886911773',
    displayNumber: '+91 88869 11773',
  },
};
