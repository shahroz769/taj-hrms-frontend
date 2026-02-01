import API from "./api";

export const fetchAttendancesByContract = async (
  contractId,
  { page = 1, limit = 50, startDate = "", endDate = "" }
) => {
  const res = await API.get(`/api/contract-attendances/contract/${contractId}`, {
    params: { page, limit, startDate, endDate },
  });
  return res.data;
};

export const createAttendance = async (payload) => {
  const res = await API.post(`/api/contract-attendances`, payload);
  return res.data;
};

export const getAttendanceById = async (id) => {
  const res = await API.get(`/api/contract-attendances/${id}`);
  return res.data;
};

export const updateAttendance = async (id, payload) => {
  const res = await API.put(`/api/contract-attendances/${id}`, payload);
  return res.data;
};

export const deleteAttendance = async (id) => {
  const res = await API.delete(`/api/contract-attendances/${id}`);
  return res.data;
};
