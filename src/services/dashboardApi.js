import API from "./api";

export const fetchDashboardOverview = async ({
  periodType = "monthly",
  year,
  month,
  quarter,
  attendanceView,
  attendanceMonth,
  attendanceWeek,
  payrollYear,
}) => {
  const response = await API.get("/api/dashboard/overview", {
    params: {
      periodType,
      year,
      month,
      quarter,
      attendanceView,
      attendanceMonth,
      attendanceWeek,
      payrollYear,
    },
  });

  return response.data;
};
