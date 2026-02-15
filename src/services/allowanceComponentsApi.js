import API from "./api";

export const fetchAllowanceComponents = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/allowance-components`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchAllowanceComponentsList = async () => {
  const res = await API.get(`/api/allowance-components/list`);
  return res.data;
};

export const createAllowanceComponent = async (payload) => {
  const res = await API.post(`/api/allowance-components`, payload);
  return res.data;
};

export const updateAllowanceComponent = async (id, payload) => {
  const res = await API.put(`/api/allowance-components/${id}`, payload);
  return res.data;
};

export const deleteAllowanceComponent = async (id) => {
  const res = await API.delete(`/api/allowance-components/${id}`);
  return res.data;
};

export const updateAllowanceComponentStatus = async (id, status) => {
  const res = await API.patch(`/api/allowance-components/${id}/status`, { status });
  return res.data;
};
