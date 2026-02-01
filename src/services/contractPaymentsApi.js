import API from "./api";

/**
 * Fetch all payments for a specific contract with pagination
 * @param {string} contractId - Contract ID
 * @param {object} options - Query options (page, limit, startDate, endDate)
 * @returns {Promise} Payment data with pagination
 */
export const fetchPaymentsByContract = async (contractId, options = {}) => {
  const { page = 1, limit = 50, startDate = "", endDate = "" } = options;
  const res = await API.get(`/api/contract-payments/contract/${contractId}`, {
    params: { page, limit, startDate, endDate },
  });
  return res.data;
};

/**
 * Get payment summary for a specific contract
 * @param {string} contractId - Contract ID
 * @returns {Promise} Payment summary data
 */
export const getPaymentSummary = async (contractId) => {
  const res = await API.get(`/api/contract-payments/summary/${contractId}`);
  return res.data;
};

/**
 * Create a new payment record
 * @param {object} payload - Payment data
 * @returns {Promise} Created payment data
 */
export const createPayment = async (payload) => {
  const res = await API.post(`/api/contract-payments`, payload);
  return res.data;
};

/**
 * Get a single payment by ID
 * @param {string} id - Payment ID
 * @returns {Promise} Payment data
 */
export const getPaymentById = async (id) => {
  const res = await API.get(`/api/contract-payments/${id}`);
  return res.data;
};

/**
 * Update an existing payment record
 * @param {string} id - Payment ID
 * @param {object} payload - Updated payment data
 * @returns {Promise} Updated payment data
 */
export const updatePayment = async (id, payload) => {
  const res = await API.put(`/api/contract-payments/${id}`, payload);
  return res.data;
};

/**
 * Delete a payment record
 * @param {string} id - Payment ID
 * @returns {Promise} Deletion confirmation
 */
export const deletePayment = async (id) => {
  const res = await API.delete(`/api/contract-payments/${id}`);
  return res.data;
};
