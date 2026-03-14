import API from "./api";

export const fetchDeductions = async ({
  page = 1,
  limit = 10,
  search = "",
  department = "",
  position = "",
  year = "",
  month = "",
}) => {
  const res = await API.get(`/api/deductions`, {
    params: { page, limit, search, department, position, year, month },
  });
  return res.data;
};

export const searchEmployeesForDeduction = async (query) => {
  const res = await API.get(`/api/deductions/search-employees`, {
    params: { q: query },
  });
  return res.data;
};

export const createDeduction = async (payload) => {
  const res = await API.post(`/api/deductions`, payload);
  return res.data;
};

export const updateDeduction = async (id, payload) => {
  const res = await API.put(`/api/deductions/${id}`, payload);
  return res.data;
};

export const deleteDeduction = async (id) => {
  const res = await API.delete(`/api/deductions/${id}`);
  return res.data;
};
