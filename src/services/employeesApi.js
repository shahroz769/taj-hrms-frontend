import API from "./api";

export const fetchEmployees = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/employees`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchEmployeeById = async (id) => {
  const res = await API.get(`/api/employees/${id}`);
  return res.data;
};

export const createEmployee = async (formData) => {
  const res = await API.post(`/api/employees`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const updateEmployee = async (id, formData) => {
  const res = await API.put(`/api/employees/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

export const fetchPositionsByDepartment = async (departmentId) => {
  const res = await API.get(`/api/positions/by-department/${departmentId}`);
  return res.data;
};
