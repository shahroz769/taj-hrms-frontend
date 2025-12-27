import API from "./api";

export const fetchDepartments = async () => {
  const res = await API.get(`/api/departments`);
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
  console.log("Updating department with ID:", id, "and payload:", payload);
  const res = await API.put(`/api/departments/${id}`, payload);
  return res.data;
};

export const deleteDepartment = async (id) => {
  const res = await API.delete(`/api/departments/${id}`);
  return res.data;
};
