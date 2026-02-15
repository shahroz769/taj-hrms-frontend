import API from "./api";

export const fetchDisciplinaryActions = async ({
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get(`/api/disciplinary-actions`, {
    params: { page, limit, search },
  });
  return res.data;
};

export const fetchDisciplinaryActionById = async (id) => {
  const res = await API.get(`/api/disciplinary-actions/${id}`);
  return res.data;
};

export const createDisciplinaryAction = async (payload) => {
  const res = await API.post(`/api/disciplinary-actions`, payload);
  return res.data;
};

export const updateDisciplinaryAction = async (id, payload) => {
  const res = await API.put(`/api/disciplinary-actions/${id}`, payload);
  return res.data;
};

export const toggleDisciplinaryActionStatus = async (id) => {
  const res = await API.patch(`/api/disciplinary-actions/${id}/status`);
  return res.data;
};

export const deleteDisciplinaryAction = async (id) => {
  const res = await API.delete(`/api/disciplinary-actions/${id}`);
  return res.data;
};
