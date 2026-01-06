import API from "./api";

export const fetchSalaryComponents = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/salary-components`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchSalaryComponentsList = async () => {
  const res = await API.get(`/api/salary-components/list`);
  return res.data;
};

export const createSalaryComponent = async (payload) => {
  const res = await API.post(`/api/salary-components`, payload);
  return res.data;
};

export const updateSalaryComponent = async (id, payload) => {
  const res = await API.put(`/api/salary-components/${id}`, payload);
  return res.data;
};

export const deleteSalaryComponent = async (id) => {
  const res = await API.delete(`/api/salary-components/${id}`);
  return res.data;
};

export const updateSalaryComponentStatus = async (id, status) => {
  const res = await API.patch(`/api/salary-components/${id}/status`, { status });
  return res.data;
};
