import API from "./api";

export const fetchLoans = async ({
  page = 1,
  limit = 10,
  search = "",
  department = "",
  position = "",
  status = "",
  year = "",
}) => {
  const res = await API.get(`/api/loans`, {
    params: { page, limit, search, department, position, status, year },
  });
  return res.data;
};

export const searchEmployeesForLoan = async (query) => {
  const res = await API.get(`/api/loans/search-employees`, {
    params: { q: query },
  });
  return res.data;
};

export const fetchLoanDetails = async (id) => {
  const res = await API.get(`/api/loans/${id}`);
  return res.data;
};

export const createLoan = async (payload) => {
  const res = await API.post(`/api/loans`, payload);
  return res.data;
};

export const approveLoan = async (id) => {
  const res = await API.patch(`/api/loans/${id}/approve`);
  return res.data;
};

export const rejectLoan = async (id) => {
  const res = await API.patch(`/api/loans/${id}/reject`);
  return res.data;
};

export const settleLoan = async (id) => {
  const res = await API.patch(`/api/loans/${id}/settle`);
  return res.data;
};

export const deleteLoan = async (id) => {
  const res = await API.delete(`/api/loans/${id}`);
  return res.data;
};
