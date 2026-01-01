import API from "./api";

export const fetchShifts = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/shifts`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchShiftsFilters = async () => {
  const res = await API.get(`/api/shifts/filters`);
  return res.data;
};

export const createShift = async (payload) => {
  const res = await API.post(`/api/shifts`, payload);
  return res.data;
};

export const getShiftById = async (id) => {
  const res = await API.get(`/api/shifts/${id}`);
  return res.data;
};

export const updateShift = async (id, payload) => {
  const res = await API.put(`/api/shifts/${id}`, payload);
  return res.data;
};

export const deleteShift = async (id) => {
  const res = await API.delete(`/api/shifts/${id}`);
  return res.data;
};
