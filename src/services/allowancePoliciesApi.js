import API from "./api";

export const fetchAllowancePolicies = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/allowance-policies`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchAllowancePoliciesList = async () => {
  const res = await API.get(`/api/allowance-policies/list`);
  return res.data;
};

export const createAllowancePolicy = async (payload) => {
  const res = await API.post(`/api/allowance-policies`, payload);
  return res.data;
};

export const updateAllowancePolicy = async (id, payload) => {
  const res = await API.put(`/api/allowance-policies/${id}`, payload);
  return res.data;
};

export const deleteAllowancePolicy = async (id) => {
  const res = await API.delete(`/api/allowance-policies/${id}`);
  return res.data;
};

export const updateAllowancePolicyStatus = async (id, status) => {
  const res = await API.patch(`/api/allowance-policies/${id}/status`, { status });
  return res.data;
};
