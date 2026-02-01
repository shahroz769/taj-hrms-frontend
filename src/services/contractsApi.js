import API from "./api";

export const fetchContracts = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "",
}) => {
  const res = await API.get(`/api/contracts`, {
    params: { page, limit, search, status },
  });
  return res.data;
};

export const fetchContractsList = async () => {
  const res = await API.get(`/api/contracts/list`);
  return res.data;
};

export const createContract = async (payload) => {
  const res = await API.post(`/api/contracts`, payload);
  return res.data;
};

export const getContractById = async (id) => {
  const res = await API.get(`/api/contracts/${id}`);
  return res.data;
};

export const updateContract = async (id, payload) => {
  const res = await API.put(`/api/contracts/${id}`, payload);
  return res.data;
};

export const updateContractStatus = async (id, status) => {
  const res = await API.patch(`/api/contracts/${id}/status`, { status });
  return res.data;
};

export const deleteContract = async (id) => {
  const res = await API.delete(`/api/contracts/${id}`);
  return res.data;
};
