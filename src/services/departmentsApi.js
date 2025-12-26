import API from "./api";

export const fetchDepartments = async () => {
  const res = await API.get(`/api/departments`);
  return res.data;
};

export const createDepartment = async (payload) => {
  const res = await API.post(`/api/departments`, payload);
  return res.data;
};
