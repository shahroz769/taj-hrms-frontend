import API from "./api";

export const fetchLeavePolicies = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/leave-policies`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchLeavePoliciesFilters = async () => {
  const res = await API.get(`/api/leave-policies/filters`);
  return res.data;
};

export const createLeavePolicy = async (payload) => {
  const res = await API.post(`/api/leave-policies`, payload);
  return res.data;
};

export const updateLeavePolicy = async (id, payload) => {
  const res = await API.put(`/api/leave-policies/${id}`, payload);
  return res.data;
};

export const deleteLeavePolicy = async (id) => {
  const res = await API.delete(`/api/leave-policies/${id}`);
  return res.data;
};

export const updateLeavePolicyStatus = async (id, status) => {
  const res = await API.patch(`/api/leave-policies/${id}/status`, { status });
  return res.data;
}