import API from "./api";

export const fetchDepartments = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/departments`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchDepartmentsList = async () => {
  const res = await API.get(`/api/departments/list`);
  return res.data;
};

export const createDepartment = async (payload) => {
  const res = await API.post(`/api/departments`, payload);
  return res.data;
};

export const getDepartmentById = async (id) => {
  const res = await API.get(`/api/departments/${id}`);
  return res.data;
};

export const updateDepartment = async (id, payload) => {
  const res = await API.put(`/api/departments/${id}`, payload);
  return res.data;
};

export const deleteDepartment = async (id) => {
  const res = await API.delete(`/api/departments/${id}`);
  return res.data;
};
