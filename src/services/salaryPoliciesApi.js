import API from "./api";

export const fetchSalaryPolicies = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/salary-policies`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchSalaryPoliciesList = async () => {
  const res = await API.get(`/api/salary-policies/list`);
  return res.data;
};

export const createSalaryPolicy = async (payload) => {
  const res = await API.post(`/api/salary-policies`, payload);
  return res.data;
};

export const updateSalaryPolicy = async (id, payload) => {
  const res = await API.put(`/api/salary-policies/${id}`, payload);
  return res.data;
};

export const deleteSalaryPolicy = async (id) => {
  const res = await API.delete(`/api/salary-policies/${id}`);
  return res.data;
};

export const updateSalaryPolicyStatus = async (id, status) => {
  const res = await API.patch(`/api/salary-policies/${id}/status`, { status });
  return res.data;
}