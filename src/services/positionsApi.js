import API from "./api";

export const fetchPositions = async ({ page = 1, limit = 10, search = "" }) => {
  const res = await API.get(`/api/positions`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const createPosition = async (payload) => {
  const res = await API.post(`/api/positions`, payload);
  return res.data;
};

export const getPositionById = async (id) => {
  const res = await API.get(`/api/positions/${id}`);
  return res.data;
};

export const updatePosition = async (id, payload) => {
  console.log("Updating position with ID:", id, "and payload:", payload);
  const res = await API.put(`/api/positions/${id}`, payload);
  return res.data;
};

export const deletePosition = async (id) => {
  const res = await API.delete(`/api/positions/${id}`);
  return res.data;
};
