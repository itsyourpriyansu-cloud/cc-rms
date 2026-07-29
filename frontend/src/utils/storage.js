const CART_KEY = 'tbv_restaurant_cart';
const TABLE_KEY = 'tbv_restaurant_table';
const ACTIVE_ORDER_KEY = 'tbv_restaurant_active_order';
const KITCHEN_ORDERS_KEY = 'tbv_restaurant_kitchen_orders';
const ASSISTANCE_KEY = 'tbv_restaurant_assistance_requests';
const KITCHEN_AUTH_KEY = 'tbv_restaurant_kitchen_auth';
const WAITER_TABLES_KEY = 'tbv_restaurant_waiter_tables';
const BILL_REQUESTS_KEY = 'tbv_restaurant_bill_requests';
const KITCHEN_PREFS_KEY = 'tbv_restaurant_kitchen_prefs';
const ISSUE_REPORT_KEY = 'tbv_restaurant_issue_report';
const CUSTOMER_AUTH_KEY = 'rms_customer_auth';
const CUSTOMER_PROFILES_KEY = 'rms_customer_profiles';
const CUSTOMER_FULFILLMENT_KEY = 'rms_customer_fulfillment';
const CUSTOMER_FAVOURITES_KEY = 'rms_customer_favourites';
const CUSTOMER_ORDERS_KEY = 'rms_customer_orders';

const readJson = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage`, error);
  }
};

export const getStoredCustomerAuth = () => readJson(CUSTOMER_AUTH_KEY);

export const setStoredCustomerAuth = (auth) => writeJson(CUSTOMER_AUTH_KEY, auth);

export const clearStoredCustomerAuth = () => {
  try {
    localStorage.removeItem(CUSTOMER_AUTH_KEY);
  } catch (error) {
    console.error('Error clearing customer authentication', error);
  }
};

export const getStoredCustomerProfile = (phone) => {
  const profiles = readJson(CUSTOMER_PROFILES_KEY, {});
  return profiles[phone] || null;
};

export const setStoredCustomerProfile = (phone, profile) => {
  const profiles = readJson(CUSTOMER_PROFILES_KEY, {});
  writeJson(CUSTOMER_PROFILES_KEY, {
    ...profiles,
    [phone]: profile,
  });
};

export const getStoredCustomerFulfillment = (phone) => {
  const records = readJson(CUSTOMER_FULFILLMENT_KEY, {});
  return records[phone] || null;
};

export const setStoredCustomerFulfillment = (phone, fulfillment) => {
  const records = readJson(CUSTOMER_FULFILLMENT_KEY, {});
  writeJson(CUSTOMER_FULFILLMENT_KEY, {
    ...records,
    [phone]: fulfillment,
  });
};

export const getStoredCustomerFavourites = (phone) => {
  const records = readJson(CUSTOMER_FAVOURITES_KEY, {});
  return Array.isArray(records[phone]) ? records[phone] : [];
};

export const setStoredCustomerFavourites = (phone, dishIds) => {
  const records = readJson(CUSTOMER_FAVOURITES_KEY, {});
  writeJson(CUSTOMER_FAVOURITES_KEY, {
    ...records,
    [phone]: dishIds,
  });
};

export const getStoredCustomerOrders = (phone) => {
  const records = readJson(CUSTOMER_ORDERS_KEY, {});
  return Array.isArray(records[phone]) ? records[phone] : [];
};

export const setStoredCustomerOrders = (phone, orders) => {
  const records = readJson(CUSTOMER_ORDERS_KEY, {});
  writeJson(CUSTOMER_ORDERS_KEY, {
    ...records,
    [phone]: orders,
  });
};

export const getStoredCart = () => {
  try {
    const item = localStorage.getItem(CART_KEY);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error("Error reading cart from localStorage", e);
    return [];
  }
};

export const setStoredCart = (cartItems) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
  } catch (e) {
    console.error("Error writing cart to localStorage", e);
  }
};

export const clearStoredCart = () => {
  try {
    localStorage.removeItem(CART_KEY);
  } catch (e) {
    console.error("Error clearing cart from localStorage", e);
  }
};

export const getStoredTable = () => {
  try {
    return localStorage.getItem(TABLE_KEY) || '05';
  } catch (e) {
    return '05';
  }
};

export const setStoredTable = (tableNo) => {
  try {
    localStorage.setItem(TABLE_KEY, tableNo);
  } catch (e) {
    console.error("Error saving table to localStorage", e);
  }
};

export const getStoredOrder = () => {
  try {
    const item = localStorage.getItem(ACTIVE_ORDER_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredOrder = (orderData) => {
  try {
    localStorage.setItem(ACTIVE_ORDER_KEY, JSON.stringify(orderData));
  } catch (e) {
    console.error("Error saving order to localStorage", e);
  }
};

export const clearStoredOrder = () => {
  try {
    localStorage.removeItem(ACTIVE_ORDER_KEY);
  } catch (e) {
    console.error("Error clearing order from localStorage", e);
  }
};

export const getStoredKitchenOrders = () => {
  try {
    const item = localStorage.getItem(KITCHEN_ORDERS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredKitchenOrders = (orders) => {
  try {
    localStorage.setItem(KITCHEN_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error("Error saving kitchen orders to localStorage", e);
  }
};

export const getStoredAssistanceRequests = () => {
  try {
    const item = localStorage.getItem(ASSISTANCE_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredAssistanceRequests = (requests) => {
  try {
    localStorage.setItem(ASSISTANCE_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Error saving assistance requests to localStorage", e);
  }
};

export const getStoredKitchenAuth = () => {
  try {
    const item = localStorage.getItem(KITCHEN_AUTH_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredKitchenAuth = (authData) => {
  try {
    localStorage.setItem(KITCHEN_AUTH_KEY, JSON.stringify(authData));
  } catch (e) {
    console.error("Error saving kitchen auth to localStorage", e);
  }
};

export const clearStoredKitchenAuth = () => {
  try {
    localStorage.removeItem(KITCHEN_AUTH_KEY);
  } catch (e) {
    console.error("Error clearing kitchen auth from localStorage", e);
  }
};

export const getStoredWaiterTables = () => {
  try {
    const item = localStorage.getItem(WAITER_TABLES_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredWaiterTables = (tables) => {
  try {
    localStorage.setItem(WAITER_TABLES_KEY, JSON.stringify(tables));
  } catch (e) {
    console.error("Error saving waiter tables to localStorage", e);
  }
};

export const getStoredBillRequests = () => {
  try {
    const item = localStorage.getItem(BILL_REQUESTS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredBillRequests = (requests) => {
  try {
    localStorage.setItem(BILL_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Error saving bill requests to localStorage", e);
  }
};

export const getStoredKitchenPrefs = () => {
  try {
    const item = localStorage.getItem(KITCHEN_PREFS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredKitchenPrefs = (prefs) => {
  try {
    localStorage.setItem(KITCHEN_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.error("Error saving kitchen prefs to localStorage", e);
  }
};

export const getStoredIssueReport = () => {
  try {
    const item = localStorage.getItem(ISSUE_REPORT_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredIssueReport = (report) => {
  try {
    localStorage.setItem(ISSUE_REPORT_KEY, JSON.stringify(report));
  } catch (e) {
    console.error("Error saving issue report to localStorage", e);
  }
};

export const clearStoredIssueReport = () => {
  try {
    localStorage.removeItem(ISSUE_REPORT_KEY);
  } catch (e) {
    console.error("Error clearing issue report from localStorage", e);
  }
};

const CUSTOMER_MEMORY_KEY = 'tbv_restaurant_customer_memory';
const KITCHEN_LOAD_KEY = 'tbv_restaurant_kitchen_load';
const ISSUES_LIST_KEY = 'tbv_restaurant_issues_list';

export const getStoredCustomerMemory = () => {
  try {
    const item = localStorage.getItem(CUSTOMER_MEMORY_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredCustomerMemory = (memory) => {
  try {
    localStorage.setItem(CUSTOMER_MEMORY_KEY, JSON.stringify(memory));
  } catch (e) {
    console.error("Error saving customer memory to localStorage", e);
  }
};

export const clearStoredCustomerMemory = () => {
  try {
    localStorage.removeItem(CUSTOMER_MEMORY_KEY);
  } catch (e) {
    console.error("Error clearing customer memory", e);
  }
};

export const getStoredKitchenLoad = () => {
  try {
    const item = localStorage.getItem(KITCHEN_LOAD_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredKitchenLoad = (load) => {
  try {
    localStorage.setItem(KITCHEN_LOAD_KEY, JSON.stringify(load));
  } catch (e) {
    console.error("Error saving kitchen load", e);
  }
};

export const getStoredIssuesList = () => {
  try {
    const item = localStorage.getItem(ISSUES_LIST_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredIssuesList = (issues) => {
  try {
    localStorage.setItem(ISSUES_LIST_KEY, JSON.stringify(issues));
  } catch (e) {
    console.error("Error saving issues list", e);
  }
};

const FEEDBACKS_LIST_KEY = 'tbv_restaurant_feedbacks_list';
const UGC_SUBMISSIONS_KEY = 'tbv_restaurant_ugc_submissions';
const REMOVAL_REQUESTS_KEY = 'tbv_restaurant_removal_requests';
const CUSTOMER_MEMBERSHIP_KEY = 'tbv_restaurant_customer_membership';

export const getStoredFeedbacksList = () => {
  try {
    const item = localStorage.getItem(FEEDBACKS_LIST_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredFeedbacksList = (list) => {
  try {
    localStorage.setItem(FEEDBACKS_LIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Error saving feedbacks list", e);
  }
};

export const getStoredUgcSubmissions = () => {
  try {
    const item = localStorage.getItem(UGC_SUBMISSIONS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredUgcSubmissions = (submissions) => {
  try {
    localStorage.setItem(UGC_SUBMISSIONS_KEY, JSON.stringify(submissions));
  } catch (e) {
    console.error("Error saving UGC submissions", e);
  }
};

export const getStoredRemovalRequests = () => {
  try {
    const item = localStorage.getItem(REMOVAL_REQUESTS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredRemovalRequests = (requests) => {
  try {
    localStorage.setItem(REMOVAL_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Error saving removal requests", e);
  }
};

export const getStoredCustomerMembership = () => {
  try {
    const item = localStorage.getItem(CUSTOMER_MEMBERSHIP_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredCustomerMembership = (membership) => {
  try {
    localStorage.setItem(CUSTOMER_MEMBERSHIP_KEY, JSON.stringify(membership));
  } catch (e) {
    console.error("Error saving customer membership", e);
  }
};

const GUEST_FLOW_KEY = 'tbv_restaurant_guest_flow';
const INGREDIENTS_KEY = 'tbv_restaurant_ingredients';
const AUDIT_LOGS_KEY = 'tbv_restaurant_audit_logs';
const BILLS_LIST_KEY = 'tbv_restaurant_bills_list';
const DISH_AVAILABILITY_KEY = 'tbv_restaurant_dish_availability';

export const getStoredGuestFlow = () => {
  try {
    const item = localStorage.getItem(GUEST_FLOW_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredGuestFlow = (flow) => {
  try {
    localStorage.setItem(GUEST_FLOW_KEY, JSON.stringify(flow));
  } catch (e) {
    console.error("Error saving guest flow", e);
  }
};

export const getStoredIngredients = () => {
  try {
    const item = localStorage.getItem(INGREDIENTS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredIngredients = (ingredients) => {
  try {
    localStorage.setItem(INGREDIENTS_KEY, JSON.stringify(ingredients));
  } catch (e) {
    console.error("Error saving ingredients", e);
  }
};

export const getStoredAuditLogs = () => {
  try {
    const item = localStorage.getItem(AUDIT_LOGS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredAuditLogs = (logs) => {
  try {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Error saving audit logs", e);
  }
};

export const getStoredBillsList = () => {
  try {
    const item = localStorage.getItem(BILLS_LIST_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredBillsList = (bills) => {
  try {
    localStorage.setItem(BILLS_LIST_KEY, JSON.stringify(bills));
  } catch (e) {
    console.error("Error saving bills list", e);
  }
};

export const getStoredDishAvailability = () => {
  try {
    const item = localStorage.getItem(DISH_AVAILABILITY_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredDishAvailability = (avail) => {
  try {
    localStorage.setItem(DISH_AVAILABILITY_KEY, JSON.stringify(avail));
  } catch (e) {
    console.error("Error saving dish availability", e);
  }
};

const COUPON_REQUESTS_KEY = 'tbv_restaurant_coupon_requests';

export const getStoredCouponRequests = () => {
  try {
    const item = localStorage.getItem(COUPON_REQUESTS_KEY);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredCouponRequests = (requests) => {
  try {
    localStorage.setItem(COUPON_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Error saving coupon requests", e);
  }
};




