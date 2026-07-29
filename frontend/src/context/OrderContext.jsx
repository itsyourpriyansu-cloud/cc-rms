import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getStoredOrder,
  setStoredOrder,
  clearStoredOrder,
  getStoredKitchenOrders,
  setStoredKitchenOrders,
  getStoredAssistanceRequests,
  setStoredAssistanceRequests,
  getStoredWaiterTables,
  setStoredWaiterTables,
  getStoredBillRequests,
  setStoredBillRequests,
  getStoredIssueReport,
  setStoredIssueReport,
  clearStoredIssueReport,
  getStoredCustomerMemory,
  setStoredCustomerMemory,
  clearStoredCustomerMemory,
  getStoredKitchenLoad,
  setStoredKitchenLoad,
  getStoredIssuesList,
  setStoredIssuesList,
  getStoredFeedbacksList,
  setStoredFeedbacksList,
  getStoredUgcSubmissions,
  setStoredUgcSubmissions,
  getStoredRemovalRequests,
  setStoredRemovalRequests,
  getStoredCustomerMembership,
  setStoredCustomerMembership,
  getStoredGuestFlow,
  setStoredGuestFlow,
  getStoredIngredients,
  setStoredIngredients,
  getStoredAuditLogs,
  setStoredAuditLogs,
  getStoredBillsList,
  setStoredBillsList,
  getStoredDishAvailability,
  setStoredDishAvailability,
  getStoredCouponRequests,
  setStoredCouponRequests,
  getStoredCustomerOrders,
  setStoredCustomerOrders,
} from '../utils/storage';
import { useCustomerSession } from './CustomerSessionContext';
import {
  INITIAL_KITCHEN_ORDERS,
  INITIAL_ASSISTANCE_REQUESTS,
  playKitchenChime,
} from '../services/kitchenService';
import {
  INITIAL_WAITER_TABLES,
  INITIAL_BILL_REQUESTS,
} from '../services/waiterService';
import {
  getStoredReceipts,
  setStoredReceipts,
  getStoredRegisterSession,
  setStoredRegisterSession,
  INITIAL_RECEIPTS,
} from '../services/counterService';
import {
  INITIAL_KITCHEN_LOAD,
  INITIAL_PROTOTYPE_ISSUES,
  INITIAL_PROTOTYPE_CUSTOMER_MEMORY,
  INITIAL_PROTOTYPE_FEEDBACKS,
  INITIAL_PROTOTYPE_UGC,
  INITIAL_PROTOTYPE_REMOVAL_REQUESTS,
  INITIAL_PROTOTYPE_CUSTOMER_MEMBERSHIP,
  INITIAL_PROTOTYPE_ORDERS,
  INITIAL_PROTOTYPE_BILLS,
  INITIAL_INGREDIENTS,
  INITIAL_PROTOTYPE_GUEST_FLOW,
  INITIAL_PROTOTYPE_COUPON_REQUESTS,
} from '../data/restaurantPrototypeData';
import { createPrototypeCouponCode, computeExpiryDates } from '../services/couponRequestService';
import { restaurantConfig } from '../config/restaurantConfig';
import { computeDiscountAmount, getCampaignLabel } from '../utils/couponFormatting';

const OrderContext = createContext();

const STAGE_MAP = {
  received: 0,
  preparing: 1,
  ready: 2,
  served: 3,
};

export const OrderProvider = ({ children }) => {
  const { auth } = useCustomerSession();
  const customerPhone = auth?.phone || null;
  const [activeOrder, setActiveOrder] = useState(() => getStoredOrder());
  const [customerOrders, setCustomerOrders] = useState(() =>
    customerPhone ? getStoredCustomerOrders(customerPhone) : []
  );

  useEffect(() => {
    if (!customerPhone) {
      setCustomerOrders([]);
      return;
    }

    const savedOrders = getStoredCustomerOrders(customerPhone);
    if (activeOrder?.customer?.phone && activeOrder.customer.phone !== customerPhone) {
      setActiveOrder(null);
      clearStoredOrder();
      setCustomerOrders(savedOrders);
      return;
    }

    const belongsToCustomer =
      activeOrder?.customer?.phone === customerPhone || !activeOrder?.customer?.phone;
    const nextOrders =
      activeOrder && belongsToCustomer
        ? [activeOrder, ...savedOrders.filter((order) => order.orderId !== activeOrder.orderId)]
        : savedOrders;

    setCustomerOrders(nextOrders);
    setStoredCustomerOrders(customerPhone, nextOrders);
  }, [activeOrder, customerPhone]);

  const [kitchenOrders, setKitchenOrders] = useState(() => {
    const stored = getStoredKitchenOrders();
    return stored && Array.isArray(stored) ? stored : INITIAL_KITCHEN_ORDERS;
  });

  const [assistanceRequests, setAssistanceRequests] = useState(() => {
    const stored = getStoredAssistanceRequests();
    return stored && Array.isArray(stored) ? stored : INITIAL_ASSISTANCE_REQUESTS;
  });

  const [waiterTables, setWaiterTables] = useState(() => {
    const stored = getStoredWaiterTables();
    return stored && Array.isArray(stored) ? stored : INITIAL_WAITER_TABLES;
  });

  const [billRequests, setBillRequests] = useState(() => {
    const stored = getStoredBillRequests();
    return stored && Array.isArray(stored) ? stored : INITIAL_BILL_REQUESTS;
  });

  const [receipts, setReceipts] = useState(() => getStoredReceipts());
  const [registerSession, setRegisterSession] = useState(() => getStoredRegisterSession());
  const [issueReport, setIssueReport] = useState(() => getStoredIssueReport());

  // Consolidated System Systems
  const [kitchenLoad, setKitchenLoad] = useState(() => {
    const stored = getStoredKitchenLoad();
    return stored || INITIAL_KITCHEN_LOAD;
  });

  const [customerMemory, setCustomerMemory] = useState(() => {
    const stored = getStoredCustomerMemory();
    return stored || INITIAL_PROTOTYPE_CUSTOMER_MEMORY;
  });

  const [issuesList, setIssuesList] = useState(() => {
    const stored = getStoredIssuesList();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_ISSUES;
  });

  // Retention & Privacy Connected Systems State
  const [feedbacksList, setFeedbacksList] = useState(() => {
    const stored = getStoredFeedbacksList();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_FEEDBACKS;
  });

  const [ugcSubmissions, setUgcSubmissions] = useState(() => {
    const stored = getStoredUgcSubmissions();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_UGC;
  });

  const [removalRequests, setRemovalRequests] = useState(() => {
    const stored = getStoredRemovalRequests();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_REMOVAL_REQUESTS;
  });

  const [customerMembership, setCustomerMembership] = useState(() => {
    const stored = getStoredCustomerMembership();
    return stored || INITIAL_PROTOTYPE_CUSTOMER_MEMBERSHIP;
  });

  const [couponRequests, setCouponRequests] = useState(() => {
    const stored = getStoredCouponRequests();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_COUPON_REQUESTS;
  });

  useEffect(() => {
    setStoredCouponRequests(couponRequests);
  }, [couponRequests]);

  useEffect(() => {
    setStoredFeedbacksList(feedbacksList);
  }, [feedbacksList]);

  useEffect(() => {
    setStoredUgcSubmissions(ugcSubmissions);
  }, [ugcSubmissions]);

  useEffect(() => {
    setStoredRemovalRequests(removalRequests);
  }, [removalRequests]);

  useEffect(() => {
    setStoredCustomerMembership(customerMembership);
  }, [customerMembership]);

  useEffect(() => {
    setStoredKitchenLoad(kitchenLoad);
  }, [kitchenLoad]);

  useEffect(() => {
    if (customerMemory) setStoredCustomerMemory(customerMemory);
    else clearStoredCustomerMemory();
  }, [customerMemory]);

  useEffect(() => {
    setStoredIssuesList(issuesList);
  }, [issuesList]);

  useEffect(() => {
    if (issueReport) {
      setStoredIssueReport(issueReport);
    }
  }, [issueReport]);

  useEffect(() => {
    setStoredReceipts(receipts);
  }, [receipts]);

  useEffect(() => {
    setStoredRegisterSession(registerSession);
  }, [registerSession]);

  useEffect(() => {
    if (activeOrder) {
      setStoredOrder(activeOrder);
    }
  }, [activeOrder]);

  // Connected Operational Prototype States
  const [orders, setOrders] = useState(() => {
    const stored = getStoredKitchenOrders();
    return stored && Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_PROTOTYPE_ORDERS;
  });

  const [guestFlow, setGuestFlow] = useState(() => {
    const stored = getStoredGuestFlow();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_GUEST_FLOW;
  });

  const [ingredients, setIngredients] = useState(() => {
    const stored = getStoredIngredients();
    return stored && Array.isArray(stored) ? stored : INITIAL_INGREDIENTS;
  });

  const [bills, setBills] = useState(() => {
    const stored = getStoredBillsList();
    return stored && Array.isArray(stored) ? stored : INITIAL_PROTOTYPE_BILLS;
  });

  const [auditLogs, setAuditLogs] = useState(() => {
    const stored = getStoredAuditLogs();
    return stored && Array.isArray(stored) ? stored : [
      {
        actionId: 'AUD-3001',
        actionType: 'ORDER_ITEM_REJECTED',
        entityId: 'ITEM-1048-02',
        reason: 'Sold Out',
        performedBy: 'Ananya Reddy',
        performedAt: '27 Jul 2026, 7:42 PM',
        note: 'Customer notified with Paneer Biryani alternative suggestion'
      }
    ];
  });

  const [dishAvailability, setDishAvailability] = useState(() => {
    const stored = getStoredDishAvailability();
    return stored || {
      'biryani-chicken-dum': { availabilityStatus: 'AVAILABLE', availableQuantity: 12, dailyLimit: 40, soldQuantityToday: 28, availableAfter: null, linkedIngredients: ['ING-BIRYANI-MASALA'] },
      'biryani-mutton-dum': { availabilityStatus: 'LOW_STOCK', availableQuantity: 4, dailyLimit: 30, soldQuantityToday: 26, availableAfter: null, linkedIngredients: ['ING-CHICKEN'] },
      'mcveg-paneer-butter-masala': { availabilityStatus: 'AVAILABLE', availableQuantity: 15, dailyLimit: 35, soldQuantityToday: 20, availableAfter: null, linkedIngredients: ['ING-PANEER'] },
      'meals-aritaku-veg': { availabilityStatus: 'AVAILABLE', availableQuantity: 20, dailyLimit: 50, soldQuantityToday: 30, availableAfter: null, linkedIngredients: [] },
      'dessert-carrot-halwa': { availabilityStatus: 'AVAILABLE_LATER', availableQuantity: 0, dailyLimit: 25, soldQuantityToday: 25, availableAfter: '7:30 PM', linkedIngredients: ['ING-CARROT'] },
      'drink-sweet-lassi': { availabilityStatus: 'AVAILABLE', availableQuantity: 50, dailyLimit: 100, soldQuantityToday: 50, availableAfter: null, linkedIngredients: [] },
    };
  });

  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [customerAttentionNotice, setCustomerAttentionNotice] = useState(null);

  useEffect(() => {
    setStoredKitchenOrders(orders);
  }, [orders]);

  useEffect(() => {
    setStoredGuestFlow(guestFlow);
  }, [guestFlow]);

  useEffect(() => {
    setStoredIngredients(ingredients);
  }, [ingredients]);

  useEffect(() => {
    setStoredBillsList(bills);
  }, [bills]);

  useEffect(() => {
    setStoredAuditLogs(auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    setStoredDishAvailability(dishAvailability);
  }, [dishAvailability]);

  // Operational Action Handlers
  const logAuditEntry = (actionType, entityId, reason, performedBy = 'Staff', note = '') => {
    const newAudit = {
      actionId: `AUD-${Date.now()}`,
      actionType,
      entityId,
      reason: reason || 'Operation performed',
      performedBy,
      performedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      note
    };
    setAuditLogs(prev => [newAudit, ...prev]);
  };

  const acceptRejectOrderItem = (orderId, orderItemId, action, reason = '', replacementDish = null, newQty = null, staffName = 'Rahul Sharma') => {
    setOrders(prevOrders => prevOrders.map(ord => {
      if (ord.orderId !== orderId) return ord;
      const updatedItems = ord.items.map(it => {
        if (it.orderItemId === orderItemId || it.id === orderItemId) {
          if (action === 'ACCEPT') {
            return { ...it, status: 'ACCEPTED', readinessStatus: 'PREPARING' };
          } else if (action === 'REJECT') {
            return {
              ...it,
              status: 'REJECTED',
              readinessStatus: 'REJECTED',
              rejectionReason: reason,
              suggestedReplacement: replacementDish
            };
          } else if (action === 'CHANGE_QTY' && newQty) {
            return { ...it, quantity: newQty, total: (it.unitPrice || 0) * newQty };
          }
        }
        return it;
      });

      const hasRejected = updatedItems.some(i => i.status === 'REJECTED');
      const allRejected = updatedItems.every(i => i.status === 'REJECTED');
      const orderStatus = allRejected ? 'CANCELLED' : (hasRejected ? 'PARTIALLY_ACCEPTED' : 'ACCEPTED');

      return { ...ord, items: updatedItems, orderStatus };
    }));

    if (action === 'REJECT') {
      const rejectedItem = orders.flatMap(o => o.items).find(i => i.orderItemId === orderItemId || i.id === orderItemId);
      setCustomerAttentionNotice({
        orderId,
        orderItemId,
        itemName: rejectedItem ? rejectedItem.name : 'Item',
        reason,
        suggestedReplacement: replacementDish
      });
      logAuditEntry('ORDER_ITEM_REJECTED', orderItemId, reason, staffName, `Replacement: ${replacementDish ? replacementDish.name : 'None'}`);
    }
  };

  const updateCourseAction = (orderId, orderItemId, courseAction) => {
    setOrders(prev => prev.map(ord => {
      if (ord.orderId !== orderId) return ord;
      const updatedItems = ord.items.map(it => {
        if (it.orderItemId === orderItemId || it.id === orderItemId) {
          const isHold = courseAction === 'HOLD';
          return {
            ...it,
            courseAction,
            status: isHold ? 'QUEUED' : 'PREPARING',
            readinessStatus: isHold ? 'HOLD' : 'PREPARING'
          };
        }
        return it;
      });
      return { ...ord, items: updatedItems };
    }));
  };

  const updateItemDelay = (orderId, orderItemId, delayReason, updatedMinutes) => {
    const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setOrders(prev => prev.map(ord => {
      if (ord.orderId !== orderId) return ord;
      return {
        ...ord,
        isDelayed: true,
        delayReason,
        etaChangeReason: delayReason,
        etaUpdatedAt: nowStr,
        estimatedReadyAt: `${updatedMinutes} PM`
      };
    }));
  };

  const refireOrderItem = (orderId, orderItemId, refireData) => {
    const { reason, quantity, staffName, customerExplanation, discardOriginalItem } = refireData;
    setOrders(prev => prev.map(ord => {
      if (ord.orderId !== orderId) return ord;
      const origItem = ord.items.find(i => i.orderItemId === orderItemId || i.id === orderItemId);
      if (!origItem) return ord;

      const newItemId = `ITEM-REFIRE-${Date.now()}`;
      const refiredItem = {
        ...origItem,
        orderItemId: newItemId,
        id: newItemId,
        quantity,
        status: 'PREPARING',
        readinessStatus: 'PREPARING',
        isRefire: true,
        refireReason: reason,
        refireStaff: staffName,
        refireCustomerExplanation: customerExplanation,
        discardOriginalItem,
        replacementForItemId: orderItemId
      };

      return {
        ...ord,
        items: [...ord.items, refiredItem]
      };
    }));

    logAuditEntry('ORDER_ITEM_REFIRED', orderItemId, reason, staffName || 'Staff', customerExplanation);
  };

  const requestCancelOrder = (orderId, itemId, reason, prepStage = 'PREPARING', staffName = 'Staff') => {
    setOrders(prev => prev.map(ord => {
      if (ord.orderId !== orderId) return ord;
      if (itemId) {
        const updatedItems = ord.items.map(it => {
          if (it.orderItemId === itemId || it.id === itemId) {
            return { ...it, status: 'CANCELLED', readinessStatus: 'CANCELLED', cancellationReason: reason };
          }
          return it;
        });
        return { ...ord, items: updatedItems };
      } else {
        return { ...ord, orderStatus: 'CANCELLED', kitchenStatus: 'CANCELLED', cancellationReason: reason };
      }
    }));

    logAuditEntry('ORDER_CANCELLED', orderId, reason, staffName);
  };

  const splitOrder = (originalOrderId, selectedItemIds) => {
    let newOrder = null;
    setOrders(prev => {
      const orig = prev.find(o => o.orderId === originalOrderId);
      if (!orig) return prev;

      const itemsToKeep = orig.items.filter(i => !selectedItemIds.includes(i.orderItemId || i.id));
      const itemsToMove = orig.items.filter(i => selectedItemIds.includes(i.orderItemId || i.id));

      const newOrderId = `ORD-${Math.floor(1050 + Math.random() * 50)}`;
      const newSubtotal = itemsToMove.reduce((sum, i) => sum + (i.total || (i.unitPrice * i.quantity)), 0);
      const newTax = Math.round(newSubtotal * 0.05);

      newOrder = {
        ...orig,
        orderId: newOrderId,
        kitchenTicketId: `KOT-${newOrderId.split('-')[1]}`,
        billId: `BILL-${newOrderId.split('-')[1]}`,
        items: itemsToMove,
        subtotal: newSubtotal,
        tax: newTax,
        total: newSubtotal + newTax
      };

      const updatedOrigSubtotal = itemsToKeep.reduce((sum, i) => sum + (i.total || (i.unitPrice * i.quantity)), 0);
      const updatedOrigTax = Math.round(updatedOrigSubtotal * 0.05);
      const updatedOrig = {
        ...orig,
        items: itemsToKeep,
        subtotal: updatedOrigSubtotal,
        tax: updatedOrigTax,
        total: updatedOrigSubtotal + updatedOrigTax
      };

      return [...prev.map(o => o.orderId === originalOrderId ? updatedOrig : o), newOrder];
    });

    logAuditEntry('ORDER_SPLIT', originalOrderId, `Moved ${selectedItemIds.length} items to new split order`, 'Staff');
    return newOrder;
  };

  const mergeOrders = (sourceOrderId, destinationOrderId, staffName = 'Staff') => {
    setOrders(prev => {
      const src = prev.find(o => o.orderId === sourceOrderId);
      const dest = prev.find(o => o.orderId === destinationOrderId);
      if (!src || !dest) return prev;

      const mergedItems = [...dest.items, ...src.items];
      const subtotal = mergedItems.reduce((sum, i) => sum + (i.total || (i.unitPrice * i.quantity)), 0);
      const tax = Math.round(subtotal * 0.05);

      const updatedDest = {
        ...dest,
        items: mergedItems,
        subtotal,
        tax,
        total: subtotal + tax
      };

      return prev.filter(o => o.orderId !== sourceOrderId).map(o => o.orderId === destinationOrderId ? updatedDest : o);
    });

    logAuditEntry('ORDERS_MERGED', sourceOrderId, `Merged into ${destinationOrderId}`, staffName);
  };

  const moveOrderTable = (orderId, fromTableId, toTableId, staffName = 'Staff') => {
    const destTableNo = toTableId.replace('TABLE-', '');
    setOrders(prev => prev.map(ord => {
      if (ord.orderId !== orderId) return ord;
      return {
        ...ord,
        tableId: toTableId,
        tableNumber: destTableNo
      };
    }));

    setWaiterTables(prev => prev.map(tbl => {
      if (tbl.tableId === fromTableId) {
        return { ...tbl, status: 'Available', currentOrderId: null };
      }
      if (tbl.tableId === toTableId) {
        return { ...tbl, status: 'Dining', currentOrderId: orderId };
      }
      return tbl;
    }));

    logAuditEntry('MOVE_ORDER', orderId, `Moved from ${fromTableId} to ${toTableId}`, staffName);
  };

  const checkDuplicateOrder = (tableId, cartItems) => {
    const match = orders.find(o => o.tableId === tableId && o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED');
    if (!match) return null;

    const matchNames = match.items.map(i => i.name).sort().join(',');
    const cartNames = cartItems.map(i => i.name).sort().join(',');

    if (matchNames === cartNames) {
      return {
        isDuplicate: true,
        existingOrderId: match.orderId,
        existingTotal: match.total
      };
    }
    return null;
  };

  const queueOfflineOrder = (orderData) => {
    const localId = `LOCAL-${Math.floor(100 + Math.random() * 900)}`;
    const queuedObj = {
      localQueueId: localId,
      tableId: orderData.tableId || 'TABLE-08',
      createdTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: 'Waiting to Sync',
      orderData
    };
    setOfflineQueue(prev => [...prev, queuedObj]);
    return queuedObj;
  };

  const syncOfflineQueue = () => {
    setOfflineQueue(prev => prev.map(item => ({ ...item, status: 'Synced' })));
    setTimeout(() => setOfflineQueue([]), 3000);
  };

  const updateDishAvailability = (dishId, status, extraData = {}, staffName = 'Manager') => {
    setDishAvailability(prev => ({
      ...prev,
      [dishId]: {
        ...prev[dishId],
        availabilityStatus: status,
        ...extraData,
        lastUpdatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        updatedBy: staffName
      }
    }));

    logAuditEntry('OVERRIDE_AVAILABILITY', dishId, `Status updated to ${status}`, staffName);
  };

  const toggleIngredientAvailability = (ingredientId, status = null, staffName = 'Manager') => {
    setIngredients(prev => prev.map(ing => {
      if (ing.ingredientId !== ingredientId) return ing;
      const targetStatus = status || (ing.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE');
      const isUnavail = targetStatus === 'UNAVAILABLE';

      ing.affectedItems.forEach(dishId => {
        updateDishAvailability(dishId, isUnavail ? 'UNAVAILABLE_DUE_TO_INGREDIENT' : 'AVAILABLE', {
          linkedIngredients: [ingredientId]
        }, staffName);
      });

      return { ...ing, status: targetStatus };
    }));

    logAuditEntry('INGREDIENT_AVAILABILITY_CHANGED', ingredientId, `Status: ${status}`, staffName);
  };

  const splitBillEqually = (billId, numberOfGuests) => {
    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;

      const total = b.invoiceTotal || b.amount;
      const baseShare = Math.floor((total / numberOfGuests) * 100) / 100;
      const remainderCents = Math.round((total - baseShare * numberOfGuests) * 100);

      const guestSplits = [];
      for (let i = 0; i < numberOfGuests; i++) {
        const share = i === 0 ? Math.round((baseShare + remainderCents / 100) * 100) / 100 : baseShare;
        guestSplits.push({
          guestLabel: `Guest ${i + 1}`,
          amount: share,
          paid: false
        });
      }

      return {
        ...b,
        splitMode: 'EQUAL',
        splitDetails: { numberOfGuests, guestSplits }
      };
    }));
  };

  const splitBillByItem = (billId, guestAssignments) => {
    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;
      return {
        ...b,
        splitMode: 'BY_ITEM',
        splitDetails: { guestAssignments }
      };
    }));
  };

  const recordPayment = (billId, paymentMethod, amount, payerName = 'Guest') => {
    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;
      const newPaidAmount = (b.paidAmount || 0) + Number(amount);
      const total = b.invoiceTotal || b.amount;
      const balanceDue = Math.max(0, Math.round((total - newPaidAmount) * 100) / 100);

      let paymentStatus = 'UNPAID';
      if (balanceDue === 0) paymentStatus = 'PAID';
      else if (newPaidAmount > 0) paymentStatus = 'PARTIALLY_PAID';

      const reconciliationStatus = balanceDue === 0 ? 'RECONCILED' : 'PARTIALLY_PAID';
      const newRecord = {
        paymentId: `PAY-${Date.now()}`,
        method: paymentMethod,
        amount: Number(amount),
        payerName,
        paidAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };

      return {
        ...b,
        paidAmount: newPaidAmount,
        balanceDue,
        paymentStatus,
        status: balanceDue === 0 ? 'PAID' : 'PENDING_PAYMENT',
        reconciliationStatus,
        reconciliationDifference: balanceDue,
        paymentRecords: [...(b.paymentRecords || []), newRecord]
      };
    }));
  };

  const processRefund = (billId, paymentId, amount, reason, refundMethod = 'ORIGINAL_PAYMENT', staffName = 'Manager') => {
    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;
      const refundRecord = {
        refundId: `REF-${Date.now()}`,
        paymentId,
        amount: Number(amount),
        reason,
        refundMethod,
        status: 'COMPLETED',
        requestedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        approvedBy: staffName
      };

      return {
        ...b,
        reconciliationStatus: 'REFUND_PENDING',
        refundRecords: [...(b.refundRecords || []), refundRecord]
      };
    }));

    logAuditEntry('REFUND', billId, reason, staffName, `Amount: ₹${amount}`);
  };

  const voidBill = (billId, reason, staffName = 'Manager') => {
    const targetBill = bills.find(b => b.billId === billId);
    if (targetBill && (targetBill.paidAmount > 0 || (targetBill.paymentRecords && targetBill.paymentRecords.length > 0))) {
      return { success: false, message: 'This bill has recorded payments. Refund or reverse the payment before voiding the bill.' };
    }

    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;
      return { ...b, isVoided: true, voidReason: reason, voidApprovedBy: staffName, status: 'VOIDED' };
    }));

    logAuditEntry('VOID_BILL', billId, reason, staffName);
    return { success: true };
  };

  const applyDiscount = (billId, discountType, value, reason, staffName = 'Waiter', managerApproved = true) => {
    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;

      let discountAmount = 0;
      if (discountType === 'PERCENT') {
        discountAmount = Math.round((b.subtotal * (value / 100)) * 100) / 100;
      } else {
        discountAmount = Number(value);
      }

      const newSubtotalAfterDisc = Math.max(0, b.subtotal - discountAmount);
      const gst = Math.round(newSubtotalAfterDisc * 0.05 * 100) / 100;
      const invoiceTotal = newSubtotalAfterDisc + (b.packagingCharge || 0) + gst;

      return {
        ...b,
        discount: discountAmount,
        discountReason: reason,
        discountApprovedBy: managerApproved ? staffName : null,
        gst,
        invoiceTotal,
        amount: invoiceTotal,
        balanceDue: invoiceTotal - (b.paidAmount || 0)
      };
    }));

    logAuditEntry('APPLY_DISCOUNT', billId, reason, staffName, `Value: ${value}`);
  };

  const markItemComplimentary = (billId, itemId, reason, approvedBy = 'Manager') => {
    setBills(prev => prev.map(b => {
      if (b.billId !== billId) return b;
      const compRecord = { itemId, reason, approvedBy };
      return {
        ...b,
        compItems: [...(b.compItems || []), compRecord]
      };
    }));

    logAuditEntry('COMPLIMENTARY_ITEM', billId, reason, approvedBy);
  };

  const addReservation = (resData) => {
    const newRes = {
      guestFlowId: `GF-${Math.floor(200 + Math.random() * 800)}`,
      guestType: 'RESERVATION',
      status: 'CONFIRMED',
      expectedWaitMinutes: '0 minutes',
      estimateUpdatedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      ...resData
    };

    const duplicate = guestFlow.find(g => g.guestName.toLowerCase() === resData.guestName.toLowerCase() && g.status !== 'CANCELLED' && g.status !== 'COMPLETED');
    setGuestFlow(prev => [newRes, ...prev]);
    return { newRes, duplicateWarning: duplicate || null };
  };

  const addWalkInGuest = (walkInData) => {
    const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const waitingCount = guestFlow.filter(g => g.status === 'WAITING' || g.status === 'ADDED_TO_QUEUE').length;
    const estimatedMins = `${15 + waitingCount * 5}–${25 + waitingCount * 5} minutes`;

    const newWalkIn = {
      guestFlowId: `GF-${Math.floor(200 + Math.random() * 800)}`,
      guestType: 'WALK_IN',
      status: 'WAITING',
      arrivalTime: nowStr,
      expectedWaitMinutes: estimatedMins,
      estimateUpdatedAt: nowStr,
      ...walkInData
    };

    const duplicate = guestFlow.find(g => g.guestName.toLowerCase() === walkInData.guestName.toLowerCase() && g.status !== 'CANCELLED' && g.status !== 'COMPLETED');
    setGuestFlow(prev => [...prev, newWalkIn]);
    return { newWalkIn, duplicateWarning: duplicate || null };
  };

  const markGuestArrived = (guestFlowId) => {
    const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setGuestFlow(prev => prev.map(g => {
      if (g.guestFlowId !== guestFlowId) return g;
      return { ...g, status: 'ARRIVED', arrivalTime: nowStr };
    }));
  };

  const assignTableToGuest = (guestFlowId, tableId, overrideReason = null) => {
    setGuestFlow(prev => prev.map(g => {
      if (g.guestFlowId !== guestFlowId) return g;
      return { ...g, assignedTableId: tableId, status: 'SEATED', overrideReason };
    }));

    const tableNo = tableId.replace('TABLE-', '');
    setWaiterTables(prev => prev.map(t => {
      if (t.tableId === tableId || t.tableNumber === tableNo) {
        return { ...t, status: 'Dining' };
      }
      return t;
    }));
  };

  const groupTablesForGuest = (guestFlowId, tableIds) => {
    setGuestFlow(prev => prev.map(g => {
      if (g.guestFlowId !== guestFlowId) return g;
      return { ...g, groupedTableIds: tableIds };
    }));
  };

  const markGuestNoShow = (guestFlowId, note = '', staffName = 'Host') => {
    setGuestFlow(prev => prev.map(g => {
      if (g.guestFlowId !== guestFlowId) return g;
      return { ...g, status: 'NO_SHOW', internalNote: note };
    }));

    logAuditEntry('MARK_NO_SHOW', guestFlowId, note, staffName);
  };


  useEffect(() => {
    setStoredAssistanceRequests(assistanceRequests);
  }, [assistanceRequests]);

  useEffect(() => {
    setStoredWaiterTables(waiterTables);
  }, [waiterTables]);

  useEffect(() => {
    setStoredBillRequests(billRequests);
  }, [billRequests]);

  // Kitchen load management
  const updateKitchenLoadStatus = (newStatus) => {
    let customerMessage = 'Kitchen running normally';
    if (newStatus === 'BUSY') customerMessage = 'Kitchen is currently busy. Longer preparation times are expected.';
    else if (newStatus === 'VERY_BUSY') customerMessage = 'Kitchen load is high. Extended prep times across all items.';
    else if (newStatus === 'PAUSED') customerMessage = 'New food orders are temporarily paused by kitchen.';

    setKitchenLoad((prev) => ({
      ...prev,
      status: newStatus,
      customerMessage,
      lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
  };

  // Customer memory handlers
  const saveCustomerMemory = (memoryData) => {
    setCustomerMemory(memoryData);
  };

  const forgetCustomerMemory = () => {
    setCustomerMemory(null);
    clearStoredCustomerMemory();
  };

  // Customer submitting issue with specific category & affected item
  const submitIssue = (data) => {
    const newIssueId = `ISSUE-${Math.floor(200 + Math.random() * 800)}`;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newIssue = {
      issueId: newIssueId,
      orderId: data.orderId || activeOrder?.orderId || 'ORD-1048',
      tableId: data.tableId || 'TABLE-08',
      tableNumber: data.tableNumber || '08',
      category: data.category,
      categoryLabel: data.categoryLabel || data.category,
      affectedItemId: data.affectedItemId || null,
      affectedItemName: data.affectedItemName || 'General Order',
      description: data.description || '',
      priority: data.category === 'ALLERGY_CONCERN' || data.category === 'BILLING_ISSUE' ? 'HIGH' : 'MEDIUM',
      status: 'REPORTED', // REPORTED, ACKNOWLEDGED, OWNER_ASSIGNED, ACTION_IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, REOPENED, CLOSED
      statusLabel: 'Report received',
      reportedAt: timeNow,
      assignedOwner: 'Unassigned',
      assignedRole: null,
      recoveryAction: null,
      customerConfirmed: false,
      resolutionFeedback: null,
      timeline: [
        { time: timeNow, text: `Issue reported by customer (${data.categoryLabel || data.category})` }
      ]
    };

    setIssuesList((prev) => [newIssue, ...prev]);
    playKitchenChime();
    return newIssue;
  };

  // Staff updating issue status & taking ownership
  const updateIssueWorkflow = (issueId, updates) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setIssuesList((prev) =>
      prev.map((iss) => {
        if (iss.issueId === issueId) {
          const newTimeline = [...iss.timeline];
          if (updates.assignedOwner && updates.assignedOwner !== iss.assignedOwner) {
            newTimeline.push({ time: timeNow, text: `Assigned to ${updates.assignedOwner}` });
          }
          if (updates.recoveryAction && updates.recoveryAction !== iss.recoveryAction) {
            newTimeline.push({ time: timeNow, text: `Action set: ${updates.recoveryAction}` });
          }
          if (updates.status && updates.status !== iss.status) {
            newTimeline.push({ time: timeNow, text: `Status changed to ${updates.status}` });
          }

          return {
            ...iss,
            ...updates,
            timeline: newTimeline
          };
        }
        return iss;
      })
    );
  };

  // Customer confirming issue resolution
  const confirmIssueResolution = (issueId, isResolved, feedback = null) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setIssuesList((prev) =>
      prev.map((iss) => {
        if (iss.issueId === issueId) {
          const status = isResolved ? 'RESOLVED' : 'REOPENED';
          const statusLabel = isResolved ? 'Resolved' : 'Reopened by customer';
          const newTimeline = [
            ...iss.timeline,
            { time: timeNow, text: isResolved ? 'Customer confirmed resolution' : 'Customer marked issue as not resolved (Reopened)' }
          ];

          return {
            ...iss,
            status,
            statusLabel,
            customerConfirmed: isResolved,
            resolutionFeedback: feedback,
            timeline: newTimeline
          };
        }
        return iss;
      })
    );
  };

  // Update Item Readiness Status in Active Order / Kitchen Order
  const updateOrderItemReadiness = (orderId, itemId, newReadiness) => {
    if (activeOrder && activeOrder.orderId === orderId) {
      const updatedItems = (activeOrder.items || []).map((it) =>
        it.id === itemId || it.dishId === itemId ? { ...it, readinessStatus: newReadiness } : it
      );
      const updatedOrder = { ...activeOrder, items: updatedItems };
      setActiveOrder(updatedOrder);
      setStoredOrder(updatedOrder);
    }
  };

  // ETA updates with previous estimate and clear reason
  const updateOrderETA = (orderId, newETA, reason) => {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (activeOrder && activeOrder.orderId === orderId) {
      const updated = {
        ...activeOrder,
        previousEstimate: activeOrder.estimatedReadyAt || activeOrder.previousEstimate || '7:38 PM',
        estimatedReadyAt: newETA,
        etaChangeReason: reason,
        etaUpdatedAt: timeNow,
        isDelayed: true
      };
      setActiveOrder(updated);
      setStoredOrder(updated);
    }
  };

  // Handle customer placing a new order -> add to active order & push to kitchen KDS
  const placeOrder = (orderData) => {
    const fullOrder = {
      ...orderData,
      status: 'received',
      stageIndex: 0, // 0: Received, 1: Preparing, 2: Ready, 3: Served
      createdAt: new Date().toISOString(),
      isPaid: Boolean(orderData.isPaid),
      transaction: orderData.transaction || null,
      items: (orderData.items || []).map((it, idx) => ({
        ...it,
        id: it.id || `item-${Date.now()}-${idx}`,
        readinessStatus: 'PREPARING'
      }))
    };

    setActiveOrder(fullOrder);
    setStoredOrder(fullOrder);

    // Convert customer items into kitchen ticket items format
    const kitchenTicketItems = (orderData.items || []).map((item, idx) => {
      let station = 'Main Kitchen Station';
      if (item.category === 'biryanis') station = 'Biryani & Rice Station';
      else if (item.category === 'main_course_veg' || item.category === 'main_course_nonveg') station = 'Curry & Gravy Station';
      else if (item.category === 'nonveg_starters' || item.category === 'chinese_veg_starters' || item.category === 'fish_prawns' || item.category === 'tandoor') station = 'Starter & Tandoor Station';
      else if (item.category === 'desserts' || item.category === 'drinks') station = 'Beverage & Dessert Station';

      return {
        id: `k-item-${Date.now()}-${idx}`,
        dishId: item.dishId || item.id,
        name: item.name,
        quantity: item.quantity,
        station,
        isDone: false,
        selectedOptions: item.selectedOptions || [],
        notes: item.specialInstructions || '',
      };
    });

    const newKitchenOrder = {
      orderId: orderData.orderId || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      tableNumber: orderData.tableNumber || orderData.fulfillment?.type || 'DELIVERY',
      serverName: orderData.fulfillment?.type === 'PICKUP' ? 'Customer Pickup' : 'Direct Delivery',
      guestCount: orderData.guestCount || 1,
      customer: orderData.customer,
      fulfillment: orderData.fulfillment,
      status: 'received',
      isRush: false,
      createdAt: new Date().toISOString(),
      elapsedSeconds: 0,
      specialNotes: orderData.specialNotes || '',
      items: kitchenTicketItems,
    };

    setKitchenOrders((prev) => [newKitchenOrder, ...prev]);

    // Update waiter floor plan table status to 'cooking'
    if (orderData.tableNumber) {
      updateWaiterTableStatus(orderData.tableNumber, 'cooking', {
        activeOrderId: newKitchenOrder.orderId,
        totalBill: orderData.totals?.grandTotal || 0,
      });
    }

    playKitchenChime();
  };

  const updateOrderStatus = (newStatus, stageIndex) => {
    if (!activeOrder) return;
    const updatedStageIdx = stageIndex !== undefined ? stageIndex : (STAGE_MAP[newStatus] ?? activeOrder.stageIndex);
    const updated = {
      ...activeOrder,
      status: newStatus,
      stageIndex: updatedStageIdx,
    };
    setActiveOrder(updated);
    setStoredOrder(updated);

    // Also update corresponding kitchen order if exists
    setKitchenOrders((prev) =>
      prev.map((ko) =>
        ko.orderId === activeOrder.orderId
          ? { ...ko, status: newStatus }
          : ko
      )
    );
  };

  // Kitchen Staff advancing status of an order ticket in KDS
  const updateKitchenOrderStatus = (orderId, newStatus) => {
    let targetTableNo = null;

    setKitchenOrders((prev) =>
      prev.map((ko) => {
        if (ko.orderId === orderId) {
          targetTableNo = ko.tableNumber;
          // If status changes to 'ready' or 'served', mark items done
          const allItemsDone = newStatus === 'ready' || newStatus === 'served';
          const updatedItems = ko.items.map((it) => ({
            ...it,
            isDone: allItemsDone ? true : it.isDone,
          }));
          return { ...ko, status: newStatus, items: updatedItems };
        }
        return ko;
      })
    );

    // Update corresponding floor plan table status
    if (targetTableNo) {
      const tableStatus = newStatus === 'ready' ? 'ready' : newStatus === 'served' ? 'seated' : 'cooking';
      updateWaiterTableStatus(targetTableNo, tableStatus);
    }

    // Synchronize customer active order if matching
    if (activeOrder && activeOrder.orderId === orderId) {
      const stageIndex = STAGE_MAP[newStatus] ?? activeOrder.stageIndex;
      const updatedCustomerOrder = {
        ...activeOrder,
        status: newStatus,
        stageIndex,
      };
      setActiveOrder(updatedCustomerOrder);
      setStoredOrder(updatedCustomerOrder);
    }
  };

  // Waiter updating table status on floor plan
  const updateWaiterTableStatus = (tableNumber, newStatus, extraData = {}) => {
    setWaiterTables((prev) =>
      prev.map((tbl) =>
        tbl.tableNumber === tableNumber
          ? {
              ...tbl,
              status: newStatus,
              guestCount: extraData.guestCount !== undefined ? extraData.guestCount : tbl.guestCount,
              serverName: extraData.serverName || tbl.serverName,
              activeOrderId: extraData.activeOrderId !== undefined ? extraData.activeOrderId : tbl.activeOrderId,
              totalBill: extraData.totalBill !== undefined ? extraData.totalBill : tbl.totalBill,
            }
          : tbl
      )
    );
  };

  // Toggle item completed status within a ticket card
  const toggleKitchenItemDone = (orderId, itemId) => {
    setKitchenOrders((prev) =>
      prev.map((ko) => {
        if (ko.orderId === orderId) {
          const updatedItems = ko.items.map((it) =>
            it.id === itemId ? { ...it, isDone: !it.isDone } : it
          );

          let nextStatus = ko.status;
          if (ko.status === 'received' && updatedItems.some((it) => it.isDone)) {
            nextStatus = 'preparing';
          }

          return { ...ko, items: updatedItems, status: nextStatus };
        }
        return ko;
      })
    );
  };

  // Toggle Rush / Urgent status for a ticket
  const toggleRushOrder = (orderId) => {
    setKitchenOrders((prev) =>
      prev.map((ko) =>
        ko.orderId === orderId ? { ...ko, isRush: !ko.isRush } : ko
      )
    );
  };

  // Customer table assistance call log
  const addAssistanceRequest = (tableNumber, requestType) => {
    const newReq = {
      id: `req-${Date.now()}`,
      tableNumber,
      requestType,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAssistanceRequests((prev) => [newReq, ...prev]);
    updateWaiterTableStatus(tableNumber, 'call_waiter');
    playKitchenChime();
    return newReq;
  };

  const resolveAssistanceRequest = (requestId) => {
    let resolvedTableNo = null;

    setAssistanceRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          resolvedTableNo = req.tableNumber;
          return { ...req, status: 'resolved' };
        }
        return req;
      })
    );

    if (resolvedTableNo) {
      updateWaiterTableStatus(resolvedTableNo, 'seated');
    }
  };

  // Bill Settlement Handlers
  const addBillRequest = (tableNumber, billData = {}) => {
    const newBill = {
      id: `bill-${Date.now()}`,
      tableNumber,
      guestCount: billData.guestCount || 2,
      serverName: billData.serverName || 'Elena Vance',
      subtotal: billData.subtotal || 420.00,
      packagingCharge: billData.packagingCharge || 0,
      tax: billData.tax || billData.gst || 21.00,
      gst: billData.gst || billData.tax || 21.00,
      cgst: billData.cgst || 10.50,
      sgst: billData.sgst || 10.50,
      vat: 0,
      grandTotal: billData.grandTotal || billData.totalPayable || 441.00,
      paymentMethod: billData.paymentMethod || 'UPI / Card',
      splitRequested: billData.splitRequested || false,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    setBillRequests((prev) => [newBill, ...prev]);
    updateWaiterTableStatus(tableNumber, 'bill_requested');
  };

  const settleBillRequest = (billId, tableNumber) => {
    setBillRequests((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, status: 'settled' } : b))
    );
    updateWaiterTableStatus(tableNumber, 'available', {
      guestCount: 0,
      activeOrderId: null,
      totalBill: 0,
      serverName: 'Unassigned',
    });
  };

  const processCounterPayment = (paymentData) => {
    const newReceiptNo = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const timestamp = new Date().toISOString();

    const newReceipt = {
      receiptNo: newReceiptNo,
      orderId: paymentData.orderId || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      tableNumber: paymentData.tableNumber || "Quick Counter",
      serverName: paymentData.serverName || "Marco Rossi",
      cashierName: paymentData.cashierName || registerSession.cashierName || "Marco Rossi",
      timestamp,
      paymentMethod: paymentData.paymentMethod || "Credit Card",
      cardBrand: paymentData.cardBrand,
      referenceNo: paymentData.referenceNo,
      tenderedAmount: paymentData.tenderedAmount,
      changeGiven: paymentData.changeGiven,
      subtotal: paymentData.subtotal || 0,
      packagingCharge: paymentData.packagingCharge || 0,
      tax: paymentData.tax || paymentData.gst || 0,
      gst: paymentData.gst || paymentData.tax || 0,
      cgst: paymentData.cgst || ((paymentData.gst || paymentData.tax || 0) / 2),
      sgst: paymentData.sgst || ((paymentData.gst || paymentData.tax || 0) / 2),
      vat: 0,
      discount: paymentData.discount || 0,
      tip: paymentData.tip || 0,
      grandTotal: paymentData.grandTotal || paymentData.totalPayable || 0,
      status: "paid",
      items: paymentData.items || []
    };

    setReceipts((prev) => [newReceipt, ...prev]);

    setRegisterSession((prev) => {
      let cashInc = 0;
      let cardInc = 0;
      let upiInc = 0;
      if (paymentData.paymentMethod === 'Cash') cashInc = paymentData.grandTotal;
      else if (paymentData.paymentMethod.includes('Card') || paymentData.paymentMethod.includes('Credit')) cardInc = paymentData.grandTotal;
      else upiInc = paymentData.grandTotal;

      return {
        ...prev,
        cashCollected: prev.cashCollected + cashInc,
        cardCollected: prev.cardCollected + cardInc,
        upiCollected: prev.upiCollected + upiInc,
      };
    });

    if (paymentData.billId) {
      settleBillRequest(paymentData.billId, paymentData.tableNumber);
    } else if (paymentData.tableNumber && paymentData.tableNumber !== "Quick Counter") {
      updateWaiterTableStatus(paymentData.tableNumber, 'available', {
        guestCount: 0,
        activeOrderId: null,
        totalBill: 0,
        serverName: 'Unassigned',
      });
    }

    return newReceipt;
  };

  const toggleRegisterDrawer = (openState) => {
    setRegisterSession((prev) => ({
      ...prev,
      isDrawerOpen: openState !== undefined ? openState : !prev.isDrawerOpen
    }));
  };

  const voidOrRefundReceipt = (receiptNo) => {
    setReceipts((prev) =>
      prev.map((r) => (r.receiptNo === receiptNo ? { ...r, status: "refunded" } : r))
    );
  };

  const resetKitchenDemoData = () => {
    setKitchenOrders(INITIAL_KITCHEN_ORDERS);
    setAssistanceRequests(INITIAL_ASSISTANCE_REQUESTS);
    setWaiterTables(INITIAL_WAITER_TABLES);
    setBillRequests(INITIAL_BILL_REQUESTS);
    setReceipts(INITIAL_RECEIPTS);
    setKitchenLoad(INITIAL_KITCHEN_LOAD);
    setIssuesList(INITIAL_PROTOTYPE_ISSUES);
  };

  const markAsPaid = (transactionData) => {
    if (!activeOrder) return;
    const updated = {
      ...activeOrder,
      isPaid: transactionData?.paymentStatus !== 'PAY_ON_DELIVERY',
      paymentStatus: transactionData?.paymentStatus || 'PAID',
      transaction: transactionData,
    };
    setActiveOrder(updated);
    setStoredOrder(updated);
  };

  const clearOrder = () => {
    if (activeOrder && customerPhone) {
      const completedOrder = {
        ...activeOrder,
        status: activeOrder.status === 'delivered' ? 'delivered' : 'completed',
        completedAt: activeOrder.completedAt || new Date().toISOString(),
      };
      const nextOrders = [
        completedOrder,
        ...customerOrders.filter((order) => order.orderId !== activeOrder.orderId),
      ];
      setCustomerOrders(nextOrders);
      setStoredCustomerOrders(customerPhone, nextOrders);
    }
    setActiveOrder(null);
    clearStoredOrder();
  };

  // Legacy single issue report compatibility
  const submitIssueReport = (reportData) => {
    const newReport = {
      id: `ISS-${Math.floor(1000 + Math.random() * 9000)}`,
      category: reportData.category,
      categoryLabel: reportData.categoryLabel,
      details: reportData.details || '',
      orderId: reportData.orderId,
      tableNumber: reportData.tableNumber,
      priority: 'High Priority',
      stageIndex: 0,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };
    setIssueReport(newReport);
    setStoredIssueReport(newReport);
    playKitchenChime();
    return newReport;
  };

  const advanceIssueReportStage = () => {
    setIssueReport((prev) => {
      if (!prev) return prev;
      const nextIdx = Math.min(4, prev.stageIndex + 1);
      const stageIds = ['submitted', 'staff_notified', 'staff_assigned', 'resolving', 'resolved'];
      return { ...prev, stageIndex: nextIdx, status: stageIds[nextIdx] };
    });
  };

  const clearIssueReport = () => {
    setIssueReport(null);
    clearStoredIssueReport();
  };

  // Diagnostic Feedback Handlers
  const addDiagnosticFeedback = (newFeedback) => {
    const feedbackRecord = {
      feedbackId: `FDB-${Math.floor(1000 + Math.random() * 9000)}`,
      submittedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'New',
      ...newFeedback
    };
    setFeedbacksList(prev => [feedbackRecord, ...prev]);
    return feedbackRecord;
  };

  const updateFeedbackStatus = (feedbackId, newStatus, managerNote = '') => {
    setFeedbacksList(prev =>
      prev.map(f =>
        f.feedbackId === feedbackId
          ? { ...f, status: newStatus, managerNotes: managerNote || f.managerNotes }
          : f
      )
    );
  };

  // Customer UGC & Privacy Handlers
  const addUgcSubmission = (submission) => {
    const newSubmission = {
      participationId: `UGC-${Math.floor(1000 + Math.random() * 9000)}`,
      permissionGrantedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      permissionVersion: 'UGC-CONSENT-V1',
      status: 'SUBMITTED',
      ...submission
    };
    setUgcSubmissions(prev => [newSubmission, ...prev]);
    return newSubmission;
  };

  const updateUgcPermission = (participationId, newPermissions) => {
    setUgcSubmissions(prev =>
      prev.map(u =>
        u.participationId === participationId
          ? {
              ...u,
              permissions: { ...u.permissions, ...newPermissions },
              permissionGrantedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            }
          : u
      )
    );
  };

  // Content Removal Handlers
  const addRemovalRequest = (requestData) => {
    const newRequest = {
      requestId: `REM-${Math.floor(100 + Math.random() * 900)}`,
      submittedAt: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'Submitted',
      ...requestData
    };
    setRemovalRequests(prev => [newRequest, ...prev]);
    return newRequest;
  };

  const updateRemovalRequestStatus = (requestId, newStatus, resolutionNote = '') => {
    setRemovalRequests(prev =>
      prev.map(r =>
        r.requestId === requestId
          ? { ...r, status: newStatus, resolutionNote: resolutionNote || r.resolutionNote }
          : r
      )
    );
  };

  // Customer Membership / Guest Benefits Handlers
  const updateCustomerMembership = (updater) => {
    setCustomerMembership(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
  };

  // WhatsApp Coupon Request Handlers (Customer PWA + Manager Portal shared state)
  const nowLabel = () => new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  const updateCouponRequest = (requestId, updaterFn, auditText) => {
    setCouponRequests(prev => prev.map(req => {
      if (req.requestId !== requestId) return req;
      const updated = updaterFn(req);
      const audit = auditText ? [...(req.auditHistory || []), { time: nowLabel(), text: auditText }] : req.auditHistory;
      return { ...req, ...updated, updatedAt: nowLabel(), auditHistory: audit };
    }));
  };

  const getCouponRequestForOrder = (orderId) => {
    return couponRequests.find(r => r.orderReference?.orderId === orderId && r.status !== 'CANCELLED') || null;
  };

  const createCouponRequest = (payload) => {
    const existing = getCouponRequestForOrder(payload.orderReference?.orderId);
    if (existing) return existing;

    const newRequest = {
      requestId: `CPN-REQ-${Math.floor(3000 + Math.random() * 900)}`,
      customer: payload.customer,
      milestone: payload.milestone,
      orderReference: payload.orderReference,
      couponOffer: payload.couponOffer,
      consent: payload.consent,
      whatsapp: { deepLinkOpenedAt: null, customerConfirmedSentAt: null, restaurantConfirmedReceivedAt: null },
      status: 'FORM_STARTED',
      coupon: null,
      declineReason: null,
      declineNote: null,
      createdAt: nowLabel(),
      updatedAt: nowLabel(),
      auditHistory: [{ time: nowLabel(), text: 'Coupon request started by customer' }],
    };

    setCouponRequests(prev => [newRequest, ...prev]);
    return newRequest;
  };

  const markCouponWhatsAppOpened = (requestId) => {
    updateCouponRequest(requestId, (req) => ({
      status: 'WHATSAPP_OPENED',
      whatsapp: { ...req.whatsapp, deepLinkOpenedAt: nowLabel() },
    }), 'Customer opened WhatsApp with prepared message');
  };

  const confirmCouponRequestSent = (requestId) => {
    updateCouponRequest(requestId, (req) => ({
      status: 'CUSTOMER_CONFIRMED_SENT',
      whatsapp: { ...req.whatsapp, customerConfirmedSentAt: nowLabel() },
    }), 'Customer confirmed message sent on WhatsApp');
  };

  const cancelCouponRequest = (requestId) => {
    updateCouponRequest(requestId, () => ({ status: 'CANCELLED' }), 'Customer cancelled the coupon request');
  };

  const managerMarkCouponMessageReceived = (requestId, staffName = 'Manager') => {
    updateCouponRequest(requestId, (req) => ({
      status: 'AWAITING_RESTAURANT_REVIEW',
      whatsapp: { ...req.whatsapp, restaurantConfirmedReceivedAt: nowLabel() },
    }), `Marked WhatsApp message received by ${staffName}`);
  };

  const managerVerifyCouponEligibility = (requestId, staffName = 'Manager') => {
    updateCouponRequest(requestId, () => ({ status: 'VERIFIED' }), `Eligibility verified by ${staffName}`);
  };

  const managerDeclineCouponRequest = (requestId, reason, note = '', staffName = 'Manager') => {
    updateCouponRequest(requestId, () => ({
      status: 'DECLINED',
      declineReason: reason,
      declineNote: note,
    }), `Declined by ${staffName}: ${reason}`);
  };

  const managerIssuePrototypeCoupon = (requestId, staffName = 'Manager') => {
    const request = couponRequests.find(r => r.requestId === requestId);
    if (!request) return null;

    const code = createPrototypeCouponCode({
      restaurantPrefix: 'MGR',
      discountValue: request.couponOffer?.discountValue || 15,
      requestId,
    });
    const issuedAt = nowLabel();
    const { iso: expiresAt, display: validUntil } = computeExpiryDates(new Date(), 30);
    const couponRecord = {
      couponId: `CPN-${requestId.split('-').pop()}`,
      code,
      requestId,
      discountType: request.couponOffer?.discountType || 'PERCENTAGE',
      discountValue: request.couponOffer?.discountValue || 15,
      status: 'ISSUED',
      issuedAt,
      validUntil,
      expiresAt,
      issuedBy: staffName,
      sentAt: null,
      redemption: null,
      revocation: null,
      attributedOrderRevenuePaise: 0,
    };

    updateCouponRequest(requestId, () => ({
      status: 'COUPON_ISSUED',
      coupon: couponRecord,
    }), `Prototype coupon issued: ${code}`);

    return couponRecord;
  };

  const managerMarkCouponSent = (requestId, staffName = 'Manager') => {
    updateCouponRequest(requestId, (req) => ({
      coupon: req.coupon ? { ...req.coupon, sentAt: nowLabel() } : req.coupon,
    }), `Coupon reply marked sent by ${staffName}`);
  };

  const managerMarkCouponReplyOpened = (requestId, staffName = 'Manager') => {
    updateCouponRequest(requestId, () => ({}), `WhatsApp reply opened by ${staffName}`);
  };

  /**
   * Redeems a coupon against a live bill, reusing the existing applyDiscount
   * billing handler for the real GST/discount recalculation rather than
   * re-deriving that math here. Falls back to a reference-only redemption
   * (no live bill recalculation) when the bill isn't found in `bills`.
   */
  const managerRedeemCoupon = (requestId, { billId, note = '', staffName = 'Manager' } = {}) => {
    const request = couponRequests.find(r => r.requestId === requestId);
    if (!request || !request.coupon) return { success: false, message: 'Coupon not found or not yet issued.' };

    const bill = bills.find(b => b.billId === billId || b.orderId === billId);
    let subtotalPaise = 0;
    let discountPaise = 0;
    let finalPayablePaise = 0;

    if (bill) {
      const subtotal = bill.subtotal || 0;
      const discount = computeDiscountAmount(subtotal, request.coupon);
      const applyDiscountType = request.coupon.discountType === 'FLAT' ? 'FLAT' : 'PERCENT';
      const applyDiscountValue = request.coupon.discountType === 'FLAT' ? discount : request.coupon.discountValue;
      applyDiscount(bill.billId, applyDiscountType, applyDiscountValue, `${getCampaignLabel(request.couponOffer)} Coupon Redemption: ${request.coupon.code}`, staffName, true);

      const gstRate = (restaurantConfig.taxStructure.totalRate || 5) / 100;
      const subtotalAfterDiscount = subtotal - discount;
      const gst = Math.round(subtotalAfterDiscount * gstRate * 100) / 100;
      const invoiceTotal = subtotalAfterDiscount + (bill.packagingCharge || 0) + gst;

      subtotalPaise = Math.round(subtotal * 100);
      discountPaise = Math.round(discount * 100);
      finalPayablePaise = Math.round(invoiceTotal * 100);
    }

    const redeemedAt = nowLabel();
    const redemptionRecord = {
      redemptionId: `RED-${Date.now()}`,
      couponId: request.coupon.couponId,
      couponCode: request.coupon.code,
      sourceBillId: bill?.billId || billId || null,
      sourceInvoiceId: request.orderReference.invoiceId,
      sourceOrderId: bill?.orderId || request.orderReference.orderId,
      subtotalPaise,
      discountPaise,
      finalPayablePaise,
      redeemedAt,
      redeemedBy: staffName,
      redemptionChannel: 'MANAGER_PORTAL',
      status: 'COMPLETED',
      note,
    };

    updateCouponRequest(requestId, (req) => ({
      status: 'REDEEMED',
      coupon: {
        ...req.coupon,
        status: 'REDEEMED',
        redemption: redemptionRecord,
        attributedOrderRevenuePaise: finalPayablePaise,
      },
    }), `Coupon redeemed by ${staffName}${redemptionRecord.sourceBillId ? ` on ${redemptionRecord.sourceBillId}` : ''}`);

    return { success: true, redemption: redemptionRecord };
  };

  const managerRevokeCoupon = (requestId, reason, note = '', staffName = 'Manager') => {
    updateCouponRequest(requestId, (req) => ({
      coupon: req.coupon ? {
        ...req.coupon,
        revocation: { reason, note, revokedBy: staffName, revokedAt: nowLabel() },
      } : req.coupon,
    }), `Revoked by ${staffName}: ${reason}`);
  };

  const managerExtendCouponExpiry = (requestId, newExpiryDate, reason, staffName = 'Manager') => {
    updateCouponRequest(requestId, (req) => {
      if (!req.coupon) return {};
      const previousExpiry = req.coupon.expiresAt;
      const newExpiresAt = new Date(newExpiryDate).toISOString();
      const newValidUntil = new Date(newExpiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return {
        coupon: {
          ...req.coupon,
          expiresAt: newExpiresAt,
          validUntil: newValidUntil,
          expiryHistory: [
            ...(req.coupon.expiryHistory || []),
            { previousExpiry, newExpiry: newExpiresAt, changedBy: staffName, changedAt: nowLabel(), reason },
          ],
        },
      };
    }, `Expiry extended by ${staffName}: ${reason}`);
  };

  const managerRevealCouponPhone = (requestId, staffName = 'Manager') => {
    const request = couponRequests.find(r => r.requestId === requestId);
    updateCouponRequest(requestId, () => ({}), `Full phone number revealed by ${staffName}`);
    return request?.customer?.formattedMobile || null;
  };

  const managerWithdrawMarketingConsent = (requestId, staffName = 'Manager') => {
    updateCouponRequest(requestId, (req) => ({
      consent: { ...req.consent, marketingGranted: false, marketingGrantedAt: null },
    }), `Marketing consent withdrawn by ${staffName}`);
  };

  /**
   * Creates and immediately issues a fully custom coupon directly from the
   * Manager Portal — no prior customer WhatsApp request required. Reuses the
   * exact same couponRequests shape as the milestone flow (tagged with
   * origin: 'MANAGER_CREATED') so it's managed identically in the ledger.
   */
  const managerCreateDynamicCoupon = (payload, staffName = 'Manager') => {
    const requestId = `CPN-REQ-${Math.floor(4000 + Math.random() * 900)}`;
    const createdAt = nowLabel();
    const code = createPrototypeCouponCode({
      restaurantPrefix: 'MGR',
      discountValue: payload.discountValue,
      requestId,
    });
    const { iso: expiresAt, display: validUntil } = computeExpiryDates(new Date(), payload.validityDays || 30);

    const newRequest = {
      requestId,
      origin: 'MANAGER_CREATED',
      customer: payload.customer,
      milestone: {
        completedVisits: payload.completedVisits ?? null,
        level: 'MANAGER_ISSUED',
        eligible: true,
        unlockedAt: createdAt,
      },
      orderReference: payload.orderReference,
      couponOffer: {
        campaignId: `CUSTOM-${requestId}`,
        name: payload.campaignName,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
      },
      consent: {
        fulfilmentGranted: true,
        fulfilmentGrantedAt: createdAt,
        marketingGranted: !!payload.marketingGranted,
        marketingGrantedAt: payload.marketingGranted ? createdAt : null,
        consentVersion: 'MANAGER-ISSUED-V1',
        attestedByStaff: true,
      },
      whatsapp: { deepLinkOpenedAt: null, customerConfirmedSentAt: null, restaurantConfirmedReceivedAt: null },
      status: 'COUPON_ISSUED',
      coupon: {
        couponId: `CPN-${requestId.split('-').pop()}`,
        code,
        requestId,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        status: 'ISSUED',
        issuedAt: createdAt,
        validUntil,
        expiresAt,
        issuedBy: staffName,
        sentAt: null,
        redemption: null,
        revocation: null,
        attributedOrderRevenuePaise: 0,
      },
      declineReason: null,
      declineNote: null,
      createdAt,
      updatedAt: createdAt,
      auditHistory: [
        { time: createdAt, text: `Coupon manually created by ${staffName}: ${payload.campaignName}` },
        { time: createdAt, text: `Prototype coupon issued: ${code}` },
      ],
    };

    setCouponRequests(prev => [newRequest, ...prev]);
    return newRequest;
  };

  return (
    <OrderContext.Provider
      value={{
        activeOrder,
        customerOrders,
        placeOrder,
        updateOrderStatus,
        markAsPaid,
        clearOrder,
        kitchenOrders,
        assistanceRequests,
        updateKitchenOrderStatus,
        toggleKitchenItemDone,
        toggleRushOrder,
        addAssistanceRequest,
        resolveAssistanceRequest,
        resetKitchenDemoData,
        waiterTables,
        billRequests,
        updateWaiterTableStatus,
        addBillRequest,
        settleBillRequest,
        receipts,
        registerSession,
        processCounterPayment,
        toggleRegisterDrawer,
        voidOrRefundReceipt,
        issueReport,
        submitIssueReport,
        advanceIssueReportStage,
        clearIssueReport,
        kitchenLoad,
        updateKitchenLoadStatus,
        customerMemory,
        saveCustomerMemory,
        forgetCustomerMemory,
        issuesList,
        submitIssue,
        updateIssueWorkflow,
        confirmIssueResolution,
        updateOrderItemReadiness,
        updateOrderETA,
        // Retention & Privacy Connected Systems Context
        feedbacksList,
        addDiagnosticFeedback,
        updateFeedbackStatus,
        ugcSubmissions,
        addUgcSubmission,
        updateUgcPermission,
        removalRequests,
        addRemovalRequest,
        updateRemovalRequestStatus,
        customerMembership,
        updateCustomerMembership,
        // WhatsApp Coupon Request Prototype Context
        couponRequests,
        getCouponRequestForOrder,
        createCouponRequest,
        markCouponWhatsAppOpened,
        confirmCouponRequestSent,
        cancelCouponRequest,
        managerMarkCouponMessageReceived,
        managerVerifyCouponEligibility,
        managerDeclineCouponRequest,
        managerIssuePrototypeCoupon,
        managerMarkCouponSent,
        managerMarkCouponReplyOpened,
        managerRedeemCoupon,
        managerRevokeCoupon,
        managerExtendCouponExpiry,
        managerRevealCouponPhone,
        managerWithdrawMarketingConsent,
        managerCreateDynamicCoupon,
        // Connected Operational Prototype Context
        orders,
        guestFlow,
        ingredients,
        bills,
        auditLogs,
        dishAvailability,
        isOffline,
        setIsOffline,
        offlineQueue,
        customerAttentionNotice,
        setCustomerAttentionNotice,
        acceptRejectOrderItem,
        updateCourseAction,
        updateItemDelay,
        refireOrderItem,
        requestCancelOrder,
        splitOrder,
        mergeOrders,
        moveOrderTable,
        checkDuplicateOrder,
        queueOfflineOrder,
        syncOfflineQueue,
        updateDishAvailability,
        toggleIngredientAvailability,
        splitBillEqually,
        splitBillByItem,
        recordPayment,
        processRefund,
        voidBill,
        applyDiscount,
        markItemComplimentary,
        addReservation,
        addWalkInGuest,
        markGuestArrived,
        assignTableToGuest,
        groupTablesForGuest,
        markGuestNoShow,
        logAuditEntry,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within OrderProvider');
  }
  return context;
};
