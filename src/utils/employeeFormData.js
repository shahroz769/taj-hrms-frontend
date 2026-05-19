export const ACCEPTED_EMPLOYEE_IMAGE_TYPES =
  "image/jpeg,image/jpg,image/png,image/webp";

const ACCEPTED_EMPLOYEE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const JSON_FORM_KEYS = new Set([
  "emergencyContact",
  "education",
  "previousExperience",
  "guarantor",
  "references",
  "medical",
  "legal",
  "allowances",
]);

const OPTIONAL_ARRAY_KEYS = {
  education: ["qualification", "institute", "grades", "status"],
  previousExperience: ["company", "position", "from", "to", "lastSalary"],
};

export const isAcceptedEmployeeImageFile = (file) =>
  file instanceof File && ACCEPTED_EMPLOYEE_IMAGE_MIME_TYPES.has(file.type);

const hasValue = (value) => {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  return value !== undefined && value !== null && String(value).trim() !== "";
};

const removeEmptyOptionalRows = (key, value) => {
  const fields = OPTIONAL_ARRAY_KEYS[key];
  if (!fields || !Array.isArray(value)) {
    return value;
  }

  return value.filter((row) => fields.some((field) => hasValue(row?.[field])));
};

const appendValue = (formData, key, value) => {
  if (value === undefined || value === null) {
    return;
  }

  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      formData.append(key, value.toISOString());
    }
    return;
  }

  formData.append(key, value);
};

export const buildEmployeeFormData = ({
  data,
  leaveMethod = "Fixed",
  employeePictureFile,
  cnicFrontFile,
  cnicBackFile,
  guarantorDocFiles = [],
}) => {
  const formData = new FormData();
  const expandedEntitlements = (data.leaveEntitlements || [])
    .filter((entry) => entry.enabled)
    .map((entry) => ({
      leaveType: entry.leaveType,
      enabled: true,
      annualDays: Number(entry.annualDays) || 0,
      method: leaveMethod || "Fixed",
    }));

  Object.keys(data).forEach((key) => {
    if (key === "department" || key === "leaveMethod") {
      return;
    }

    if (key === "leaveEntitlements") {
      formData.append("leaveEntitlements", JSON.stringify(expandedEntitlements));
      return;
    }

    if (JSON_FORM_KEYS.has(key)) {
      formData.append(key, JSON.stringify(removeEmptyOptionalRows(key, data[key])));
      return;
    }

    appendValue(formData, key, data[key]);
  });

  if (!data.leaveEntitlements) {
    formData.append("leaveEntitlements", JSON.stringify(expandedEntitlements));
  }

  if (employeePictureFile instanceof File) {
    formData.append("employeePicture", employeePictureFile);
  }
  if (cnicFrontFile instanceof File) {
    formData.append("cnicFront", cnicFrontFile);
  }
  if (cnicBackFile instanceof File) {
    formData.append("cnicBack", cnicBackFile);
  }

  const docIndices = [];
  (data.guarantor || []).forEach((_, index) => {
    const file = guarantorDocFiles[index];
    if (file instanceof File) {
      formData.append("guarantorDocuments", file);
      docIndices.push(index);
    }
  });
  if (docIndices.length > 0) {
    formData.append("guarantorDocumentIndices", JSON.stringify(docIndices));
  }

  return formData;
};
